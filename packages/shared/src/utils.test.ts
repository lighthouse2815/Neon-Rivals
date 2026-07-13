import { describe, expect, it } from "vitest";

import { ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "./constants";
import { createRoomCode } from "./utils";

describe("createRoomCode", () => {
  it("creates a six-character code using the allowed alphabet", () => {
    const code = createRoomCode(() => 0.1);
    expect(code).toHaveLength(ROOM_CODE_LENGTH);
    for (const character of code) {
      expect(ROOM_CODE_ALPHABET.includes(character)).toBe(true);
    }
  });
});
