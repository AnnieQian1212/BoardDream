import { createRng, evaluate, fuzz, heuristicBot, measureProfile, playMatch, profileGame, randomBot, scoreProfile, simulate, type Bot } from "@boarddream/engine";
import { describe, expect, it } from "vitest";
import {
  catalog,
  defaultBot,
  fenlight,
  fenlightBot,
  fixtureGames,
  GLASSHOUSE_CARDS,
  GLASSHOUSE_RESOURCES,
  glasshouse,
  glasshouseBot,
  hexGame,
  highsail,
  highsailBot,
  iDoubtIt,
  LANTERN_MAP,
  lanternIsles,
  lanternIslesBot,
  lanternScore,
  liarsDice,
  liarsDiceBot,
  lineUp,
  ownBot,
  raceHome,
  referenceGames,
  reversi,
  wildmere,
  wildmereBot,
  WILDMERE_TILES,
  suspicion,
  type FenlightMove,
  type FenlightState,
} from "./index";
import { raisesAbove } from "./mechanics/bidding";
import { deal, draw, numberedDeck, removeCards } from "./mechanics/deck";
import { allCards, cleanup, gainCard, hideDeck, moveCard, newDeck, playCard, trashCard, type PlayerDeck } from "./mechanics/deckbuilding";
import { allPicked, draftOver, hideDraft, passHands, pick, resolve, roundDirection, snakeOrder, startDraft, waiting } from "./mechanics/drafting";
import { countKinds, distinctSets, fullSets, sameKindSets, scoreByKind, scoreDistinctSets, tablePoints } from "./mechanics/sets";
import { drawEvents, hotspots, intensify, rate, relieve, strike, teamOutcome, totalThreat } from "./mechanics/threat";
import { buildHexMap, canRoad, canSettle, radiusCoords, roadSpots, settleSpots } from "./mechanics/hexmap";
import { cornerYield, flipEvent, produce } from "./mechanics/production";
import { bankTrade, settle as settleOffer, swapOptions } from "./mechanics/trade";
import { tileYield, type LanternMove, type LanternState } from "./games/lantern-isles";
import { atLeastProbability, countFace } from "./mechanics/dice";
import { applyEffects, buildDeck, endgameScore, rulesText, validateCards, type CardDef } from "./mechanics/effects";
import { refill, take } from "./mechanics/market";
import { add, canAfford, formatAmounts, pay, shortfall, type Amounts } from "./mechanics/resources";
import { dealRoles, visibleRoles } from "./mechanics/roles";
import { scoreWinners } from "./mechanics/scoring";
import { applyJumps, bounceMove, generateJumps } from "./mechanics/shortcuts";
import { nextSeat } from "./mechanics/turns";
import { majority, topVoted } from "./mechanics/voting";
import { controller, majorityAwards, presence, scoreRegions, standings } from "./mechanics/majority";
import { nextToPlace, openSpaces, place, placedBy } from "./mechanics/workers";
import { islandOf, outpostsLeft, workersLeft, type HighsailMove, type HighsailState } from "./games/highsail";
import { distinctRotations, fit, fits, frontier, hexBoard, partKey, placements, regionIndex, regions, rotate, segmentPoint, segments, squareBoard } from "./mechanics/tiles";
import { rangerSpots, regionPresence, valleyRegions, type WildmereMove, type WildmereState } from "./games/wildmere";
import { START_TILE } from "./games/wildmere-tiles";

describe("reference and fixture games", () => {
  for (const game of [...referenceGames, ...fixtureGames]) {
    // Map games carry big states and geometry through every strict check; give them room.
    it(`${game.meta.id} survives fuzzing across its parameter space`, { timeout: 30_000 }, () => {
      const report = fuzz(game, { runs: 300, determinismChecks: 30 });
      expect(report.failures).toEqual([]);
    });

    it(`${game.meta.id} also passes with its default bot`, () => {
      const bot = defaultBot(game);
      const result = playMatch(game, { numPlayers: game.meta.maxPlayers, bots: new Array(game.meta.maxPlayers).fill(bot), strict: true });
      expect(result.truncated).toBe(false);
    });
  }
});

describe("generic heuristic bot", () => {
  it("beats random play in games it knows nothing about", { timeout: 30_000 }, () => {
    const bot = heuristicBot({ rollouts: 6, depth: 16 });
    for (const game of [reversi, hexGame]) {
      const asFirst = simulate(game, { numPlayers: 2, games: 12, bots: [bot, randomBot] });
      const asSecond = simulate(game, { numPlayers: 2, games: 12, seed: 900, bots: [randomBot, bot] });
      expect((asFirst.winRateBySeat[0] + asSecond.winRateBySeat[1]) / 2, game.meta.id).toBeGreaterThan(0.7);
    }
  });

  it("reads scores from outcome() and seat panels", () => {
    const state = lanternIsles.setup({ numPlayers: 2, params: { target: 10, maxRounds: 30, bankRate: 3, tradesPerTurn: 3, tides: "cycle", randomMap: false }, rng: createRng(1) });
    const ahead = { ...state, phase: "play" as const, buildings: { v10: { owner: 0, level: 2 } } };
    expect(evaluate(lanternIsles, ahead, 0)).toBeGreaterThan(evaluate(lanternIsles, ahead, 1));
  });
});

describe("line-up", () => {
  it("detects a vertical four with gravity", () => {
    // Seat 0 always drops in column 0, seat 1 in column 1: seat 0 completes four first.
    const column = (x: number): Bot => ({ moves, game, state }) =>
      moves.find((m) => game.moveTarget?.(state, m)?.startsWith(`${x},`)) ?? moves[0];
    const result = playMatch(lineUp, { numPlayers: 2, bots: [column(0), column(1)], strict: true });
    expect(result.outcome.winners).toEqual([0]);
    expect(result.turns).toBe(7);
  });
});

describe("reversi", () => {
  const opening = reversi.setup({ numPlayers: 2, params: { size: 8 }, rng: createRng(1) });

  it("offers the four standard opening moves", () => {
    // (3,2), (2,3), (5,4), (4,5) on an 8x8 board.
    expect(reversi.legalMoves(opening, 0)).toEqual([19, 26, 37, 44]);
  });

  it("flips the trapped disc", () => {
    const next = reversi.applyMove(opening, 0, 19, createRng(1));
    expect(next.cells[19]).toBe(0);
    expect(next.cells[27]).toBe(0);
    expect(next.toMove).toBe(1);
  });
});

describe("hex", () => {
  it("wins on a top-to-bottom chain", () => {
    // Seat 0 holds column q = 0 except the bottom cell; claiming it completes the chain.
    const size = 4;
    const cells = new Array(size * size).fill(null);
    for (let r = 0; r < size - 1; r++) cells[r * size] = 0;
    const state = { size, swapRule: false, cells, toMove: 0, moves: 6, winner: null };
    expect(hexGame.applyMove(state, 0, (size - 1) * size, createRng(1)).winner).toBe(0);
  });

  it("mirrors the opening stone on a swap", () => {
    const cells = new Array(16).fill(null);
    cells[1] = 0; // (q 1, r 0)
    const state = { size: 4, swapRule: true, cells, toMove: 1, moves: 1, winner: null };
    expect(hexGame.legalMoves(state, 1)).toContain(-1);
    const next = hexGame.applyMove(state, 1, -1, createRng(1));
    expect(next.cells.flatMap((c, i) => (c === null ? [] : [[i, c]]))).toEqual([[4, 1]]); // (q 0, r 1)
  });
});

