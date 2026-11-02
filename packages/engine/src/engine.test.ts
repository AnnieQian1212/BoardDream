import { describe, expect, it, test } from "vitest";
import { fitBounds, fuzz, isDeck, isScore, overlappingCells, plannerResult, playMatch, randomBot, randomPlayout, rectPolygon, sampleSeats, scoreOf, simulate, squareGridGeometry, type BalanceStats, type Bot, type Counter, type GameModule } from "./index";

type NimState = { pile: number; toMove: number; numPlayers: number; lastTaker: number | null };

// Take 1-3 stones; whoever takes the last stone wins.
const nim: GameModule<NimState, number> = {
  meta: { id: "nim", name: "Nim", family: "grid", mode: "competitive", minPlayers: 2, maxPlayers: 3, summary: "" },
  params: [{ key: "pile", label: "Stones", kind: "int", min: 5, max: 30, default: 15 }],
  setup: ({ numPlayers, params }) => ({ pile: params.pile, toMove: 0, numPlayers, lastTaker: null }),
  activePlayers: (s) => (s.pile === 0 ? [] : [s.toMove]),
  legalMoves: (s) => [1, 2, 3].filter((n) => n <= s.pile),
  applyMove: (s, player, take) => ({ ...s, pile: s.pile - take, toMove: (player + 1) % s.numPlayers, lastTaker: player }),
  isTerminal: (s) => s.pile === 0,
  outcome: (s) => ({ winners: s.lastTaker === null ? [] : [s.lastTaker] }),
};

type RpsState = { picks: (number | null)[]; wins: number[]; round: number; rounds: number };

// Simultaneous moves: both players pick, the first pick stays hidden until the round resolves.
const rps: GameModule<RpsState, number> = {
  meta: { id: "rps", name: "RPS", family: "bluff", mode: "competitive", minPlayers: 2, maxPlayers: 2, summary: "" },
  params: [{ key: "rounds", label: "Rounds", kind: "int", min: 1, max: 9, default: 3 }],
  setup: ({ params }) => ({ picks: [null, null], wins: [0, 0], round: 0, rounds: params.rounds }),
  activePlayers: (s) => (s.round >= s.rounds ? [] : [0, 1].filter((p) => s.picks[p] === null)),
  legalMoves: () => [0, 1, 2],
  applyMove(s, player, pick) {
    const picks = s.picks.map((x, p) => (p === player ? pick : x));
    if (picks.includes(null)) return { ...s, picks };
    const [a, b] = picks as number[];
    const wins = s.wins.slice();
    if ((a - b + 3) % 3 === 1) wins[0]++;
    else if ((b - a + 3) % 3 === 1) wins[1]++;
    return { ...s, picks: [null, null], wins, round: s.round + 1 };
  },
  isTerminal: (s) => s.round >= s.rounds,
  outcome: (s) => ({ winners: s.wins[0] === s.wins[1] ? [] : [s.wins[0] > s.wins[1] ? 0 : 1] }),
  view: (s, me) => ({ ...s, picks: s.picks.map((x, p) => (p === me || x === null ? x : "hidden")) }),
};

const firstFailure = (game: GameModule) => fuzz(game, { runs: 30 }).failures[0]?.kind;

