import { afterEach, describe, expect, it, vi } from "vitest";

import { AppStore } from "./state";

describe("AppStore", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies partial state updates", () => {
    const store = new AppStore();
    store.setState({
      playerName: "Verifier",
      roomCodeDraft: "ABC123"
    });

    expect(store.getState().playerName).toBe("Verifier");
    expect(store.getState().roomCodeDraft).toBe("ABC123");
  });

  it("restores a changed player name for a new app session", () => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    });

    const firstSession = new AppStore();
    firstSession.setState({ playerName: "Bravo" });

    expect(new AppStore().getState().playerName).toBe("Bravo");
  });
});
