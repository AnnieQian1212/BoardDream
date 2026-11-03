const mechanics = require("@boarddream/mechanics");
const marketH = mechanics.market;
const majorityH = mechanics.majority;
const setsH = mechanics.sets;
const resH = mechanics.resources;
const effectsH = mechanics.effects;
const scoringH = mechanics.scoring;

const HARBOR_NAMES = ["Lamp Quay","Copper Steps","Emberfall","Saffron Gate","Clove Wharf","Cinnamon Strand","Pearl Jetty","Coral Landing","Amber Dock","Monsoon Pier","Salt Bastion","Ivory Anchorage","Spice Haven","Storm Break"];
const BAY_NAMES = ["Amber Bay", "Coral Bay", "Pearl Bay"];
const SPICES = ["saffron", "clove", "cinnamon"];
const NAMES = { saffron: "saffron", clove: "clove", cinnamon: "cinnamon", coins: "coins" };

const CHART_DEFS = [
  { id: "pilot", name: "Harbor Pilot", cost: { coins: 3 }, points: 1, tags: ["Sail", "Guild"] },
  { id: "broker", name: "Guild Broker", cost: { coins: 3 }, points: 1, tags: ["Sail"] },
  { id: "factor", name: "Coin Factor", cost: { coins: 3 }, points: 1, tags: ["Coin"] },
  { id: "monsoon", name: "Monsoon Runner", cost: { coins: 2 }, points: 0, tags: ["Sail"] },
  { id: "tidecaller", name: "Tidecaller", cost: { coins: 2 }, points: 0, tags: ["Sail"] },
  { id: "lantern", name: "Lantern Tender", cost: { coins: 2 }, points: 0, tags: ["Guild"] },
  { id: "saltclerk", name: "Salt Clerk", cost: { coins: 2 }, points: 0, tags: ["Coin"] },
  { id: "ivory", name: "Ivory Lookout", cost: { coins: 4 }, points: 2, tags: ["Sail", "Coin"] },
  { id: "storm", name: "Storm Reader", cost: { coins: 4 }, points: 2, tags: ["Sail", "Guild"] },
  { id: "coral", name: "Coral Diver", cost: { coins: 3 }, points: 1, tags: ["Guild"] },
  { id: "pearl", name: "Pearl Agent", cost: { coins: 4 }, points: 1, tags: ["Coin", "Guild"] },
  { id: "amber", name: "Amber Weigher", cost: { coins: 2 }, points: 0, tags: ["Coin"] },
  { id: "weigher", name: "Spice Weigher", cost: { coins: 3 }, points: 0, tags: ["Coin", "Guild"] },
  { id: "counter", name: "Coin Counter", cost: { coins: 2 }, points: 1, tags: ["Coin"] },
  { id: "scribe", name: "Guild Scribe", cost: { coins: 3 }, points: 1, tags: ["Guild"] },
  { id: "sailmaker", name: "Sailmaker", cost: { coins: 2 }, points: 0, tags: ["Sail", "Coin"] },
  { id: "ropewalk", name: "Ropewalk", cost: { coins: 2 }, points: 0, tags: ["Sail", "Guild"] },
  { id: "keeper", name: "Chartkeeper", cost: { coins: 5 }, points: 2, tags: ["Sail", "Coin", "Guild"] },
  { id: "haven", name: "Haven Master", cost: { coins: 4 }, points: 1, tags: ["Guild"] },
  { id: "quay", name: "Quay Warden", cost: { coins: 3 }, points: 0, tags: ["Guild"] },
  { id: "dredger", name: "Channel Dredger", cost: { coins: 2 }, points: 0, tags: ["Sail"] },
  { id: "chandler", name: "Spice Chandler", cost: { coins: 3 }, points: 1, tags: ["Coin"] },
  { id: "signal", name: "Signal Boy", cost: { coins: 1 }, points: 0, tags: ["Sail"] },
  { id: "purser", name: "Ship Purser", cost: { coins: 2 }, points: 1, tags: ["Coin", "Sail"] },
  { id: "caravan", name: "Caravan Contact", cost: { coins: 3 }, points: 1, tags: ["Guild", "Coin"] },
  { id: "smuggler", name: "Night Smuggler", cost: { coins: 4 }, points: 2, tags: ["Sail"] },
  { id: "harbor", name: "Harbor Master", cost: { coins: 5 }, points: 2, tags: ["Guild"] },
  { id: "mint", name: "Brass Mint", cost: { coins: 4 }, points: 1, tags: ["Coin"] },
];
const CHART_MAP = new Map(CHART_DEFS.map((c) => [c.id, c]));
const GAINS = {
  monsoon: { coins: 2 }, tidecaller: { saffron: 1 }, lantern: { coins: 1 },
  saltclerk: { coins: 2 }, sailmaker: { coins: 1 }, ropewalk: { saffron: 1 },
  quay: { clove: 1 }, amber: { coins: 1 }, signal: { coins: 1 },
  dredger: { cinnamon: 1 }, chandler: { cinnamon: 1 }, purser: { coins: 1 },
  caravan: { clove: 1 }, counter: { coins: 1 },
};
const CHART_INCOME = { haven: { coins: 1 }, harbor: { coins: 1 }, mint: { coins: 1 }, keeper: { coins: 1 } };
const ABILITY = {
  pilot: "On play: +1 sail range per Guild tag you own.",
  broker: "Found costs 1 coin less per Sail tag (min 1).",
  factor: "On play: +1 coin per Coin tag played before it.",
  monsoon: "On play: +2 coins.", tidecaller: "On play: +1 saffron.",
  haven: "Each round: +1 coin.", harbor: "Each round: +1 coin.",
  mint: "Each round: +1 coin.", keeper: "Each round: +1 coin.",
};

