# Progress Log

## Status

- Overall status: complete MVP delivered.
- Product name: `Neon Duel`
- Workspace type: pnpm + Turborepo monorepo with client, server, and shared package.

## Files changed

- Root and tooling:
  - `.gitignore`
  - `package.json`
  - `pnpm-workspace.yaml`
  - `turbo.json`
  - `tsconfig.base.json`
  - `eslint.config.mjs`
  - `prettier.config.mjs`
  - `playwright.config.ts`
  - `scripts/preview-e2e.mjs`
- Documentation:
  - `README.md`
  - `AGENTS.md`
  - `docs/00_GAME_DESIGN.md`
  - `docs/01_ARCHITECTURE.md`
  - `docs/02_MULTIPLAYER_PROTOCOL.md`
  - `docs/03_ASSET_GUIDE.md`
  - `docs/04_TEST_PLAN.md`
  - `docs/05_PROGRESS.md`
  - `docs/evidence/menu.png`
  - `docs/evidence/lobby-two-players.png`
  - `docs/evidence/active-match.png`
  - `docs/evidence/damage-synchronized.png`
  - `docs/evidence/round-result.png`
  - `docs/evidence/reconnect-success.png`
  - `docs/evidence/final-test-results.txt`
- Shared package:
  - `packages/shared/package.json`
  - `packages/shared/tsconfig.json`
  - `packages/shared/src/constants.ts`
  - `packages/shared/src/events.ts`
  - `packages/shared/src/index.ts`
  - `packages/shared/src/schemas.ts`
  - `packages/shared/src/simulation.ts`
  - `packages/shared/src/types.ts`
  - `packages/shared/src/utils.ts`
  - `packages/shared/src/utils.test.ts`
  - `packages/shared/src/simulation.test.ts`
- Server:
  - `apps/server/package.json`
  - `apps/server/tsconfig.json`
  - `apps/server/src/config.ts`
  - `apps/server/src/core/runtime.ts`
  - `apps/server/src/network/create-app.ts`
  - `apps/server/src/index.ts`
  - `apps/server/test/runtime.test.ts`
  - `apps/server/test/integration.test.ts`
- Client:
  - `apps/client/package.json`
  - `apps/client/tsconfig.json`
  - `apps/client/vite.config.ts`
  - `apps/client/index.html`
  - `apps/client/src/main.ts`
  - `apps/client/src/styles.css`
  - `apps/client/src/state.ts`
  - `apps/client/src/state.test.ts`
  - `apps/client/src/app-controller.ts`
  - `apps/client/src/audio/audio-manager.ts`
  - `apps/client/src/network/online-session.ts`
  - `apps/client/src/ui/shell.ts`
  - `apps/client/src/game/assets.ts`
  - `apps/client/src/game/input-controller.ts`
  - `apps/client/src/game/local-practice.ts`
  - `apps/client/src/game/types.ts`
  - `apps/client/src/game/rendering/arena-renderer.ts`
  - `apps/client/src/game/scenes/BootScene.ts`
  - `apps/client/src/game/scenes/MenuScene.ts`
  - `apps/client/src/game/scenes/LobbyScene.ts`
  - `apps/client/src/game/scenes/ArenaScene.ts`
  - `apps/client/src/game/scenes/ResultScene.ts`
  - `apps/client/e2e/multiplayer.spec.ts`

## Functionality completed

- Phase 0:
  - Monorepo scaffolded with shared TS config, ESLint, Prettier, Vitest, Playwright, and Turbo orchestration.
  - Root scripts verified for lint, typecheck, test, build, preview, and E2E.
- Phase 1:
  - Offline playable arena delivered with movement, aim, shooting, dash, health, round loop, HUD, audio, and AI sparring opponent.
- Phase 2:
  - Real two-player private room flow implemented with create, join, ready, countdown, leave, rematch, room summary sync, and two-player cap.
- Phase 3:
  - Server-authoritative simulation implemented for position, projectiles, health, damage, score, and winner resolution.
- Phase 4:
  - Snapshot interpolation, local prediction, reconciliation, sequence numbers, ping updates, and stale-input rejection implemented.
