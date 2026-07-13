import type { MatchState, ServerGameEvent } from "@neon-duel/shared";

export type InputFrame = {
  moveX: number;
  moveY: number;
  aimX: number;
  aimY: number;
  shoot: boolean;
  dashPressed: boolean;
};

export type RenderFrame = {
  match: MatchState;
  localPlayerId: string;
  pingMs: number;
  mode: "practice" | "online";
};

export interface ArenaDriver {
  enter(): void;
  leave(): void;
  update(now: number, deltaMs: number, input: InputFrame): void;
  getRenderFrame(now: number): RenderFrame | null;
  drainEvents(): ServerGameEvent[];
  isPractice(): boolean;
}
