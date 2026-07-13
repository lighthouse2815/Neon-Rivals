import Phaser from "phaser";

import { createGeneratedTextures } from "../assets";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  create(): void {
    createGeneratedTextures(this);
    this.scene.start("MenuScene");
  }
}
