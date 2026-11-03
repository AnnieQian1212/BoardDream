const mechanics = require("@boarddream/mechanics");
const workers = mechanics.workers;
const resources = mechanics.resources;
const effects = mechanics.effects;
const majority = mechanics.majority;
const marketMod = mechanics.market;

const ISLANDS = [
  { id: "pudding", name: "Pudding Isle", terrain: "grass" },
  { id: "sock", name: "Sock Isle", terrain: "forest" },
  { id: "teacup", name: "Teacup Isle", terrain: "stone" },
  { id: "button", name: "Button Isle", terrain: "grain" },
  { id: "grumble", name: "Grumble Isle", terrain: "water" },
];

const BERTHS = [
  { id: "timber-barge", label: "Timber Barge +3", capacity: 1 },
  { id: "scree-lift", label: "Scree Lift +2", capacity: 1 },
  { id: "siphon-buoy", label: "Siphon Buoy +2", capacity: 1 },
  { id: "toll-booth", label: "Toll Booth +Survey", capacity: 1 },
  { id: "charter-office", label: "Charter Office", capacity: 1 },
  { id: "shipyard-slip", label: "Shipyard Slip", capacity: 1 },
  { id: "crew-mess", label: "Crew Mess", capacity: 1 },
  { id: "admiralty-perch", label: "Admiralty Perch", capacity: 1 },
];
const BERTH_IDS = BERTHS.map((b) => b.id);

