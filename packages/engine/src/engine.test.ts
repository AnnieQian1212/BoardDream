import { describe, expect, it } from "vitest";
import { fuzz, playMatch, simulate, type GameModule } from "./index";

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