describe("fuzz", () => {
  it("passes a correct game", () => {
    const report = fuzz(nim, { runs: 200 });
    expect(report.ok).toBe(true);
    expect(report.passed).toBe(200);
  });

  it("catches in-place state mutation", () => {
    expect(
      firstFailure({
        ...nim,
        applyMove: (s, player, take) => {
          s.pile -= take;
          return s;
        },
      }),
    ).toBe("mutated-state");
  });

  it("catches games that never end", () => {
    expect(firstFailure({ ...nim, applyMove: (s, player) => ({ ...s, toMove: (player + 1) % s.numPlayers }) })).toBe(
      "no-termination",
    );
  });

  it("catches a player left without moves", () => {
    expect(firstFailure({ ...nim, legalMoves: (s) => [1, 2, 3].filter((n) => n < s.pile) })).toBe("no-legal-moves");
  });

  it("catches Math.random", () => {
    expect(
      firstFailure({ ...nim, setup: ({ numPlayers }) => ({ pile: 5 + Math.floor(Math.random() * 20), toMove: 0, numPlayers, lastTaker: null }) }),
    ).toBe("nondeterministic");
  });

  it("catches state JSON cannot hold", () => {
    expect(firstFailure({ ...nim, setup: (ctx) => ({ ...nim.setup(ctx), seen: new Set() }) })).toBe("not-serializable");
  });

  it("catches winners that are not seats", () => {
    expect(firstFailure({ ...nim, outcome: () => ({ winners: [7] }) })).toBe("bad-outcome");
  });

  it("catches moves that point outside the board", () => {
    expect(firstFailure({ ...nim, geometry: () => squareGridGeometry(1, 1), moveTarget: () => "nowhere" })).toBe("bad-geometry");
  });

  it("catches a cell badge too long for its token", () => {
    const badged = (badge: unknown) => () => {
      const g = squareGridGeometry(1, 1);
      return { ...g, cells: g.cells.map((c) => ({ ...c, badge: badge as string })) };
    };
    expect(firstFailure({ ...nim, geometry: badged("Elevation 3") })).toBe("bad-geometry");
    expect(firstFailure({ ...nim, geometry: badged(Number.NaN) })).toBe("bad-geometry");
    expect(firstFailure({ ...nim, geometry: badged(3) })).toBeUndefined();
    expect(firstFailure({ ...nim, geometry: badged("+2") })).toBeUndefined();
  });

  it("passes a simultaneous-move game", () => {
    expect(fuzz(rps, { runs: 200 }).ok).toBe(true);
  });
});

describe("hidden information", () => {
  it("shows a simultaneous mover only their own pick", () => {
    const seen: RpsState[] = [];
    const spy: Bot = ({ state, moves, rng }) => {
      seen.push(state as RpsState);
      return rng.pick(moves);
    };
    playMatch(rps, { numPlayers: 2, bots: [randomBot, spy], strict: true });
    expect(seen.length).toBe(3);
    expect(seen.every((view) => view.picks[0] === ("hidden" as unknown))).toBe(true);
  });
});

describe("playMatch", () => {
  it("replays a seed exactly", () => {
    const a = playMatch(nim, { numPlayers: 2, seed: 42 });
    const b = playMatch(nim, { numPlayers: 2, seed: 42 });
    expect(a.trace).toEqual(b.trace);
  });
});

describe("simulate", () => {
  it("accounts for every game", () => {
    const stats = simulate(nim, { numPlayers: 2, games: 200 });
    expect(stats.games).toBe(200);
    expect(stats.drawRate).toBe(0);
    expect(stats.winRateBySeat[0] + stats.winRateBySeat[1]).toBeCloseTo(1);
  });
});

describe("the planner's time limit", () => {
  // Takes the most stones it may, slowly: about 5 ms a move.
  const slow: Bot = ({ moves }) => {
    const until = Date.now() + 5;
    while (Date.now() < until);
    return Math.max(...(moves as number[]));
  };

  it("plays every game when there is time", () => {
    const result = plannerResult(nim, slow, { numPlayers: 2, games: 6 });
    expect(result.games).toBe(6);
  });

  it("stops in the middle of a game at the deadline and counts only whole rounds", () => {
    const start = Date.now();
    // A pile of 30 is about 8 planner moves (40 ms) a game; 60 ms is not enough for a round of two.
    const result = plannerResult(nim, slow, { numPlayers: 2, params: { pile: 30 }, games: 20, deadline: start + 60 });
    expect(Date.now() - start).toBeLessThan(200);
    expect(result.games % 2).toBe(0);
    expect(result.games).toBeLessThan(20);
  });

  it("measures nothing when the first round cannot finish in time", () => {
    const result = plannerResult(nim, slow, { numPlayers: 2, params: { pile: 30 }, games: 4, deadline: Date.now() + 10 });
    expect(result).toEqual({ winRate: 0, games: 0 });
  });
});

describe("fitBounds", () => {
  it("grows a board to cover cells drawn past its declared size, and leaves a tidy one alone", () => {
    const tidy = { width: 4, height: 2, cells: [{ id: "a", polygon: rectPolygon(0, 0, 4, 2) }], pieces: [] };
    expect(fitBounds(tidy)).toBe(tidy);
    const sloppy = {
      width: 4,
      height: 2,
      cells: [{ id: "a", polygon: rectPolygon(0, 0, 4, 2) }, { id: "third-mat", polygon: rectPolygon(4.5, 0, 2, 2) }],
      pieces: [{ id: "p", x: -1, y: 1, r: 0.5 }],
    };
    const fitted = fitBounds(sloppy);
    expect([fitted.width, fitted.height]).toEqual([8, 2]);
    expect(fitted.cells[1].polygon[1]).toEqual([8, 0]);
    expect(fitted.pieces[0].x).toBe(0.5);
  });
});

