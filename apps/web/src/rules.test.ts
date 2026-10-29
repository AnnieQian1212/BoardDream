import type { GameModule } from "@boarddream/engine";
import { describe, expect, it } from "vitest";
import { rulesFor } from "./rules";

const game = {
  meta: { rules: ["Each player gets startingCoins Coins.", "Play rounds rounds; most rounds won takes the crown.", "Deal marketSlots Ovens face up."] },
  params: [
    { key: "startingCoins", label: "Starting coins", kind: "int", min: 2, max: 9, default: 6 },
    { key: "rounds", label: "Rounds", kind: "int", min: 4, max: 12, default: 10 },
    { key: "marketSlots", label: "Market slots", kind: "int", min: 3, max: 6, default: 4 },
  ],
} as unknown as GameModule;

describe("rules for players", () => {
  it("write tunables as the numbers they are set to", () => {
    expect(rulesFor(game, { startingCoins: 7, rounds: 10, marketSlots: 4 })).toEqual([
      "Each player gets 7 Coins.",
      "Play 10 rounds; most rounds won takes the crown.",
      "Deal 4 Ovens face up.",
    ]);
  });
});