describe("race-home", () => {
  const base = {
    trackLength: 16,
    sixToEnter: true,
    maxRounds: 80,
    numPlayers: 2,
    starts: [0, 8],
    toMove: 0,
    round: 0,
    winners: null,
  };

  it("sends a rival back to base when landing on it", () => {
    // Seat 0 moves from square 3 to 5; seat 1's pawn is 13 steps past square 8, which is square 5.
    const state = { ...base, pawns: [[3], [13]], roll: 2 };
    const next = raceHome.applyMove(state, 0, { type: "advance", pawn: 0 }, createRng(1));
    expect(next.pawns).toEqual([[5], [-1]]);
    expect(next.toMove).toBe(1);
  });

  it("protects pawns on start squares", () => {
    // Seat 1's pawn sits on square 0, seat 0's start square.
    const state = { ...base, pawns: [[-1], [8]], roll: 6 };
    const next = raceHome.applyMove(state, 0, { type: "advance", pawn: 0 }, createRng(1));
    expect(next.pawns).toEqual([[0], [8]]);
    expect(next.toMove).toBe(0); // a six rolls again
  });

  it("forces a pass when no pawn can enter", () => {
    const state = { ...base, pawns: [[-1, -1], [-1, -1]], roll: 3 };
    expect(raceHome.legalMoves(state, 0)).toEqual([{ type: "pass" }]);
  });
});

describe("liars-dice", () => {
  const state = {
    numPlayers: 2,
    wildOnes: true,
    dice: [
      [1, 5],
      [5, 3],
    ],
    bid: { quantity: 3, face: 5 },
    bidder: 0,
    toMove: 1,
    lastReveal: null,
    winner: null,
  };

  it("counts wild ones and penalizes a wrong challenge", () => {
    // Fives on the table: 1 (wild) + 5 + 5 = 3, so the bid of three 5s holds and the challenger loses.
    const next = liarsDice.applyMove(state, 1, { type: "liar" }, createRng(1));
    expect(next.lastReveal).toMatchObject({ count: 3, loser: 1 });
    expect(next.dice.map((row) => row.length)).toEqual([2, 1]);
    expect(next.toMove).toBe(1);
  });

  it("hides other players' dice", () => {
    const view = liarsDice.view!(state, 1) as Record<string, unknown>;
    expect(view).not.toHaveProperty("dice");
    expect(view.myDice).toEqual([5, 3]);
    const labels = liarsDice.geometry!(state, 1).pieces.filter((p) => p.owner === 0).map((p) => p.label);
    expect(labels).toEqual(["?", "?"]);
  });

  it("probability bot beats random play", () => {
    const bot = liarsDiceBot();
    const asFirst = simulate(liarsDice, { numPlayers: 2, games: 150, bots: [bot, randomBot] });
    const asSecond = simulate(liarsDice, { numPlayers: 2, games: 150, seed: 1000, bots: [randomBot, bot] });
    const winRate = (asFirst.winRateBySeat[0] + asSecond.winRateBySeat[1]) / 2;
    expect(winRate).toBeGreaterThan(0.75);
  });
});

describe("i-doubt-it", () => {
  const base = {
    numPlayers: 2,
    ranks: 13,
    maxPlays: 180,
    claim: 3,
    phase: "respond" as const,
    toMove: 1,
    plays: 5,
    lastReveal: null,
    winners: null,
  };

  it("gives the pile to a caught liar", () => {
    // Seat 0 played a 5 claiming it was a 3.
    const state = { ...base, hands: [[4, 4], [2, 9]], pile: [7, 7, 5], lastPlay: { player: 0, rank: 5, count: 1, claim: 3 } };
    const next = iDoubtIt.applyMove(state, 1, { type: "doubt" }, createRng(1));
    expect(next.hands[0]).toEqual([4, 4, 5, 7, 7]);
    expect(next.pile).toEqual([]);
    expect(next).toMatchObject({ phase: "play", toMove: 1, claim: 4, winners: null });
  });

  it("lets an honest last play win", () => {
    const state = { ...base, hands: [[], [2, 9]], pile: [3], lastPlay: { player: 0, rank: 3, count: 1, claim: 3 } };
    expect(iDoubtIt.applyMove(state, 1, { type: "doubt" }, createRng(1)).winners).toEqual([0]);
  });

  it("keeps a rival's real cards out of their view and the log", () => {
    const state = { ...base, hands: [[4], [2, 9]], pile: [5], lastPlay: { player: 0, rank: 5, count: 1, claim: 3 } };
    expect(iDoubtIt.view!(state, 1)).toMatchObject({ lastPlay: { player: 0, count: 1, claim: 3 } });
    expect(iDoubtIt.view!(state, 1)).not.toMatchObject({ lastPlay: { rank: 5 } });
    const playing = { ...state, phase: "play" as const, toMove: 0, lastPlay: null };
    expect(iDoubtIt.describeMove!(playing, { type: "play", rank: 5, count: 1 }, 1)).toBe("play 1 card as 3");
    expect(iDoubtIt.describeMove!(playing, { type: "play", rank: 5, count: 1 }, 0)).toBe("play 1 × 5 as 3");
  });
});

describe("glasshouse", () => {
  it("has a valid card list", () => {
    expect(validateCards(GLASSHOUSE_CARDS, GLASSHOUSE_RESOURCES.map((r) => r.id))).toEqual([]);
    expect(buildDeck(GLASSHOUSE_CARDS)).toHaveLength(38);
  });

  it("plants a card, paying for it and scoring it", () => {
    const state = glasshouse.setup({ numPlayers: 2, params: { turns: 14, marketSize: 4, handLimit: 5 }, rng: createRng(1) });
    const seat = { ...state.seats[0], resources: { water: 3, light: 3, soil: 3 }, hand: ["tulip#1"] };
    const next = glasshouse.applyMove({ ...state, seats: [seat, state.seats[1]] }, 0, { type: "plant", card: "tulip#1" }, createRng(1));
    expect(next.seats[0]).toMatchObject({ resources: { water: 2, light: 2, soil: 3 }, points: 2, hand: [], tableau: ["tulip#1"] });
    expect(next.toMove).toBe(1);
  });

  it("harvests every plant's income", () => {
    const state = glasshouse.setup({ numPlayers: 2, params: { turns: 14, marketSize: 4, handLimit: 5 }, rng: createRng(1) });
    const seat = { ...state.seats[0], resources: {}, tableau: ["mint#1", "duckweed#1", "lily#1", "jade#1"] };
    const next = glasshouse.applyMove({ ...state, seats: [seat, state.seats[1]] }, 0, { type: "harvest" }, createRng(1));
    // Mint +1 water, Duckweed +1 water per aquatic (2), Water Lily +1 light, Jade +1 point.
    expect(next.seats[0].resources).toEqual({ water: 3, light: 1 });
    expect(next.seats[0].points).toBe(seat.points + 1);
  });

  it("hides rivals' hands from the panels and the view", () => {
    const state = glasshouse.setup({ numPlayers: 2, params: { turns: 14, marketSize: 4, handLimit: 5 }, rng: createRng(1) });
    const panels = glasshouse.panels!(state, 1);
    expect(panels.filter((p) => p.zone === "hand").map((p) => p.owner)).toEqual([1]);
    const view = glasshouse.view!(state, 1) as typeof state;
    expect(view.seats[0].hand.every((c) => c === "hidden")).toBe(true);
    expect(view.seats[1].hand).toEqual(state.seats[1].hand);
  });

  it("greedy bot beats random play", () => {
    const bot = glasshouseBot();
    const asFirst = simulate(glasshouse, { numPlayers: 2, games: 60, bots: [bot, randomBot] });
    const asSecond = simulate(glasshouse, { numPlayers: 2, games: 60, seed: 500, bots: [randomBot, bot] });
    expect((asFirst.winRateBySeat[0] + asSecond.winRateBySeat[1]) / 2).toBeGreaterThan(0.8);
  });
});