describe("board cells that cover each other", () => {
  const square = (id: string, x: number, y: number, size = 1, kind?: string) => ({
    id,
    kind,
    polygon: [[x, y], [x + size, y], [x + size, y + size], [x, y + size]] as [number, number][],
  });

  test("side by side is fine, and so is a place wholly inside scenery; one across another's edge is not", () => {
    expect(overlappingCells([square("a", 0, 0), square("b", 1, 0), square("c", 0, 1)])).toBeNull();
    expect(overlappingCells([square("sea", 0, 0, 4), square("harbor", 1, 1, 1), square("isle", 2, 2, 1)])).toBeNull();
    expect(overlappingCells([square("river", 0, 0, 2), square("bridge", 1.2, 0.5, 1.2)])).toMatch(/cells "river" and "bridge" partly overlap/);
  });

  test("building spots, roads and labels may sit on tiles", () => {
    expect(overlappingCells([square("tile", 0, 0, 2), square("v1", 0.9, 0.9, 0.2, "vertex"), square("e1", 0.5, 0.5, 0.2, "edge"), square("name", 0, 0, 2, "label")])).toBeNull();
  });
});

describe("the table's vocabulary", () => {
  const counter = (label: string, resource?: string): Counter => ({ id: label, label, value: 1, resource });

  test("reads the names games give their points as the score, but never a resource", () => {
    for (const label of ["Score", "Victory points", "VP", "Prestige", "Renown", "Glory", "Honour"]) expect(isScore(counter(label)), label).toBe(true);
    for (const label of ["Coins", "Cards in hand", "Round", "Waves"]) expect(isScore(counter(label)), label).toBe(false);
    expect(isScore(counter("Prestige", "prestige"))).toBe(false);
    expect(scoreOf([counter("Coins", "coins"), counter("Round"), counter("Score")])?.label).toBe("Score");
    expect(scoreOf(undefined)).toBeUndefined();
  });

  test("reads stacks of cards as decks", () => {
    for (const label of ["Deck", "Draw pile", "Discard pile", "Event stack"]) expect(isDeck(counter(label)), label).toBe(true);
    expect(isDeck(counter("Coins"))).toBe(false);
    expect(isDeck(counter("Stacked stone", "stone"))).toBe(false);
  });
});

describe("looking at a game", () => {
  test("seats three when the game allows it", () => {
    expect(sampleSeats(nim)).toBe(3);
    expect(sampleSeats({ ...nim, meta: { ...nim.meta, maxPlayers: 2 } })).toBe(2);
    expect(sampleSeats({ ...nim, meta: { ...nim.meta, minPlayers: 4, maxPlayers: 5 } })).toBe(4);
  });

  test("a random playout is the same game for the same seed, and stops when asked", () => {
    const play = (seed: number) => {
      const turns: number[] = [];
      const end = randomPlayout(nim, { seed, maxTurns: 100 }, ({ turn, move }) => void turns.push(turn * 10 + (move as number)));
      return { turns, end };
    };
    expect(play(4)).toEqual(play(4));
    const { turns, end } = play(4);
    expect(turns.map((t) => Math.floor(t / 10))).toEqual(turns.map((_, i) => i));
    expect(nim.isTerminal(end as NimState)).toBe(true);
    expect((end as NimState).numPlayers).toBe(3);

    let seen = 0;
    const stopped = randomPlayout(nim, { seed: 4, maxTurns: 100 }, () => (++seen === 2 ? false : undefined));
    expect(seen).toBe(2);
    expect((stopped as NimState).pile).toBeGreaterThan(0);
    expect(nim.isTerminal(randomPlayout(nim, { seed: 4, maxTurns: 1 }) as NimState)).toBe(false);
  });

  test("simulate reports running statistics, ending with what it returns", () => {
    const heard: BalanceStats[] = [];
    const stats = simulate(nim, { numPlayers: 2, games: 45, statsEvery: 20, onStats: (s) => heard.push(s) });
    expect(heard.map((s) => s.games)).toEqual([20, 40, 45]);
    expect(heard.at(-1)).toEqual(stats);
  });
});
