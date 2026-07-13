import Phaser from "phaser";

import { normalizeVector } from "@neon-duel/shared";

import type { InputFrame } from "./types";

export class InputController {
  private readonly keys: Record<string, Phaser.Input.Keyboard.Key>;
  private dashPressed = false;

  constructor(private readonly scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error("Keyboard input is required.");
    }

    this.keys = keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      altUp: Phaser.Input.Keyboard.KeyCodes.UP,
      altLeft: Phaser.Input.Keyboard.KeyCodes.LEFT,
      altDown: Phaser.Input.Keyboard.KeyCodes.DOWN,
      altRight: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      dash: Phaser.Input.Keyboard.KeyCodes.SPACE,
      escape: Phaser.Input.Keyboard.KeyCodes.ESC
    }) as Record<string, Phaser.Input.Keyboard.Key>;

    keyboard.on("keydown-SPACE", () => {
      this.dashPressed = true;
    });
  }

  sample(localX: number, localY: number): InputFrame {
    const pointer = this.scene.input.activePointer;
    const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const right = this.keys.right;
    const altRight = this.keys.altRight;
    const left = this.keys.left;
    const altLeft = this.keys.altLeft;
    const down = this.keys.down;
    const altDown = this.keys.altDown;
    const up = this.keys.up;
    const altUp = this.keys.altUp;
    const movement = normalizeVector(
      Number(right?.isDown || altRight?.isDown) - Number(left?.isDown || altLeft?.isDown),
      Number(down?.isDown || altDown?.isDown) - Number(up?.isDown || altUp?.isDown)
    );
    const aim = normalizeVector(worldPoint.x - localX, worldPoint.y - localY);
    const frame: InputFrame = {
      moveX: movement.x,
      moveY: movement.y,
      aimX: aim.x === 0 && aim.y === 0 ? 1 : aim.x,
      aimY: aim.x === 0 && aim.y === 0 ? 0 : aim.y,
      shoot: pointer.isDown,
      dashPressed: this.dashPressed
    };
    this.dashPressed = false;
    return frame;
  }
}