describe("lantern-isles", () => {
  const params = { target: 10, maxRounds: 30, bankRate: 3, tradesPerTurn: 3, tides: "shuffled", randomMap: false };
  const start = (numPlayers = 2) => lanternIsles.setup({ numPlayers, params, rng: createRng(4) });
  const play = (state: LanternState, moves: LanternMove[]) => {
    const rng = createRng(9);
    return moves.reduce((s, m) => lanternIsles.applyMove(s, lanternIsles.activePlayers(s)[0], m, rng), state);
  };
  /** Runs the snake-order setup with each seat taking its first legal corner and road. */
  const afterSetup = (numPlayers = 2) => {
    let s = start(numPlayers);
    while (s.phase === "setup") {
      const seat = lanternIsles.activePlayers(s)[0];
      s = lanternIsles.applyMove(s, seat, lanternIsles.legalMoves(s, seat)[0], createRng(2));
    }
    return s;
  };

  it("places villages and roads in snake order, then starts round one with a tide", () => {
    let s = start(3);
    const seats: number[] = [];
    while (s.phase === "setup") {
      const seat = lanternIsles.activePlayers(s)[0];
      if (s.setup.settled === undefined) seats.push(seat);
      s = lanternIsles.applyMove(s, seat, lanternIsles.legalMoves(s, seat)[0], createRng(2));
    }
    expect(seats).toEqual([0, 1, 2, 2, 1, 0]);
    expect(Object.keys(s.buildings)).toHaveLength(6);
    expect(Object.keys(s.roads)).toHaveLength(6);
    expect(s).toMatchObject({ phase: "play", round: 1, toMove: 0, tidesFlipped: 1 });
    expect(s.tide).toBeDefined();
  });

  it("pays out the second free village's neighbors", () => {
    const next = (st: LanternState) => {
      const seat = lanternIsles.activePlayers(st)[0];
      return lanternIsles.applyMove(st, seat, lanternIsles.legalMoves(st, seat)[0], createRng(2));
    };
    // Order 0, 1, 1, 0: the first two villages pay nothing.
    let s = next(next(next(next(start(2)))));
    expect(s.resources).toEqual([{}, {}]);
    const second = lanternIsles.legalMoves(s, 1)[0] as Extract<LanternMove, { type: "settle" }>;
    s = next(s);
    const expected = cornerYield(LANTERN_MAP, second.vertex, (t) => tileYield(s, t));
    expect(s.resources[1]).toEqual(expected);
    expect(Object.keys(expected).length).toBeGreaterThan(0);
  });

  it("enforces the distance rule and connected roads", () => {
    const s = afterSetup();
    const [mine] = Object.entries(s.buildings).find(([, b]) => b.owner === 0)!;
    const neighbor = LANTERN_MAP.vertices.find((v) => v.id === mine)!.neighbors[0];
    expect(canSettle(LANTERN_MAP, s.buildings, s.roads, neighbor, 0, false)).toBe(false);
    const rich: LanternState = { ...s, resources: [{ wood: 5, stone: 5, grain: 5, fish: 5 }, {}] };
    const roads = lanternIsles.legalMoves(rich, 0).filter((m) => m.type === "road");
    expect(roads.length).toBeGreaterThan(0);
    for (const m of roads) expect(canRoad(LANTERN_MAP, s.buildings, s.roads, (m as { edge: string }).edge, 0)).toBe(true);
  });

  it("builds, upgrades and wins at the target score", () => {
    const s = afterSetup();
    const [vertex] = Object.entries(s.buildings).find(([, b]) => b.owner === 0)!;
    const rich: LanternState = { ...s, target: 3, resources: [{ grain: 4, stone: 4 }, {}] };
    const town = play(rich, [{ type: "town", vertex }]);
    expect(town.buildings[vertex].level).toBe(2);
    expect(lanternScore(town, 0)).toBe(3);
    expect(lanternIsles.isTerminal(town)).toBe(true);
    expect(lanternIsles.outcome(town).winners).toEqual([0]);
  });

  it("trades with the bank and between players", () => {
    const s = afterSetup();
    const banked = play({ ...s, resources: [{ wood: 3 }, {}] }, [{ type: "bank", give: "wood", get: "fish" }]);
    expect(banked.resources[0]).toEqual({ wood: 0, fish: 1 });
    expect(banked.tradesLeft).toBe(2);

    const offering: LanternState = { ...s, resources: [{ wood: 1 }, { fish: 1 }] };
    const offered = play(offering, [{ type: "offer", to: 1, give: "wood", get: "fish" }]);
    expect(lanternIsles.activePlayers(offered)).toEqual([1]);
    expect(lanternIsles.legalMoves(offered, 1).map((m) => m.type)).toEqual(["accept", "decline"]);
    const accepted = play(offered, [{ type: "accept" }]);
    expect(accepted.resources).toEqual([
      { wood: 0, fish: 1 },
      { fish: 0, wood: 1 },
    ]);
    expect(lanternIsles.activePlayers(accepted)).toEqual([0]);
    expect(play(offered, [{ type: "decline" }]).resources).toEqual(offering.resources);
  });

  it("ends after the round limit with the highest score winning", () => {
    let s: LanternState = { ...afterSetup(), maxRounds: 1 };
    s = play(s, [{ type: "end" }, { type: "end" }]);
    expect(lanternIsles.isTerminal(s)).toBe(true);
    expect(lanternIsles.outcome(s).scores).toEqual([2, 2]);
  });

  it("heuristic bot beats random play", () => {
    const bot = lanternIslesBot();
    const asFirst = simulate(lanternIsles, { numPlayers: 2, games: 40, bots: [bot, randomBot] });
    const asSecond = simulate(lanternIsles, { numPlayers: 2, games: 40, seed: 500, bots: [randomBot, bot] });
    expect((asFirst.winRateBySeat[0] + asSecond.winRateBySeat[1]) / 2).toBeGreaterThan(0.85);
  });
});