const CARDS = [
  { id: "survey-pudding", name: "Pudding Drift Survey", cost: { timber: 2 }, points: 1, tags: ["pudding", "survey", "gull", "scroll"], income: [{ gain: { coins: 2 } }], copies: 2 },
  { id: "survey-sock", name: "Sock Puff Survey", cost: { timber: 1, crystal: 1 }, points: 2, tags: ["sock", "survey", "spyglass", "scroll"], income: [{ gain: { coins: 2 } }], copies: 2 },
  { id: "survey-teacup", name: "Teacup Steam Survey", cost: { timber: 2, fuel: 1 }, points: 2, tags: ["teacup", "survey", "waxseal", "scroll"], income: [{ gain: { coins: 2 } }], copies: 2 },
  { id: "survey-button", name: "Button Muddle Survey", cost: { crystal: 1, fuel: 1 }, points: 1, tags: ["button", "survey", "gull", "scroll"], income: [{ gain: { coins: 2 } }], copies: 2 },
  { id: "survey-grumble", name: "Grumble Grump Survey", cost: { timber: 1, fuel: 1 }, points: 2, tags: ["grumble", "survey", "spyglass", "scroll"], income: [{ gain: { coins: 2 } }], copies: 2 },
  { id: "courier-pudding", name: "Pudding Dash Courier", cost: { timber: 1, fuel: 1 }, points: 2, tags: ["pudding", "courier", "gull", "scroll"], onPlay: [{ gain: { coins: 3 } }], discount: { tag: "scroll", amounts: { timber: 1 } }, copies: 2 },
  { id: "courier-sock", name: "Sock Flit Courier", cost: { crystal: 1 }, points: 1, tags: ["sock", "courier", "spyglass", "scroll"], onPlay: [{ gain: { coins: 4 } }], discount: { tag: "scroll", amounts: { timber: 1 } }, copies: 2 },
  { id: "courier-teacup", name: "Teacup Zip Courier", cost: { timber: 1, crystal: 1 }, points: 2, tags: ["teacup", "courier", "waxseal", "scroll"], onPlay: [{ gain: { coins: 4 } }], discount: { tag: "scroll", amounts: { timber: 1 } }, copies: 2 },
  { id: "courier-button", name: "Button Dart Courier", cost: { fuel: 1 }, points: 1, tags: ["button", "courier", "gull", "scroll"], onPlay: [{ gain: { coins: 3 } }], discount: { tag: "scroll", amounts: { timber: 1 } }, copies: 2 },
  { id: "courier-grumble", name: "Grumble Hurry Courier", cost: { timber: 2, crystal: 1 }, points: 3, tags: ["grumble", "courier", "spyglass", "scroll"], onPlay: [{ gain: { coins: 5 } }], discount: { tag: "scroll", amounts: { timber: 1 } }, copies: 2 },
  { id: "envoy-pudding", name: "Pudding Seal Envoy", cost: { timber: 2, crystal: 1 }, points: 2, tags: ["pudding", "envoy", "waxseal", "scroll"], endgame: [{ pointsPerTag: { tag: "gull", points: 2 } }], copies: 2 },
  { id: "envoy-sock", name: "Sock Parley Envoy", cost: { timber: 1, fuel: 1 }, points: 1, tags: ["sock", "envoy", "spyglass", "scroll"], endgame: [{ pointsPerTag: { tag: "survey", points: 2 } }], copies: 2 },
  { id: "envoy-teacup", name: "Teacup Accord Envoy", cost: { crystal: 2 }, points: 2, tags: ["teacup", "envoy", "waxseal", "scroll"], endgame: [{ pointsPerTag: { tag: "teacup", points: 2 } }], copies: 2 },
  { id: "envoy-button", name: "Button Pact Envoy", cost: { timber: 1, crystal: 1, fuel: 1 }, points: 2, tags: ["button", "envoy", "waxseal", "scroll"], endgame: [{ pointsPerTag: { tag: "courier", points: 2 } }], copies: 2 },
  { id: "envoy-grumble", name: "Grumble Treaty Envoy", cost: { timber: 2, fuel: 1 }, points: 3, tags: ["grumble", "envoy", "spyglass", "scroll"], endgame: [{ pointsPerTag: { tag: "envoy", points: 2 } }], copies: 2 },
];
const CARD_MAP = new Map(CARDS.map((c) => [c.id, c]));
const cardOf = (instance) => CARD_MAP.get(instance.split("#")[0]);
const islandOf = (instance) => ISLANDS.find((isl) => cardOf(instance).tags[0] === isl.id);
const NAMES = {
  timber: "timber", crystal: "crystal", fuel: "fuel", coins: "coins",
  pudding: "Pudding", sock: "Sock", teacup: "Teacup", button: "Button", grumble: "Grumble",
  survey: "Survey", courier: "Courier", envoy: "Envoy", scroll: "scroll",
  spyglass: "spyglass", gull: "gull", waxseal: "wax-seal",
};
const EFFECTS = { cardOf, draw: () => [] };
const ROW_SIZE = 4;
const MAX_CREW = 5;

const effectSeat = (s, seat) => ({
  resources: s.resources[seat],
  points: s.sails[seat],
  hand: s.hand[seat],
  tableau: s.tableau[seat],
  fired: s.fired[seat],
  firedAt: s.firedAt[seat],
});
const launchCost = (s, seat, instance) => effects.costOf(cardOf(instance), s.tableau[seat], cardOf);
const workersLeft = (s, seat) => s.crew[seat] - workers.placedBy(s.placed, seat);
const deckCount = (s) => s.market.drawPile.length + s.market.discard.length;
const seatOrder = (first, n) => Array.from({ length: n }, (_, i) => (first + i) % n);
const sameMove = (a, b) => a.type === b.type && a.space === b.space && a.card === b.card && a.option === b.option;

function charterView(instance, s, seat) {
  const card = cardOf(instance);
  const isl = islandOf(instance);
  const text = `Flies to ${isl ? isl.name : "an isle"}. ` + effects.rulesText(card, NAMES, { onPlay: "Launch", income: "Income", endgame: "Game end", play: "launch", cards: "scrolls" });
  return {
    id: instance,
    title: card.name,
    text,
    cost: s !== undefined && seat !== undefined ? launchCost(s, seat, instance) : { ...card.cost },
    points: card.points,
    tags: [card.tags[1], card.tags[0]],
    pulse: s !== undefined && seat !== undefined ? effects.pulseOf({ fired: s.fired[seat], firedAt: s.firedAt[seat] }, instance) : undefined,
  };
}