- Phase 5:
  - Reconnect token flow with 15-second grace and reconnect-timeout round award implemented.
- Phase 6:
  - Original procedural neon assets, HUD chrome, particles, impact flashes, screen shake, and responsive overlay UI implemented.
- Phase 7:
  - Two-browser Playwright scenario executed end to end with screenshots and final evidence file saved under `docs/evidence/`.

## Commands executed

- Environment and scaffold:
  - `Get-ChildItem -Force`
  - `Get-Content -Raw promp.txt`
  - `node -v`
  - `pnpm -v`
  - `pnpm install`
  - `pnpm approve-builds --all`
- Quality gates:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`
  - `pnpm test:e2e`
- Targeted verification while fixing issues:
  - `pnpm --filter @neon-duel/shared test`
  - `pnpm --filter @neon-duel/server test`
  - `pnpm exec playwright test apps/client/e2e/multiplayer.spec.ts`
  - `pnpm exec node --input-type=module -` with a Playwright browser probe to verify `Practice Offline` activates `ArenaScene`

## Test results

- `pnpm lint`: passed
- `pnpm typecheck`: passed
- `pnpm test`: passed
- `pnpm build`: passed
- `pnpm test:e2e`: passed
- Server startup: verified through `/health` during preview/E2E run
- Client startup: verified through Vite preview during Playwright run
- Multiplayer verification:
  - Room creation: passed
  - Two-player join: passed
  - Third-player rejection: passed
  - Ready and countdown sync: passed
  - Movement sync: passed
  - Damage sync: passed
  - Match completion: passed
  - Browser reload and reconnect: passed
  - Rematch after completed match: passed

## Bugs found and fixed

- `pnpm` build-script policy blocked `esbuild`; fixed with `pnpm approve-builds --all`.
- Shared simulation tests initially missed hits due to spawn-protection reset; fixed test setup.
- Client `ArenaScene` initially referenced Arcade Physics before it was configured; fixed by enabling Arcade Physics in the Phaser game config.
- Online arena scene was being restarted on every snapshot because navigation was called repeatedly; fixed by making scene navigation idempotent when `view` and `mode` are unchanged.
- Headless Playwright background-tab throttling broke gameplay input on one browser context; fixed E2E by using explicit foreground switching plus a narrow browser-context debug command for authoritative input and rematch events.
- Offline practice initially failed to start because `AppController.navigate()` skipped `game.scene.start("ArenaScene")` when store state was already updated to `view="arena"` and `mode="practice"`; fixed by making the navigation guard compare the actual active Phaser scene before returning.

## Remaining non-MVP limitations

- Rooms and matches are memory-only; restarts drop active sessions.
- Client production bundle is large because Phaser ships in the main chunk.
- E2E debug hooks remain exposed on `window.__NEON_DUEL__` for browser-context verification; acceptable for local MVP, but should be gated or removed before a public production launch.

## Exact local startup instructions

```bash
pnpm install
pnpm dev
```

- Client dev URL: `http://127.0.0.1:4173`
- Server health URL: `http://127.0.0.1:3001/health`

For production-style local verification:

```bash
pnpm build
pnpm preview:e2e
```

## Deployment instructions

- Static client: deploy `apps/client/dist`.
- Node server: deploy `apps/server/dist/index.js` with:
  - `PORT`
  - `HOST`
  - `CLIENT_ORIGIN`
  - `INVITATION_BASE_URL`
- Keep client and server on consistent public origins so invitation URLs and Socket.IO CORS remain aligned.

## Maintenance update 2026-07-13

### Files changed

- `README.md`
- `.gitignore`
- `apps/client/vitest.config.ts`
- `apps/client/tsconfig.json`
- `apps/client/e2e/multiplayer.spec.ts`
- `docs/05_PROGRESS.md`

### Functionality completed

- Rewrote the root `README.md` in Vietnamese with project introduction, prerequisites, detailed local run steps, separate client/server commands, quality-gate commands, environment-variable guidance, multiplayer smoke-test steps, and deployment notes.
- Expanded `.gitignore` so build outputs, caches, logs, local env files, and IDE/OS noise are not staged for GitHub by default.
- Split client unit-test discovery from Playwright E2E by adding `apps/client/vitest.config.ts`, so `pnpm test` no longer loads `apps/client/e2e/multiplayer.spec.ts` inside Vitest.
- Added `vitest.config.ts` to the client TypeScript project so ESLint project-service parsing remains valid.
- Tightened the Playwright flow by bringing the browser pages to the foreground before the initial active-match wait, reducing background-tab ambiguity during multiplayer startup verification.

