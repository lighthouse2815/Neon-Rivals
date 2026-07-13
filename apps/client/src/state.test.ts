import { describe, expect, it } from "vitest";

import { AppStore } from "./state";

describe("AppStore", () => {
  it("applies partial state updates", () => {
    const store = new AppStore();
    store.setState({
      playerName: "Verifier",
      roomCodeDraft: "ABC123"
    });

    expect(store.getState().playerName).toBe("Verifier");
    expect(store.getState().roomCodeDraft).toBe("ABC123");
  });
});
