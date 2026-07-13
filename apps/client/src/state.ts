import type { MatchState, RoomSummary } from "@neon-duel/shared";

export type AppView = "menu" | "lobby" | "arena" | "result";
export type AppMode = "menu" | "practice" | "online";

export type BannerState =
  | {
      kind: "info" | "error";
      message: string;
    }
  | null;

export type ResultState =
  | {
      title: string;
      subtitle: string;
    }
  | null;

export type AppState = {
  view: AppView;
  mode: AppMode;
  playerName: string;
  roomCodeDraft: string;
  room: RoomSummary | null;
  latestMatch: MatchState | null;
  playerId: string | null;
  reconnectToken: string | null;
  pingMs: number;
  soundEnabled: boolean;
  settingsOpen: boolean;
  connectionLabel: string;
  banner: BannerState;
  result: ResultState;
};

export type StateListener = (state: AppState) => void;

const DEFAULT_STATE: AppState = {
  view: "menu",
  mode: "menu",
  playerName: "Neon Pilot",
  roomCodeDraft: "",
  room: null,
  latestMatch: null,
  playerId: null,
  reconnectToken: null,
  pingMs: 0,
  soundEnabled: true,
  settingsOpen: false,
  connectionLabel: "Offline ready",
  banner: null,
  result: null
};

export class AppStore {
  private state: AppState = DEFAULT_STATE;
  private readonly listeners = new Set<StateListener>();

  getState(): AppState {
    return this.state;
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setState(patch: Partial<AppState> | ((state: AppState) => AppState)): void {
    this.state =
      typeof patch === "function" ? patch(this.state) : { ...this.state, ...patch };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  reset(): void {
    this.state = DEFAULT_STATE;
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