### Commands executed

- `Get-ChildItem -Force`
- `git status --short --branch`
- `Get-Content -Raw promp.txt`
- `Get-Content -Raw README.md`
- `Get-Content -Raw .gitignore`
- `Get-Content -Raw docs/05_PROGRESS.md`
- `Get-Content -Raw package.json`
- `rg --files`
- `Get-Content -Raw apps/client/package.json`
- `Get-Content -Raw apps/server/package.json`
- `Get-Content -Raw apps/server/src/config.ts`
- `Get-Content -Raw apps/client/vite.config.ts`
- `pnpm --filter @neon-duel/client test`
- `pnpm check`
- `pnpm test:e2e`

### Test results

- `pnpm --filter @neon-duel/client test`: passed after isolating Vitest to `src/**/*.test.ts`.
- `pnpm check`: passed after adding `apps/client/vitest.config.ts` and including it in `apps/client/tsconfig.json`.
- `pnpm test:e2e`: failed twice during the Playwright multiplayer flow.
  - First failure: local port `4173` was already occupied by a stale Vite process from this repo.
  - Second failure after clearing stale processes: timeout at `apps/client/e2e/multiplayer.spec.ts:96` while Browser B waited for `latestMatch.phase === "active"`.

### Bugs found and fixed

- Root `pnpm test` was incorrectly discovering `apps/client/e2e/multiplayer.spec.ts` as a Vitest suite; fixed by adding `apps/client/vitest.config.ts` with `include: ["src/**/*.test.ts"]` and `exclude: ["e2e/**"]`.
- ESLint project-service parsing for the new Vitest config initially failed because the file was outside the client TS project; fixed by adding `vitest.config.ts` to `apps/client/tsconfig.json`.
- `pnpm test:e2e` initially failed before launching because port `4173` was already occupied by a stale client preview/dev process from this workspace; fixed by stopping the stale process and rerunning.

### Remaining work

- Investigate why Browser B in `apps/client/e2e/multiplayer.spec.ts` can still stall before reaching `latestMatch.phase === "active"` under Playwright, even after explicit foreground switching.
- No gameplay or backend feature changes were made in this maintenance update beyond test-configuration and E2E stability adjustments.

## Deployment preparation update 2026-07-13

### Files changed

- `render.yaml`
- `docs/05_PROGRESS.md`
- `docs/evidence/render-deploy-check.png`
- `docs/evidence/cloudflare-deploy-check.png`

### Functionality completed

- Added a Render Blueprint file at the repo root so the backend can be imported from GitHub with build/start commands prefilled.
- Collected live deployment evidence for the current external blockers on Render and Cloudflare.

### Commands executed

- `git remote -v`
- `Get-ChildItem -Force`
- `Get-Content package.json`
- `Get-Content apps/client/package.json`
- `Get-Content apps/server/package.json`
- `Get-Content apps/server/src/config.ts`
- `Get-Content apps/client/src/network/online-session.ts`
- `node --input-type=module -` with a Playwright probe against `https://dashboard.render.com` and `https://dash.cloudflare.com`

### Test results

- Render dashboard probe: reached `https://dashboard.render.com/login` and confirmed login is required before creating a service.
- Cloudflare dashboard probe: reached `https://dash.cloudflare.com/` but was stopped by the anti-bot verification page `Just a moment...`.
- Local artifact capture: screenshots saved successfully under `docs/evidence/`.

### Remaining work

- Render deployment still needs an authenticated dashboard session to import `https://github.com/lighthouse2815/Neon-Rivals`.
- Cloudflare Pages deployment still needs a human-verified browser session to pass the anti-bot check and connect the same GitHub repo.
- After Cloudflare Pages assigns the final frontend URL, Render environment variables must be set to that exact public origin for `CLIENT_ORIGIN` and `INVITATION_BASE_URL`.

