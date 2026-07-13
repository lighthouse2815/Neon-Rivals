import {
  beginCountdown,
  createBotInput,
  createEmptyMatchState,
  createPlayerState,
  stepMatch,
  type InputCommand,
  type MatchState,
  type ServerGameEvent
} from "@neon-duel/shared";

import type { ArenaDriver, InputFrame, RenderFrame } from "./types";

const TICK_MS = 1000 / 30;

export class LocalPracticeDriver implements ArenaDriver {
  private match: MatchState;
  private accumulator = 0;
  private localSeq = 0;
  private botSeq = 0;
  private readonly localPlayerId = "local-player";
  private readonly botPlayerId = "bot-player";
  private readonly eventQueue: ServerGameEvent[] = [];
  private projectileCounter = 0;

  constructor(private readonly onMatchComplete: (winnerName: string) => void) {
    this.match = this.createFreshMatch();
  }

  enter(): void {
    this.match = this.createFreshMatch();
    this.accumulator = 0;
    this.localSeq = 0;
    this.botSeq = 0;
    this.projectileCounter = 0;
    this.eventQueue.length = 0;
  }

  leave(): void {
    this.eventQueue.length = 0;
  }

  isPractice(): boolean {
    return true;
  }

  update(now: number, deltaMs: number, input: InputFrame): void {
    this.accumulator += deltaMs;
    while (this.accumulator >= TICK_MS) {
      this.accumulator -= TICK_MS;
      const human = this.match.players.find((player) => player.id === this.localPlayerId);
      const bot = this.match.players.find((player) => player.id === this.botPlayerId);
      if (!human || !bot) {
        return;
      }

      const humanInput: InputCommand = {
        seq: this.localSeq,
        clientTime: now,
        moveX: input.moveX,
        moveY: input.moveY,
        aimX: input.aimX,
        aimY: input.aimY,
        shoot: input.shoot,
        dash: input.dashPressed
      };
      this.localSeq += 1;

      const result = stepMatch(this.match, {
        now,
        dtMs: TICK_MS,
        inputs: new Map([
          [this.localPlayerId, humanInput],
          [this.botPlayerId, createBotInput(bot, human, this.botSeq++, now)]
        ]),
        createProjectileId: () => `local-${this.projectileCounter++}`
      });
      this.eventQueue.push(...result.events);

      if (this.match.phase === "match-over") {
        const winner = this.match.players.find((player) => player.id === this.match.matchWinnerId);
        this.onMatchComplete(winner?.name ?? "Practice Complete");
        break;
      }
    }
  }

  getRenderFrame(): RenderFrame {
    return {
      match: this.match,
      localPlayerId: this.localPlayerId,
      pingMs: 0,
      mode: "practice"
    };
  }

  drainEvents(): ServerGameEvent[] {
    return this.eventQueue.splice(0, this.eventQueue.length);
  }

  private createFreshMatch(): MatchState {
    const match = createEmptyMatchState("LOCAL");
    match.players = [
      createPlayerState(this.localPlayerId, "Pilot One", 0),
      createPlayerState(this.botPlayerId, "Ghost Mirror", 1)
    ];
    for (const player of match.players) {
      player.ready = true;
    }
    beginCountdown(match, Date.now());
    return match;
  }
}
