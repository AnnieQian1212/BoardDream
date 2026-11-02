import { resolveParams, type GameModule } from "@boarddream/engine";
import { iDoubtIt, lanternIsles } from "@boarddream/library";
import { describe, expect, test } from "vitest";
import { battleStarted, historyFor, isOver, LOG_LIMIT, latestSpeech, nextSeat, playMove, randomStep, restartMatch, startMatch } from "./match";

const human = 0;

describe("a match", () => {
  test("logs each move as the human saw it, and tells each seat the history as that seat saw it", () => {
    let m = startMatch(iDoubtIt, 3, resolveParams(iDoubtIt.params), human, 7);
    for (let i = 0; i < 12 && !isOver(m); i++) {
      const seat = nextSeat(m)!;
      m = playMove(m, seat, m.game.legalMoves(m.state, seat)[0]);
    }
    const plays = m.log.filter((e) => (e.move as { type: string }).type === "play");
    expect(plays.length).toBeGreaterThan(2);
    const rivals = plays.find((e) => e.seat !== human)!;
    const mine = plays.find((e) => e.seat === human)!;
    // The human sees the cards they played, not the ones a rival played.
    expect(mine.text).toMatch(/×/);
    expect(rivals.text).not.toMatch(/×/);
    // Seat 1 hears its own plays as "You", with its real cards, and the human's as a claim only.
    const history = historyFor(m, 1);
    expect(history).toHaveLength(m.log.length);
    const own = m.log.findIndex((e) => e.seat === 1 && (e.move as { type: string }).type === "play");
    expect(history[own]).toMatch(/^You play .*×/);
    const humanPlay = m.log.indexOf(mine);
    expect(history[humanPlay]).toMatch(/^P1 play /);
    expect(history[humanPlay]).not.toMatch(/×/);
  });

  test("keeps the latest moves, numbered on, and what was said", () => {
    let m = startMatch(lanternIsles, 3, resolveParams(lanternIsles.params), human, 3);
    for (let i = 0; i < LOG_LIMIT + 10 && !isOver(m); i++) {
      const seat = nextSeat(m)!;
      m = playMove(m, seat, m.game.legalMoves(m.state, seat)[0], i === LOG_LIMIT + 7 ? "Your harbor is mine." : undefined);
    }
    expect(m.log).toHaveLength(LOG_LIMIT);
    expect(m.log.at(-1)!.id).toBe(LOG_LIMIT + 10);
    expect(latestSpeech(m)).toMatchObject({ text: "Your harbor is mine." });
    m = playMove(m, nextSeat(m)!, m.game.legalMoves(m.state, nextSeat(m)!)[0]);
    m = playMove(m, nextSeat(m)!, m.game.legalMoves(m.state, nextSeat(m)!)[0]);
    // Five moves on, the line is no longer on show.
    expect(latestSpeech(m)).toBeUndefined();
  });

  test("a restart is a new match of the same game", () => {
    const m = startMatch(lanternIsles, 3, resolveParams(lanternIsles.params), human, 1);
    const again = restartMatch(playMove(m, nextSeat(m)!, m.game.legalMoves(m.state, nextSeat(m)!)[0]));
    expect(again.id).not.toBe(m.id);
    expect(again.log).toEqual([]);
    expect(again.game).toBe(lanternIsles);
  });

  test("random steps play to the end and start again", () => {
    let m = startMatch(iDoubtIt, 2, resolveParams(iDoubtIt.params), human, 11);
    const first = m.id;
    let steps = 0;
    while (m.id === first && steps < 5000) {
      m = randomStep(m);
      steps++;
    }
    expect(m.id).not.toBe(first);
    expect(m.log).toEqual([]);
  });
});

/** Two seats take turns; every third move fights a battle with a new id. */
const skirmish: GameModule<{ turn: number }, "go"> = {
  meta: { id: "skirmish", name: "Skirmish", family: "map", mode: "competitive", minPlayers: 2, maxPlayers: 2, summary: "" },
  params: [],
  setup: () => ({ turn: 0 }),
  activePlayers: (s) => [s.turn % 2],
  legalMoves: () => ["go"],
  applyMove: (s) => ({ turn: s.turn + 1 }),
  isTerminal: (s) => s.turn >= 9,
  outcome: () => ({ winners: [] }),
  geometry: (s) => ({
    width: 1,
    height: 1,
    cells: [],
    pieces: [],
    battle:
      s.turn >= 3
        ? { id: `b${Math.floor(s.turn / 3)}`, cellId: "x", attacker: 0, defender: 1, attackerDice: [6], defenderDice: [1], attackerHitOn: 5, defenderHitOn: 5, attackerLosses: 0, defenderLosses: 1 }
        : undefined,
  }),
};

test("knows when the last move fought a new battle", () => {
  let m = startMatch(skirmish as GameModule, 2, {}, human, 1);
  const fought: boolean[] = [];
  while (!isOver(m)) {
    m = playMove(m, nextSeat(m)!, "go");
    fought.push(battleStarted(m));
  }
  // Battles start on turns 3, 6 and 9; the moves between show the same battle, not a new one.
  expect(fought).toEqual([false, false, true, false, false, true, false, false, true]);
  expect(nextSeat(m)).toBeUndefined();
});
