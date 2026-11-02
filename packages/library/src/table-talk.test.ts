import { createRng, resolveParams, type GameModule } from "@boarddream/engine";
import { describe, expect, test } from "vitest";
import { botMove, decideSeat, HISTORY, lanternIsles, liarsDice, socialMoves, type Chooser, type OpponentRequest } from "./index";

/** A seat in Liar's Dice whose bot move is social (every move there is a bid or a call). */
function liarsTurn() {
  const game = liarsDice as GameModule;
  const rng = createRng(5);
  const state = game.setup({ numPlayers: 3, params: resolveParams(game.params), rng });
  const [seat] = game.activePlayers(state);
  return { game, state, seat };
}

/** A chooser that records what it was asked and answers as told. */
function fake(answer: (request: OpponentRequest) => { move: number; say: string } | Error) {
  const asked: OpponentRequest[] = [];
  const choose: Chooser = async (request) => {
    asked.push(request);
    const reply = answer(request);
    if (reply instanceof Error) throw reply;
    return reply;
  };
  return { asked, choose };
}

describe("the decision for a seat", () => {
  test("without a model, the game's own bot decides", async () => {
    const { game, state, seat } = liarsTurn();
    const decision = await decideSeat(game, state, seat, 3, [], createRng(1));
    expect(decision).toEqual({ move: botMove(game, state, seat, createRng(1)), asked: false, overruled: false, failed: false });
  });

  test("a routine move never asks the model", async () => {
    const game = lanternIsles as GameModule;
    const state = game.setup({ numPlayers: 3, params: resolveParams(game.params), rng: createRng(2) });
    const [seat] = game.activePlayers(state);
    // The opening placement is not social.
    expect(socialMoves(game, state, seat, game.legalMoves(state, seat))).toEqual([]);
    const { asked, choose } = fake(() => ({ move: 0, say: "hi" }));
    const decision = await decideSeat(game, state, seat, 3, [], createRng(1), choose);
    expect(asked).toHaveLength(0);
    expect(decision.asked).toBe(false);
  });

  test("a social move asks the model, with the bot's move as advice and the last moves as the seat saw them", async () => {
    const { game, state, seat } = liarsTurn();
    const history = Array.from({ length: HISTORY + 6 }, (_, i) => `P2 move ${i}`);
    const { asked, choose } = fake((request) => ({ move: request.moves.length - 1, say: "  You're bluffing.  " }));
    const decision = await decideSeat(game, state, seat, 3, history, createRng(1), choose);
    expect(asked).toHaveLength(1);
    const [request] = asked;
    expect(request.recent).toEqual(history.slice(-HISTORY));
    expect(request.seat).toBe(seat);
    expect(request.moves.length).toBeGreaterThan(1);
    expect(request.moves[request.advice!]).toBe(game.describeMove?.(state, botMove(game, state, seat, createRng(1)), seat));
    const social = socialMoves(game, state, seat, game.legalMoves(state, seat));
    expect(decision.move).toEqual(social.at(-1));
    expect(decision).toMatchObject({ say: "You're bluffing.", asked: true, failed: false });
    expect(decision.overruled).toBe(request.advice !== request.moves.length - 1);
  });

  test.each([
    ["the model fails", () => new Error("timeout")],
    ["the model answers out of range", () => ({ move: 99, say: "" })],
    ["the model answers with no number", () => ({ move: Number.NaN, say: "" })],
  ])("when %s, the bot's move stands", async (_case, answer) => {
    const { game, state, seat } = liarsTurn();
    const decision = await decideSeat(game, state, seat, 3, [], createRng(1), fake(answer as () => { move: number; say: string } | Error).choose);
    expect(decision).toMatchObject({ move: botMove(game, state, seat, createRng(1)), asked: true, failed: true, overruled: false });
  });
});