function defIdOf(inst) {
  if (effectsH && effectsH.defId) return effectsH.defId(inst);
  return String(inst).split("#")[0];
}
function chartOf(instance) { return CHART_MAP.get(defIdOf(instance)); }
function chartCost(state, seat, instance) {
  const card = chartOf(instance);
  if (effectsH && effectsH.costOf) {
    try { return effectsH.costOf(card, state.tableau[seat], chartOf); } catch (e) { return card.cost; }
  }
  return card.cost;
}
function countTag(tableau, tag) {
  let n = 0;
  for (const inst of tableau) { const c = chartOf(inst); if (c && c.tags.includes(tag)) n++; }
  return n;
}
function foundCoinCost(state, seat) {
  return Math.max(1, 4 - countTag(state.tableau[seat], "Sail"));
}
function tagCounts(state, seat) {
  const tags = [];
  for (const inst of state.tableau[seat]) { const c = chartOf(inst); if (c) tags.push(...c.tags); }
  if (setsH && setsH.countKinds) return setsH.countKinds(tags);
  const m = {}; for (const t of tags) m[t] = (m[t] || 0) + 1; return m;
}
function tagSetPoints(state, seat) {
  const counts = tagCounts(state, seat);
  if (setsH && setsH.scoreDistinctSets) return setsH.scoreDistinctSets(counts, [0, 2, 5]);
  const a = counts.Sail || 0, b = counts.Coin || 0, c = counts.Guild || 0;
  return Math.min(a, b, c) * 5 + Math.max(0, [a, b, c].sort((x, y) => x - y)[1] - Math.min(a, b, c)) * 0;
}
function bayCounts(state, bay) {
  const arr = new Array(state.numPlayers).fill(0);
  state.harbors.forEach((h, i) => { if (h.bay === bay && state.houses[i] !== null) arr[state.houses[i]]++; });
  return arr;
}
function majorityPoints(state) {
  const tot = new Array(state.numPlayers).fill(0);
  for (let b = 0; b < 3; b++) {
    const awards = state.numPlayers >= 3 ? [5, 2] : [5];
    const pts = majorityH.majorityAwards(bayCounts(state, b), awards);
    for (let s = 0; s < state.numPlayers; s++) tot[s] += pts[s];
  }
  return tot;
}
function tableauPoints(state, seat) {
  return 0;
}
function totalScore(state, seat) {
  const maj = majorityPoints(state)[seat];
  const tags = tagSetPoints(state, seat);
  const coins = Math.floor((resH ? resH.amountOf(state.res[seat], "coins") : (state.res[seat].coins || 0)) / 3);
  return state.points[seat] + tableauPoints(state, seat) + maj + tags + coins;
}
function effectSeat(s, seat) {
  return { resources: s.res[seat], points: s.points[seat], hand: s.hands[seat], tableau: s.tableau[seat], fired: s.fired[seat], firedAt: s.firedAt[seat] };
}
const EFFECTS = { cardOf: chartOf, draw: () => [] };
function playCard(state, seat, instance) {
  let played;
  if (effectsH && effectsH.playToTableau) {
    played = effectsH.playToTableau(effectSeat(state, seat), instance, EFFECTS);
  } else {
    played = { resources: state.res[seat], points: state.points[seat], hand: state.hands[seat].filter((c) => c !== instance), tableau: [...state.tableau[seat], instance], fired: [...state.fired[seat], instance], firedAt: state.turn + 1 };
  }
  let resources = played.resources;
  let points = played.points + (chartOf(instance).points || 0);
  const def = defIdOf(instance);
  const g = GAINS[def];
  if (g) resources = resH.add(resources, g);
  let pilotBonus = state.pilotBonus[seat];
  if (def === "pilot") {
    const tab = played.tableau;
    let n = 0;
    for (const c of tab) { const d = chartOf(c); if (d && d.tags.includes("Guild")) n++; }
    pilotBonus = pilotBonus + n;
  }
  if (def === "factor") {
    const before = countTag(state.tableau[seat], "Coin");
    resources = resH.add(resources, { coins: before });
  }
  return { resources, points, hand: played.hand, tableau: played.tableau, fired: played.fired || state.fired[seat], firedAt: played.firedAt !== undefined ? played.firedAt : state.firedAt[seat], pilotBonus };
}
function chartView(instance, state, seat) {
  const card = chartOf(instance);
  if (!card) return { id: instance, title: instance };
  let text = ABILITY[card.id] || "";
  if (card.tags.includes("Sail") && card.id !== "broker" && card.id !== "pilot") text = text ? text + " Sail crew." : "Sail crew.";
  if (effectsH && effectsH.rulesText) {
    try {
      const rt = effectsH.rulesText(card, NAMES, { onPlay: "On play", income: "Each round", endgame: "End", play: "play", cards: "charts" });
      if (rt) text = text ? text + " " + rt : rt;
    } catch (e) {}
  }
  let pulse;
  if (state !== undefined && seat !== undefined && effectsH && effectsH.pulseOf) {
    try { pulse = effectsH.pulseOf(effectSeat(state, seat), instance); } catch (e) {}
  }
  const cost = state !== undefined && seat !== undefined ? chartCost(state, seat, instance) : card.cost;
  return { id: instance, title: card.name, text: text || `${card.tags.join(" · ")}`, cost, points: card.points, tags: card.tags, pulse };
}
function contractView(c) {
  const need = SPICES.filter((s) => (c.need[s] || 0) > 0).map((s) => `${c.need[s]} ${s}`).join(" + ");
  return { id: c.id, title: `${BAY_NAMES[c.bay]} Contract`, text: `Needs ${need} + house in ${BAY_NAMES[c.bay]}.`, cost: c.need, points: c.points, tags: ["Contract"] };
}

