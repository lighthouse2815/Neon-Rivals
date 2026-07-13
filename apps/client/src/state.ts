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

const DEFAULT_PLAYER_NAME = "Neon Pilot";
const PLAYER_NAME_STORAGE_KEY = "neon-duel-player-name";

const readStoredPlayerName = (): string => {
  try {
    const playerName = globalThis.localStorage?.getItem(PLAYER_NAME_STORAGE_KEY);
    return playerName?.trim() ? playerName : DEFAULT_PLAYER_NAME;
  } catch {
    return DEFAULT_PLAYER_NAME;
  }
};

const persistPlayerName = (playerName: string): void => {
  try {
    globalThis.localStorage?.setItem(PLAYER_NAME_STORAGE_KEY, playerName);
  } catch {
    // Keep the current in-memory name when storage is unavailable.
  }
};

const createDefaultState = (): AppState => ({
  view: "menu",
  mode: "menu",
  playerName: readStoredPlayerName(),
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
});

export class AppStore {
  private state: AppState = createDefaultState();
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
    const previousState = this.state;
    this.state =
      typeof patch === "function" ? patch(this.state) : { ...this.state, ...patch };
    if (this.state.playerName !== previousState.playerName) {
      persistPlayerName(this.state.playerName);
    }
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  reset(): void {
    this.state = createDefaultState();
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}
