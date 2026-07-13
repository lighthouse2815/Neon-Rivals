import {
  CLIENT_EVENTS,
  GAME_CONSTANTS,
  SERVER_EVENTS,
  clampPosition,
  sanitizeInput,
  type InputCommand,
  type MatchState,
  type PlayerState,
  type RoomSummary,
  type ServerGameEvent,
  type Snapshot
} from "@neon-duel/shared";
import { io, type Socket } from "socket.io-client";

import type { AppStore } from "../state";
import type { ArenaDriver, InputFrame, RenderFrame } from "../game/types";

type JoinPayload = {
  roomCode: string;
  playerId: string;
  reconnectToken: string;
  invitationUrl: string;
  room: RoomSummary;
};

type SessionCallbacks = {
  onArenaNeeded: () => void;
  onLobbyNeeded: () => void;
  onResult: (winnerName: string) => void;
  onBanner: (message: string, kind?: "info" | "error") => void;
  onRoomChanged: (room: RoomSummary | null) => void;
};

const TICK_MS = 1000 / GAME_CONSTANTS.simulationTickHz;
const SESSION_STORAGE_KEY = "neon-duel-session";
const lerp = (from: number, to: number, alpha: number): number => from + (to - from) * alpha;

type StoredSession = {
  roomCode: string;
  reconnectToken: string;
  playerName: string;
};

export class OnlineSession implements ArenaDriver {
  private socket: Socket | null = null;
  private playerId: string | null = null;
  private roomCode: string | null = null;
  private reconnectToken: string | null = null;
  private snapshotBuffer: Snapshot[] = [];
  private pendingInputs: InputCommand[] = [];
  private localSeq = 0;
  private inputAccumulator = 0;
  private pingMs = 0;
  private lastHeartbeatAt = 0;
  private readonly events: ServerGameEvent[] = [];
  private debugInputOverride: InputFrame | null = null;

  constructor(
    private readonly store: AppStore,
    private readonly callbacks: SessionCallbacks
  ) {}

  ensureConnected(): void {
    if (this.socket) {
      return;
    }

    const serverUrl =
      typeof import.meta.env.VITE_SERVER_URL === "string"
        ? import.meta.env.VITE_SERVER_URL
        : "http://127.0.0.1:3001";
    this.socket = io(serverUrl, {
      autoConnect: true,
      transports: ["websocket"]
    });

    this.socket.on(SERVER_EVENTS.welcome, () => {
      this.store.setState({
        connectionLabel: "Server online"
      });
    });

    this.socket.on(SERVER_EVENTS.created, (payload: JoinPayload) => {
      this.acceptJoin(payload);
      this.callbacks.onBanner("Private room created.", "info");
    });

    this.socket.on(SERVER_EVENTS.joined, (payload: JoinPayload) => {
      this.acceptJoin(payload);
      this.callbacks.onBanner("Joined duel room.", "info");
    });

    this.socket.on(SERVER_EVENTS.roomUpdate, (payload: { room: RoomSummary }) => {
      this.store.setState({
        room: payload.room
      });
      this.callbacks.onRoomChanged(payload.room);
      if (payload.room.phase === "waiting") {
        this.callbacks.onLobbyNeeded();
      }
    });

    this.socket.on(SERVER_EVENTS.countdown, () => {
      this.callbacks.onArenaNeeded();
    });

    this.socket.on(SERVER_EVENTS.snapshot, (snapshot: Snapshot) => {
      this.snapshotBuffer.push(snapshot);
      if (this.snapshotBuffer.length > 12) {
        this.snapshotBuffer.shift();
      }
      this.store.setState({
        latestMatch: snapshot.state,
        room: this.store.getState().room
      });
      if (snapshot.state.phase === "match-over") {
        const winner = snapshot.state.players.find(
          (player) => player.id === snapshot.state.matchWinnerId
        );
        this.callbacks.onResult(winner?.name ?? "Match Complete");
      } else {
        this.callbacks.onArenaNeeded();
      }
    });

    this.socket.on(SERVER_EVENTS.gameEvent, (event: ServerGameEvent) => {
      this.events.push(event);
    });

    this.socket.on(
      SERVER_EVENTS.error,
      (payload: {
        code: string;
        message: string;
      }) => {
        this.callbacks.onBanner(payload.message, "error");
      }
    );

    this.socket.on("disconnect", () => {
      this.store.setState({
        connectionLabel: "Disconnected"
      });
      this.callbacks.onBanner("Connection lost. Reconnect is available for 15 seconds.", "error");
    });
  }

  dispose(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.snapshotBuffer = [];
    this.pendingInputs = [];
    this.roomCode = null;
    this.playerId = null;
    this.reconnectToken = null;
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }

