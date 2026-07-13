# Multiplayer Protocol

## Transport

- Socket.IO for bidirectional room and gameplay traffic.
- Shared Zod schemas in `packages/shared` validate every inbound payload.
- Server emits compact room updates and authoritative snapshots.

## Client events

- `room:create`
  - Zod: `{ playerName: string(2..24) }`
- `room:join`
  - Zod: `{ roomCode: string(6, uppercase), playerName: string(2..24) }`
- `room:ready`
  - Zod: `{ roomCode: string(6), ready: boolean }`
- `room:leave`
  - Zod: `{ roomCode: string(6) }`
- `room:rematch`
  - Zod: `{ roomCode: string(6) }`
- `room:heartbeat`
  - Zod: `{ roomCode: string(6), reconnectToken?: string, pingMs?: int }`
- `room:reconnect`
  - Zod: `{ roomCode: string(6), reconnectToken: string, playerName?: string }`
- `game:input`
  - Zod: `{ roomCode: string(6), input: { seq, clientTime, moveX, moveY, aimX, aimY, shoot, dash } }`
- `client:ping`
  - Zod: `{ sentAt: number }`

## Server events

- `server:welcome`
  - Payload: `{ serverTime: number }`
- `room:created`
  - Payload: `{ roomCode, playerId, reconnectToken, invitationUrl, room }`
- `room:joined`
  - Payload: `{ roomCode, playerId, reconnectToken, invitationUrl, room }`
- `room:update`
  - Payload: `{ room: RoomSummary }`
- `game:countdown`
  - Payload: `{ roomCode, countdownRemainingMs }`
- `game:snapshot`
  - Payload: authoritative `Snapshot`
- `game:event`
  - Payload: `{ type, at, actorId?, targetId?, message? }`
- `server:error`
  - Payload: `{ code, message }`

## Security and correctness

- The client never submits health, score, projectile positions, or round outcomes.
- Sequence numbers gate reconciliation and stale-input rejection.
- Reconnect tokens are room-scoped, opaque, and required to reclaim a disconnected slot.
- Per-socket input rate limiting prevents spam and oversized message abuse.
