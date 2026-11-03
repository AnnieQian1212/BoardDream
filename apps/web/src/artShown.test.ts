import { beforeEach, describe, expect, it } from "vitest";
import { artShown, setArtShown } from "./artShown";

/** A browser's storage, in memory. */
function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
    clear: () => items.clear(),
    key: (i: number) => [...items.keys()][i] ?? null,
    get length() {
      return items.size;
    },
  };
}

describe("which paintings the table shows", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", { value: memoryStorage(), configurable: true });
  });

  it("shows the card art and the painted board until the player hides one", () => {
    expect(artShown("farlight")).toEqual({ cards: true, board: true });
    expect(setArtShown("farlight", "board", false)).toEqual({ cards: true, board: false });
    expect(artShown("farlight")).toEqual({ cards: true, board: false });
  });

  it("remembers each game's choice on its own", () => {
    setArtShown("farlight", "cards", false);
    expect(artShown("highsail")).toEqual({ cards: true, board: true });
    expect(artShown("farlight")).toEqual({ cards: false, board: true });
  });

  it("forgets a game once everything shows again", () => {
    setArtShown("farlight", "board", false);
    setArtShown("farlight", "board", true);
    expect(localStorage.getItem("boarddream.art-shown")).toBe("{}");
  });

  it("shows everything when the browser keeps nothing", () => {
    Object.defineProperty(globalThis, "localStorage", { value: undefined, configurable: true });
    expect(artShown("farlight")).toEqual({ cards: true, board: true });
    expect(setArtShown("farlight", "cards", false)).toEqual({ cards: false, board: true });
  });
});
