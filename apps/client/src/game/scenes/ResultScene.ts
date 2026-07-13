import Phaser from "phaser";

export class ResultScene extends Phaser.Scene {
  private backdrop?: Phaser.GameObjects.TileSprite;

  constructor() {
    super("ResultScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#090814");
    this.backdrop = this.add
      .tileSprite(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, "arena-floor")
      .setAlpha(0.2)
      .setTint(0xff4bc8);
    this.scale.on("resize", () => this.resizeBackdrop());
  }

  update(): void {
    this.backdrop?.setTilePosition(-this.time.now * 0.01, this.time.now * 0.01);
  }

  private resizeBackdrop(): void {
    this.backdrop?.setPosition(this.scale.width / 2, this.scale.height / 2);
    this.backdrop?.setSize(this.scale.width, this.scale.height);
  }
}
