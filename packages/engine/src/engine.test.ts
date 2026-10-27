import { describe, expect, it } from "vitest";
import { fuzz, playMatch, randomBot, simulate, squareGridGeometry, type Bot, type GameModule } from "./index";

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
