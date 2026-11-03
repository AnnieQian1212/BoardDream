import { Anchor, Coins, Crown, Sailboat, Scroll } from "lucide-react";
import { describe, expect, it, test } from "vitest";
import { cardType, tagStyle } from "./icons";
import { motifFor } from "./motifs";

describe("card motifs", () => {
  it("picks a motif from the words in a title, the noun at the end first", () => {
    expect(motifFor("Harbor Pilot")).toBe(Anchor);
    expect(motifFor("Night Ferry")).toBe(Sailboat);
    expect(motifFor("Crown Charter")).toBe(Scroll);
    expect(motifFor("Baron 3")).toBe(Crown);
    expect(motifFor("Coins +3")).toBe(Coins);
  });

  it("knows plurals and leaves unknown titles to the tag's icon", () => {
    expect(motifFor("Midnight Contracts")).toBe(Scroll);
    expect(motifFor("Zzyx")).toBeUndefined();
  });
});

describe("a card's type stamp", () => {
  test("takes the first tag that names a kind of thing, passing over places", () => {
    expect(cardType(["Lowhaven", "guild"])?.icon).toBe(motifFor("guild"));
    expect(cardType(["Mistwood", "survey"])?.icon).toBe(motifFor("survey"));
    expect(cardType(["cargo", "Ironcrag"])?.icon).toBe(motifFor("cargo"));
  });

  test("falls back to the first tag's style, and a card with no tags has no stamp", () => {
    expect(cardType(["Zephyrine", "Quorl"])).toEqual(tagStyle("Zephyrine"));
    expect(cardType([])).toBeUndefined();
    expect(cardType(undefined)).toBeUndefined();
  });
});
