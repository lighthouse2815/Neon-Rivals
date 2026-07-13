import { randomBytes, randomUUID } from "node:crypto";

import {
  CLIENT_EVENTS,
  GAME_CONSTANTS,
  SERVER_EVENTS,
  beginCountdown,
  createEmptyMatchState,
  createPlayerState,
  createRoomCode,
  expireReconnect,
  fullyResetMatch,
  markPlayerDisconnected,
  restorePlayerConnection,
  stepMatch,
  toRoomSummary,
  type InputCommand,
  type MatchState,
  type RoomSummary,
  type ServerGameEvent,
  type Snapshot
} from "@neon-duel/shared";

export class RuntimeError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

type SessionRecord = {
  socketId: string | null;
  playerId: string;
  roomCode: string;
  reconnectToken: string;
  lastHeartbeatAt: number;
  latestInput?: InputCommand;
  lastReceivedInputSeq: number;
  inputWindow: number[];
};

type RoomRecord = {
  code: string;
  invitationUrl: string;
  match: MatchState;
  sessions: Map<string, SessionRecord>;
  createdAt: number;
  updatedAt: number;
  tick: number;
  lastSnapshotAt: number;
  projectileCounter: number;
};

export type JoinResult = {
  roomCode: string;
  playerId: string;
  reconnectToken: string;
  invitationUrl: string;
  room: RoomSummary;
};

export type AdvanceResult = {
  roomUpdates: string[];
  countdowns: string[];
  snapshots: Snapshot[];
  events: Array<{
    roomCode: string;
    event: ServerGameEvent;
  }>;
};

export type RematchRequestResult = {
  startedCountdown: boolean;
  requesterId: string;
  requesterName: string;
  notifyOpponent: boolean;
};

const SNAPSHOT_INTERVAL_MS = 1000 / GAME_CONSTANTS.snapshotHz;
const TICK_INTERVAL_MS = 1000 / GAME_CONSTANTS.simulationTickHz;

const createReconnectToken = (): string => randomBytes(24).toString("hex");

export class NeonDuelRuntime {
  private readonly rooms = new Map<string, RoomRecord>();
  private readonly socketToPlayer = new Map<string, { roomCode: string; playerId: string }>();

  constructor(private readonly invitationBaseUrl: string) {}

  createRoom(socketId: string, playerName: string, now: number): JoinResult {
    const roomCode = this.generateUniqueRoomCode();
    const invitationUrl = `${this.invitationBaseUrl.replace(/\/$/, "")}/?room=${roomCode}`;
    const match = createEmptyMatchState(roomCode);
    const playerId = randomUUID();
    match.players.push(createPlayerState(playerId, playerName, 0));

    const room: RoomRecord = {
      code: roomCode,
      invitationUrl,
      match,
      sessions: new Map(),
      createdAt: now,
      updatedAt: now,
      tick: 0,
      lastSnapshotAt: 0,
      projectileCounter: 0
    };

    const session: SessionRecord = {
      socketId,
      playerId,
      roomCode,
      reconnectToken: createReconnectToken(),
      lastHeartbeatAt: now,
      lastReceivedInputSeq: -1,
      inputWindow: []
    };

    room.sessions.set(playerId, session);
    this.rooms.set(roomCode, room);
    this.socketToPlayer.set(socketId, { roomCode, playerId });

    return this.buildJoinResult(room, session);
  }

  joinRoom(socketId: string, roomCode: string, playerName: string, now: number): JoinResult {
    const room = this.getRoom(roomCode);
    this.prepareRoomForNewOpponent(room, now);

    if (room.match.players.length >= 2) {
      throw new RuntimeError("ROOM_FULL", "This room already has two players.");
    }

    const occupiedSlots = new Set(room.match.players.map((player) => player.slot));
    const slot = occupiedSlots.has(0) ? 1 : 0;
    const playerId = randomUUID();
    room.match.players.push(createPlayerState(playerId, playerName, slot));
    room.match.players.sort((left, right) => left.slot - right.slot);

    const session: SessionRecord = {
      socketId,
      playerId,
      roomCode,
      reconnectToken: createReconnectToken(),
      lastHeartbeatAt: now,
      lastReceivedInputSeq: -1,
      inputWindow: []
    };

    room.sessions.set(playerId, session);
    room.updatedAt = now;
    this.socketToPlayer.set(socketId, { roomCode, playerId });

    return this.buildJoinResult(room, session);
  }

