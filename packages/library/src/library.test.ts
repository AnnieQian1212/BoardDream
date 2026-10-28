import { createRng, fuzz, playMatch, randomBot, simulate, type Bot } from "@boarddream/engine";
import { describe, expect, it } from "vitest";
import {
  catalog,
  defaultBot,
  GLASSHOUSE_CARDS,
  GLASSHOUSE_RESOURCES,
  glasshouse,
  glasshouseBot,
  hexGame,
  iDoubtIt,
  LANTERN_MAP,
  lanternIsles,
  lanternIslesBot,
  lanternScore,
  liarsDice,
  liarsDiceBot,
  lineUp,
  raceHome,
  referenceGames,
  reversi,
} from "./index";
import { raisesAbove } from "./mechanics/bidding";
import { deal, draw, numberedDeck, removeCards } from "./mechanics/deck";
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

describe("reference games", () => {
  for (const game of referenceGames) {
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

describe("mechanics", () => {
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
