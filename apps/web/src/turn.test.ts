import { createRng, fitBounds, resolveParams, type GameModule } from "@boarddream/engine";
import { fixtureGames, glasshouse, referenceGames } from "@boarddream/library";
import { describe, expect, test } from "vitest";
import { tidyPanels } from "./panels";
import { kindOf, turnOf } from "./turn";

const human = 0;

describe.each([...referenceGames, ...fixtureGames].map((g) => [g.meta.id, g] as const))("%s, turn by turn", (_id, game) => {
  test("every glowing thing has a kind, every click plays a legal move, and a turn with glow says what to do", () => {
    const rng = createRng(4);
    const players = Math.min(game.meta.maxPlayers, Math.max(game.meta.minPlayers, 3));
    let state = game.setup({ numPlayers: players, params: resolveParams(game.params), rng });
    let mine = 0;
    for (let step = 0; step < 120 && !game.isTerminal(state); step++) {
      const raw = game.geometry?.(state, human);
      const turn = turnOf(game, state, human, tidyPanels(game.panels?.(state, human) ?? []), raw && fitBounds(raw));
      expect(turn.active).toBe(game.activePlayers(state)[0]);
      if (turn.mine) {
        mine++;
        const legal = game.legalMoves(state, human);
        for (const [id, moves] of turn.byTarget) {
          expect(turn.kindOf(id), id).toBeDefined();
          for (const move of moves) expect(legal).toContainEqual(move);
        }
        expect(turn.loose.length + [...turn.byTarget.values()].flat().length).toBe(legal.length);
        if (turn.targets.size > 0) expect(turn.instruction).toMatch(/^Click/);
      } else {
        expect(turn.byTarget.size + turn.loose.length).toBe(0);
        expect(turn.instruction).toBeUndefined();
      }
      const [seat] = game.activePlayers(state);
      state = game.applyMove(state, seat, rng.pick(game.legalMoves(state, seat)), rng);
    }
    expect(mine).toBeGreaterThan(0);
  });
});

test("names resource piles, decks and other counters the same way on both tables", () => {
  const game: GameModule = glasshouse;
  const state = game.setup({ numPlayers: 2, params: resolveParams(game.params), rng: createRng(1) });
  const panels = game.panels!(state, 0);
  const resource = panels.flatMap((p) => p.counters ?? []).find((c) => c.resource)!;
  expect(kindOf(resource.id, panels, undefined)).toBe("pile");
  const card = panels.flatMap((p) => p.cards ?? []).find((c) => !c.faceDown)!;
  expect(kindOf(card.id, panels, undefined)).toBe("card");
  const shared = [{ id: "market", title: "Market", zone: "shared" as const, counters: [{ id: "deck", label: "Deck", value: 30 }, { id: "round", label: "Round", value: 2 }] }];
  expect(kindOf("deck", shared, undefined)).toBe("deck");
  expect(kindOf("round", shared, undefined)).toBe("counter");
  expect(kindOf("nowhere", shared, undefined)).toBeUndefined();
});