  createRoom(playerName: string): void {
    this.ensureConnected();
    this.socket?.emit(CLIENT_EVENTS.createRoom, {
      playerName
    });
  }

  joinRoom(roomCode: string, playerName: string): void {
    this.ensureConnected();
    this.socket?.emit(CLIENT_EVENTS.joinRoom, {
      roomCode,
      playerName
    });
  }

  tryReconnect(playerName: string): boolean {
    this.ensureConnected();
    const stored = this.readStoredSession();
    if (!stored) {
      return false;
    }

    this.socket?.emit(CLIENT_EVENTS.reconnect, {
      roomCode: stored.roomCode,
      reconnectToken: stored.reconnectToken,
      playerName
    });
    return true;
  }

  setReady(ready: boolean): void {
    if (!this.roomCode) {
      return;
    }
    this.socket?.emit(CLIENT_EVENTS.ready, {
      roomCode: this.roomCode,
      ready
    });
  }

  rematch(): void {
    if (!this.roomCode) {
      return;
    }
    this.socket?.emit(CLIENT_EVENTS.rematch, {
      roomCode: this.roomCode
    });
  }

  leaveRoom(): void {
    if (!this.roomCode) {
      return;
    }
    this.socket?.emit(CLIENT_EVENTS.leaveRoom, {
      roomCode: this.roomCode
    });
    this.store.setState({
      room: null,
      latestMatch: null,
      connectionLabel: "Server online"
    });
    this.snapshotBuffer = [];
    this.pendingInputs = [];
    this.roomCode = null;
    this.playerId = null;
    this.reconnectToken = null;
    localStorage.removeItem(SESSION_STORAGE_KEY);
  }

  enter(): void {
    this.inputAccumulator = 0;
  }

  leave(): void {
    this.pendingInputs = [];
  }

  isPractice(): boolean {
    return false;
  }

  update(now: number, deltaMs: number, input: InputFrame): void {
    if (!this.socket || !this.playerId || !this.roomCode) {
      return;
    }

    if (now - this.lastHeartbeatAt >= GAME_CONSTANTS.heartbeatIntervalMs) {
      this.lastHeartbeatAt = now;
      const sentAt = Date.now();
      this.socket.emit(
        CLIENT_EVENTS.ping,
        { sentAt },
        () => {
          this.pingMs = Date.now() - sentAt;
          this.store.setState({
            pingMs: this.pingMs
          });
          if (!this.roomCode) {
            return;
          }
          this.socket?.emit(CLIENT_EVENTS.heartbeat, {
            roomCode: this.roomCode,
            pingMs: this.pingMs
          });
        }
      );
    }

    const latestSnapshot = this.snapshotBuffer[this.snapshotBuffer.length - 1];
    if (!latestSnapshot) {
      return;
    }

    if (
      latestSnapshot.state.phase !== "active" &&
      latestSnapshot.state.phase !== "countdown" &&
      latestSnapshot.state.phase !== "paused"
    ) {
      return;
    }

    const effectiveInput = this.debugInputOverride ?? input;
    this.inputAccumulator += deltaMs;
    while (this.inputAccumulator >= TICK_MS) {
      this.inputAccumulator -= TICK_MS;
      const command: InputCommand = {
        seq: this.localSeq++,
        clientTime: now,
        moveX: effectiveInput.moveX,
        moveY: effectiveInput.moveY,
        aimX: effectiveInput.aimX,
        aimY: effectiveInput.aimY,
        shoot: effectiveInput.shoot,
        dash: effectiveInput.dashPressed
      };
      this.pendingInputs.push(command);
      this.socket.emit(CLIENT_EVENTS.input, {
        roomCode: this.roomCode,
        input: command
      });
    }
  }

  setDebugInputOverride(input: InputFrame | null): void {
    this.debugInputOverride = input;
  }

  sendDebugCommand(input: InputFrame): void {
    if (!this.socket || !this.roomCode) {
      return;
    }

    const command: InputCommand = {
      seq: this.localSeq++,
      clientTime: Date.now(),
      moveX: input.moveX,
      moveY: input.moveY,
      aimX: input.aimX,
      aimY: input.aimY,
      shoot: input.shoot,
      dash: input.dashPressed
    };

    this.pendingInputs.push(command);
    this.socket.emit(CLIENT_EVENTS.input, {
      roomCode: this.roomCode,
      input: command
    });
  }