function projectedScores(s) {
  const n = s.numPlayers;
  const remaining = s.over ? 0 : s.scoringRounds.filter((r) => r >= s.round).length;
  const futureCoins = new Array(n).fill(0);
  const futureSails = new Array(n).fill(0);
  if (remaining > 0) {
    for (const isl of ISLANDS) {
      const counts = s.kites[isl.id];
      const groups = majority.standings(counts);
      const top = groups[0] || [];
      if (top.length === 0) continue;
      for (const seat of top) futureCoins[seat] += s.censusCoins * remaining;
      const lead = majority.controller(counts);
      if (lead !== undefined) futureSails[lead] += 3 * remaining;
    }
  }
  return Array.from({ length: n }, (_, seat) => {
    const totalCoins = resources.amountOf(s.resources[seat], "coins") + futureCoins[seat];
    const totalSails = s.sails[seat] + futureSails[seat];
    const base = { resources: s.resources[seat], points: totalSails, hand: s.hand[seat], tableau: s.tableau[seat] };
    const withEnd = effects.endgameScore(base, cardOf);
    return withEnd + Math.floor(totalCoins / 3);
  });
}

function isRoundDone(s) {
  if (s.pending) return false;
  const allPlaced = seatOrder(s.admiral, s.numPlayers).every((seat) => workersLeft(s, seat) <= 0);
  if (allPlaced) return true;
  return BERTHS.every((b) => workers.occupants(s.placed, b.id).length >= (b.capacity || 1));
}

function endRound(s, rng) {
  let next = { ...s };
  let resList = next.resources.map((r) => ({ ...r }));
  let sails = next.sails.slice();
  if (s.scoringRounds.includes(s.round)) {
    for (const isl of ISLANDS) {
      const counts = next.kites[isl.id];
      const groups = majority.standings(counts);
      const top = groups[0] || [];
      if (top.length === 0) continue;
      for (const seat of top) resList[seat] = resources.add(resList[seat], { coins: s.censusCoins });
      const lead = majority.controller(counts);
      if (lead !== undefined) sails[lead] += 3;
    }
    next = { ...next, lastCensus: { round: s.round } };
  }
  next = { ...next, resources: resList, sails };
  if (s.round >= s.numRounds) {
    return { ...next, placed: {}, pending: undefined, over: true };
  }
  const [oldest, ...rest] = next.market.row;
  const withDiscard = oldest === undefined ? next.market : { ...next.market, row: rest, discard: [...next.market.discard, oldest] };
  const refilled = marketMod.refill(rng, withDiscard, ROW_SIZE);
  const admiral = s.nextAdmiral !== undefined ? s.nextAdmiral : (s.admiral + 1) % s.numPlayers;
  const nRes = resList.map((r) => ({ ...r }));
  const nSails = sails.slice();
  const nFired = next.fired.slice();
  const nFiredAt = next.firedAt.slice();
  for (let seat = 0; seat < s.numPlayers; seat++) {
    const paid = effects.applyIncome({ resources: nRes[seat], points: nSails[seat], hand: next.hand[seat], tableau: next.tableau[seat], fired: nFired[seat], firedAt: nFiredAt[seat] }, EFFECTS);
    nRes[seat] = paid.resources;
    nSails[seat] = paid.points;
    nFired[seat] = paid.fired || [];
    nFiredAt[seat] = paid.firedAt !== undefined ? paid.firedAt : nFiredAt[seat];
  }
  return {
    ...next,
    round: s.round + 1,
    admiral,
    nextAdmiral: undefined,
    toMove: admiral,
    placed: {},
    pending: undefined,
    market: refilled,
    resources: nRes,
    sails: nSails,
    fired: nFired,
    firedAt: nFiredAt,
  };
}