const CONTRACT_DEFS = [
  { id: "k1", bay: 0, need: { saffron: 2, clove: 1 }, points: 5, reward: { coins: 2 } },
  { id: "k2", bay: 0, need: { cinnamon: 2 }, points: 4, reward: { coins: 2 } },
  { id: "k3", bay: 0, need: { saffron: 1, clove: 1, cinnamon: 1 }, points: 6, reward: { coins: 3 } },
  { id: "k4", bay: 0, need: { clove: 3 }, points: 5, reward: { coins: 2 } },
  { id: "k5", bay: 0, need: { saffron: 3 }, points: 6, reward: { coins: 3 } },
  { id: "k6", bay: 1, need: { clove: 2, cinnamon: 1 }, points: 5, reward: { coins: 2 } },
  { id: "k7", bay: 1, need: { saffron: 2 }, points: 4, reward: { coins: 2 } },
  { id: "k8", bay: 1, need: { saffron: 1, cinnamon: 2 }, points: 6, reward: { coins: 3 } },
  { id: "k9", bay: 1, need: { clove: 1, cinnamon: 1 }, points: 4, reward: { coins: 3 } },
  { id: "k10", bay: 1, need: { saffron: 2, cinnamon: 2 }, points: 7, reward: { coins: 3 } },
  { id: "k11", bay: 2, need: { cinnamon: 3 }, points: 5, reward: { coins: 2 } },
  { id: "k12", bay: 2, need: { saffron: 1, clove: 2 }, points: 6, reward: { coins: 3 } },
  { id: "k13", bay: 2, need: { clove: 2 }, points: 4, reward: { coins: 2 } },
  { id: "k14", bay: 2, need: { saffron: 2, clove: 2 }, points: 7, reward: { coins: 4 } },
  { id: "k15", bay: 2, need: { saffron: 1, cinnamon: 1 }, points: 4, reward: { coins: 2 } },
  { id: "k16", bay: 0, need: { cinnamon: 1, clove: 1, saffron: 1 }, points: 5, reward: { coins: 2 } },
];

