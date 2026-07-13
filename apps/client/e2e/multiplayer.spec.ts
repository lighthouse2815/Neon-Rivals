import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const evidenceDir = path.resolve(process.cwd(), "docs/evidence");

const readState = async (page: Page) =>
  page.evaluate(() => window.__NEON_DUEL__?.getState() ?? null);

const setInputOverride = async (
  page: Page,
  input: {
    moveX: number;
    moveY: number;
    aimX: number;
    aimY: number;
    shoot: boolean;
    dashPressed: boolean;
  } | null
) => {
  await page.evaluate((nextInput) => {
    window.__NEON_DUEL__?.setInputOverride(nextInput);
  }, input);
};

const sendInputCommand = async (
  page: Page,
  input: {
    moveX: number;
    moveY: number;
    aimX: number;
    aimY: number;
    shoot: boolean;
    dashPressed: boolean;
  }
) => {
  await page.evaluate((nextInput) => {
    window.__NEON_DUEL__?.sendInputCommand(nextInput);
  }, input);
};

const requestRematch = async (page: Page) => {
  await page.evaluate(() => {
    window.__NEON_DUEL__?.requestRematch();
  });
};

const waitForMatch = async (
  page: Page,
  predicate: (match: NonNullable<Awaited<ReturnType<typeof readState>>>["latestMatch"]) => boolean,
  timeoutMs = 20_000
) => {
  await expect
    .poll(async () => {
      const state = await readState(page);
      return predicate(state?.latestMatch ?? null);
    }, { timeout: timeoutMs })
    .toBe(true);
};

test("two-browser multiplayer flow with reconnect and rematch", async ({ browser }) => {
  await mkdir(evidenceDir, { recursive: true });

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();

  await pageA.goto("/");
  await pageA.screenshot({ path: path.join(evidenceDir, "menu.png") });

  await pageA.locator('[data-action="player-name"]').fill("Alpha");
  await pageA.locator('[data-action="online"]').click();
  await pageA.locator('[data-action="create-room"]').click();

  await expect(pageA.locator(".room-card__value").first()).toBeVisible();
  const roomCode = ((await readState(pageA))?.room?.roomCode ?? "").trim();
  expect(roomCode).toHaveLength(6);

  await pageB.goto(`/?room=${roomCode}`);
  await pageB.locator('[data-action="player-name"]').fill("Bravo");
  await pageB.locator('[data-action="join-room"]').click();

  await expect
    .poll(async () => ((await readState(pageA))?.room?.players.length ?? 0), { timeout: 10_000 })
    .toBe(2);
  await pageA.screenshot({ path: path.join(evidenceDir, "lobby-two-players.png") });

  await pageA.locator('[data-action="ready"]').click();
  await pageB.locator('[data-action="ready"]').click();

  await pageA.bringToFront();
  await waitForMatch(pageA, (match) => match?.phase === "active");
  await pageB.bringToFront();
  await waitForMatch(pageB, (match) => match?.phase === "active");
  await pageA.bringToFront();
  await pageA.waitForTimeout(300);
  await pageA.screenshot({ path: path.join(evidenceDir, "active-match.png") });

  const alphaAssaultInput = {
    moveX: 1,
    moveY: 0,
    aimX: 1,
    aimY: 0,
    shoot: true,
    dashPressed: false
  };
  await setInputOverride(pageA, alphaAssaultInput);
  await sendInputCommand(pageA, alphaAssaultInput);

  await expect
    .poll(async () => {
      const state = await readState(pageB);
      const match = state?.latestMatch;
      const alpha = match?.players.find((player) => player.name === "Alpha");
      return alpha?.x ?? 0;
    }, { timeout: 10_000 })
    .toBeGreaterThan(280);

  await waitForMatch(
    pageB,
    (match) => Boolean(match?.players.find((player) => player.name === "Bravo" && player.health < 100)),
    12_000
  );
  await pageB.bringToFront();
  await pageB.waitForTimeout(300);
  await pageB.screenshot({ path: path.join(evidenceDir, "damage-synchronized.png") });

  await pageB.reload();
  await waitForMatch(pageB, (match) => match?.players.length === 2 && match.phase !== "waiting", 15_000);
  await pageB.screenshot({ path: path.join(evidenceDir, "reconnect-success.png") });

  await waitForMatch(pageA, (match) => match?.phase === "match-over", 35_000);
  await pageA.bringToFront();
  await pageA.waitForTimeout(300);
  await expect(pageA.locator(".panel__title")).toHaveText("You Win");
  await pageA.screenshot({ path: path.join(evidenceDir, "round-result.png") });

  await setInputOverride(pageA, null);

  await requestRematch(pageB);
  await expect(pageA.locator(".panel__title")).toHaveText("Room Sync");
  await expect(pageB.locator(".panel__title")).toHaveText("Room Sync");
  await expect(pageA.locator(".banner")).toContainText("Bravo wants a rematch");
  await expect(pageB.locator('[data-action="player-name"]')).toHaveValue("Bravo");
  await pageA.screenshot({ path: path.join(evidenceDir, "rematch-request.png") });

  await pageA.locator('[data-action="ready"]').click();
  await waitForMatch(pageA, (match) => match?.phase === "countdown" || match?.phase === "active", 15_000);

  await writeFile(
    path.join(evidenceDir, "final-test-results.txt"),
    [
      "E2E flow completed.",
      `Room: ${roomCode}`,
      "Verified: create room, join room, ready flow, active match, synchronized damage, reconnect, rematch request notification, and player-name persistence."
    ].join("\n"),
    "utf8"
  );

  await contextA.close();
  await contextB.close();
});