  getRenderFrame(now: number): RenderFrame | null {
    if (!this.playerId || this.snapshotBuffer.length === 0) {
      return null;
    }

    const state = this.interpolateState(now);
    if (!state) {
      return null;
    }

    const localPlayer = state.players.find((player) => player.id === this.playerId);
    if (!localPlayer) {
      return null;
    }

    return {
      match: state,
      localPlayerId: localPlayer.id,
      pingMs: this.pingMs,
      mode: "online"
    };
  }

  drainEvents(): ServerGameEvent[] {
    return this.events.splice(0, this.events.length);
  }

  private acceptJoin(payload: JoinPayload): void {
    this.playerId = payload.playerId;
    this.roomCode = payload.roomCode;
    this.reconnectToken = payload.reconnectToken;
    this.store.setState({
      room: payload.room,
      playerId: payload.playerId,
      reconnectToken: payload.reconnectToken,
      connectionLabel: "Connected to duel room"
    });
    localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({
        roomCode: payload.roomCode,
        reconnectToken: payload.reconnectToken,
        playerName: this.store.getState().playerName
      } satisfies StoredSession)
    );
  }

  private interpolateState(now: number): MatchState | null {
    const targetTime = now - GAME_CONSTANTS.interpolationDelayMs;
    const newerIndex = this.snapshotBuffer.findIndex((snapshot) => snapshot.serverTime >= targetTime);
    const latest = this.snapshotBuffer[this.snapshotBuffer.length - 1];
    if (!latest) {
      return null;
    }

    if (newerIndex <= 0) {
      const clone = structuredClone(latest.state);
      this.applyPrediction(clone);
      return clone;
    }

    const older = this.snapshotBuffer[newerIndex - 1];
    const newer = this.snapshotBuffer[newerIndex];
    if (!older || !newer) {
      const clone = structuredClone(latest.state);
      this.applyPrediction(clone);
      return clone;
    }

    const duration = Math.max(1, newer.serverTime - older.serverTime);
    const alpha = Math.min(1, Math.max(0, (targetTime - older.serverTime) / duration));
    const interpolated = structuredClone(newer.state);

    for (const player of interpolated.players) {
      if (player.id === this.playerId) {
        continue;
      }
      const previous = older.state.players.find((candidate) => candidate.id === player.id);
      const next = newer.state.players.find((candidate) => candidate.id === player.id);
      if (!previous || !next) {
        continue;
      }
      player.x = lerp(previous.x, next.x, alpha);
      player.y = lerp(previous.y, next.y, alpha);
      player.vx = lerp(previous.vx, next.vx, alpha);
      player.vy = lerp(previous.vy, next.vy, alpha);
    }

    this.applyPrediction(interpolated);
    return interpolated;
  }

  private applyPrediction(match: MatchState): void {
    if (!this.playerId) {
      return;
    }
    const player = match.players.find((candidate) => candidate.id === this.playerId);
    if (!player) {
      return;
    }

    this.pendingInputs = this.pendingInputs.filter(
      (input) => input.seq > player.lastProcessedInputSeq
    );
    const predicted = structuredClone(player);
    for (const pendingInput of this.pendingInputs) {
      this.advancePredictedPlayer(predicted, pendingInput);
    }
    Object.assign(player, predicted);
  }

  private advancePredictedPlayer(player: PlayerState, input: InputCommand): void {
    const safeInput = sanitizeInput(input);
    player.fireCooldownMs = Math.max(0, player.fireCooldownMs - TICK_MS);
    player.dashCooldownMs = Math.max(0, player.dashCooldownMs - TICK_MS);
    player.dashRemainingMs = Math.max(0, player.dashRemainingMs - TICK_MS);
    player.spawnProtectionMs = Math.max(0, player.spawnProtectionMs - TICK_MS);

    if (
      safeInput.dash &&
      player.dashCooldownMs === 0 &&
      Math.hypot(safeInput.moveX, safeInput.moveY) > 0
    ) {
      player.dashRemainingMs = GAME_CONSTANTS.dashDurationMs;
      player.dashCooldownMs = GAME_CONSTANTS.dashCooldownMs;
    }

    const speed =
      player.dashRemainingMs > 0 ? GAME_CONSTANTS.dashSpeed : GAME_CONSTANTS.playerSpeed;
    player.vx = safeInput.moveX * speed;
    player.vy = safeInput.moveY * speed;
    const next = clampPosition({
      x: player.x + player.vx * (TICK_MS / 1000),
      y: player.y + player.vy * (TICK_MS / 1000)
    });
    player.x = next.x;
    player.y = next.y;
    player.aimX = safeInput.aimX;
    player.aimY = safeInput.aimY;
  }

  private readStoredSession(): StoredSession | null {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as StoredSession;
    } catch {
      return null;
    }
  }
}
