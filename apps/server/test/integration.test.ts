import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { io, type Socket } from "socket.io-client";

import { CLIENT_EVENTS, SERVER_EVENTS, type RoomSummary, type Snapshot } from "@neon-duel/shared";

import { createNeonDuelApp } from "../src/network/create-app";

type JoinPayload = {
  roomCode: string;
  playerId: string;
  reconnectToken: string;
  invitationUrl: string;
  room: RoomSummary;
};

const waitForEvent = async <T>(
  socket: Socket,
  eventName: string,
  predicate?: (payload: T) => boolean,
  timeoutMs = 7000
): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeoutMs);

    const handler = (payload: T): void => {
      if (predicate && !predicate(payload)) {
        return;
      }
      clearTimeout(timer);
      socket.off(eventName, handler);
      resolve(payload);
    };

    socket.on(eventName, handler);
  });

const waitForConnect = async (socket: Socket, timeoutMs = 5000): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off("connect", handleConnect);
      reject(new Error("Timed out waiting for socket connection"));
    }, timeoutMs);

    const handleConnect = (): void => {
      clearTimeout(timer);
      socket.off("connect", handleConnect);
      resolve();
    };

    socket.on("connect", handleConnect);
  });

describe("Socket.IO integration", () => {
  let serverUrl = "";
  let stopServer: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const { app, stop } = await createNeonDuelApp({
      host: "127.0.0.1",
      port: 0,
      clientOrigin: "http://127.0.0.1:4173",
      invitationBaseUrl: "http://127.0.0.1:4173"
    });
    await app.listen({
      host: "127.0.0.1",
      port: 0
    });
    const address = app.server.address();
    if (!address || typeof address === "string") {
      throw new Error("Unable to determine server address.");
    }
    serverUrl = `http://127.0.0.1:${address.port}`;
    stopServer = stop;
  });

  afterAll(async () => {
    await stopServer?.();
  });

  it(
    "creates, joins, readies, syncs movement, applies damage, and rejects a third player",
    async () => {
    const socketA = io(serverUrl, { transports: ["websocket"], forceNew: true });
    const socketB = io(serverUrl, { transports: ["websocket"], forceNew: true });
    const socketC = io(serverUrl, { transports: ["websocket"], forceNew: true });

    try {
      await Promise.all([waitForConnect(socketA), waitForConnect(socketB), waitForConnect(socketC)]);

      const createdPromise = waitForEvent<JoinPayload>(socketA, SERVER_EVENTS.created);
      socketA.emit(CLIENT_EVENTS.createRoom, { playerName: "Alpha" });
      const created = await createdPromise;

      const joinedPromise = waitForEvent<JoinPayload>(socketB, SERVER_EVENTS.joined);
      socketB.emit(CLIENT_EVENTS.joinRoom, { roomCode: created.roomCode, playerName: "Bravo" });
      const joined = await joinedPromise;

      const roomUpdateA = waitForEvent<{ room: RoomSummary }>(
        socketA,
        SERVER_EVENTS.roomUpdate,
        (payload) => payload.room.players.length === 2
      );
      socketA.emit(CLIENT_EVENTS.ready, { roomCode: created.roomCode, ready: true });
      socketB.emit(CLIENT_EVENTS.ready, { roomCode: created.roomCode, ready: true });
      await roomUpdateA;

      await waitForEvent(socketA, SERVER_EVENTS.countdown);
      await waitForEvent<Snapshot>(
        socketA,
        SERVER_EVENTS.snapshot,
        (snapshot) => snapshot.state.phase === "active",
        12_000
      );

      socketA.emit(CLIENT_EVENTS.input, {
        roomCode: created.roomCode,
        input: {
          seq: 0,
          clientTime: Date.now(),
          moveX: 1,
          moveY: 0,
          aimX: 1,
          aimY: 0,
          shoot: true,
          dash: false
        }
      });

      const movedSnapshot = await waitForEvent<Snapshot>(
        socketB,
        SERVER_EVENTS.snapshot,
        (snapshot) => {
          const player = snapshot.state.players.find((candidate) => candidate.id === created.playerId);
          return Boolean(player && player.x > 280);
        },
        6000
      );
      const movedPlayer = movedSnapshot.state.players.find((player) => player.id === created.playerId);
      expect(movedPlayer?.x).toBeGreaterThan(280);

      const damagedSnapshot = await waitForEvent<Snapshot>(
        socketB,
        SERVER_EVENTS.snapshot,
        (snapshot) => {
          const self = snapshot.state.players.find((player) => player.id === joined.playerId);
          return Boolean(self && self.health < 100);
        },
        8000
      );
      const damagedPlayer = damagedSnapshot.state.players.find((player) => player.id === joined.playerId);
      expect(damagedPlayer?.health).toBeLessThan(100);

      const fullError = waitForEvent<{ code: string; message: string }>(
        socketC,
        SERVER_EVENTS.error,
        (payload) => payload.code === "ROOM_FULL"
      );
      socketC.emit(CLIENT_EVENTS.joinRoom, { roomCode: created.roomCode, playerName: "Charlie" });
      await expect(fullError).resolves.toMatchObject({ code: "ROOM_FULL" });
    } finally {
      socketA.disconnect();
      socketB.disconnect();
      socketC.disconnect();
    }
    },
    20_000
  );

  it("returns a server error for invalid payloads", async () => {
    const socket = io(serverUrl, { transports: ["websocket"], forceNew: true });

    try {
      await waitForConnect(socket);
      const errorPromise = waitForEvent<{ code: string; message: string }>(
        socket,
        SERVER_EVENTS.error
      );
      socket.emit(CLIENT_EVENTS.joinRoom, { roomCode: "12", playerName: "" });
      await expect(errorPromise).resolves.toMatchObject({ code: "INTERNAL_ERROR" });
    } finally {
      socket.disconnect();
    }
  });
});
