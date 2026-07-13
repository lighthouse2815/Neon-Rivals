import { GAME_CONSTANTS } from "./constants";
import type {
  InputCommand,
  MatchState,
  PlayerState,
  ProjectileState,
  ServerGameEvent
} from "./types";
import { clampPosition, normalizeVector, resetPlayersForRound, sanitizeInput } from "./utils";

export type SimulationContext = {
  now: number;
  dtMs: number;
  inputs: ReadonlyMap<string, InputCommand | undefined>;
  createProjectileId: () => string;
};

export type SimulationResult = {
  events: ServerGameEvent[];
  lastProcessedInputByPlayer: Record<string, number>;
};

const getAlivePlayers = (match: MatchState): PlayerState[] =>
  match.players.filter((player) => player.health > 0);

const expireCooldown = (value: number, dtMs: number): number => Math.max(0, value - dtMs);

const spawnProjectile = (
  player: PlayerState,
  createProjectileId: () => string
): ProjectileState => ({
  id: createProjectileId(),
  ownerId: player.id,
  x: player.x + player.aimX * (GAME_CONSTANTS.playerRadius + GAME_CONSTANTS.projectileRadius + 8),
  y: player.y + player.aimY * (GAME_CONSTANTS.playerRadius + GAME_CONSTANTS.projectileRadius + 8),
  vx: player.aimX * GAME_CONSTANTS.projectileSpeed,
  vy: player.aimY * GAME_CONSTANTS.projectileSpeed,
  ttlMs: GAME_CONSTANTS.projectileLifetimeMs
});

const awardRound = (
  match: MatchState,
  winner: PlayerState,
  now: number,
  result: SimulationResult
): void => {
  winner.score += 1;
  match.winnerId = winner.id;
  match.projectiles = [];

  if (winner.score >= GAME_CONSTANTS.winsToFinish) {
    match.phase = "match-over";
    match.matchWinnerId = winner.id;
    match.countdownRemainingMs = 0;
    result.events.push({
      type: "match-win",
      at: now,
      actorId: winner.id
    });
    return;
  }

  match.phase = "round-over";
  match.countdownRemainingMs = GAME_CONSTANTS.roundWinDelayMs;
  result.events.push({
    type: "round-win",
    at: now,
    actorId: winner.id
  });
};

export const beginCountdown = (match: MatchState, now: number): void => {
  match.phase = "countdown";
  match.players = resetPlayersForRound(match.players);
  match.projectiles = [];
  match.winnerId = null;
  match.matchWinnerId = null;
  match.pausedReason = null;
  match.roundTimerMs = 0;
  match.countdownRemainingMs = GAME_CONSTANTS.roundCountdownMs;
  for (const player of match.players) {
    player.lastDamageAt = now;
  }
};

export const fullyResetMatch = (match: MatchState, now: number): void => {
  for (const player of match.players) {
    player.score = 0;
    player.ready = false;
  }
  match.roundNumber = 1;
  beginCountdown(match, now);
};

export const markPlayerDisconnected = (
  match: MatchState,
  playerId: string,
  reconnectDeadlineAt: number
): void => {
  const player = match.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    return;
  }
  player.connected = false;
  player.ready = false;
  player.reconnectDeadlineAt = reconnectDeadlineAt;
  if (match.phase === "active" || match.phase === "countdown") {
    match.phase = "paused";
    match.pausedReason = "Waiting for reconnection";
  }
};

export const restorePlayerConnection = (match: MatchState, playerId: string): void => {
  const player = match.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    return;
  }
  player.connected = true;
  player.reconnectDeadlineAt = null;
  match.pausedReason = null;
  if (
    match.phase === "paused" &&
    match.players.filter((candidate) => candidate.connected).length === 2
  ) {
    match.phase = "countdown";
    match.countdownRemainingMs = Math.min(match.countdownRemainingMs || 2000, 2000);
  }
};

export const expireReconnect = (
  match: MatchState,
  disconnectedPlayerId: string,
  now: number
): ServerGameEvent[] => {
  const disconnectedPlayer = match.players.find((player) => player.id === disconnectedPlayerId);
  const connectedOpponent = match.players.find(
    (player) => player.id !== disconnectedPlayerId && player.connected
  );

  if (!disconnectedPlayer || !connectedOpponent) {
    return [];
  }

  const result: SimulationResult = {
    events: [],
    lastProcessedInputByPlayer: {}
  };

  awardRound(match, connectedOpponent, now, result);
  result.events.push({
    type: "reconnect-expired",
    at: now,
    actorId: connectedOpponent.id,
    targetId: disconnectedPlayer.id
  });

  if (match.phase === "round-over") {
    match.players = match.players.filter((player) => player.id !== disconnectedPlayerId);
    match.roundNumber += 1;
  }

  return result.events;
};

const movePlayer = (player: PlayerState, input: InputCommand, dtMs: number): void => {
  const speed =
    player.dashRemainingMs > 0 ? GAME_CONSTANTS.dashSpeed : GAME_CONSTANTS.playerSpeed;
  player.vx = input.moveX * speed;
  player.vy = input.moveY * speed;
  const nextPosition = clampPosition({
    x: player.x + player.vx * (dtMs / 1000),
    y: player.y + player.vy * (dtMs / 1000)
  });
  player.x = nextPosition.x;
  player.y = nextPosition.y;
};

