import { describe, expect, it } from "vitest";

import { GAME_CONSTANTS } from "@neon-duel/shared";

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
});
