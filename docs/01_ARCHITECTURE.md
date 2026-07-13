# Architecture

## Monorepo

- `apps/client`: renders gameplay and UI, collects local input, predicts the local player, interpolates remote players, and reconciles against authoritative snapshots.
- `apps/server`: validates payloads, owns room lifecycle, simulates the match at 30 Hz, emits snapshots at 20 Hz, enforces reconnect, and rate-limits input.
- `packages/shared`: single source of truth for constants, Zod schemas, event names, and deterministic simulation primitives.

## Authoritative loop

1. Client sends normalized input plus sequence number.
2. Server validates payload, rejects stale or excessive input, and stores the latest command per player.
3. Simulation advances at fixed delta.
4. Projectiles, dash cooldowns, health, round transitions, and score all resolve on the server.
5. Server emits snapshots with the authoritative state and the last processed input sequence per player.
6. Client predicts the local player, interpolates the remote player, and reconciles local divergence.

## Room lifecycle

- `create -> join -> ready -> countdown -> active round -> round result -> rematch or match finish`
- Disconnect during active play pauses the round and starts a 15-second reconnect grace timer.
- Expired reconnect awards the round to the connected player and frees the room when the match is finished or abandoned.

## Extensibility

- Room registry is isolated from transport code so Redis-backed room discovery can be added later.
- Match state and reconnect records are explicit objects, enabling persistence or PostgreSQL event storage later without rewriting the domain rules.
