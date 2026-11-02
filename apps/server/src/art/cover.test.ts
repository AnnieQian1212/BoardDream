import { describe, expect, test } from "vitest";
import { COMPOSITIONS, coverPrompt, LIGHTS, lookFor } from "./cover";

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

  test("lets the setting pick the landscape, and keeps faces out of close-up", () => {
    expect(prompt).toMatch(/the place that world's own words describe/);
    expect(prompt).toMatch(/generous open space/);
    expect(prompt).not.toMatch(/cumulus|lush/);
    expect(prompt).toMatch(/nobody's face fills the frame/);
    expect(prompt).toMatch(/varied in age, build, skin tone and hair/);
    for (const framing of COMPOSITIONS) expect(framing).not.toMatch(/close up|portrait/);
  });
});

test("each game keeps its own framing and light, and games spread over them", () => {
  expect(lookFor("lantern-isles")).toEqual(lookFor("lantern-isles"));
  const ids = ["lantern-isles", "highsail", "wildmere", "fenlight", "glasshouse", "mistpass-caravans-mvyngws0", "emberbank-row-mvynluxv", "veiled-firmament-mvyojhow"];
  const looks = ids.map(lookFor);
  expect(new Set(looks.map((l) => l.composition)).size).toBeGreaterThanOrEqual(4);
  expect(new Set(looks.map((l) => l.light)).size).toBeGreaterThanOrEqual(4);
  const prompt = coverPrompt({ game: "X", summary: "Y" }, { composition: 2, light: 5 });
  expect(prompt).toContain(COMPOSITIONS[2]);
  expect(prompt).toContain(LIGHTS[5]);
});
