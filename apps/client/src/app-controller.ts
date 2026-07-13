import type Phaser from "phaser";

import { AudioManager } from "./audio/audio-manager";
import { LocalPracticeDriver } from "./game/local-practice";
import type { ArenaDriver, InputFrame } from "./game/types";
import { OnlineSession } from "./network/online-session";
import { AppStore } from "./state";

export class AppController {
  readonly store = new AppStore();
  readonly audio = new AudioManager();
  readonly online = new OnlineSession(this.store, {
    onArenaNeeded: () => this.navigate("arena", "online"),
    onLobbyNeeded: () => this.navigate("lobby", "online"),
    onResult: (winnerName) => {
      this.store.setState({
        result: {
          title: winnerName,
          subtitle: "Match complete"
        },
        view: "result",
        mode: "online"
      });
      this.navigate("result", "online");
    },
    onBanner: (message, kind = "info") =>
      this.store.setState({
        banner: {
          kind,
          message
        }
      }),
    onRoomChanged: (room) =>
      this.store.setState({
        room
      })
  });

  readonly practice = new LocalPracticeDriver(
    () => this.store.getState().playerName,
    (winnerName) => {
      this.store.setState({
        result: {
          title: winnerName,
          subtitle: "Practice concluded"
        },
        view: "result",
        mode: "practice"
      });
      this.navigate("result", "practice");
    }
  );

  private game: Phaser.Game | null = null;

  attachGame(game: Phaser.Game): void {
    this.game = game;
  }

  init(): void {
    this.audio.setEnabled(this.store.getState().soundEnabled);
    const roomCode = new URLSearchParams(window.location.search).get("room");
    if (roomCode) {
      this.store.setState({
        mode: "online",
        view: "lobby",
        roomCodeDraft: roomCode.toUpperCase(),
        connectionLabel: "Attempting reconnect"
      });
      this.online.ensureConnected();
      this.online.tryReconnect(this.store.getState().playerName);
    }
  }

  getActiveDriver(): ArenaDriver {
    return this.store.getState().mode === "online" ? this.online : this.practice;
  }

  setPlayerName(value: string): void {
    this.store.setState({
      playerName: value
    });
  }

  setRoomCodeDraft(value: string): void {
    this.store.setState({
      roomCodeDraft: value.toUpperCase()
    });
  }

  startPractice(): void {
    this.practice.enter();
    this.store.setState({
      view: "arena",
      mode: "practice",
      banner: {
        kind: "info",
        message: "Local practice is running offline."
      },
      room: null,
      latestMatch: null,
      result: null
    });
    this.navigate("arena", "practice");
  }

  openOnlineLobby(): void {
    this.online.ensureConnected();
    this.store.setState({
      view: "lobby",
      mode: "online",
      banner: null,
      result: null
    });
    this.navigate("lobby", "online");
  }

  createRoom(): void {
    this.openOnlineLobby();
    this.online.createRoom(this.store.getState().playerName);
  }

  joinRoom(): void {
    this.openOnlineLobby();
    this.online.joinRoom(this.store.getState().roomCodeDraft, this.store.getState().playerName);
  }

  toggleReady(): void {
    const room = this.store.getState().room;
    const playerId = this.store.getState().playerId;
    const player = room?.players.find((candidate) => candidate.id === playerId);
    this.online.setReady(!(player?.ready ?? false));
  }

  rematch(): void {
    if (this.store.getState().mode === "online") {
      this.online.rematch();
      return;
    }
    this.startPractice();
  }

  leaveRoom(): void {
    this.online.leaveRoom();
    this.store.setState({
      view: "menu",
      mode: "menu",
      room: null,
      latestMatch: null,
      result: null,
      banner: null
    });
    this.navigate("menu", "menu");
  }

  returnToMenu(): void {
    if (this.store.getState().mode === "online") {
      this.online.leaveRoom();
    }
    this.store.setState({
      view: "menu",
      mode: "menu",
      room: null,
      latestMatch: null,
      result: null,
      banner: null
    });
    this.navigate("menu", "menu");
  }

  setSoundEnabled(enabled: boolean): void {
    this.audio.setEnabled(enabled);
    this.store.setState({
      soundEnabled: enabled
    });
  }

  setDebugInputOverride(input: InputFrame | null): void {
    this.online.setDebugInputOverride(input);
  }

  sendDebugCommand(input: InputFrame): void {
    this.online.sendDebugCommand(input);
  }

  private navigate(view: "menu" | "lobby" | "arena" | "result", mode: string): void {
    if (!this.game) {
      return;
    }
    const current = this.store.getState();
    this.store.setState({
      view,
      mode: mode as "menu" | "practice" | "online"
    });
    const sceneKey =
      view === "menu"
        ? "MenuScene"
        : view === "lobby"
          ? "LobbyScene"
        : view === "arena"
            ? "ArenaScene"
            : "ResultScene";
    const activeSceneKeys = this.game.scene.getScenes(true).map((scene) => scene.scene.key);
    if (
      activeSceneKeys.length === 1 &&
      activeSceneKeys[0] === sceneKey &&
      current.view === view &&
      current.mode === mode
    ) {
      return;
    }

    for (const activeSceneKey of activeSceneKeys) {
      if (activeSceneKey !== sceneKey) {
        this.game.scene.stop(activeSceneKey);
      }
    }

    if (!activeSceneKeys.includes(sceneKey)) {
      this.game.scene.start(sceneKey);
    }
  }
}