function harborXY(i, n) {
  const x = 1.4 + (i * 13.2) / Math.max(1, n - 1);
  const y = 5.0 + Math.sin(i * 0.85) * 1.5;
  return [x, y];
}
function rectPoly(x, y, w, h) { return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }
function diamond(cx, cy, r) { return [[cx - r, cy], [cx, cy - r], [cx + r, cy], [cx, cy + r]]; }
function dhowCounts(state) {
  const c = new Array(state.numHarbors).fill(0);
  for (const arr of state.dhowPos) for (const h of arr) c[h]++;
  return c;
}
function hasBayHouse(state, seat, bay) {
  return state.harbors.some((h, i) => h.bay === bay && state.houses[i] === seat);
}
function canAfford(pool, cost) {
  if (resH && resH.canAfford) return resH.canAfford(pool, cost);
  return Object.entries(cost).every(([k, v]) => (pool[k] || 0) >= v);
}

const sameMove = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function genMoves(s, player) {
  const moves = [];
  const range = 2 + (s.pilotBonus[player] || 0);
  const counts = dhowCounts(s);
  for (let d = 0; d < 2; d++) {
    const origin = s.dhowPos[player][d];
    for (let dest = 0; dest < s.numHarbors; dest++) {
      if (Math.abs(dest - origin) > range) continue;
      if (dest !== origin && counts[dest] >= 3) continue;
      const hb = s.harbors[dest];
      const spice = hb.spice;
      const price = hb.price;
      const own = s.houses[dest] === player;
      const buyPer = Math.max(1, price - (own ? 1 : 0));
      const sellPer = price + (own ? 1 : 0);
      for (let q = 1; q <= 3; q++) {
        if ((s.res[player].coins || 0) >= q * buyPer) moves.push({ type: "move", dhow: d, dest, action: "trade", mode: "buy", qty: q });
        if ((s.res[player][spice] || 0) >= q) moves.push({ type: "move", dhow: d, dest, action: "trade", mode: "sell", qty: q });
        if (moves.length > 220) return moves;
      }
      if (s.houses[dest] === null) {
        const built = s.houses.filter((o) => o === player).length;
        if (built < s.houseLimit) {
          const cc = foundCoinCost(s, player);
          for (const sp of SPICES) {
            if ((s.res[player][sp] || 0) >= 2 && (s.res[player].coins || 0) >= cc)
              moves.push({ type: "move", dhow: d, dest, action: "found", spice: sp });
          }
        }
      }
      if (s.hands[player].length < 5) {
        s.chartMarket.row.forEach((card, idx) => {
          const cost = chartCost(s, player, card);
          if (canAfford(s.res[player], cost)) moves.push({ type: "move", dhow: d, dest, action: "chart", market: idx });
        });
      }
      for (const card of s.hands[player]) moves.push({ type: "move", dhow: d, dest, action: "play", card });
      for (const c of s.contractsRow) {
        if (hasBayHouse(s, player, c.bay) && canAfford(s.res[player], c.need))
          moves.push({ type: "move", dhow: d, dest, action: "fulfill", contract: c.id });
      }
      if (moves.length > 220) return moves;
    }
  }
  moves.push({ type: "move", dhow: 0, dest: s.dhowPos[player][0], action: "pass" });
  return moves.slice(0, 240);
}

