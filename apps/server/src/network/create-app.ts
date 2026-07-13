import Fastify from "fastify";
import cors from "@fastify/cors";
import { Server } from "socket.io";
import {
  CLIENT_EVENTS,
  GAME_CONSTANTS,
  SERVER_EVENTS,
  createRoomSchema,
  gameInputSchema,
  heartbeatSchema,
  joinRoomSchema,
  leaveRoomSchema,
  pingSchema,
  readySchema,
  reconnectSchema,
  rematchSchema,
  type RematchRequestedPayload
} from "@neon-duel/shared";
import type { ZodType } from "zod";

import type { ServerConfig } from "../config";
import { NeonDuelRuntime, RuntimeError } from "../core/runtime";

const parseWithSchema = <T>(schema: ZodType<T>, payload: unknown): T => schema.parse(payload);

export const createNeonDuelApp = async (config: ServerConfig) => {
  const app = Fastify({
    logger: true
  });
  await app.register(cors, {
    origin: config.clientOrigin
  });

  const runtime = new NeonDuelRuntime(config.invitationBaseUrl);

  app.get("/health", () => ({
    ok: true,
    rooms: runtime.getActiveRoomCodes().length,
    serverTime: Date.now()
  }));

  const io = new Server(app.server, {
    cors: {
      origin: config.clientOrigin
    },
    maxHttpBufferSize: GAME_CONSTANTS.maxMessageBytes
  });

  const emitRoomUpdate = (roomCode: string): void => {
    const summary = runtime.getRoomSummary(roomCode);
    if (!summary) {
      return;
    }
    io.to(roomCode).emit(SERVER_EVENTS.roomUpdate, { room: summary });
  };

  const emitCountdown = (roomCode: string): void => {
    const room = runtime.getRoomSummary(roomCode);
    if (!room) {
      return;
    }
    io.to(roomCode).emit(SERVER_EVENTS.countdown, {
      roomCode,
      countdownRemainingMs: room.countdownRemainingMs
    });
  };

  const emitError = (socketId: string, error: unknown): void => {
    if (error instanceof RuntimeError) {
      io.to(socketId).emit(SERVER_EVENTS.error, {
        code: error.code,
        message: error.message
      });
      return;
    }

    const message = error instanceof Error ? error.message : "Unexpected server error.";
    io.to(socketId).emit(SERVER_EVENTS.error, {
      code: "INTERNAL_ERROR",
      message
    });
  };

  const interval = setInterval(() => {
    const result = runtime.advance(Date.now());
    for (const roomCode of result.roomUpdates) {
      emitRoomUpdate(roomCode);
    }
    for (const roomCode of result.countdowns) {
      emitCountdown(roomCode);
    }
    for (const snapshot of result.snapshots) {
      io.to(snapshot.roomCode).emit(SERVER_EVENTS.snapshot, snapshot);
    }
    for (const { roomCode, event } of result.events) {
      io.to(roomCode).emit(SERVER_EVENTS.gameEvent, event);
    }
  }, Math.round(1000 / GAME_CONSTANTS.simulationTickHz));

  io.on("connection", (socket) => {
    socket.emit(SERVER_EVENTS.welcome, {
      serverTime: Date.now()
    });

    socket.on(CLIENT_EVENTS.createRoom, (payload: unknown) => {
      try {
        const data = parseWithSchema(createRoomSchema, payload);
        const result = runtime.createRoom(socket.id, data.playerName, Date.now());
        void socket.join(result.roomCode);
        socket.emit(SERVER_EVENTS.created, result);
        emitRoomUpdate(result.roomCode);
      } catch (error) {
        emitError(socket.id, error);
      }
    });

    socket.on(CLIENT_EVENTS.joinRoom, (payload: unknown) => {
      try {
        const data = parseWithSchema(joinRoomSchema, payload);
        const result = runtime.joinRoom(socket.id, data.roomCode, data.playerName, Date.now());
        void socket.join(result.roomCode);
        socket.emit(SERVER_EVENTS.joined, result);
        emitRoomUpdate(result.roomCode);
      } catch (error) {
        emitError(socket.id, error);
      }
    });

    socket.on(CLIENT_EVENTS.reconnect, (payload: unknown) => {
      try {
        const data = parseWithSchema(reconnectSchema, payload);
        const result = runtime.reconnectRoom(
          socket.id,
          data.roomCode,
          data.reconnectToken,
          Date.now()
        );
        void socket.join(result.roomCode);
        socket.emit(SERVER_EVENTS.joined, result);
        emitRoomUpdate(result.roomCode);
        emitCountdown(result.roomCode);
      } catch (error) {
        emitError(socket.id, error);
      }
    });

    socket.on(CLIENT_EVENTS.ready, (payload: unknown) => {
      try {
        const data = parseWithSchema(readySchema, payload);
        const startedCountdown = runtime.setReady(socket.id, data.roomCode, data.ready, Date.now());
        emitRoomUpdate(data.roomCode);
        if (startedCountdown) {
          emitCountdown(data.roomCode);
        }
      } catch (error) {
        emitError(socket.id, error);
      }
    });

    socket.on(CLIENT_EVENTS.rematch, (payload: unknown) => {
      try {
        const data = parseWithSchema(rematchSchema, payload);
        const result = runtime.requestRematch(socket.id, data.roomCode, Date.now());
        emitRoomUpdate(data.roomCode);
        if (result.notifyOpponent) {
          socket.to(data.roomCode).emit(
            SERVER_EVENTS.rematchRequested,
            {
              roomCode: data.roomCode,
              requesterId: result.requesterId,
              requesterName: result.requesterName
            } satisfies RematchRequestedPayload
          );
        }
        if (result.startedCountdown) {
          emitCountdown(data.roomCode);
        }
      } catch (error) {
        emitError(socket.id, error);
      }
    });

    socket.on(CLIENT_EVENTS.leaveRoom, (payload: unknown) => {
      try {
        const data = parseWithSchema(leaveRoomSchema, payload);
        runtime.leaveRoom(socket.id, data.roomCode, Date.now());
        void socket.leave(data.roomCode);
        emitRoomUpdate(data.roomCode);
      } catch (error) {
        emitError(socket.id, error);
      }
    });

    socket.on(CLIENT_EVENTS.heartbeat, (payload: unknown) => {
      try {
        const data = parseWithSchema(heartbeatSchema, payload);
        runtime.recordHeartbeat(socket.id, data.roomCode, Date.now(), data.pingMs);
      } catch (error) {
        emitError(socket.id, error);
      }
    });

    socket.on(CLIENT_EVENTS.input, (payload: unknown) => {
      try {
        const data = parseWithSchema(gameInputSchema, payload);
        runtime.submitInput(socket.id, data.roomCode, data.input, Date.now());
      } catch (error) {
        emitError(socket.id, error);
      }
    });

    socket.on(
      CLIENT_EVENTS.ping,
      (payload: unknown, callback?: (response: { serverTime: number }) => void) => {
        try {
          parseWithSchema(pingSchema, payload);
          callback?.({
            serverTime: Date.now()
          });
        } catch (error) {
          emitError(socket.id, error);
        }
      }
    );

    socket.on("disconnect", () => {
      const { roomCode, events } = runtime.disconnectSocket(socket.id, Date.now());
      if (!roomCode) {
        return;
      }
      emitRoomUpdate(roomCode);
      for (const event of events) {
        io.to(roomCode).emit(SERVER_EVENTS.gameEvent, event);
      }
    });
  });

  const stop = async (): Promise<void> => {
    clearInterval(interval);
    await io.close();
    await app.close();
  };

  return { app, io, runtime, stop };
};
