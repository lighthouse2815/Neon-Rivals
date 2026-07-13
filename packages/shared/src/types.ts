export type Vector2 = {
  x: number;
  y: number;
};

export type PlayerSlot = 0 | 1;

export type RoundPhase =
  | "waiting"
  | "countdown"
  | "active"
  | "paused"
  | "round-over"
  | "match-over";

export type GameEventType =
  | "shoot"
  | "hit"
  | "dash"
  | "round-win"
  | "match-win"
  | "player-disconnected"
  | "player-reconnected"
  | "reconnect-expired"
  | "countdown-started"
  | "error";

export type InputCommand = {
  seq: number;
  clientTime: number;
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  shoot: boolean;
  dash: boolean;
};

export type PlayerState = {
  id: string;
  name: string;
  slot: PlayerSlot;
  x: number;
  y: number;
  vx: number;
  vy: number;
  aimX: number;
  aimY: number;
  health: number;
  score: number;
  connected: boolean;
  ready: boolean;
  pingMs: number;
  fireCooldownMs: number;
  dashCooldownMs: number;
  dashRemainingMs: number;
  spawnProtectionMs: number;
  lastProcessedInputSeq: number;
  lastDamageAt: number;
  reconnectDeadlineAt: number | null;
};

export type ProjectileState = {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ttlMs: number;
};

export type ReconnectRecord = {
  playerId: string;
  token: string;
  deadlineAt: number;
};

export type MatchState = {
  roomCode: string;
  phase: RoundPhase;
  roundNumber: number;
  countdownRemainingMs: number;
  roundTimerMs: number;
  winnerId: string | null;
  matchWinnerId: string | null;
  pausedReason: string | null;
  players: PlayerState[];
  projectiles: ProjectileState[];
};

export type RoomPlayerSummary = Pick<
  PlayerState,
  "id" | "name" | "slot" | "ready" | "connected" | "score" | "pingMs"
> & {
  reconnecting: boolean;
};

export type RoomSummary = {
  roomCode: string;
  phase: RoundPhase;
  players: RoomPlayerSummary[];
  canJoin: boolean;
  invitationUrl: string;
  countdownRemainingMs: number;
  roundNumber: number;
};

export type RematchRequestedPayload = {
  roomCode: string;
  requesterId: string;
  requesterName: string;
};

export type Snapshot = {
  serverTime: number;
  tick: number;
  roomCode: string;
  state: MatchState;
};

export type ServerGameEvent = {
  type: GameEventType;
  at: number;
  actorId?: string;
  targetId?: string;
  message?: string;
};