module.exports = {
  meta: {
    id: "saffron-wake",
    name: "Saffron Wake",
    family: "map",
    mode: "competitive",
    minPlayers: 2,
    maxPlayers: 4,
    summary: "Out-sail rivals around a shifting spice coast, plant guild houses and chain voyage charts into contracts.",
    rules: [
      "Sail one dhow up to 2 routes, then take one harbor action: Trade, Found, Chart or Fulfill.",
      "Trade buys or sells up to 3 of the harbor spice; selling raises its price and buying lowers it, and your own house discounts you.",
      "Found spends 2 matching spices plus coins for a guild house worth 2 points and 1 coin each round; chart buys a voyage card and plays it, chaining Sail, Coin and Guild tags.",
      "Fulfill a contract by discarding its spices while you hold a house in its bay to score 4 to 7 points plus coins.",
      "Harbors hold 3 dhows and 1 house, so your house blocks rivals. After the rounds the bays, tag sets and leftover coins score and most points wins.",
    ],
    resources: [
      { id: "saffron", name: "Saffron", icon: "sun", color: "#e09a00" },
      { id: "clove", name: "Clove", icon: "sprout", color: "#4d7c3a" },
      { id: "cinnamon", name: "Cinnamon", icon: "brick", color: "#8a4b2a" },
      { id: "coins", name: "Coins", icon: "coins", color: "#c9a227" },
    ],
  },
  params: [
    { key: "harbors", label: "Harbors in play", kind: "int", min: 10, max: 14, default: 12 },
    { key: "rounds", label: "Rounds", kind: "int", min: 4, max: 8, default: 6 },
    { key: "houseLimit", label: "Guild houses per player", kind: "int", min: 6, max: 10, default: 8 },
  ],

  setup({ numPlayers, params, rng }) {
    const n = params.harbors;
    const harbors = [];
    for (let i = 0; i < n; i++) {
      harbors.push({ id: `harbor-${i}`, name: HARBOR_NAMES[i], bay: Math.min(2, Math.floor((i * 3) / n)), spice: SPICES[i % 3], price: 2 });
    }
    const houses = new Array(n).fill(null);
    const dhowPos = [];
    for (let p = 0; p < numPlayers; p++) dhowPos.push([(p * 3) % n, (p * 3 + 1) % n]);
    let deck;
    if (effectsH && effectsH.buildDeck) deck = rng.shuffle(effectsH.buildDeck(CHART_DEFS));
    else deck = rng.shuffle(CHART_DEFS.map((c) => `${c.id}#1`));
    const hands = Array.from({ length: numPlayers }, () => []);
    let rest = deck.slice();
    for (let p = 0; p < numPlayers; p++) { if (rest.length) hands[p].push(rest.shift()); }
    let chartMarket = { row: [], drawPile: rest, discard: [] };
    chartMarket = marketH.refill(rng, chartMarket, 4);
    const shuffledK = rng.shuffle(CONTRACT_DEFS.map((c) => ({ ...c, need: { ...c.need }, reward: { ...c.reward } })));
    const contractsRow = shuffledK.slice(0, 3);
    const contractDeck = shuffledK.slice(3);
    return {
      numPlayers, rounds: params.rounds, houseLimit: params.houseLimit, numHarbors: n,
      turn: 0, toMove: 0, over: false,
      harbors, houses, dhowPos,
      res: Array.from({ length: numPlayers }, () => ({ saffron: 2, clove: 1, cinnamon: 0, coins: 5 })),
      points: new Array(numPlayers).fill(0),
      hands, tableau: Array.from({ length: numPlayers }, () => []),
      fired: Array.from({ length: numPlayers }, () => []),
      firedAt: new Array(numPlayers).fill(0),
      chartMarket, contractsRow, contractDeck,
      pilotBonus: new Array(numPlayers).fill(0),
    };
  },

  activePlayers(s) { return s.over ? [] : [s.toMove]; },

  legalMoves(s, player) {
    if (s.over || player !== s.toMove) return [];
    return genMoves(s, player);
  },

  applyMove(s, player, move, rng) {
    const legal = genMoves(s, player);
    if (!legal.some((m) => sameMove(m, move))) throw new Error(`illegal move ${JSON.stringify(move)}`);
    let harbors = s.harbors.map((h) => ({ ...h }));
    let houses = s.houses.slice();
    let dhowPos = s.dhowPos.map((a) => a.slice());
    let res = s.res.map((r) => ({ ...r }));
    let points = s.points.slice();
    let hands = s.hands.map((a) => a.slice());
    let tableau = s.tableau.map((a) => a.slice());
    let fired = s.fired.map((a) => a.slice());
    let firedAt = s.firedAt.slice();
    let chartMarket = { row: s.chartMarket.row.slice(), drawPile: s.chartMarket.drawPile.slice(), discard: s.chartMarket.discard.slice() };
    let contractsRow = s.contractsRow.map((c) => ({ ...c, need: { ...c.need }, reward: { ...c.reward } }));
    let contractDeck = s.contractDeck.map((c) => ({ ...c, need: { ...c.need }, reward: { ...c.reward } }));
    let pilotBonus = s.pilotBonus.slice();

    dhowPos[player][move.dhow] = move.dest;
    pilotBonus[player] = 0;

    if (move.action === "trade") {
      const hb = harbors[move.dest];
      const own = houses[move.dest] === player;
      if (move.mode === "buy") {
        const per = Math.max(1, hb.price - (own ? 1 : 0));
        res[player] = resH.pay(res[player], { coins: move.qty * per });
        res[player] = resH.add(res[player], { [hb.spice]: move.qty });
        hb.price = Math.max(1, hb.price - 1);
      } else {
        res[player] = resH.pay(res[player], { [hb.spice]: move.qty });
        const per = hb.price + (own ? 1 : 0);
        res[player] = resH.add(res[player], { coins: move.qty * per });
        hb.price = Math.min(5, hb.price + 1);
      }
    } else if (move.action === "found") {
      const cc = foundCoinCost({ ...s, tableau }, player);
      res[player] = resH.pay(res[player], { [move.spice]: 2, coins: cc });
      houses[move.dest] = player;
      points[player] += 2;
    } else if (move.action === "chart") {
      const instance = chartMarket.row[move.market];
      const cost = chartCost(s, player, instance);
      res[player] = resH.pay(res[player], cost);
      const taken = marketH.take(rng, chartMarket, move.market, 4);
      chartMarket = taken.market;
      const tmpState = { ...s, res, points, hands, tableau, fired, firedAt, turn: s.turn, pilotBonus };
      const withCard = { ...tmpState, hands: hands.map((h, i) => (i === player ? [...h, instance] : h)) };
      hands = withCard.hands.map((a) => a.slice());
      const r = playCard({ ...s, res, points, hands, tableau, fired, firedAt, turn: s.turn, pilotBonus }, player, instance);
      res[player] = r.resources; points[player] = r.points;
      hands[player] = r.hand; tableau[player] = r.tableau;
      fired[player] = r.fired; firedAt[player] = r.firedAt;
      pilotBonus[player] = r.pilotBonus;
    } else if (move.action === "play") {
      const r = playCard({ ...s, res, points, hands, tableau, fired, firedAt, turn: s.turn, pilotBonus }, player, move.card);
      res[player] = r.resources; points[player] = r.points;
      hands[player] = r.hand; tableau[player] = r.tableau;
      fired[player] = r.fired; firedAt[player] = r.firedAt;
      pilotBonus[player] = r.pilotBonus;
    } else if (move.action === "fulfill") {
      const idx = contractsRow.findIndex((c) => c.id === move.contract);
      const c = contractsRow[idx];
      res[player] = resH.pay(res[player], c.need);
      res[player] = resH.add(res[player], c.reward);
      points[player] += c.points;
      contractsRow.splice(idx, 1);
      if (contractDeck.length) contractsRow.push(contractDeck.shift());
    }

    const totalTurns = s.rounds * s.numPlayers * 3;
    const turn = s.turn + 1;
    let over = turn >= totalTurns;
    let toMove = over ? s.toMove : (s.toMove + 1) % s.numPlayers;
    let next = { ...s, harbors, houses, dhowPos, res, points, hands, tableau, fired, firedAt, chartMarket, contractsRow, contractDeck, pilotBonus, turn, toMove, over };
    if (!over && turn % (s.numPlayers * 3) === 0) {
      const nr = next.res.map((r) => ({ ...r }));
      const np = next.points.slice();
      const nf = next.fired.map((a) => a.slice());
      const nft = next.firedAt.slice();
      for (let seat = 0; seat < next.numPlayers; seat++) {
        let coins = 0;
        next.houses.forEach((o) => { if (o === seat) coins += 1; });
        for (const inst of next.tableau[seat]) {
          const inc = CHART_INCOME[defIdOf(inst)];
          if (inc) coins += inc.coins || 0;
        }
        let seatObj = { resources: nr[seat], points: np[seat], hand: next.hands[seat], tableau: next.tableau[seat], fired: nf[seat], firedAt: nft[seat] };
        if (effectsH && effectsH.applyIncome) {
          try {
            const paid = effectsH.applyIncome(seatObj, EFFECTS);
            seatObj = paid;
          } catch (e) {}
        }
        nr[seat] = resH.add(seatObj.resources, { coins });
        np[seat] = seatObj.points;
        nf[seat] = seatObj.fired || nf[seat];
        nft[seat] = seatObj.firedAt !== undefined ? seatObj.firedAt : nft[seat];
      }
      next = { ...next, res: nr, points: np, fired: nf, firedAt: nft };
    }
    return next;
  },

  isTerminal(s) { return s.over; },

  outcome(s) {
    const scores = Array.from({ length: s.numPlayers }, (_, i) => totalScore(s, i));
    let winners = [];
    if (s.over) {
      if (scoringH && scoringH.scoreWinners) {
        try { winners = scoringH.scoreWinners(scores); } catch (e) { winners = []; }
      } else {
        const best = Math.max(...scores);
        winners = scores.flatMap((v, i) => (v === best ? [i] : []));
        if (new Set(scores).size === 1 && s.numPlayers > 1) winners = [];
        if (winners.length === s.numPlayers) winners = [];
      }
    }
    return { winners, scores };
  },

  view(s, player) {
    return {
      ...s,
      hands: s.hands.map((h, i) => (i === player ? h.slice() : h.map(() => "hidden"))),
      chartMarket: { row: s.chartMarket.row.slice(), drawPile: s.chartMarket.drawPile.map(() => "hidden"), discard: s.chartMarket.discard.slice() },
      contractDeck: s.contractDeck.map(() => "hidden"),
    };
  },

  geometry(s) {
    const n = s.numHarbors;
    const cells = [];
    const pieces = [];
    const xs = [];
    for (let i = 0; i < n; i++) xs.push(harborXY(i, n)[0]);
    let d0 = 5.7;
    let d1 = 10.7;
    const bays = s.harbors.map((h) => h.bay);
    let split0 = bays.findIndex((b) => b === 1);
    let split1 = bays.findIndex((b) => b === 2);
    if (split0 > 0) d0 = (xs[split0 - 1] + xs[split0]) / 2;
    if (split1 > 0) d1 = (xs[split1 - 1] + xs[split1]) / 2;
    if (!(d1 > d0 + 0.9)) {
      const mid = (d0 + d1) / 2;
      d0 = mid - 0.45;
      d1 = mid + 0.45;
    }
    const bayTerrains = [
      { x0: 0.3, x1: d0, kind: "lagoon" },
      { x0: d0, x1: d1, kind: "sea" },
      { x0: d1, x1: 15.7, kind: "reef" },
    ];
    bayTerrains.forEach((b, i) => {
      cells.push({ id: `bay-${i}`, polygon: rectPoly(b.x0, 2.4, b.x1 - b.x0, 4.6), kind: b.kind, label: BAY_NAMES[i] });
    });
    const terrBySpice = { saffron: "grain", clove: "forest", cinnamon: "stone" };
    const HR = 0.4;
    s.harbors.forEach((h, i) => {
      const [cx, cy] = harborXY(i, n);
      cells.push({ id: h.id, polygon: diamond(cx, cy, HR), kind: "harbor", label: h.name, badge: `${h.price}`, terrain: terrBySpice[h.spice], owner: s.houses[i] === null ? undefined : s.houses[i] });
    });
    for (let i = 0; i < 4; i++) {
      const x = 1.4 + i * 3.6;
      const card = s.chartMarket.row[i];
      cells.push({ id: `chart-${i}`, polygon: rectPoly(x, 0.4, 3.2, 1.4), kind: "market", label: card ? chartOf(card).name : "Chart market" });
    }
    for (let i = 0; i < 3; i++) {
      const x = 2.2 + i * 4.4;
      const c = s.contractsRow[i];
      cells.push({ id: `wharf-${i}`, polygon: rectPoly(x, 7.6, 3.8, 1.4), kind: "wharf", label: c ? BAY_NAMES[c.bay] : "Contract wharf", badge: c ? `${c.points}` : undefined });
    }
    const perHarbor = new Array(n).fill(0);
    s.dhowPos.forEach((arr, seat) => {
      arr.forEach((h, d) => {
        const [cx, cy] = harborXY(h, n);
        const k = perHarbor[h]++;
        const x = cx - 0.3 + (k % 3) * 0.3;
        const y = cy + 0.28;
        pieces.push({ id: `dhow-${seat}-${d}`, x, y, r: 0.2, owner: seat, shape: "disc", kind: "dhow", cellId: s.harbors[h].id });
      });
    });
    s.houses.forEach((o, i) => {
      if (o === null) return;
      const [cx, cy] = harborXY(i, n);
      pieces.push({ id: `house-${i}`, x: cx, y: cy - 0.25, r: 0.22, owner: o, shape: "square", kind: "house", cellId: s.harbors[i].id });
    });
    return { width: 16, height: 9.6, cells, pieces };
  },

  panels(s, viewer) {
    const panels = [
      {
        id: "charts", title: "Chart market", zone: "shared",
        cards: s.chartMarket.row.map((c) => chartView(c, viewer === undefined ? undefined : s, viewer === undefined ? undefined : viewer)),
        counters: [{ id: "chart-deck", label: "Deck", value: s.chartMarket.drawPile.length }],
        note: `Round ${Math.min(s.rounds, Math.floor(s.turn / (s.numPlayers * 3)) + 1)}/${s.rounds}`,
      },
      {
        id: "contracts", title: "Contract wharf", zone: "shared",
        cards: s.contractsRow.map(contractView),
        counters: [{ id: "contract-deck", label: "Deck", value: s.contractDeck.length }],
        note: "Fulfill needs a bay house",
      },
    ];
    for (let seat = 0; seat < s.numPlayers; seat++) {
      panels.push({
        id: `seat${seat}`, title: `Merchant ${seat + 1}`, zone: "players", owner: seat,
        counters: [
          { id: `seat${seat}-saffron`, label: "Saffron", value: s.res[seat].saffron || 0, resource: "saffron" },
          { id: `seat${seat}-clove`, label: "Clove", value: s.res[seat].clove || 0, resource: "clove" },
          { id: `seat${seat}-cinnamon`, label: "Cinnamon", value: s.res[seat].cinnamon || 0, resource: "cinnamon" },
          { id: `seat${seat}-coins`, label: "Coins", value: s.res[seat].coins || 0, resource: "coins" },
          { id: `seat${seat}-houses`, label: "Houses", value: s.houses.filter((o) => o === seat).length },
          { id: `seat${seat}-score`, label: "Score", value: totalScore(s, seat) },
        ],
        cards: s.tableau[seat].map((c) => chartView(c, s, seat)),
        note: s.toMove === seat && !s.over ? "To move" : undefined,
      });
    }
    if (viewer !== undefined) {
      panels.push({ id: `hand${viewer}`, title: "Your charts", zone: "hand", owner: viewer, cards: s.hands[viewer].filter((c) => c !== "hidden").map((c) => chartView(c, s, viewer)) });
    }
    return panels;
  },

  moveTarget(_s, move) {
    if (!move || move.action === "pass") return undefined;
    if (move.action === "chart") return _s.chartMarket.row[move.market];
    if (move.action === "play") return move.card;
    if (move.action === "fulfill") return move.contract;
    return `harbor-${move.dest}`;
  },

  describeMove(s, move, viewer) {
    if (!move || move.action === "pass") return "hold position";
    const hb = s.harbors[move.dest];
    const where = hb ? ` at ${hb.name}` : "";
    if (move.action === "trade") return `${move.mode} ${move.qty} ${hb.spice}${where}`;
    if (move.action === "found") return `found a house with ${move.spice}${where}`;
    if (move.action === "chart") {
      const c = s.chartMarket.row[move.market];
      return c ? `take and play ${chartOf(c).name}${where}` : `take a chart${where}`;
    }
    if (move.action === "play") {
      if (viewer !== undefined && viewer !== s.toMove) return "play a chart";
      const cd = chartOf(move.card);
      return cd ? `play ${cd.name}${where}` : `play a chart${where}`;
    }
    if (move.action === "fulfill") return `fulfill ${move.contract}${where}`;
    return "sail";
  },
};
