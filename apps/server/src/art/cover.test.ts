import { describe, expect, test } from "vitest";
import { coverPrompt } from "./cover";

describe("a box cover's prompt", () => {
  const prompt = coverPrompt({ game: "Lantern Isles", summary: "Settle an archipelago where the tides decide what each coast yields." });

  test("paints the game's world as a scene", () => {
    expect(prompt).toContain("world of Lantern Isles: Settle an archipelago where the tides decide what each coast yields.");
    expect(prompt).toMatch(/never a game board, a map, playing cards/i);
  });

  test("rules out lettering, frames and animals in clothes", () => {
    expect(prompt).toMatch(/no title, caption, logo, lettering/);
    expect(prompt).toMatch(/no paper margin, border or frame/);
    expect(prompt).toMatch(/humans, not animals in clothes/);
  });
});
