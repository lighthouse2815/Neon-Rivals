import Phaser from "phaser";

import { GAME_CONSTANTS } from "@neon-duel/shared";

import type { AppController } from "../../app-controller";
import { InputController } from "../input-controller";
import { ArenaRenderer } from "../rendering/arena-renderer";

export class ArenaScene extends Phaser.Scene {
  private inputController?: InputController;
  private arenaRenderer?: ArenaRenderer;

  constructor(private readonly controller: AppController) {
    super("ArenaScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#060912");
    this.physics.world.setBounds(0, 0, GAME_CONSTANTS.arenaWidth, GAME_CONSTANTS.arenaHeight);
    this.inputController = new InputController(this);
    this.arenaRenderer = new ArenaRenderer(this, this.controller.audio);
    this.controller.getActiveDriver().enter();
    this.events.once("shutdown", () => {
      this.controller.getActiveDriver().leave();
    });
  }

  update(_time: number, delta: number): void {
    const driver = this.controller.getActiveDriver();
    const frame = driver.getRenderFrame(Date.now());
    const localPlayer = frame?.match.players.find((player) => player.id === frame.localPlayerId);
    const input = this.inputController?.sample(localPlayer?.x ?? 0, localPlayer?.y ?? 0);
    if (!input) {
      return;
    }

    driver.update(Date.now(), delta, input);
    const nextFrame = driver.getRenderFrame(Date.now());
    if (!nextFrame) {
      return;
    }

    this.controller.store.setState({
      latestMatch: nextFrame.match,
      pingMs: nextFrame.pingMs
    });
    this.arenaRenderer?.render(nextFrame, Date.now());
    this.arenaRenderer?.consumeEvents(driver.drainEvents(), nextFrame);
  }
}