const updateProjectile = (projectile: ProjectileState, dtMs: number): ProjectileState => ({
  ...projectile,
  x: projectile.x + projectile.vx * (dtMs / 1000),
  y: projectile.y + projectile.vy * (dtMs / 1000),
  ttlMs: projectile.ttlMs - dtMs
});

const activateRound = (match: MatchState): void => {
  match.phase = "active";
  match.countdownRemainingMs = 0;
  match.winnerId = null;
};

export const stepMatch = (match: MatchState, context: SimulationContext): SimulationResult => {
  const result: SimulationResult = {
    events: [],
    lastProcessedInputByPlayer: {}
  };

  if (match.phase === "paused" || match.phase === "waiting" || match.phase === "match-over") {
    return result;
  }

  if (match.phase === "countdown") {
    match.countdownRemainingMs = Math.max(0, match.countdownRemainingMs - context.dtMs);
    if (match.countdownRemainingMs === 0) {
      activateRound(match);
    }
    return result;
  }

  if (match.phase === "round-over") {
    match.countdownRemainingMs = Math.max(0, match.countdownRemainingMs - context.dtMs);
    if (match.countdownRemainingMs === 0) {
      match.roundNumber += 1;
      beginCountdown(match, context.now);
    }
    return result;
  }

  match.roundTimerMs += context.dtMs;

  for (const player of match.players) {
    player.fireCooldownMs = expireCooldown(player.fireCooldownMs, context.dtMs);
    player.dashCooldownMs = expireCooldown(player.dashCooldownMs, context.dtMs);
    player.dashRemainingMs = expireCooldown(player.dashRemainingMs, context.dtMs);
    player.spawnProtectionMs = expireCooldown(player.spawnProtectionMs, context.dtMs);

    const rawInput = context.inputs.get(player.id);
    const safeInput = rawInput ? sanitizeInput(rawInput) : undefined;

    if (!safeInput || !player.connected || player.health <= 0) {
      player.vx = 0;
      player.vy = 0;
      continue;
    }

    result.lastProcessedInputByPlayer[player.id] = safeInput.seq;
    player.lastProcessedInputSeq = safeInput.seq;
    player.aimX = safeInput.aimX;
    player.aimY = safeInput.aimY;

    if (
      safeInput.dash &&
      player.dashCooldownMs === 0 &&
      Math.hypot(safeInput.moveX, safeInput.moveY) > 0
    ) {
      player.dashRemainingMs = GAME_CONSTANTS.dashDurationMs;
      player.dashCooldownMs = GAME_CONSTANTS.dashCooldownMs;
      result.events.push({
        type: "dash",
        at: context.now,
        actorId: player.id
      });
    }

    movePlayer(player, safeInput, context.dtMs);

    if (safeInput.shoot && player.fireCooldownMs === 0) {
      match.projectiles.push(spawnProjectile(player, context.createProjectileId));
      player.fireCooldownMs = GAME_CONSTANTS.fireCooldownMs;
      result.events.push({
        type: "shoot",
        at: context.now,
        actorId: player.id
      });
    }
  }

  const nextProjectiles: ProjectileState[] = [];
  for (const projectile of match.projectiles) {
    const updatedProjectile = updateProjectile(projectile, context.dtMs);
    if (updatedProjectile.ttlMs <= 0) {
      continue;
    }

    let hit = false;
    for (const target of match.players) {
      if (
        target.id === updatedProjectile.ownerId ||
        target.health <= 0 ||
        target.spawnProtectionMs > 0 ||
        !target.connected
      ) {
        continue;
      }

      const distance = Math.hypot(updatedProjectile.x - target.x, updatedProjectile.y - target.y);
      if (distance > GAME_CONSTANTS.playerRadius + GAME_CONSTANTS.projectileRadius) {
        continue;
      }

      hit = true;
      target.health = Math.max(0, target.health - GAME_CONSTANTS.projectileDamage);
      target.lastDamageAt = context.now;
      result.events.push({
        type: "hit",
        at: context.now,
        actorId: updatedProjectile.ownerId,
        targetId: target.id
      });

      if (target.health === 0) {
        const winner = match.players.find((player) => player.id === updatedProjectile.ownerId);
        if (winner) {
          awardRound(match, winner, context.now, result);
        }
      }
      break;
    }

    if (!hit) {
      nextProjectiles.push(updatedProjectile);
    }
  }

  match.projectiles = nextProjectiles;

  const alivePlayers = getAlivePlayers(match);
  if (match.phase === "active" && alivePlayers.length === 1) {
    const winner = alivePlayers[0];
    if (winner) {
      awardRound(match, winner, context.now, result);
    }
  }

  return result;
};

export const createBotInput = (
  self: PlayerState,
  target: PlayerState,
  seq: number,
  now: number
): InputCommand => {
  const toTarget = normalizeVector(target.x - self.x, target.y - self.y);
  const desiredDistanceX = target.x - self.x;
  const desiredDistanceY = target.y - self.y;
  const movement = normalizeVector(
    Math.abs(desiredDistanceX) > 240 ? desiredDistanceX : -desiredDistanceY,
    Math.abs(desiredDistanceY) > 180 ? desiredDistanceY : desiredDistanceX
  );

  return {
    seq,
    clientTime: now,
    moveX: movement.x,
    moveY: movement.y,
    aimX: toTarget.x,
    aimY: toTarget.y,
    shoot: target.spawnProtectionMs === 0,
    dash:
      self.dashCooldownMs === 0 &&
      self.health < GAME_CONSTANTS.maxHealth / 2 &&
      Math.hypot(target.x - self.x, target.y - self.y) < 280
  };
};
