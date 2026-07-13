import {
  GAME_CONSTANTS,
  PLAYER_COLORS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  SPAWN_POINTS
} from "./constants";
import type {
  InputCommand,
  MatchState,
  PlayerSlot,
  PlayerState,
  RoomSummary,
  Vector2
} from "./types";

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const createRoomCode = (random = Math.random): string => {
  let code = "";
  for (let index = 0; index < ROOM_CODE_LENGTH; index += 1) {
    const alphabetIndex = Math.floor(random() * ROOM_CODE_ALPHABET.length);
    code += ROOM_CODE_ALPHABET[alphabetIndex] ?? ROOM_CODE_ALPHABET[0];
  }
  return code;
};

export const normalizeVector = (x: number, y: number): Vector2 => {
  const length = Math.hypot(x, y);
  if (length === 0) {
    return { x: 0, y: 0 };
  }
  return { x: x / length, y: y / length };
};

export const sanitizeInput = (input: InputCommand): InputCommand => {
  const movement = normalizeVector(input.moveX, input.moveY);
  const aim = normalizeVector(input.aimX, input.aimY);
  return {
    ...input,
    moveX: movement.x,
    moveY: movement.y,
    aimX: aim.x === 0 && aim.y === 0 ? 1 : aim.x,
    aimY: aim.x === 0 && aim.y === 0 ? 0 : aim.y
  };
};

export const createPlayerState = (
  id: string,
  name: string,
  slot: PlayerSlot
): PlayerState => ({
  id,
  name,
  slot,
  x: SPAWN_POINTS[slot].x,
  y: SPAWN_POINTS[slot].y,
  vx: 0,
  vy: 0,
  aimX: slot === 0 ? 1 : -1,
  aimY: 0,
  health: GAME_CONSTANTS.maxHealth,
  score: 0,
  connected: true,
  ready: false,
  pingMs: 0,
  fireCooldownMs: 0,
  dashCooldownMs: 0,
  dashRemainingMs: 0,
  spawnProtectionMs: GAME_CONSTANTS.spawnProtectionMs,
  lastProcessedInputSeq: -1,
  lastDamageAt: 0,
  reconnectDeadlineAt: null
});

export const createEmptyMatchState = (roomCode: string): MatchState => ({
  roomCode,
  phase: "waiting",
  roundNumber: 1,
  countdownRemainingMs: 0,
  roundTimerMs: 0,
  winnerId: null,
  matchWinnerId: null,
  pausedReason: null,
  players: [],
  projectiles: []
});

export const resetPlayersForRound = (players: PlayerState[]): PlayerState[] =>
  players.map((player) => ({
    ...player,
    x: SPAWN_POINTS[player.slot].x,
    y: SPAWN_POINTS[player.slot].y,
    vx: 0,
    vy: 0,
    aimX: player.slot === 0 ? 1 : -1,
    aimY: 0,
    health: GAME_CONSTANTS.maxHealth,
    fireCooldownMs: 0,
    dashCooldownMs: 0,
    dashRemainingMs: 0,
    spawnProtectionMs: GAME_CONSTANTS.spawnProtectionMs,
    reconnectDeadlineAt: player.connected ? null : player.reconnectDeadlineAt
  }));

export const toRoomSummary = (
  match: MatchState,
  invitationUrl: string
): RoomSummary => ({
  roomCode: match.roomCode,
  phase: match.phase,
  canJoin: match.players.length < 2 || match.players.some((player) => !player.connected),
  invitationUrl,
  countdownRemainingMs: match.countdownRemainingMs,
  roundNumber: match.roundNumber,
  players: match.players.map((player) => ({
    id: player.id,
    name: player.name,
    slot: player.slot,
    ready: player.ready,
    connected: player.connected,
    reconnecting: player.reconnectDeadlineAt !== null,
    score: player.score,
    pingMs: player.pingMs
  }))
});

export const getPlayerColor = (slot: PlayerSlot): string => PLAYER_COLORS[slot];

export const clampPosition = (position: Vector2): Vector2 => ({
  x: clamp(
    position.x,
    GAME_CONSTANTS.playerRadius,
    GAME_CONSTANTS.arenaWidth - GAME_CONSTANTS.playerRadius
  ),
  y: clamp(
    position.y,
    GAME_CONSTANTS.playerRadius,
    GAME_CONSTANTS.arenaHeight - GAME_CONSTANTS.playerRadius
  )
});
