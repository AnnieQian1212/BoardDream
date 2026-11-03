import { resolveParams } from "@boarddream/engine";
import { highsail, lanternIsles } from "@boarddream/library";
import { describe, expect, it } from "vitest";
import { gameTexts } from "./translation";

describe("what a player reads about a game, sent to be translated", () => {
  it("holds the rules, every card and the table's English words", () => {
    const texts = gameTexts(highsail, resolveParams(highsail.params));
    expect(texts.name).toBe("Highsail");
    expect(texts.rules.length).toBeGreaterThan(2);
    // Each card once.
    expect(new Set(texts.cards.map((c) => c.title)).size).toBe(texts.cards.length);
    expect(texts.cards.length).toBeGreaterThan(5);
    // Resources, places on the board and panels, as the table shows them.
    for (const word of (highsail.meta.resources ?? []).map((r) => r.name)) expect(texts.terms).toContain(word);
    expect(texts.terms).toContain("Mistwood");
  });

  it("names the actions the turn's prompt and menus use", () => {
    const texts = gameTexts(lanternIsles, resolveParams(lanternIsles.params));
    expect(texts.terms).toContain("settle");
    expect(texts.terms.length).toBeLessThanOrEqual(150);
  });
});