describe("highsail", () => {
  const params = { rounds: 6, startWorkers: 3, rowSize: 4, handLimit: 3 };
  const start = (numPlayers = 3) => highsail.setup({ numPlayers, params, rng: createRng(4) });
  const act = (s: HighsailState, move: HighsailMove) => highsail.applyMove(s, highsail.activePlayers(s)[0], move, createRng(9));

  it("blocks a taken space and passes the turn", () => {
    let s = start();
    s = act(s, { type: "place", space: "mine" });
    expect(s.resources[0].crystal).toBe(3);
    expect(s.toMove).toBe(1);
    expect(highsail.legalMoves(s, 1).some((m) => m.space === "mine")).toBe(false);
    expect(() => act(s, { type: "place", space: "mine" })).toThrow(/illegal/);
  });

  it("launches a charter: pays, scores and puts an outpost on its island", () => {
    let s = start();
    const card = s.held[0][0];
    s = { ...s, resources: s.resources.map((r, seat) => (seat === 0 ? { timber: 9, crystal: 9, fuel: 9, coins: 9 } : r)) };
    s = act(s, { type: "place", space: "shipyard", card });
    expect(s.launched[0]).toEqual([card]);
    expect(s.held[0]).toEqual([]);
    expect(s.points[0]).toBeGreaterThan(0);
    expect(s.outposts[islandOf(card).id][0]).toBe(1);
    expect(outpostsLeft(s, 0)).toBe(11);
  });

  it("ends the round when every crew is out, then scores islands in the middle and last rounds", () => {
    let s: HighsailState = { ...start(2), outposts: { ...start(2).outposts, ironcrag: [2, 1] } };
    while (s.round === 1) s = act(s, highsail.legalMoves(s, s.toMove).find((m) => m.space === "tavern")!);
    expect(s.placed).toEqual({});
    expect(workersLeft(s, 0)).toBe(3);
    expect(s.lastScoring).toBeUndefined();
    while (s.round <= 3) s = act(s, highsail.legalMoves(s, s.toMove).find((m) => m.space === "tavern")!);
    // Two players: only first place scores, so Ironcrag pays seat 0 its 6.
    expect(s.lastScoring).toEqual({ round: 3, points: [6, 0] });
    while (!highsail.isTerminal(s)) s = act(s, highsail.legalMoves(s, s.toMove).find((m) => m.space === "tavern")!);
    expect(s.points).toEqual([12, 0]);
    expect(highsail.outcome(s).winners).toEqual([0]);
  });

  it("dedicated bot beats random play", () => {
    const bot = highsailBot();
    const asFirst = simulate(highsail, { numPlayers: 2, games: 30, bots: [bot, randomBot] });
    const asSecond = simulate(highsail, { numPlayers: 2, games: 30, seed: 500, bots: [randomBot, bot] });
    expect((asFirst.winRateBySeat[0] + asSecond.winRateBySeat[1]) / 2).toBeGreaterThan(0.85);
  });
});

describe("wildmere", () => {
  const params = { radius: 3, marketSize: 4, rangers: 3 };
  const start = (numPlayers = 3) => wildmere.setup({ numPlayers, params, rng: createRng(4) });
  const act = (s: WildmereState, move: WildmereMove) => wildmere.applyMove(s, s.toMove, move, createRng(9));
  const solid = (terrain: string) => WILDMERE_TILES.findIndex((t) => t.every((e) => e === terrain));

  it("deals exactly the tiles that fill the valley", () => {
    const s = start();
    expect(s.supply.length + s.market.length).toBe(36);
    expect(s.placed).toEqual({ "0,0": { edges: START_TILE } });
    expect(s.funds).toEqual([2, 2, 3]);
    expect((wildmere.view!(s, 1) as WildmereState).supply).toEqual(s.supply.slice().sort((a, b) => a - b));
  });

  it("leaves a fund on every skipped tile, pays out the taken one's, and turns it", () => {
    let s = act(start(), { type: "take", slot: 2 });
    expect(s.funds[0]).toBe(0);
    expect(s.market.map((m) => m.funds)).toEqual([1, 1, 0, 0]);
    expect(s.phase).toBe("place");
    expect(wildmere.legalMoves(s, 0).filter((m) => m.type === "place")).toHaveLength(6);
    s = act(act(act(s, { type: "turn", dir: 1 }), { type: "turn", dir: -1 }), { type: "turn", dir: -1 });
    expect(s.held!.rotation).toBe(5);
    s = act(s, wildmere.legalMoves(s, 0).find((m) => m.type === "place")!);
    if (s.phase === "ranger") s = act(s, { type: "done" });
    expect(s.toMove).toBe(1);
    // Seat 1 has 2 funds, so the fourth slot (3 funds to reach) is out of reach.
    expect(wildmere.legalMoves(s, 1).map((m) => (m.type === "take" ? m.slot : -1))).toEqual([0, 1, 2]);
    expect(act(s, { type: "take", slot: 0 }).funds[1]).toBe(3);
  });

  it("scores a region the moment its last open edge is covered, for whoever placed most of it", () => {
    // The start tile's woodland (sides 0 and 1) runs into seat 1's tile east of it; only side 1 is open.
    const meadow = ["meadow", "meadow", "meadow", "woodland", "meadow", "meadow"];
    let s: WildmereState = {
      ...start(),
      placed: { "0,0": { edges: START_TILE }, "1,0": { edges: meadow, owner: 1 } },
      phase: "place",
      held: { tile: solid("meadow"), rotation: 0, turns: 0 },
      funds: [5, 3, 3],
    };
    // A meadow tile below the start tile shuts the woodland in, and joins seat 1's meadow.
    s = act(s, { type: "place", cell: "0,1" });
    expect(s.completed).toEqual([{ terrain: "woodland", size: 2, points: [0, 2, 0] }]);
    expect(s.points).toEqual([0, 2, 0]);
    expect(s.funds[0]).toBe(5);
    expect(s.phase).toBe("ranger");
    expect(rangerSpots(s)).toEqual([0]);
    s = act(s, { type: "ranger", side: 0 });
    expect([s.funds[0], s.rangersLeft[0], s.toMove]).toEqual([3, 2, 1]);
    const all = valleyRegions(s);
    const meadowRegion = all.find((r) => r.terrain === "meadow" && r.cells.includes("0,1"))!;
    expect([...meadowRegion.cells].sort()).toEqual(["0,1", "1,0"]);
    expect(regionPresence(s, meadowRegion, regionIndex(all))).toEqual([3, 1, 0]);
  });

  it("closes a region on the neutral start tile without paying anyone", () => {
    // The start tile's heath is a single side; a woodland tile across it closes it.
    let s: WildmereState = { ...start(), phase: "place", held: { tile: solid("woodland"), rotation: 0, turns: 0 } };
    s = act(s, { type: "place", cell: "1,-1" });
    expect(s.completed).toEqual([{ terrain: "heath", size: 1, points: [0, 0, 0] }]);
  });

  it("ends when the valley is full, with every ranger home", () => {
    const result = playMatch(wildmere, { numPlayers: 3, params, seed: 3, strict: true });
    const s = result.finalState as WildmereState;
    expect(Object.keys(s.placed)).toHaveLength(37);
    expect(valleyRegions(s).every((r) => r.open === 0)).toBe(true);
    expect(s.rangers).toEqual([]);
    expect(s.rangersLeft).toEqual([3, 3, 3]);
    expect(result.outcome.winners.length).toBeGreaterThan(0);
  });

  it("dedicated bot beats random play", { timeout: 30_000 }, () => {
    const bot = wildmereBot();
    const asFirst = simulate(wildmere, { numPlayers: 2, games: 10, bots: [bot, randomBot] });
    const asSecond = simulate(wildmere, { numPlayers: 2, games: 10, seed: 500, bots: [randomBot, bot] });
    expect((asFirst.winRateBySeat[0] + asSecond.winRateBySeat[1]) / 2).toBeGreaterThan(0.85);
  });
});

