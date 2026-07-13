import Phaser from "phaser";

export class MenuScene extends Phaser.Scene {
  private stripes?: Phaser.GameObjects.TileSprite;

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor("#070a14");
    this.stripes = this.add
      .tileSprite(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, "arena-floor")
      .setAlpha(0.18)
      .setScrollFactor(0);
    this.events.on("resize", () => this.resizeBackdrop());
    this.scale.on("resize", () => this.resizeBackdrop());
  }

  update(): void {
    this.stripes?.setTilePosition(this.time.now * 0.012, this.time.now * 0.007);
  }

  private resizeBackdrop(): void {
    this.stripes?.setPosition(this.scale.width / 2, this.scale.height / 2);
    this.stripes?.setSize(this.scale.width, this.scale.height);
  }
}