  reconnectRoom(socketId: string, roomCode: string, reconnectToken: string, now: number): JoinResult {
    const room = this.getRoom(roomCode);
    const session = [...room.sessions.values()].find(
      (candidate) => candidate.reconnectToken === reconnectToken
    );

    if (!session) {
      throw new RuntimeError("RECONNECT_DENIED", "Reconnect token is invalid.");
    }

    const player = room.match.players.find((candidate) => candidate.id === session.playerId);
    if (!player || player.reconnectDeadlineAt === null || player.reconnectDeadlineAt < now) {
      throw new RuntimeError("RECONNECT_DENIED", "Reconnect window expired.");
    }

    session.socketId = socketId;
    session.lastHeartbeatAt = now;
    session.inputWindow = [];
    this.socketToPlayer.set(socketId, { roomCode, playerId: session.playerId });
    restorePlayerConnection(room.match, session.playerId);
    room.updatedAt = now;

    return this.buildJoinResult(room, session);
  }

  setReady(socketId: string, roomCode: string, ready: boolean, now: number): boolean {
    const { room, player } = this.getPlayerForSocket(socketId, roomCode);
    player.ready = ready;
    room.updatedAt = now;

    const connectedPlayers = room.match.players.filter((candidate) => candidate.connected);
    const everyoneReady =
      connectedPlayers.length === 2 && connectedPlayers.every((candidate) => candidate.ready);

    if (everyoneReady && (room.match.phase === "waiting" || room.match.phase === "match-over")) {
      if (room.match.phase === "match-over") {
        fullyResetMatch(room.match, now);
      } else {
        beginCountdown(room.match, now);
      }
      return true;
    }

    if (!everyoneReady && room.match.phase === "countdown") {
      room.match.phase = "waiting";
      room.match.countdownRemainingMs = 0;
    }

    return false;
  }

  requestRematch(socketId: string, roomCode: string, now: number): RematchRequestResult {
    const { room, player } = this.getPlayerForSocket(socketId, roomCode);
    const notifyOpponent = room.match.phase === "match-over";

    if (notifyOpponent) {
      this.resetRoomToWaiting(room, true);
      room.match.roundNumber = 1;
    }

    if (room.match.phase !== "waiting") {
      throw new RuntimeError("INVALID_STATE", "Rematch is only available after the match ends.");
    }

    return {
      startedCountdown: this.setReady(socketId, roomCode, true, now),
      requesterId: player.id,
      requesterName: player.name,
      notifyOpponent
    };
  }

  leaveRoom(socketId: string, roomCode: string, now: number): void {
    const identity = this.socketToPlayer.get(socketId);
    if (!identity || identity.roomCode !== roomCode) {
      return;
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      this.socketToPlayer.delete(socketId);
      return;
    }

    room.sessions.delete(identity.playerId);
    room.match.players = room.match.players.filter((player) => player.id !== identity.playerId);
    this.socketToPlayer.delete(socketId);

    if (room.match.players.length === 0) {
      this.rooms.delete(roomCode);
      return;
    }

    this.resetRoomToWaiting(room, true);
    room.updatedAt = now;
  }

