import { describe, expect, test } from "vitest";
import { compositionFor, COMPOSITIONS, coverPrompt } from "./cover";

describe("a box cover's prompt", () => {
  const prompt = coverPrompt({ game: "Lantern Isles", summary: "Settle an archipelago where the tides decide what each coast yields." });

  test("paints the game's world as a scene", () => {
    expect(prompt).toContain("world of Lantern Isles: Settle an archipelago where the tides decide what each coast yields.");
    expect(prompt).toMatch(/hand-painted/i);
    expect(prompt).toMatch(/no dramatic backlight, no glow/);
    expect(prompt).toMatch(/no crowds and no clutter/);
    expect(prompt).toMatch(/never a game board, a map, playing cards/i);
  });

  test("rules out lettering, frames and animals in clothes", () => {
    expect(prompt).toMatch(/no title, caption, logo, lettering/);
    expect(prompt).toMatch(/no paper margin, border or frame/);
    expect(prompt).not.toMatch(/root|ferrin|leder|ghibli|miyazaki/i);
    expect(prompt).toMatch(/humans, not animals in clothes/);
  });
});

test("each game keeps its own framing, and games spread over them", () => {
  expect(compositionFor("lantern-isles")).toBe(compositionFor("lantern-isles"));
  const ids = ["lantern-isles", "highsail", "wildmere", "fenlight", "glasshouse", "mistpass-caravans-mvyngws0", "emberbank-row-mvynluxv", "veiled-firmament-mvyojhow"];
  expect(new Set(ids.map(compositionFor)).size).toBeGreaterThanOrEqual(4);
  expect(coverPrompt({ game: "X", summary: "Y" }, 2)).toContain(COMPOSITIONS[2]);
});