function advanceOrEnd(next, from, rng) {
  if (isRoundDone(next)) return endRound(next, rng);
  const order = seatOrder(next.admiral, next.numPlayers);
  const following = workers.nextToPlace(order, from, (seat) => workersLeft(next, seat));
  if (following === undefined) return endRound(next, rng);
  return { ...next, toMove: following };
}

const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
const BERTH_AT = {
  "timber-barge": [3.0, 0.6],
  "scree-lift": [6.0, 0.6],
  "siphon-buoy": [9.0, 0.6],
  "toll-booth": [3.0, 2.7],
  "charter-office": [9.0, 2.7],
  "shipyard-slip": [3.0, 4.8],
  "crew-mess": [6.0, 4.8],
  "admiralty-perch": [9.0, 4.8],
};
const BERTH_W = 2.7;
const BERTH_H = 1.7;
const LIGHT_AT = [6.0, 2.7];
const RACK_Y = 7.1;
const RACK_X = [3.2, 5.4, 7.6, 9.8];
const RACK_W = 2.0;
const RACK_H = 1.4;
const ISLE_Y = 9.1;
const ISLE_X = { pudding: 3.1, sock: 4.9, teacup: 6.7, button: 8.5, grumble: 10.3 };
const ISLE_W = 1.6;
const ISLE_H = 1.6;

