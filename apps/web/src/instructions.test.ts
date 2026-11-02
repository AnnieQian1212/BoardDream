import { createRng, resolveParams, sampleSeats } from "@boarddream/engine";
import { referenceGames } from "@boarddream/library";
import { describe, expect, test } from "vitest";
import { actionOf, goalOf, instruction } from "./instructions";

describe("the action a move description starts with", () => {
  test.each([
    ["settle by lagoon", "settle"],
    ["settle by lagoon and fields", "settle"],
    ["lay a free road", "lay a free road"],
    ["build a village by quarry", "build a village"],
    ["upgrade the village by reef, forest and fields to a town", "upgrade the village"],
    ["offer P2 1 stone for 1 fish", "offer"],
    ["gather 2 water", "gather"],
    ["plant Thyme", "plant"],
    ["take Mint from the market", "take"],
    ["send crew to Timber +3", "send crew"],
    ["take the Saltspire Treaty charter", "take"],
    ["recruit a crew member for 4 coins", "recruit a crew member"],
    ["take market tile 1 (free)", "take market tile"],
    ["lay the tile at 0,-1: 1 matching edge", "lay the tile"],
    ["tend the lantern", "tend the lantern"],
    ["slip away to watch P2", "slip away"],
    ["vouch for P2", "vouch"],
  ])("%s → %s", (description, action) => {
    expect(actionOf(description)).toBe(action);
  });
});

describe("the instruction for a turn", () => {
  test("one kind of target, one action", () => {
    expect(instruction(["settle by lagoon", "settle by fields", "settle by reef"].map((description) => ({ kind: "corner" as const, description })))).toBe(
      "Click a glowing corner to settle",
    );
  });

  test("two kinds, the more common first", () => {
    const moves = [
      ...["build a road", "build a road", "build a road"].map((description) => ({ kind: "edge" as const, description })),
      { kind: "corner" as const, description: "build a village by quarry" },
    ];
    expect(instruction(moves)).toBe("Click a glowing edge to build a road, or a corner to build a village");
  });

  test("several actions on one kind", () => {
    const moves = ["gather 2 water", "gather 2 soil", "plant Thyme"].map((description) => ({ kind: "pile" as const, description }));
    expect(instruction(moves)).toBe("Click a glowing pile to gather or plant");
  });

  test("actions that share a verb read as the verb", () => {
    const moves = [
      ...["gather bamboo", "gather glow-oil", "gather reeds"].map((description) => ({ kind: "space" as const, description })),
      ...["craft a violet lantern", "craft ember lantern"].map((description) => ({ kind: "card" as const, description })),
    ];
    expect(instruction(moves)).toBe("Click a glowing space to gather, or a card to craft");
  });

  test("too many kinds says only that glowing things can be clicked", () => {
    const moves = [
      { kind: "card" as const, description: "plant Fern" },
      { kind: "pile" as const, description: "gather 2 water" },
      { kind: "corner" as const, description: "settle by reef" },
    ];
    expect(instruction(moves)).toBe("Click anything that glows");
  });

  test("no targets, no instruction", () => {
    expect(instruction([])).toBeUndefined();
  });

  test.each(referenceGames.map((g) => [g.meta.id, g] as const))("%s gives an instruction on its first turns", (_id, game) => {
    const rng = createRng(5);
    const players = sampleSeats(game);
    let state = game.setup({ numPlayers: players, params: resolveParams(game.params), rng });
    for (let step = 0; step < 30 && !game.isTerminal(state); step++) {
      const [seat] = game.activePlayers(state);
      const moves = game.legalMoves(state, seat);
      const targeted = moves.filter((m) => game.moveTarget?.(state, m) !== undefined);
      if (seat === 0 && targeted.length > 0) {
        const text = instruction(targeted.map((m) => ({ kind: "space" as const, description: game.describeMove?.(state, m, 0) ?? "" })));
        expect(text).toMatch(/^Click a/);
        expect(text!.length).toBeLessThan(110);
      }
      state = game.applyMove(state, seat, rng.pick(moves), rng);
    }
  });
});

test("the goal is the rule about winning", () => {
  const rules = ["Villages sit on corners.", "Village 1 point, town 2. First to the target score wins.", "Trade freely."];
  expect(goalOf(rules, "A game.")).toBe("Village 1 point, town 2. First to the target score wins.");
  expect(goalOf(["Lay tiles."], "Build the best reef.")).toBe("Build the best reef.");
});