describe("game profile", () => {
  it("rates an abstract as luck-free and interactive, a dice race as luck-driven and solitary", () => {
    const abstract = profileGame(reversi, { numPlayers: 2, games: 6 });
    expect(abstract.measures.setupChance).toBe(false);
    expect(abstract.measures.chanceRate).toBe(0);
    expect(abstract.luck).toBe(1);
    expect(abstract.interaction).toBeGreaterThanOrEqual(4.5);
    const race = profileGame(raceHome, { numPlayers: 2, games: 6 });
    expect(race.luck).toBeGreaterThanOrEqual(4);
    expect(race.interaction).toBeLessThan(1.5);
    expect(race.strategy).toBeUndefined();
  });

  it("measures strategy with a planner and ranks heavier games as more complex", () => {
    const measures = measureProfile(liarsDice, { numPlayers: 2, games: 6, planner: ownBot(liarsDice), plannerGames: 10 });
    expect(measures.plannerWinRate).toBeGreaterThan(0.7);
    expect(scoreProfile(measures).strategy).toBeGreaterThan(3.5);
    expect(profileGame(highsail, { games: 4 }).complexity).toBeGreaterThan(profileGame(lineUp, { numPlayers: 2, games: 4 }).complexity + 1.5);
  });
});

describe("fenlight", () => {
  const params = { nights: 6, lostLimit: 4, fog: 1 };
  const start = (numPlayers = 6) => fenlight.setup({ numPlayers, params, rng: createRng(5) });
  const act = (s: FenlightState, seat: number, move: FenlightMove, seed = 1) => fenlight.applyMove(s, seat, move, createRng(seed));
  const wisps = (s: FenlightState) => s.roles.flatMap((r, seat) => (r === "wisp" ? [seat] : []));

  it("deals two wisps who know each other and pairs everyone at lanterns", () => {
    const s = start(7);
    expect(wisps(s)).toHaveLength(2);
    expect(s.posts.map((p) => p.length).sort()).toEqual([2, 2, 3]);
    expect(s.posts.flat().sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
    const [w1, w2] = wisps(s);
    const keeper = s.roles.indexOf("keeper");
    expect((fenlight.view!(s, w1) as FenlightState).roles[w2]).toBe("wisp");
    expect((fenlight.view!(s, keeper) as FenlightState).roles.filter((r) => r !== null)).toEqual(["keeper"]);
    expect(fenlight.legalMoves(s, keeper).some((m) => m.type === "dim")).toBe(false);
    expect(fenlight.legalMoves(s, w1).some((m) => m.type === "dim")).toBe(true);
  });

  it("darkens a lantern a wisp puts out, loses a boat, and tells a watcher", () => {
    let s: FenlightState = { ...start(6), fog: 0 };
    const [wisp] = wisps(s);
    const post = s.posts.findIndex((p) => p.includes(wisp));
    const watcher = s.posts.flat().find((seat) => !s.posts[post].includes(seat))!;
    for (const seat of fenlight.activePlayers(s)) {
      s = act(s, seat, seat === wisp ? { type: "dim" } : seat === watcher ? { type: "watch", target: wisp } : { type: "tend" });
    }
    expect(s.phase).toBe("day");
    expect(s.boatsLost).toBe(1);
    expect(s.reports[0].dark).toEqual([post]);
    expect(s.sightings).toEqual([{ seat: watcher, night: 1, target: wisp, dimmed: true }]);
    expect((fenlight.view!(s, wisp) as FenlightState).sightings).toEqual([]);
    // The watcher's own lantern stayed lit: their partner tended it.
    expect(s.reports[0].lost).toBe(1);
  });

  it("lets fog make a lit lantern look dark without losing a boat", () => {
    let s = start(6);
    for (const seat of fenlight.activePlayers(s)) s = act(s, seat, { type: "tend" });
    expect(s.reports[0]).toMatchObject({ lost: 0 });
    expect(s.reports[0].dark).toHaveLength(1);
    expect(s.boatsLost).toBe(0);
  });

  it("hears everyone once, then exiles a player only with more than half the votes", () => {
    let s = start(6);
    for (const seat of fenlight.activePlayers(s)) s = act(s, seat, { type: "tend" });
    const speakers: number[] = [];
    while (s.phase === "day") {
      speakers.push(s.speaker);
      s = act(s, s.speaker, { type: "quiet" });
    }
    expect(speakers).toEqual([0, 1, 2, 3, 4, 5]);
    const keeper = s.roles.indexOf("keeper");
    // Three of six votes is not enough.
    const voteFor = (state: FenlightState, target: number, voters: number) =>
      fenlight.activePlayers(state).reduce((acc, seat, i) => act(acc, seat, i < voters && seat !== target ? { type: "vote", target } : { type: "abstain" }), state);
    const tied = voteFor(s, keeper, 3);
    expect(tied.days[0].exiled).toBe(null);
    expect(tied.night).toBe(2);
    const out = voteFor(s, keeper, 5);
    expect(out.days[0].exiled).toBe(keeper);
    expect((fenlight.view!(out, wisps(out)[0]) as FenlightState).roles[keeper]).toBe("keeper");
    expect(fenlight.panels!(out, 0).find((p) => p.id === "causeway")!.counters![2].value).toBe(2);
  });

  it("catches a claim the dawn report disproves", () => {
    let s = start(6);
    for (const seat of fenlight.activePlayers(s)) s = act(s, seat, { type: "tend" });
    const litSeat = s.posts.find((_, i) => !s.reports[0].dark.includes(i))![0];
    const liar = s.posts.flat().find((seat) => seat !== litSeat)!;
    const keeper = s.posts.flat().find((seat) => seat !== litSeat && seat !== liar)!;
    const view = fenlight.view!(s, keeper) as FenlightState;
    const before = suspicion(view, keeper)[liar];
    const after = suspicion({ ...view, statements: [{ seat: liar, kind: "report", target: litSeat, dimmed: true }] }, keeper)[liar];
    expect(after - before).toBeGreaterThanOrEqual(1);
  });

  it("plays sound games, and its bot keepers beat random keepers", () => {
    expect(fuzz(fenlight, { runs: 200 }).ok).toBe(true);
    const keepersWin = (keeperBot: Bot) => {
      let wins = 0;
      for (let i = 0; i < 60; i++) {
        const bot = fenlightBot();
        const mixed: Bot = (args) => ((args.state as FenlightState).roles[args.player] === "wisp" ? bot(args) : keeperBot(args));
        const r = playMatch(fenlight, { numPlayers: 7, params, seed: 300 + i, bots: new Array(7).fill(mixed) });
        if ((r.finalState as FenlightState).winner === "keeper") wins++;
      }
      return wins / 60;
    };
    expect(keepersWin(fenlightBot())).toBeGreaterThan(keepersWin(randomBot) + 0.2);
  });
});

describe("mechanics", () => {
  it("drafts by picking one card and passing the rest, all seats at once", () => {
    let draft = startDraft([["a1", "a2", "a3"], ["b1", "b2", "b3"], ["c1", "c2", "c3"]]);
    expect(waiting(draft)).toEqual([0, 1, 2]);
    draft = pick(pick(draft, 0, 2), 2, 0);
    expect(waiting(draft)).toEqual([1]);
    expect(() => pick(draft, 0, 1)).toThrow();
    expect(() => pick(draft, 1, 3)).toThrow();
    expect(() => resolve(draft)).toThrow();
    // Seat 1 sees its own hand and that the others have picked, not what.
    expect(hideDraft(draft, 1, "?")).toEqual({
      hands: [["?", "?", "?"], ["b1", "b2", "b3"], ["?", "?", "?"]],
      picks: ["hidden", null, "hidden"],
      direction: 1,
    });
    draft = pick(draft, 1, 1);
    expect(allPicked(draft)).toBe(true);
    const step = resolve(draft);
    expect(step.picked).toEqual(["a3", "b2", "c1"]);
    // Seat 0's leftovers go to seat 1, and seat 2's wrap around to seat 0.
    expect(step.draft.hands).toEqual([["c2", "c3"], ["a1", "a2"], ["b1", "b3"]]);
    expect(step.draft.picks).toEqual([null, null, null]);
    expect(draftOver(step.draft)).toBe(false);
    expect(draftOver(step.draft, 2)).toBe(true);
    expect(passHands([["a"], ["b"], ["c"]], -1)).toEqual([["b"], ["c"], ["a"]]);
    expect([0, 1, 2].map(roundDirection)).toEqual([1, -1, 1]);
    expect(snakeOrder(3, 2)).toEqual([0, 1, 2, 2, 1, 0]);
    expect(snakeOrder(2, 3, 1)).toEqual([1, 0, 0, 1, 1, 0]);
    // A seat with an empty hand never waits.
    expect(waiting(startDraft([["a"], []]))).toEqual([0]);
  });

  it("scores sets of matching and of different kinds", () => {
    const counts = countKinds(["fish", "fern", "fish", "shell", "fish"]);
    expect(counts).toEqual({ fish: 3, fern: 1, shell: 1 });
    expect(countKinds([{ suit: "x" }, { suit: "y" }, { suit: "x" }], (c) => c.suit)).toEqual({ x: 2, y: 1 });
    expect([0, 1, 3, 9].map((n) => tablePoints(n, [1, 3, 6]))).toEqual([0, 1, 6, 6]);
    expect(distinctSets(counts)).toEqual([3, 1, 1]);
    expect(distinctSets(counts, ["fish", "fern"])).toEqual([2, 1, 1]);
    expect(distinctSets({ a: 2, b: 2, c: 1 }, undefined, 2)).toEqual([2, 2, 1]);
    expect(fullSets(counts, ["fish", "fern", "shell"])).toBe(1);
    expect(fullSets(counts, ["fish", "coral"])).toBe(0);
    expect(sameKindSets({ a: 5, b: 2 }, 2)).toBe(3);
    expect(scoreByKind({ a: 3, b: 1 }, [1, 3, 6])).toBe(7);
    expect(scoreDistinctSets(counts, [1, 3, 6])).toBe(8);
  });

  it("builds a deck: play, buy into the discards, clean up and reshuffle", () => {
    const rng = createRng(2);
    let deck = newDeck(rng, ["c1", "c2", "c3", "c4", "c5", "e1", "e2"], 5);
    expect(deck.hand).toHaveLength(5);
    expect(deck.drawPile).toHaveLength(2);
    const [first, second] = deck.hand;
    deck = playCard(deck, first);
    expect(deck.inPlay).toEqual([first]);
    expect(() => playCard(deck, first)).toThrow();
    deck = gainCard(deck, "gold1");
    deck = trashCard(deck, second);
    expect(allCards(deck).sort()).toEqual(["c1", "c2", "c3", "c4", "c5", "e1", "e2", "gold1"].filter((c) => c !== second).sort());
    // Cleanup discards 4 cards, draws the 2 left and reshuffles the discards for the other 3.
    deck = cleanup(rng, deck, 5);
    expect(deck.hand).toHaveLength(5);
    expect(deck.inPlay).toEqual([]);
    expect(deck.drawPile.length + deck.discard.length).toBe(2);
    expect(allCards(deck)).toHaveLength(7);
    const top = moveCard(gainCard(deck, "map1", "drawPile"), deck.hand[0], "hand", "drawPile");
    expect(top.drawPile.slice(0, 2)).toEqual([deck.hand[0], "map1"]);
    const seen: PlayerDeck<string> = hideDeck(deck, false, "?");
    expect(seen.hand).toEqual(["?", "?", "?", "?", "?"]);
    expect(hideDeck(deck, true, "?").hand).toEqual(deck.hand);
  });

  it("strikes places with threat that overflows into neighbors and escalates", () => {
    // A ring of four rooms: a-b-c-d-a.
    const ring: Record<string, string[]> = { a: ["b", "d"], b: ["a", "c"], c: ["b", "d"], d: ["c", "a"] };
    const near = (place: string) => ring[place];
    expect(strike({}, "a", 2, 3, near)).toEqual({ levels: { a: 2 }, overflows: [] });
    // a overflows into b and d; b, already full, overflows into c; nobody overflows twice.
    const chain = strike({ a: 3, b: 3, c: 1 }, "a", 1, 3, near);
    expect(chain.overflows).toEqual(["a", "b"]);
    expect(chain.levels).toEqual({ a: 3, b: 3, c: 2, d: 1 });
    // Every place full: the chain still ends, each overflowing once.
    expect(strike({ a: 3, b: 3, c: 3, d: 3 }, "c", 1, 3, near).overflows.sort()).toEqual(["a", "b", "c", "d"]);
    expect(relieve({ a: 2 }, "a", 5)).toEqual({ a: 0 });
    expect(totalThreat(chain.levels)).toBe(9);
    expect(hotspots(chain.levels, 2)).toEqual(["a", "b", "c"]);
    expect([0, 1, 4, 9].map((n) => rate(n, [2, 2, 3, 3, 4]))).toEqual([2, 2, 4, 4]);
    const rng = createRng(3);
    const drawn = drawEvents(rng, { drawPile: ["a", "b"], discard: [] }, 3);
    expect(drawn.events.slice(0, 2)).toEqual(["a", "b"]);
    expect(drawn.deck.drawPile.length + drawn.deck.discard.length).toBe(2);
    const surged = intensify(rng, { drawPile: ["x"], discard: ["a", "b"] });
    expect(surged.drawPile.slice(0, 2).sort()).toEqual(["a", "b"]);
    expect(surged.drawPile[2]).toBe("x");
    expect(teamOutcome(true, 3)).toEqual({ winners: [0, 1, 2] });
    expect(teamOutcome(false, 3)).toEqual({ winners: [] });
  });

  it("places workers on spaces with room", () => {
    const spaces = [{ id: "mine", capacity: 1 }, { id: "dock", capacity: 2 }, { id: "inn" }];
    let placed = place({}, "mine", 0);
    expect(openSpaces(spaces, placed, 1).map((sp) => sp.id)).toEqual(["dock", "inn"]);
    placed = place(place(placed, "dock", 1), "dock", 1);
    expect(openSpaces(spaces, placed, 0).map((sp) => sp.id)).toEqual(["inn"]);
    expect(openSpaces(spaces, place({}, "dock", 0), 0, true).map((sp) => sp.id)).toEqual(["mine", "inn"]);
    expect(placedBy(placed, 1)).toBe(2);
    // Seat 1 is out of workers, so after seat 0 comes seat 2, then nobody.
    expect(nextToPlace([0, 1, 2], 0, (seat) => (seat === 1 ? 0 : 1))).toBe(2);
    expect(nextToPlace([0, 1, 2], 0, () => 0)).toBeUndefined();
  });

  it("turns tiles, splits them into segments and matches edges", () => {
    expect(rotate(["a", "b", "c", "d"], 1)).toEqual(["d", "a", "b", "c"]);
    expect(rotate(["a", "b", "c", "d"], -1)).toEqual(["b", "c", "d", "a"]);
    expect(segments(["a", "b", "b", "a", "a", "a"])).toEqual([
      { terrain: "b", sides: [1, 2] },
      { terrain: "a", sides: [3, 4, 5, 0] },
    ]);
    expect(segments(["a", "a", "a", "a"])).toEqual([{ terrain: "a", sides: [0, 1, 2, 3] }]);
    expect(partKey("x", ["a", "b", "b", "a", "a", "a"], 0)).toBe("x:0");
    expect(partKey("x", ["a", "b", "b", "a", "a", "a"], 2)).toBe("x:1");
    expect(distinctRotations(["a", "b", "a", "b"])).toEqual([0, 1]);
    const board = squareBoard(3, 3);
    expect(board.byId["1,1"].neighbors).toEqual(["1,0", "2,1", "1,2", "0,1"]);
    expect(board.byId["0,0"].neighbors).toEqual([undefined, "1,0", "0,1", undefined]);
    const placed = { "1,1": { edges: ["road", "field", "field", "field"] } };
    expect(frontier(board, placed)).toEqual(["1,0", "0,1", "2,1", "1,2"]);
    // The tile north of it meets the road with its south edge.
    expect(fit(board, placed, "1,0", ["x", "x", "road", "x"])).toEqual({ touching: 1, matching: 1, mismatched: 0 });
    expect(fits(board, placed, "1,0", ["x", "x", "field", "x"])).toBe(false);
    expect(fits(board, placed, "1,0", ["x", "x", "field", "x"], false)).toBe(true);
    expect(fits(board, placed, "0,0", ["road", "road", "road", "road"], false)).toBe(false);
    expect(placements(board, placed, ["road", "road", "road", "road"])).toEqual([{ cell: "1,0", rotation: 0, matching: 1 }]);
  });

  it("joins matching edges into regions, closed by mismatches and the rim", () => {
    const board = hexBoard(1);
    expect(board.cells).toHaveLength(7);
    expect(board.byId["0,0"].neighbors).toEqual(["1,0", "0,1", "-1,1", "-1,0", "0,-1", "1,-1"]);
    const sea = new Array(6).fill("sea");
    const land = new Array(6).fill("land");
    const placed: Record<string, { edges: string[] }> = { "0,0": { edges: ["sea", "sea", "sea", "land", "land", "land"] } };
    expect(regions(board, placed).map((r) => [r.terrain, r.cells.length, r.open, r.rim])).toEqual([
      ["sea", 1, 3, 0],
      ["land", 1, 3, 0],
    ]);
    // A sea tile east joins the sea; three of its sides face past the rim.
    placed["1,0"] = { edges: sea };
    expect(regions(board, placed).find((r) => r.terrain === "sea")).toMatchObject({ id: "0,0:0", cells: ["0,0", "1,0"], open: 4, rim: 3 });
    // A land tile below both closes two of the sea's edges without joining it.
    placed["0,1"] = { edges: land };
    const list = regions(board, placed);
    expect(list.find((r) => r.terrain === "sea")!.open).toBe(2);
    expect(list.filter((r) => r.terrain === "land").map((r) => r.cells)).toEqual([["0,0"], ["0,1"]]);
    expect(regionIndex(list)["1,0:0"].id).toBe("0,0:0");
    expect(segmentPoint(board, "0,1", [0, 1, 2, 3, 4, 5])).toEqual(board.byId["0,1"].center);
  });

  it("scores area majorities with ties splitting the places they span", () => {
    expect(standings([2, 0, 3, 2])).toEqual([[2], [0, 3]]);
    expect(majorityAwards([3, 1, 0], [6, 3])).toEqual([6, 3, 0]);
    expect(majorityAwards([2, 2, 1], [6, 3])).toEqual([4, 4, 0]);
    expect(majorityAwards([0, 0, 0], [6, 3])).toEqual([0, 0, 0]);
    expect(controller([2, 2, 1])).toBeUndefined();
    expect(controller([0, 3, 1])).toBe(1);
    const counts = presence(["a", "b"], 2, [
      { region: "a", owner: 0 },
      { region: "a", owner: 0 },
      { region: "b", owner: 1 },
    ]);
    expect(counts).toEqual({ a: [2, 0], b: [0, 1] });
    expect(scoreRegions(counts, (region) => (region === "a" ? [5, 2] : [3, 1]), 2)).toEqual([5, 3]);
  });

  it("builds the vertex and edge graph of a hex map", () => {
    const map = buildHexMap(radiusCoords(2));
    expect([map.tiles.length, map.vertices.length, map.edges.length]).toEqual([19, 54, 72]);
    for (const v of map.vertices) {
      expect(v.tiles.length).toBeGreaterThanOrEqual(1);
      expect(v.neighbors.length).toBe(v.edges.length);
    }
    expect(buildHexMap(radiusCoords(1)).vertices).toHaveLength(24);
  });

  it("places settlements and roads by the distance and connection rules", () => {
    const map = buildHexMap(radiusCoords(1));
    const v = map.vertices.find((x) => x.tiles.length === 3)!;
    const buildings = { [v.id]: { owner: 0, level: 1 } };
    expect(canSettle(map, buildings, {}, v.neighbors[0], 1, false)).toBe(false);
    expect(settleSpots(map, buildings, {}, 0, true)).toEqual([]);
    expect(roadSpots(map, buildings, {}, 0).sort()).toEqual(v.edges.slice().sort());
    // A rival's building blocks a road from continuing through its corner.
    const road = v.edges[0];
    const far = map.edges.find((e) => e.id === road)!.ends.find((end) => end !== v.id)!;
    const blocked = { ...buildings, [far]: { owner: 1, level: 1 } };
    const beyond = map.vertices.find((x) => x.id === far)!.edges.filter((e) => e !== road);
    for (const e of beyond) expect(canRoad(map, blocked, { [road]: 0 }, e, 0)).toBe(false);
  });

  it("produces for buildings by level and flips events", () => {
    const map = buildHexMap(radiusCoords(1));
    const tile = map.tiles[0];
    const gains = produce(map, { [tile.corners[0]]: { owner: 1, level: 2 } }, [tile.id], () => ({ wood: 1 }), 2);
    expect(gains).toEqual([{}, { wood: 2 }]);
    const { event, deck } = flipEvent(createRng(1), { drawPile: [], discard: ["a", "b"] });
    expect(["a", "b"]).toContain(event);
    expect(deck.drawPile.length + deck.discard.length).toBe(2);
  });

  it("trades with the bank and settles player offers", () => {
    expect(bankTrade({ wood: 3 }, "wood", "fish", 3)).toEqual({ wood: 0, fish: 1 });
    expect(() => bankTrade({ wood: 2 }, "wood", "fish", 3)).toThrow();
    const pools: Amounts[] = [{ wood: 1 }, { fish: 2 }];
    expect(swapOptions(pools, 0, 1, ["wood", "fish"])).toEqual([{ from: 0, to: 1, give: { wood: 1 }, get: { fish: 1 } }]);
    expect(settleOffer(pools, { from: 0, to: 1, give: { wood: 1 }, get: { fish: 1 } })).toEqual([
      { wood: 0, fish: 1 },
      { fish: 1, wood: 1 },
    ]);
  });

  it("adds, pays and formats resources", () => {
    expect(add({ water: 1 }, { water: 2, soil: 1 })).toEqual({ water: 3, soil: 1 });
    expect(canAfford({ water: 1 }, { water: 2 })).toBe(false);
    expect(pay({ water: 3, light: 1 }, { water: 2 })).toEqual({ water: 1, light: 1 });
    expect(() => pay({}, { water: 1 })).toThrow(/cannot afford/);
    expect(shortfall({ water: 1 }, { water: 3, light: 1 })).toEqual({ water: 2, light: 1 });
    expect(formatAmounts({ water: 2, light: 1 })).toBe("2 water and 1 light");
  });

  it("refills the market from the deck and its discards", () => {
    const rng = createRng(1);
    const full = refill(rng, { row: [], drawPile: [1, 2, 3], discard: [4] }, 3);
    expect(full.row).toEqual([1, 2, 3]);
    const after = take(rng, full, 1, 3);
    expect(after.card).toBe(2);
    expect(after.market.row).toEqual([1, 3, 4]);
  });

  it("applies, scores and describes card effects", () => {
    const cards: Record<string, CardDef> = {
      a: { id: "a", name: "A", cost: {}, points: 1, tags: ["tree"], endgame: [{ pointsPerTag: { tag: "tree", points: 2 } }] },
      b: { id: "b", name: "B", cost: {}, points: 0, tags: ["tree"], income: [{ convert: { give: { water: 2 }, get: { light: 3 } } }] },
    };
    const cardOf = (i: string) => cards[i.split("#")[0]];
    const ctx = { cardOf, draw: (n: number) => Array.from({ length: n }, (_, i) => `x#${i}`) };
    const seat = { resources: { water: 2 }, points: 1, hand: [], tableau: ["a#1", "b#1"] };
    expect(applyEffects(seat, [{ draw: 2 }, { gain: { soil: 1 } }], ctx)).toMatchObject({ hand: ["x#0", "x#1"], resources: { water: 2, soil: 1 } });
    expect(applyEffects(seat, cards.b.income, ctx).resources).toEqual({ water: 0, light: 3 });
    expect(applyEffects({ ...seat, resources: {} }, cards.b.income, ctx).resources).toEqual({});
    expect(endgameScore(seat, cardOf)).toBe(1 + 2 * 2);
    expect(rulesText(cards.a)).toBe("Game end: +2 points per tree.");
  });

  it("flags broken card data", () => {
    const bad: CardDef[] = [
      { id: "x", name: "X", cost: { gold: 1 }, points: 1, tags: [] },
      { id: "x", name: "Y", cost: {}, points: 1, tags: [], onPlay: [{ gain: { water: -1 } }, { teleport: 1 } as never] },
    ];
    const problems = validateCards(bad, ["water"]);
    expect(problems.some((p) => p.includes('unknown resource "gold"'))).toBe(true);
    expect(problems.some((p) => p.includes('two cards use the id "x"'))).toBe(true);
    expect(problems.some((p) => p.includes("amount -1"))).toBe(true);
    expect(problems.some((p) => p.includes("[teleport]"))).toBe(true);
  });

  it("computes binomial tails", () => {
    expect(atLeastProbability(2, 0.5, 1)).toBeCloseTo(0.75);
    expect(atLeastProbability(3, 1 / 6, 0)).toBe(1);
    expect(atLeastProbability(3, 1 / 6, 4)).toBe(0);
  });

  it("counts wild faces", () => {
    expect(countFace([1, 1, 4, 6], 4, 1)).toBe(3);
    expect(countFace([1, 1, 4, 6], 1, 1)).toBe(2);
  });

  it("lists raises in order", () => {
    expect(raisesAbove({ quantity: 2, face: 5 }, { maxQuantity: 3, faces: [2, 3, 4, 5, 6] })).toEqual([
      { quantity: 2, face: 6 },
      { quantity: 3, face: 2 },
      { quantity: 3, face: 3 },
      { quantity: 3, face: 4 },
      { quantity: 3, face: 5 },
      { quantity: 3, face: 6 },
    ]);
  });

  it("deals, draws and reshuffles", () => {
    expect(deal([1, 2, 3, 4, 5], 2)).toEqual({ hands: [[1, 3, 5], [2, 4]], rest: [] });
    expect(deal([1, 2, 3, 4, 5], 2, 1)).toEqual({ hands: [[1], [2]], rest: [3, 4, 5] });
    const result = draw(createRng(1), { drawPile: [1], discard: [7, 8] }, 3);
    expect(result.drawn[0]).toBe(1);
    expect(result.drawn.slice(1).sort()).toEqual([7, 8]);
    expect(result.discard).toEqual([]);
    expect(removeCards([3, 5, 3, 3], 3, 2)).toEqual([5, 3]);
    expect(numberedDeck(3, 2)).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it("skips seats that are out", () => {
    const out = new Set([1, 2]);
    expect(nextSeat(0, 4, (s) => !out.has(s))).toBe(3);
    expect(nextSeat(0, 4, () => true, -1)).toBe(3);
    expect(nextSeat(2, 3, (s) => s === 2)).toBe(2);
  });

  it("scores ties as shared wins and full ties as draws", () => {
    expect(scoreWinners([5, 3, 5])).toEqual([0, 2]);
    expect(scoreWinners([4, 4])).toEqual([]);
  });

  it("bounces and follows jumps", () => {
    expect(bounceMove(8, 4, 9)).toBe(6);
    expect(applyJumps(4, [[4, 12], [20, 3]])).toBe(12);
    expect(applyJumps(5, [[4, 12]])).toBe(5);
  });

  it("generates jumps that never chain", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const jumps = generateJumps(createRng(seed), 30, 8, 8);
      const squares = jumps.flat();
      expect(new Set(squares).size).toBe(squares.length);
      expect(squares.every((s) => s > 0 && s < 29)).toBe(true);
    }
  });

  it("deals roles and shows teammates", () => {
    const roles = dealRoles(createRng(3), 5, { wolf: 2 }, "villager");
    expect(roles.filter((r) => r === "wolf").length).toBe(2);
    const wolf = roles.indexOf("wolf");
    const villager = roles.indexOf("villager");
    const knows = (role: string) => role === "wolf";
    expect(visibleRoles(roles, wolf, knows).filter((r) => r === "wolf").length).toBe(2);
    expect(visibleRoles(roles, villager, knows).filter((r) => r !== null)).toEqual(["villager"]);
  });

  it("tallies votes", () => {
    expect(topVoted([1, 2, 1, null], 3)).toEqual([1]);
    expect(topVoted([0, 1], 3)).toEqual([0, 1]);
    expect(majority([1, 1, 2], 3)).toBe(1);
    expect(majority([1, 2, null], 3)).toBeNull();
  });
});

describe("catalog", () => {
  it("has unique ids", () => {
    expect(new Set(catalog.map((e) => e.id)).size).toBe(catalog.length);
  });

  it("points ready entries at real sources", () => {
    // Vite's import.meta.glob lists the source files without loading them.
    const sources = (import.meta as unknown as { glob(pattern: string): Record<string, unknown> }).glob("./**/*.ts");
    for (const entry of catalog.filter((e) => e.status === "ready")) {
      expect(entry.source && `./${entry.source}` in sources, entry.id).toBe(true);
    }
  });
});