  disconnectSocket(socketId: string, now: number): { roomCode: string | null; events: ServerGameEvent[] } {
    const identity = this.socketToPlayer.get(socketId);
    if (!identity) {
      return { roomCode: null, events: [] };
    }

    this.socketToPlayer.delete(socketId);
    const room = this.rooms.get(identity.roomCode);
    if (!room) {
      return { roomCode: null, events: [] };
    }

    const session = room.sessions.get(identity.playerId);
    if (!session) {
      return { roomCode: room.code, events: [] };
    }

    session.socketId = null;
    session.latestInput = undefined;
    session.inputWindow = [];

    const player = room.match.players.find((candidate) => candidate.id === identity.playerId);
    if (!player) {
      return { roomCode: room.code, events: [] };
    }

    if (room.match.players.length === 1 || room.match.phase === "waiting" || room.match.phase === "match-over") {
      room.sessions.delete(identity.playerId);
      room.match.players = room.match.players.filter((candidate) => candidate.id !== identity.playerId);
      if (room.match.players.length === 0) {
        this.rooms.delete(room.code);
        return { roomCode: room.code, events: [] };
      }
      this.resetRoomToWaiting(room, true);
      return {
        roomCode: room.code,
        events: []
      };
    }

    const reconnectDeadlineAt = now + GAME_CONSTANTS.reconnectGraceMs;
    markPlayerDisconnected(room.match, identity.playerId, reconnectDeadlineAt);
    room.updatedAt = now;

    return {
      roomCode: room.code,
      events: [
        {
          type: "player-disconnected",
          at: now,
          actorId: identity.playerId
        }
      ]
    };
  }

  recordHeartbeat(socketId: string, roomCode: string, now: number, pingMs?: number): void {
    const { room, player, session } = this.getSessionForSocket(socketId, roomCode);
    session.lastHeartbeatAt = now;
    if (typeof pingMs === "number") {
      player.pingMs = pingMs;
    }
    room.updatedAt = now;
  }

  submitInput(socketId: string, roomCode: string, input: InputCommand, now: number): void {
    const { player, session } = this.getSessionForSocket(socketId, roomCode);
    if (!player.connected) {
      throw new RuntimeError("INVALID_STATE", "Disconnected players cannot submit input.");
    }

    session.inputWindow = session.inputWindow.filter((timestamp) => now - timestamp <= 1000);
    if (session.inputWindow.length >= GAME_CONSTANTS.maxInputPerSecond) {
      throw new RuntimeError("RATE_LIMITED", "Input rate limit exceeded.");
    }

    if (input.seq <= session.lastReceivedInputSeq) {
      throw new RuntimeError("STALE_INPUT", "Input sequence number is stale.");
    }

    session.lastReceivedInputSeq = input.seq;
    session.inputWindow.push(now);
    session.latestInput = input;
  }

