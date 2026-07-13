# Neon Duel Agent Guide

## Scope control

- Keep changes scoped to the active phase from `promp.txt`.
- Do not downgrade the server-authoritative model to client trust.
- Do not duplicate shared event names or payload contracts outside `packages/shared`.

## Verification

- Treat runtime behavior as the source of truth.
- For each phase, update `docs/05_PROGRESS.md` with files changed, commands run, results, and remaining work.
- Save screenshots and final test artifacts under `docs/evidence/`.

## Game rules

- Exactly two players per room.
- Room and match state stay in memory only.
- Reconnect grace is mandatory for networked matches.
- Local practice mode must remain playable without server connectivity.
