import type Phaser from "phaser";

export const createGeneratedTextures = (scene: Phaser.Scene): void => {
  const graphics = scene.add.graphics();

  const makePlayerTexture = (key: string, fillColor: number): void => {
    graphics.clear();
    graphics.fillStyle(fillColor, 0.24);
    graphics.fillCircle(40, 40, 32);
    graphics.fillStyle(fillColor, 0.95);
    graphics.beginPath();
    graphics.moveTo(40, 8);
    graphics.lineTo(70, 40);
    graphics.lineTo(40, 72);
    graphics.lineTo(10, 40);
    graphics.closePath();
    graphics.fillPath();
    graphics.fillStyle(0xffffff, 0.45);
    graphics.fillCircle(40, 40, 10);
    graphics.generateTexture(key, 80, 80);
  };

  makePlayerTexture("player-cyan", 0x56f0ff);
  makePlayerTexture("player-magenta", 0xff4bc8);

  graphics.clear();
  graphics.fillStyle(0xffffff, 1);
  graphics.fillCircle(20, 20, 10);
  graphics.generateTexture("projectile", 40, 40);

  graphics.clear();
  graphics.fillGradientStyle(0x56f0ff, 0xff4bc8, 0xff4bc8, 0x56f0ff, 1, 1, 0.4, 0.4);
  graphics.fillCircle(12, 12, 12);
  graphics.generateTexture("spark", 24, 24);

  graphics.clear();
  graphics.lineStyle(4, 0x56f0ff, 0.8);
  graphics.strokeCircle(24, 24, 20);
  graphics.generateTexture("shield", 48, 48);

  graphics.clear();
  graphics.fillStyle(0x0f1427, 1);
  graphics.fillRect(0, 0, 256, 256);
  graphics.lineStyle(1, 0x13213f, 1);
  for (let index = 0; index <= 256; index += 32) {
    graphics.lineBetween(index, 0, index, 256);
    graphics.lineBetween(0, index, 256, index);
  }
  graphics.generateTexture("arena-floor", 256, 256);

  graphics.destroy();
};
