import { Anchor, Coins, Crown, Sailboat, Scroll } from "lucide-react";
import { describe, expect, it } from "vitest";
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
