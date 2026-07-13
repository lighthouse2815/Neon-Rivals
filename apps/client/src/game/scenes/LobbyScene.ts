import Phaser from "phaser";

export class LobbyScene extends Phaser.Scene {
  private lines?: Phaser.GameObjects.TileSprite;

  constructor() {
    super("LobbyScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#080d1b");
    this.lines = this.add
      .tileSprite(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, "arena-floor")
      .setAlpha(0.24)
      .setTint(0x56f0ff);
    this.scale.on("resize", () => this.resizeBackdrop());
  }

  update(): void {
    this.lines?.setTilePosition(this.time.now * 0.009, 0);
  }

  private resizeBackdrop(): void {
    this.lines?.setPosition(this.scale.width / 2, this.scale.height / 2);
    this.lines?.setSize(this.scale.width, this.scale.height);
  }
}
