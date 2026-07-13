import Phaser from "phaser";

import { GAME_CONSTANTS } from "@neon-duel/shared";
import type { PlayerState, ServerGameEvent } from "@neon-duel/shared";

import type { AudioManager } from "../../audio/audio-manager";
import type { RenderFrame } from "../types";

type PlayerVisual = {
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  shield: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
};

export class ArenaRenderer {
  private readonly floor: Phaser.GameObjects.TileSprite;
  private readonly frameGraphics: Phaser.GameObjects.Graphics;
  private readonly centerText: Phaser.GameObjects.Text;
  private readonly playerVisuals = new Map<string, PlayerVisual>();
  private readonly projectileVisuals = new Map<string, Phaser.GameObjects.Image>();
  private readonly hitFlashUntil = new Map<string, number>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly audio: AudioManager
  ) {
    this.floor = scene.add.tileSprite(
      GAME_CONSTANTS.arenaWidth / 2,
      GAME_CONSTANTS.arenaHeight / 2,
      GAME_CONSTANTS.arenaWidth,
      GAME_CONSTANTS.arenaHeight,
      "arena-floor"
    );
    this.frameGraphics = scene.add.graphics();
    this.centerText = scene.add
      .text(GAME_CONSTANTS.arenaWidth / 2, 120, "", {
        fontFamily: "Segoe UI",
        fontSize: "32px",
        fontStyle: "700",
        color: "#ffffff",
        stroke: "#06111d",
        strokeThickness: 8,
        align: "center"
      })
      .setOrigin(0.5);

    this.configureCamera();
    scene.scale.on("resize", () => this.configureCamera());
  }

  render(frame: RenderFrame, now: number): void {
    this.floor.tilePositionX += 0.12;
    this.floor.tilePositionY += 0.04;

    this.drawArenaFrame(now);
    this.updatePlayers(frame.match.players, frame.localPlayerId, now);
    this.updateProjectiles(frame.match.projectiles);
    this.updateCenterText(frame);
  }

  consumeEvents(events: ServerGameEvent[], frame: RenderFrame): void {
    for (const event of events) {
      if (event.type === "shoot") {
        this.audio.playShoot();
      }

      if (event.type === "hit" && event.targetId) {
        const victim = frame.match.players.find((player) => player.id === event.targetId);
        const attacker = frame.match.players.find((player) => player.id === event.actorId);
        if (victim && attacker) {
          this.audio.playHit();
          this.hitFlashUntil.set(victim.id, event.at + 180);
          this.spawnImpact(victim.x, victim.y, victim.slot === 0 ? 0x56f0ff : 0xff4bc8);
          if (victim.id === frame.localPlayerId) {
            this.scene.cameras.main.shake(120, 0.0035);
          }
        }
      }

      if (event.type === "dash" && event.actorId) {
        const player = frame.match.players.find((candidate) => candidate.id === event.actorId);
        if (player) {
          this.audio.playDash();
          this.spawnImpact(player.x, player.y, player.slot === 0 ? 0x56f0ff : 0xff4bc8, 0.6);
        }
      }

      if (event.type === "round-win") {
        this.audio.playRound();
      }

      if (event.type === "match-win") {
        this.audio.playWin();
      }
    }
  }

  private configureCamera(): void {
    const camera = this.scene.cameras.main;
    const zoom = Math.min(
      this.scene.scale.width / (GAME_CONSTANTS.arenaWidth + 160),
      this.scene.scale.height / (GAME_CONSTANTS.arenaHeight + 160)
    );
    camera.setBounds(0, 0, GAME_CONSTANTS.arenaWidth, GAME_CONSTANTS.arenaHeight);
    camera.setZoom(Math.max(0.45, zoom));
    camera.centerOn(GAME_CONSTANTS.arenaWidth / 2, GAME_CONSTANTS.arenaHeight / 2);
  }

  private drawArenaFrame(now: number): void {
    const pulse = 0.18 + Math.sin(now / 520) * 0.04;
    this.frameGraphics.clear();
    this.frameGraphics.lineStyle(6, 0x56f0ff, 0.26 + pulse);
    this.frameGraphics.strokeRoundedRect(
      14,
      14,
      GAME_CONSTANTS.arenaWidth - 28,
      GAME_CONSTANTS.arenaHeight - 28,
      30
    );
    this.frameGraphics.lineStyle(2, 0xff4bc8, 0.24 + pulse);
    this.frameGraphics.strokeRoundedRect(
      34,
      34,
      GAME_CONSTANTS.arenaWidth - 68,
      GAME_CONSTANTS.arenaHeight - 68,
      26
    );
  }

  private updatePlayers(players: PlayerState[], localPlayerId: string, now: number): void {
    const activeIds = new Set(players.map((player) => player.id));
    for (const [playerId, visual] of this.playerVisuals) {
      if (activeIds.has(playerId)) {
        continue;
      }
      visual.sprite.destroy();
      visual.glow.destroy();
      visual.shield.destroy();
      visual.label.destroy();
      this.playerVisuals.delete(playerId);
    }

    for (const player of players) {
      let visual = this.playerVisuals.get(player.id);
      if (!visual) {
        const texture = player.slot === 0 ? "player-cyan" : "player-magenta";
        visual = {
          glow: this.scene.add.image(player.x, player.y, texture).setAlpha(0.24).setScale(1.34),
          sprite: this.scene.add.image(player.x, player.y, texture),
          shield: this.scene.add.image(player.x, player.y, "shield").setAlpha(0),
          label: this.scene.add.text(player.x, player.y - 44, player.name, {
            fontFamily: "Segoe UI",
            fontSize: "18px",
            color: "#ffffff",
            stroke: "#050913",
            strokeThickness: 6
          })
        };
        visual.label.setOrigin(0.5);
        this.playerVisuals.set(player.id, visual);
      }

      const angle = Math.atan2(player.aimY, player.aimX);
      const flash = (this.hitFlashUntil.get(player.id) ?? 0) > now;

      visual.glow.setPosition(player.x, player.y).setRotation(angle).setTint(
        player.id === localPlayerId ? 0x56f0ff : 0xff4bc8
      );
      visual.sprite
        .setPosition(player.x, player.y)
        .setRotation(angle)
        .setAlpha(player.connected ? 1 : 0.46)
        .setTint(flash ? 0xffffff : 0xffffff);
      visual.shield
        .setPosition(player.x, player.y)
        .setAlpha(player.spawnProtectionMs > 0 ? 0.8 : 0)
        .setScale(1 + Math.sin(now / 120) * 0.04);
      visual.label.setPosition(player.x, player.y - 54).setAlpha(player.connected ? 1 : 0.56);
    }
  }

  private updateProjectiles(
    projectiles: RenderFrame["match"]["projectiles"]
  ): void {
    const activeIds = new Set(projectiles.map((projectile) => projectile.id));
    for (const [projectileId, visual] of this.projectileVisuals) {
      if (activeIds.has(projectileId)) {
        continue;
      }
      visual.destroy();
      this.projectileVisuals.delete(projectileId);
    }

    for (const projectile of projectiles) {
      let visual = this.projectileVisuals.get(projectile.id);
      if (!visual) {
        visual = this.scene.add.image(projectile.x, projectile.y, "projectile").setScale(0.7);
        this.projectileVisuals.set(projectile.id, visual);
      }
      visual
        .setPosition(projectile.x, projectile.y)
        .setScale(0.64)
        .setAlpha(0.92)
        .setTint(0xffffff);
    }
  }

  private updateCenterText(frame: RenderFrame): void {
    if (frame.match.phase === "countdown") {
      const seconds = Math.max(1, Math.ceil(frame.match.countdownRemainingMs / 1000));
      this.centerText.setText(`${seconds}`).setAlpha(0.96);
      return;
    }

    if (frame.match.phase === "paused") {
      this.centerText.setText("Reconnect Window").setAlpha(0.9);
      return;
    }

    if (frame.match.phase === "round-over") {
      const winner = frame.match.players.find((player) => player.id === frame.match.winnerId);
      this.centerText.setText(`${winner?.name ?? "Round"} Wins`).setAlpha(0.88);
      return;
    }

    this.centerText.setText("").setAlpha(0);
  }

  private spawnImpact(x: number, y: number, tint: number, scale = 1): void {
    for (let index = 0; index < 7; index += 1) {
      const spark = this.scene.add.image(x, y, "spark").setTint(tint).setScale(0.4 * scale);
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(22, 62) * scale;
      this.scene.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0.04,
        duration: 260,
        ease: "Quad.easeOut",
        onComplete: () => spark.destroy()
      });
    }
  }
}