module.exports = {
  meta: {
    id: "cloudwaft-harbor",
    name: "Cloudwaft Harbor",
    family: "engine",
    mode: "competitive",
    minPlayers: 2,
    maxPlayers: 4,
    summary: "Bumble squeaky puffling crews around a teapot skyport, launch charter scrolls and kite your flag over five islands.",
    rules: [
      "Each round first collect 2 coins for every Survey you fly, then starting with the Admiral take turns posting one crew to an empty berth.",
      "Gather timber, crystal, fuel and coins, draw scrolls at the Charter Office without ever holding more than 4, and launch one at the Shipyard Slip by paying its cost.",
      "Launched scrolls score sails at once and plant your kite on their island: Surveys pay coins every round, Couriers pay coins now and make later launches 1 timber cheaper each, Envoys score bonus sails at the end.",
      "Hire crew at the Mess for 3 coins up to 5 crew or take 3 coins instead, and take the teacup at the Perch to go first next round plus coins or a peek at two scrolls.",
      "After round 3 and at the end each island pays coins to its most kites and 3 sails to an outright leader; leftover 3 coins score 1 sail and most sails wins, coins breaking ties.",
    ],
    resources: [
      { id: "timber", name: "Timber", icon: "tree", color: "#4a8c3f" },
      { id: "crystal", name: "Crystal", icon: "gem", color: "#7aa7ff" },
      { id: "fuel", name: "Fuel", icon: "flame", color: "#e07b39" },
      { id: "coins", name: "Coins", icon: "coins", color: "#d9a521" },
    ],
  },
  params: [
    { key: "numRounds", label: "Rounds", kind: "int", min: 5, max: 7, default: 6 },
    { key: "maxHand", label: "Charter hand size", kind: "int", min: 3, max: 5, default: 4 },
    { key: "censusCoins", label: "Census payout", kind: "int", min: 4, max: 8, default: 6 },
  ],

  setup({ numPlayers, params, rng }) {
    const numRounds = Number(params.numRounds ?? 6);
    const maxHand = Number(params.maxHand ?? 4);
    const censusCoins = Number(params.censusCoins ?? 6);
    const deck = rng.shuffle(effects.buildDeck(CARDS));
    const hand = Array.from({ length: numPlayers }, (_, seat) => deck.slice(seat * 2, seat * 2 + 2));
    const rest = deck.slice(numPlayers * 2);
    const charters = marketMod.refill(rng, { row: [], drawPile: rest, discard: [] }, ROW_SIZE);
    const scoringRounds = [...new Set([3, numRounds])].filter((r) => r <= numRounds).sort((a, b) => a - b);
    return {
      numPlayers,
      numRounds,
      maxHand,
      censusCoins,
      round: 1,
      scoringRounds,
      admiral: 0,
      nextAdmiral: undefined,
      toMove: 0,
      crew: new Array(numPlayers).fill(3),
      placed: {},
      resources: Array.from({ length: numPlayers }, () => ({ timber: 2, crystal: 1, fuel: 1, coins: 3 })),
      sails: new Array(numPlayers).fill(0),
      hand,
      tableau: Array.from({ length: numPlayers }, () => []),
      fired: Array.from({ length: numPlayers }, () => []),
      firedAt: new Array(numPlayers).fill(0),
      kites: Object.fromEntries(ISLANDS.map((isl) => [isl.id, new Array(numPlayers).fill(0)])),
      market: charters,
      pending: undefined,
      lastCensus: undefined,
      over: false,
    };
  },

  activePlayers(s) {
    if (s.over) return [];
    if (s.pending) return [s.pending.player];
    return [s.toMove];
  },

  legalMoves(s, player) {
    if (s.over) return [];
    if (s.pending) {
      if (player !== s.pending.player) return [];
      const uniq = [...new Set(s.pending.options)];
      return uniq.map((card) => ({ type: "keep", card }));
    }
    if (player !== s.toMove) return [];
    const moves = [];
    const open = workers.openSpaces(BERTHS, s.placed, player);
    for (const space of open) {
      if (space.id === "timber-barge" || space.id === "scree-lift" || space.id === "siphon-buoy" || space.id === "toll-booth") {
        moves.push({ type: "place", space: space.id });
      } else if (space.id === "charter-office") {
        if (s.hand[player].length < s.maxHand) {
          for (const card of s.market.row) moves.push({ type: "place", space: space.id, card });
          if (deckCount(s) > 0) moves.push({ type: "place", space: space.id });
        }
      } else if (space.id === "shipyard-slip") {
        for (const card of s.hand[player]) {
          if (resources.canAfford(s.resources[player], launchCost(s, player, card))) moves.push({ type: "place", space: space.id, card });
        }
      } else if (space.id === "crew-mess") {
        moves.push({ type: "place", space: space.id });
      } else if (space.id === "admiralty-perch") {
        moves.push({ type: "place", space: space.id, option: "coins" });
        if (s.hand[player].length < s.maxHand && deckCount(s) > 0) moves.push({ type: "place", space: space.id, option: "peek" });
      }
    }
    if (moves.length === 0) return [{ type: "pass" }];
    return moves;
  },

  applyMove(s, player, move, rng) {
    const legal = module.exports.legalMoves(s, player);
    if (!legal.some((m) => sameMove(m, move))) throw new Error(`illegal move ${JSON.stringify(move)}`);
    if (move.type === "keep") {
      const pending = s.pending;
      const kept = move.card;
      const others = pending.options.filter((c) => c !== kept);
      const nextHand = s.hand.map((h, seat) => (seat === player ? [...h, kept] : h.slice()));
      const nextMarket = { ...s.market, row: s.market.row.slice(), drawPile: s.market.drawPile.slice(), discard: [...s.market.discard, ...others] };
      let next = { ...s, hand: nextHand, market: nextMarket, pending: undefined };
      return advanceOrEnd(next, player, rng);
    }
    if (move.type === "pass") {
      const next = { ...s, placed: workers.place(s.placed, "passed", player) };
      return advanceOrEnd(next, player, rng);
    }
    // place
    let next = { ...s, placed: workers.place(s.placed, move.space, player) };
    let resList = next.resources.map((r) => ({ ...r }));
    let crew = next.crew.slice();
    let hand = next.hand.map((h) => h.slice());
    let tableau = next.tableau.map((t) => t.slice());
    let fired = next.fired.map((f) => f.slice());
    let firedAt = next.firedAt.slice();
    let kites = Object.fromEntries(Object.entries(next.kites).map(([k, v]) => [k, v.slice()]));
    let charters = { row: s.market.row.slice(), drawPile: s.market.drawPile.slice(), discard: s.market.discard.slice() };
    let sails = next.sails.slice();
    let nextAdmiral = next.nextAdmiral;
    let pending = undefined;

    if (move.space === "timber-barge") {
      resList[player] = resources.add(resList[player], { timber: 3 });
    } else if (move.space === "scree-lift") {
      resList[player] = resources.add(resList[player], { crystal: 2 });
    } else if (move.space === "siphon-buoy") {
      resList[player] = resources.add(resList[player], { fuel: 2 });
    } else if (move.space === "toll-booth") {
      const surveys = tableau[player].filter((c) => cardOf(c).tags.includes("survey")).length;
      resList[player] = resources.add(resList[player], { coins: 4 + surveys });
    } else if (move.space === "charter-office") {
      if (move.card) {
        const idx = charters.row.indexOf(move.card);
        const taken = marketMod.take(rng, charters, idx, ROW_SIZE);
        charters = taken.market;
        hand[player] = [...hand[player], taken.card];
      } else {
        const drawn = marketMod.drawBlind(rng, charters, 2);
        charters = drawn.market;
        if (drawn.cards.length === 0) {
          // nothing to keep
        } else if (drawn.cards.length === 1) {
          hand[player] = [...hand[player], drawn.cards[0]];
        } else {
          pending = { player, options: drawn.cards.slice(), source: "office" };
        }
      }
    } else if (move.space === "shipyard-slip") {
      const instance = move.card;
      const def = cardOf(instance);
      const cost = launchCost(s, player, instance);
      resList[player] = resources.pay(resList[player], cost);
      hand[player] = hand[player].filter((c) => c !== instance);
      const isl = islandOf(instance).id;
      kites[isl] = kites[isl].map((n, seat) => (seat === player ? n + 1 : n));
      const played = effects.playToTableau({ resources: resList[player], points: sails[player] + def.points, hand: hand[player], tableau: tableau[player], fired: fired[player], firedAt: firedAt[player] }, instance, EFFECTS);
      resList[player] = played.resources;
      sails[player] = played.points;
      hand[player] = played.hand;
      tableau[player] = played.tableau;
      fired[player] = played.fired || [];
      firedAt[player] = played.firedAt !== undefined ? played.firedAt : firedAt[player];
    } else if (move.space === "crew-mess") {
      if (crew[player] < MAX_CREW && resources.amountOf(resList[player], "coins") >= 3) {
        resList[player] = resources.pay(resList[player], { coins: 3 });
        crew[player] += 1;
      } else {
        resList[player] = resources.add(resList[player], { coins: 3 });
      }
    } else if (move.space === "admiralty-perch") {
      nextAdmiral = player;
      if (move.option === "peek") {
        const drawn = marketMod.drawBlind(rng, charters, 2);
        charters = drawn.market;
        if (drawn.cards.length === 0) {
          resList[player] = resources.add(resList[player], { coins: 2 });
        } else if (drawn.cards.length === 1) {
          hand[player] = [...hand[player], drawn.cards[0]];
        } else {
          pending = { player, options: drawn.cards.slice(), source: "perch" };
        }
      } else {
        resList[player] = resources.add(resList[player], { coins: 2 });
      }
    }
    next = { ...next, resources: resList, crew, hand, tableau, fired, firedAt, kites, market: charters, sails, nextAdmiral, pending };
    if (pending) return next;
    return advanceOrEnd(next, player, rng);
  },

  isTerminal(s) {
    return s.over;
  },

  outcome(s) {
    const scores = projectedScores(s);
    if (!s.over) return { winners: [], scores };
    const best = Math.max(...scores);
    const top = scores.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0);
    if (top.length === 1) return { winners: top, scores };
    const bestCoins = Math.max(...top.map((seat) => resources.amountOf(s.resources[seat], "coins")));
    const champs = top.filter((seat) => resources.amountOf(s.resources[seat], "coins") === bestCoins);
    return { winners: champs, scores };
  },

  view(state, player) {
    return {
      ...state,
      hand: state.hand.map((h, seat) => (seat === player ? h.slice() : h.map(() => "hidden-scroll"))),
      market: { row: state.market.row.slice(), drawPile: state.market.drawPile.map(() => "hidden-scroll"), discard: state.market.discard.slice() },
      pending: state.pending
        ? state.pending.player === player
          ? { ...state.pending, options: state.pending.options.slice() }
          : { player: state.pending.player, source: state.pending.source, options: state.pending.options.map(() => "hidden-scroll") }
        : undefined,
      resources: state.resources.map((r) => ({ ...r })),
    };
  },

  geometry(s) {
    const cells = [];
    const pieces = [];
    for (const b of BERTHS) {
      const [x, y] = BERTH_AT[b.id];
      cells.push({ id: `berth-${b.id}`, polygon: rect(x, y, BERTH_W, BERTH_H), kind: "berth", label: b.label });
      workers.occupants(s.placed, b.id).forEach((seat, i) => {
        pieces.push({ id: `crew-${b.id}-${i}`, x: x + BERTH_W / 2, y: y + BERTH_H / 2, r: 0.24, owner: seat, shape: "pawn", kind: "crew", cellId: `berth-${b.id}` });
      });
    }
    {
      const [x, y] = LIGHT_AT;
      cells.push({ id: "lighthouse", polygon: rect(x, y, BERTH_W, BERTH_H), kind: "lighthouse", label: "Teapot Light", glow: "#ffdf8a" });
      pieces.push({ id: "teacup", x: x + BERTH_W / 2, y: y + BERTH_H / 2 + 0.35, r: 0.22, owner: s.admiral, shape: "disc", kind: "teacup", cellId: "lighthouse" });
    }
    s.market.row.forEach((card, i) => {
      const x = RACK_X[i] !== undefined ? RACK_X[i] : 3.2 + i * 2.2;
      cells.push({ id: `rack-${i}`, polygon: rect(x, RACK_Y, RACK_W, RACK_H), kind: "scroll", label: cardOf(card).name, badge: String(cardOf(card).points) });
    });
    for (const isl of ISLANDS) {
      const x = ISLE_X[isl.id];
      cells.push({ id: `isle-${isl.id}`, polygon: rect(x, ISLE_Y, ISLE_W, ISLE_H), kind: isl.id, label: isl.name, badge: String(s.censusCoins), terrain: isl.terrain });
      let slot = 0;
      s.kites[isl.id].forEach((count, seat) => {
        for (let n = 0; n < count; n++, slot++) {
          const px = x + 0.28 + (slot % 4) * 0.34;
          const py = ISLE_Y + 0.85 + Math.floor(slot / 4) * 0.32;
          pieces.push({ id: `kite-${isl.id}-${slot}`, x: px, y: py, r: 0.14, owner: seat, shape: "square", kind: "kite", cellId: `isle-${isl.id}` });
        }
      });
    }
    const roundLabel = s.over ? "Voyage over" : `Round ${s.round}/${s.numRounds} P${s.admiral + 1}`;
    cells.push({ id: "round-label", polygon: rect(0.2, 0.6, 2.4, 0.7), kind: "label", label: roundLabel });
    cells.push({ id: "census-label", polygon: rect(12.2, 0.6, 2.6, 0.7), kind: "label", label: `Census +${s.censusCoins}c +3s` });
    cells.push({ id: "hand-label", polygon: rect(0.2, 2.0, 2.4, 0.7), kind: "label", label: `Hands hold ${s.maxHand}` });
    return { width: 15.5, height: 11.5, cells, pieces };
  },

  panels(s, viewer) {
    const scores = projectedScores(s);
    const panels = [
      {
        id: "rack",
        title: "Charter Rack",
        zone: "shared",
        cards: s.market.row.map((c) => charterView(c)),
        counters: [{ id: "deck", label: "Deck", value: s.market.drawPile.length }],
        note: s.over ? "Voyage over" : `Round ${s.round}/${s.numRounds} first P${s.admiral + 1}`,
      },
    ];
    for (let seat = 0; seat < s.numPlayers; seat++) {
      const kites = ISLANDS.reduce((sum, isl) => sum + s.kites[isl.id][seat], 0);
      panels.push({
        id: `seat${seat}`,
        title: `Captain ${seat + 1}`,
        zone: "players",
        owner: seat,
        counters: [
          { id: `seat${seat}-timber`, label: "Timber", value: resources.amountOf(s.resources[seat], "timber"), resource: "timber" },
          { id: `seat${seat}-crystal`, label: "Crystal", value: resources.amountOf(s.resources[seat], "crystal"), resource: "crystal" },
          { id: `seat${seat}-fuel`, label: "Fuel", value: resources.amountOf(s.resources[seat], "fuel"), resource: "fuel" },
          { id: `seat${seat}-coins`, label: "Coins", value: resources.amountOf(s.resources[seat], "coins"), resource: "coins" },
          { id: `seat${seat}-crew`, label: "Crew", value: workersLeft(s, seat) },
          { id: `seat${seat}-kites`, label: "Kites", value: kites },
          { id: `seat${seat}-score`, label: "Score", value: scores[seat] },
        ],
        cards: s.tableau[seat].map((c) => charterView(c, s, seat)),
        note: s.admiral === seat && !s.over ? "Holds the teacup" : `${kites} kites flying`,
      });
    }
    if (viewer !== undefined) {
      panels.push({
        id: `hand${viewer}`,
        title: "Your Scrolls",
        zone: "hand",
        owner: viewer,
        cards: s.hand[viewer].filter((c) => c !== "hidden-scroll").map((c) => charterView(c, s, viewer)),
      });
    }
    if (s.pending && viewer !== undefined && viewer === s.pending.player) {
      const opts = s.pending.options.filter((c) => c !== "hidden-scroll");
      panels.push({
        id: `choice${viewer}`,
        title: "Choose a Scroll",
        zone: "hand",
        owner: viewer,
        cards: opts.map((c) => charterView(c, s, viewer)),
        note: "Keep 1, discard the rest",
      });
    }
    return panels;
  },

  moveTarget(_s, move) {
    if (move.type === "keep") return move.card;
    if (move.type === "pass") return undefined;
    if (move.space === "charter-office" && move.card) return move.card;
    if (move.space === "shipyard-slip" && move.card) return move.card;
    return `berth-${move.space}`;
  },

  describeMove(s, move, viewer) {
    if (move.type === "keep") {
      const owner = s.pending ? s.pending.player : undefined;
      if (viewer !== undefined && owner !== undefined && viewer !== owner) return "keeps a scroll";
      try {
        return `keeps ${cardOf(move.card).name}`;
      } catch {
        return "keeps a scroll";
      }
    }
    if (move.type === "pass") return "passes";
    const berthName = (BERTHS.find((b) => b.id === move.space) || { label: move.space }).label;
    if (move.space === "charter-office") {
      if (move.card) {
        try {
          return `takes ${cardOf(move.card).name} from the rack`;
        } catch {
          return "takes a scroll from the rack";
        }
      }
      return `uses ${berthName}: draws two, keeps one`;
    }
    if (move.space === "shipyard-slip") {
      try {
        const def = cardOf(move.card);
        const isl = islandOf(move.card);
        return `launches ${def.name} to ${isl.name} (+${def.points})`;
      } catch {
        return `uses ${berthName}`;
      }
    }
    if (move.space === "admiralty-perch") return move.option === "peek" ? "takes the teacup and peeks at two" : "takes the teacup: first next, +2 coins";
    if (move.space === "crew-mess") return "works the mess: hire or +3 coins";
    return `sends crew to ${berthName}`;
  },
};
