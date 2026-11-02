import { createRng } from "@boarddream/engine";
import { describe, expect, it } from "vitest";
import { battle, battleView, winChance } from "./combat";

describe("dice battles", () => {
  it("rolls a die per unit up to the limit and never takes more units than a side brought", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const r = battle(createRng(seed), 5, 2);
      expect(r.attackerDice).toHaveLength(3);
      expect(r.defenderDice).toHaveLength(2);
      expect([...r.attackerDice].sort((a, b) => b - a)).toEqual(r.attackerDice);
      expect(r.defenderLosses).toBe(Math.min(2, r.attackerDice.filter((d) => d >= 5).length));
      expect(r.attackerLosses).toBe(Math.min(5, r.defenderDice.filter((d) => d >= 5).length));
      expect(r.attackersLeft + r.attackerLosses).toBe(5);
      expect(r.defendersLeft + r.defenderLosses).toBe(2);
      if (r.winner === "attacker") expect(r.defendersLeft === 0 && r.attackersLeft > 0).toBe(true);
    }
  });

  it("is the same battle for the same seed, and a fort makes the defender hit more often", () => {
    expect(battle(createRng(9), 3, 3)).toEqual(battle(createRng(9), 3, 3));
    const losses = (defendOn: number) => {
      let total = 0;
      for (let seed = 1; seed <= 400; seed++) total += battle(createRng(seed), 3, 3, { defendOn }).attackerLosses;
      return total;
    };
    expect(losses(3)).toBeGreaterThan(losses(5));
  });

  it("describes the battle for the table", () => {
    const r = battle(createRng(4), 2, 1, { hitOn: 4 });
    expect(battleView(r, { id: "7", cellId: "t3", attacker: 1, defender: 0 })).toEqual({
      id: "7",
      cellId: "t3",
      attacker: 1,
      defender: 0,
      attackerDice: r.attackerDice,
      defenderDice: r.defenderDice,
      attackerHitOn: 4,
      defenderHitOn: 5,
      attackerLosses: r.attackerLosses,
      defenderLosses: r.defenderLosses,
    });
  });

  it("gives larger attacks a better chance", () => {
    expect(winChance(3, 1)).toBeGreaterThan(winChance(1, 1));
    expect(winChance(1, 2)).toBe(0);
  });
});
