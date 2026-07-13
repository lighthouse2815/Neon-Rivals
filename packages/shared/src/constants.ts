export const GAME_CONSTANTS = {
  arenaWidth: 1600,
  arenaHeight: 900,
  maxHealth: 100,
  playerRadius: 24,
  playerSpeed: 320,
  projectileRadius: 10,
  projectileSpeed: 940,
  projectileLifetimeMs: 1400,
  projectileDamage: 20,
  fireCooldownMs: 320,
  dashSpeed: 860,
  dashDurationMs: 140,
  dashCooldownMs: 2200,
  dashTrailIntervalMs: 24,
  roundCountdownMs: 3000,
  roundWinDelayMs: 2200,
  spawnProtectionMs: 1200,
  bestOfRounds: 5,
  winsToFinish: 3,
  simulationTickHz: 30,
  snapshotHz: 20,
  reconnectGraceMs: 15000,
  roomIdleMs: 5 * 60 * 1000,
  heartbeatIntervalMs: 2500,
  heartbeatTimeoutMs: 10000,
  maxInputPerSecond: 60,
  maxMessageBytes: 16384,
  predictionBufferSize: 120,
  interpolationDelayMs: 100
} as const;

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const ROOM_CODE_LENGTH = 6;

export const SPAWN_POINTS = [
  { x: 280, y: 450 },
  { x: 1320, y: 450 }
] as const;

export const PLAYER_COLORS = ["#56f0ff", "#ff4bc8"] as const;
