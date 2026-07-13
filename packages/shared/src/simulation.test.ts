import { describe, expect, it } from "vitest";

import { GAME_CONSTANTS } from "./constants";
import { beginCountdown, stepMatch } from "./simulation";
import type { InputCommand, MatchState } from "./types";
import { createEmptyMatchState, createPlayerState } from "./utils";

const TICK_MS = 1000 / GAME_CONSTANTS.simulationTickHz;

const createActiveMatch = (): {
  match: MatchState;
  createProjectileId: () => string;
} => {
  const match = createEmptyMatchState("TEST01");
  match.players = [createPlayerState("p1", "Pilot One", 0), createPlayerState("p2", "Pilot Two", 1)];
  for (const player of match.players) {
    player.ready = true;
    player.spawnProtectionMs = 0;
  }
  beginCountdown(match, 0);
  let projectileId = 0;
  stepMatch(match, {
    now: GAME_CONSTANTS.roundCountdownMs,
    dtMs: GAME_CONSTANTS.roundCountdownMs,
    inputs: new Map(),
    createProjectileId: () => `projectile-${projectileId++}`
  });
  for (const player of match.players) {
    player.spawnProtectionMs = 0;
  }

  return {
    match,
    createProjectileId: () => `projectile-${projectileId++}`
  };
};

const createInput = (overrides: Partial<InputCommand> = {}): InputCommand => ({
  seq: overrides.seq ?? 0,
  clientTime: overrides.clientTime ?? 0,
  moveX: overrides.moveX ?? 0,
  moveY: overrides.moveY ?? 0,
  aimX: overrides.aimX ?? 1,
  aimY: overrides.aimY ?? 0,
  shoot: overrides.shoot ?? false,
  dash: overrides.dash ?? false
});

describe("shared simulation", () => {
  it("normalizes movement before applying player speed", () => {
    const { match, createProjectileId } = createActiveMatch();
    const player = match.players[0]!;

    stepMatch(match, {
      now: 10,
      dtMs: TICK_MS,
      inputs: new Map([["p1", createInput({ moveX: 3, moveY: 4 })]]),
      createProjectileId
    });

    expect(player.x).toBeCloseTo(280 + GAME_CONSTANTS.playerSpeed * 0.6 * (TICK_MS / 1000), 3);
    expect(player.y).toBeCloseTo(450 + GAME_CONSTANTS.playerSpeed * 0.8 * (TICK_MS / 1000), 3);
  });

  it("enforces shoot cooldowns between projectile spawns", () => {
    const { match, createProjectileId } = createActiveMatch();
    const player = match.players[0]!;
    player.x = 600;
    player.y = 450;

    stepMatch(match, {
      now: 10,
      dtMs: TICK_MS,
      inputs: new Map([["p1", createInput({ shoot: true })]]),
      createProjectileId
    });
    expect(match.projectiles).toHaveLength(1);

    stepMatch(match, {
      now: 20,
      dtMs: TICK_MS,
      inputs: new Map([["p1", createInput({ seq: 1, shoot: true })]]),
      createProjectileId
    });
    expect(match.projectiles).toHaveLength(1);

    for (let index = 0; index < 12; index += 1) {
      stepMatch(match, {
        now: 40 + index * TICK_MS,
        dtMs: TICK_MS,
        inputs: new Map([["p1", createInput({ seq: index + 2, shoot: true })]]),
        createProjectileId
      });
    }

    expect(match.projectiles.length).toBeGreaterThan(1);
  });

  it("applies projectile hits and reduces health", () => {
    const { match, createProjectileId } = createActiveMatch();
    const attacker = match.players[0]!;
    const target = match.players[1]!;
    attacker.x = 600;
    attacker.y = 450;
    target.x = 760;
    target.y = 450;

    stepMatch(match, {
      now: 10,
      dtMs: TICK_MS,
      inputs: new Map([["p1", createInput({ shoot: true })]]),
      createProjectileId
    });

    let hitRegistered = false;
    for (let index = 0; index < 20; index += 1) {
      const result = stepMatch(match, {
        now: 20 + index * TICK_MS,
        dtMs: TICK_MS,
        inputs: new Map(),
        createProjectileId
      });
      if (result.events.some((event) => event.type === "hit")) {
        hitRegistered = true;
        break;
      }
    }

    expect(hitRegistered).toBe(true);
    expect(target.health).toBe(GAME_CONSTANTS.maxHealth - GAME_CONSTANTS.projectileDamage);
  });

  it("completes a round when lethal damage lands", () => {
    const { match, createProjectileId } = createActiveMatch();
    const attacker = match.players[0]!;
    const target = match.players[1]!;
    attacker.x = 600;
    attacker.y = 450;
    target.x = 760;
    target.y = 450;
    target.health = GAME_CONSTANTS.projectileDamage;

    stepMatch(match, {
      now: 10,
      dtMs: TICK_MS,
      inputs: new Map([["p1", createInput({ shoot: true })]]),
      createProjectileId
    });

    for (let index = 0; index < 20; index += 1) {
      stepMatch(match, {
        now: 20 + index * TICK_MS,
        dtMs: TICK_MS,
        inputs: new Map(),
        createProjectileId
      });
      if (match.phase !== "active") {
        break;
      }
    }

    expect(match.phase).toBe("round-over");
    expect(match.winnerId).toBe(attacker.id);
    expect(attacker.score).toBe(1);
  });

  it("completes the match on the third round win", () => {
    const { match, createProjectileId } = createActiveMatch();
    const attacker = match.players[0]!;
    const target = match.players[1]!;
    attacker.score = 2;
    attacker.x = 600;
    attacker.y = 450;
    target.x = 760;
    target.y = 450;
    target.health = GAME_CONSTANTS.projectileDamage;

    stepMatch(match, {
      now: 10,
      dtMs: TICK_MS,
      inputs: new Map([["p1", createInput({ shoot: true })]]),
      createProjectileId
    });

    for (let index = 0; index < 20; index += 1) {
      stepMatch(match, {
        now: 20 + index * TICK_MS,
        dtMs: TICK_MS,
        inputs: new Map(),
        createProjectileId
      });
      if (match.phase !== "active") {
        break;
      }
    }

    expect(match.phase).toBe("match-over");
    expect(match.matchWinnerId).toBe(attacker.id);
    expect(attacker.score).toBe(3);
  });
});