  getRoomSummary(roomCode: string): RoomSummary | null {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return null;
    }
    return toRoomSummary(room.match, room.invitationUrl);
  }

  getActiveRoomCodes(): string[] {
    return [...this.rooms.keys()];
  }

  getRoomPhase(roomCode: string): string | null {
    return this.rooms.get(roomCode)?.match.phase ?? null;
  }

  advance(now: number): AdvanceResult {
    const roomUpdates = new Set<string>();
    const countdowns = new Set<string>();
    const snapshots: Snapshot[] = [];
    const events: Array<{ roomCode: string; event: ServerGameEvent }> = [];

    for (const [roomCode, room] of this.rooms) {
      const expiredPlayers = room.match.players.filter(
        (player) =>
          !player.connected &&
          player.reconnectDeadlineAt !== null &&
          player.reconnectDeadlineAt <= now
      );

      for (const player of expiredPlayers) {
        const roomEvents = expireReconnect(room.match, player.id, now);
        room.sessions.delete(player.id);
        room.updatedAt = now;
        roomUpdates.add(roomCode);
        for (const event of roomEvents) {
          events.push({ roomCode, event });
        }
        if (room.match.players.length < 2 && room.match.phase !== "match-over") {
          this.resetRoomToWaiting(room, false);
        }
      }

      if (room.match.players.length === 0) {
        if (now - room.updatedAt >= GAME_CONSTANTS.roomIdleMs) {
          this.rooms.delete(roomCode);
        }
        continue;
      }

      const previousPhase = room.match.phase;
      if (
        room.match.players.length === 2 &&
        room.match.phase !== "waiting" &&
        room.match.phase !== "paused" &&
        room.match.phase !== "match-over"
      ) {
        room.tick += 1;
        const result = stepMatch(room.match, {
          now,
          dtMs: TICK_INTERVAL_MS,
          inputs: new Map(
            room.match.players.map((player) => [player.id, room.sessions.get(player.id)?.latestInput])
          ),
          createProjectileId: () => `${room.code}-${room.projectileCounter++}`
        });

        if (result.events.length > 0 || room.match.phase !== previousPhase) {
          roomUpdates.add(roomCode);
        }
        for (const event of result.events) {
          events.push({ roomCode, event });
        }
      }

      if (room.match.phase === "countdown" && previousPhase !== "countdown") {
        countdowns.add(roomCode);
      }

      const shouldSnapshot =
        room.match.phase !== "waiting" &&
        now - room.lastSnapshotAt >= SNAPSHOT_INTERVAL_MS;

      if (shouldSnapshot) {
        room.lastSnapshotAt = now;
        snapshots.push({
          serverTime: now,
          roomCode,
          tick: room.tick,
          state: structuredClone(room.match)
        });
      }
    }

    return {
      roomUpdates: [...roomUpdates],
      countdowns: [...countdowns],
      snapshots,
      events
    };
  }

  private buildJoinResult(room: RoomRecord, session: SessionRecord): JoinResult {
    return {
      roomCode: room.code,
      playerId: session.playerId,
      reconnectToken: session.reconnectToken,
      invitationUrl: room.invitationUrl,
      room: toRoomSummary(room.match, room.invitationUrl)
    };
  }

  private prepareRoomForNewOpponent(room: RoomRecord, now: number): void {
    if (room.match.players.length === 2) {
      throw new RuntimeError("ROOM_FULL", "This room already has two players.");
    }

    if (
      room.match.players.length === 1 &&
      (room.match.roundNumber > 1 ||
        room.match.players[0]?.score !== 0 ||
        room.match.phase !== "waiting")
    ) {
      this.resetRoomToWaiting(room, true);
      room.match.roundNumber = 1;
      room.updatedAt = now;
    }
  }

  private resetRoomToWaiting(room: RoomRecord, resetScores: boolean): void {
    room.match.phase = "waiting";
    room.match.countdownRemainingMs = 0;
    room.match.roundTimerMs = 0;
    room.match.winnerId = null;
    room.match.matchWinnerId = null;
    room.match.pausedReason = null;
    room.match.projectiles = [];
    for (const player of room.match.players) {
      player.ready = false;
      player.health = GAME_CONSTANTS.maxHealth;
      if (resetScores) {
        player.score = 0;
      }
      player.fireCooldownMs = 0;
      player.dashCooldownMs = 0;
      player.dashRemainingMs = 0;
      player.spawnProtectionMs = GAME_CONSTANTS.spawnProtectionMs;
      player.connected = true;
      player.reconnectDeadlineAt = null;
    }
  }

  private generateUniqueRoomCode(): string {
    for (let attempt = 0; attempt < 64; attempt += 1) {
      const code = createRoomCode();
      if (!this.rooms.has(code)) {
        return code;
      }
    }

    throw new RuntimeError("ROOM_CODE_EXHAUSTED", "Unable to allocate a unique room code.");
  }

  private getRoom(roomCode: string): RoomRecord {
    const room = this.rooms.get(roomCode);
    if (!room) {
      throw new RuntimeError("ROOM_NOT_FOUND", "Room not found.");
    }
    return room;
  }

  private getPlayerForSocket(
    socketId: string,
    roomCode: string
  ): { room: RoomRecord; player: MatchState["players"][number] } {
    const { room, player } = this.getSessionForSocket(socketId, roomCode);
    return { room, player };
  }

  private getSessionForSocket(
    socketId: string,
    roomCode: string
  ): {
    room: RoomRecord;
    player: MatchState["players"][number];
    session: SessionRecord;
  } {
    const identity = this.socketToPlayer.get(socketId);
    if (!identity || identity.roomCode !== roomCode) {
      throw new RuntimeError("UNAUTHORIZED", "Socket is not attached to this room.");
    }

    const room = this.getRoom(roomCode);
    const session = room.sessions.get(identity.playerId);
    const player = room.match.players.find((candidate) => candidate.id === identity.playerId);

    if (!session || !player) {
      throw new RuntimeError("UNAUTHORIZED", "Room membership is no longer valid.");
    }

    return { room, player, session };
  }
}

export const serverEventNames = { CLIENT_EVENTS, SERVER_EVENTS };
