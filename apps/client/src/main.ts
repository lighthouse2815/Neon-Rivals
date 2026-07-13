import Phaser from "phaser";

import { AppController } from "./app-controller";
import type { InputFrame } from "./game/types";
import { BootScene } from "./game/scenes/BootScene";
import { LobbyScene } from "./game/scenes/LobbyScene";
import { MenuScene } from "./game/scenes/MenuScene";
import { ResultScene } from "./game/scenes/ResultScene";
import { ArenaScene } from "./game/scenes/ArenaScene";
import "./styles.css";
import { createUiShell } from "./ui/shell";

declare global {
  interface Window {
    __NEON_DUEL__?: {
      getState: () => ReturnType<AppController["store"]["getState"]>;
      setInputOverride: (input: InputFrame | null) => void;
      sendInputCommand: (input: InputFrame) => void;
      requestRematch: () => void;
      getActiveScenes: () => string[];
    };
  }
}

const root = document.getElementById("app");

if (!root) {
  throw new Error("Application root not found.");
}

root.innerHTML = `
  <div class="app-root">
    <div class="game-root"></div>
    <div class="ui-root"></div>
  </div>
`;

const controller = new AppController();
const gameRoot = root.querySelector<HTMLElement>(".game-root");
const uiRoot = root.querySelector<HTMLElement>(".ui-root");

if (!gameRoot || !uiRoot) {
  throw new Error("Unable to mount application layers.");
}

createUiShell(uiRoot, controller);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: gameRoot,
  transparent: true,
  physics: {
    default: "arcade"
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: window.innerWidth,
    height: window.innerHeight
  },
  scene: [new BootScene(), new MenuScene(), new LobbyScene(), new ArenaScene(controller), new ResultScene()]
});

controller.attachGame(game);
controller.init();
window.__NEON_DUEL__ = {
  getState: () => controller.store.getState(),
  setInputOverride: (input) => controller.setDebugInputOverride(input),
  sendInputCommand: (input) => controller.sendDebugCommand(input),
  requestRematch: () => controller.rematch(),
  getActiveScenes: () => game.scene.getScenes(true).map((scene) => scene.scene.key)
};
