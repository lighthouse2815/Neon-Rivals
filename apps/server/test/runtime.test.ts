import { describe, expect, it } from "vitest";

import { GAME_CONSTANTS, type MatchState } from "@neon-duel/shared";

import { NeonDuelRuntime, RuntimeError } from "../src/core/runtime";

const advanceTicks = (
  runtime: NeonDuelRuntime,
  startAt: number,
  totalTicks: number
): ReturnType<NeonDuelRuntime["advance"]> => {
  let result = runtime.advance(startAt);
  for (let tick = 1; tick < totalTicks; tick += 1) {
    result = runtime.advance(startAt + tick * Math.round(1000 / GAME_CONSTANTS.simulationTickHz));
  }
  return result;
};

type RuntimeInternals = {
  rooms: Map<string, { match: MatchState }>;
};

const setRoomToMatchOver = (runtime: NeonDuelRuntime, roomCode: string): void => {
  const room = (runtime as unknown as RuntimeInternals).rooms.get(roomCode);
  if (!room) {
    throw new Error("Expected room to exist.");
  }
  room.match.phase = "match-over";
  room.match.roundNumber = 5;
  room.match.players[0]!.score = 3;
  room.match.matchWinnerId = room.match.players[0]!.id;
};

describe("NeonDuelRuntime", () => {
  it("rejects a third player when the room is full", () => {
    const runtime = new NeonDuelRuntime("http://127.0.0.1:4173");
    const room = runtime.createRoom("socket-a", "Alpha", 0);

    runtime.joinRoom("socket-b", room.roomCode, "Bravo", 10);

    expect(() => runtime.joinRoom("socket-c", room.roomCode, "Charlie", 20)).toThrowError(
      RuntimeError
    );
  });

  it("limits the accepted input rate per second", () => {
    const runtime = new NeonDuelRuntime("http://127.0.0.1:4173");
    const room = runtime.createRoom("socket-a", "Alpha", 0);

    for (let index = 0; index < GAME_CONSTANTS.maxInputPerSecond; index += 1) {
      runtime.submitInput("socket-a", room.roomCode, {
        seq: index,
        clientTime: index,
        moveX: 0,
        moveY: 0,
        aimX: 1,
        aimY: 0,
        shoot: false,
        dash: false
      }, 100);
    }

    expect(() =>
      runtime.submitInput(
        "socket-a",
        room.roomCode,
        {
          seq: GAME_CONSTANTS.maxInputPerSecond + 1,
          clientTime: 101,
          moveX: 0,
          moveY: 0,
          aimX: 1,
          aimY: 0,
          shoot: false,
          dash: false
        },
        100
      )
    ).toThrowError(RuntimeError);
  });

  it("awards the round to the connected player when reconnect expires", () => {
    const runtime = new NeonDuelRuntime("http://127.0.0.1:4173");
    const room = runtime.createRoom("socket-a", "Alpha", 0);
    runtime.joinRoom("socket-b", room.roomCode, "Bravo", 10);
    runtime.setReady("socket-a", room.roomCode, true, 20);
    runtime.setReady("socket-b", room.roomCode, true, 30);

    advanceTicks(runtime, 30, 100);
    runtime.disconnectSocket("socket-b", 4000);
    const result = runtime.advance(4000 + GAME_CONSTANTS.reconnectGraceMs + 1);

    const summary = runtime.getRoomSummary(room.roomCode);
    expect(result.events.some((event) => event.event.type === "reconnect-expired")).toBe(true);
    expect(summary?.players).toHaveLength(1);
    expect(summary?.players[0]?.score).toBe(1);
    expect(summary?.phase).toBe("waiting");
  });

  it("returns a finished match to the lobby and starts again only after both players agree", () => {
    const runtime = new NeonDuelRuntime("http://127.0.0.1:4173");
    const room = runtime.createRoom("socket-a", "Alpha", 0);
    const joined = runtime.joinRoom("socket-b", room.roomCode, "Bravo", 10);
    setRoomToMatchOver(runtime, room.roomCode);

    const firstRequest = runtime.requestRematch("socket-a", room.roomCode, 20);
    const lobbySummary = runtime.getRoomSummary(room.roomCode);

    expect(firstRequest).toMatchObject({
      requesterId: room.playerId,
      requesterName: "Alpha",
      notifyOpponent: true,
      startedCountdown: false
    });
    expect(lobbySummary).toMatchObject({ phase: "waiting", roundNumber: 1 });
    expect(lobbySummary?.players).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: room.playerId, ready: true, score: 0 }),
        expect.objectContaining({ id: joined.playerId, ready: false, score: 0 })
      ])
    );

    const secondRequest = runtime.requestRematch("socket-b", room.roomCode, 30);

    expect(secondRequest).toMatchObject({ notifyOpponent: false, startedCountdown: true });
    expect(runtime.getRoomSummary(room.roomCode)?.phase).toBe("countdown");
  });
});