## Offline HUD and result-control fix 2026-07-13

### Files changed

- `apps/client/src/app-controller.ts`
- `apps/client/src/game/scenes/ArenaScene.ts`
- `docs/05_PROGRESS.md`

### Bugs found and fixed

- Practice Offline did not set the active local-player ID in UI state, so the enemy HUD selected `Pilot One` twice and showed the player's HP as the bot's HP. `ArenaScene` now publishes the current render frame's `localPlayerId` to the store.
- Result controls could become unclickable because controller navigation started a new Phaser scene without stopping the active `ArenaScene`. The arena kept publishing state every frame and repeatedly replaced the Result DOM. Navigation now stops every non-target active scene before starting the target scene.

### Commands and runtime verification

- `pnpm --filter @neon-duel/client typecheck`: passed.
- `pnpm --filter @neon-duel/client test`: passed (1 test).
- `pnpm --filter @neon-duel/client build`: passed; retained the existing Phaser main-chunk size warning.
- Manual local browser verification at `http://127.0.0.1:4173`:
  - Practice HUD now displays `Pilot One` and `Ghost Mirror` as separate players.
  - After a completed offline match, `Main Menu` returned to the menu screen successfully.
  - `Rematch` was verified to begin a fresh offline round before the scene-navigation cleanup; the cleanup removes the DOM rerender condition that caused result buttons to become unreliable.

## Editable lobby fields fix 2026-07-13

### Files changed

- `apps/client/src/ui/shell.ts`
- `docs/05_PROGRESS.md`

### Bugs found and fixed

- Editing the pilot name or room code triggered a state update that replaced the whole UI root. The replacement detached the focused input after the first keystroke, making name entry appear to close or eject the field.
- The UI shell now records the focused `data-action` input and its selection range before rendering, then restores focus and cursor position on its replacement after rendering.

### Commands and runtime verification

- `pnpm --filter @neon-duel/client typecheck`: passed.
- `pnpm --filter @neon-duel/client test`: passed (1 test).
- Manual local browser verification: typed `Alpha` character by character into `Pilot Name`; the input remained active and retained the full value.

## Practice player-name propagation fix 2026-07-13

### Files changed

- `apps/client/src/app-controller.ts`
- `apps/client/src/game/local-practice.ts`
- `docs/05_PROGRESS.md`

### Bugs found and fixed

- The player name entered in the menu was not used in Practice Offline because the local match always created the human player with the hard-coded name `Pilot One`.
- `LocalPracticeDriver` now obtains the current player name from `AppController` whenever a fresh practice match is created, with `Pilot One` retained only as an empty-name fallback.

### Commands and runtime verification

- `pnpm --filter @neon-duel/client typecheck`: passed.
- `pnpm --filter @neon-duel/client test`: passed (1 test).
- Manual local browser verification: entering `Arena AlphaNeon Pilot` before Practice Offline produced the same name in the local player's HUD; the enemy HUD remained `Ghost Mirror`.

## Arena layout and back-control fix 2026-07-13

### Files changed

- `apps/client/src/game/rendering/arena-renderer.ts`
- `apps/client/src/game/scenes/ArenaScene.ts`
- `apps/client/src/ui/shell.ts`
- `apps/client/src/styles.css`
- `docs/05_PROGRESS.md`

### Functionality completed

- The arena camera now uses the available viewport size and has no restrictive camera bounds, keeping the arena centered instead of pinning it to the top on narrow, tall screens.
- Added a visible `Back to Menu` control while a match is active. It invokes the existing leave/menu flow, so online matches leave their room and practice matches return directly to the menu.
- Limited UI-store synchronization during arena play to 10 Hz while leaving Phaser rendering at full frame rate. This prevents the HUD's DOM replacement from detaching the Back button during an ordinary click.

### Commands and runtime verification

- `pnpm --filter @neon-duel/client lint`: passed.
- `pnpm --filter @neon-duel/client typecheck`: passed.
- `pnpm --filter @neon-duel/client test`: passed (1 test).
- Manual local browser verification: arena displayed centered, `Back to Menu` appeared during Practice Offline, and a standard button click returned to the menu.
