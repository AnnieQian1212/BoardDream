const M = require("@boarddream/mechanics");
const hexmap = (M && M.hexmap) || M;
const production = (M && M.production) || M;
const trade = (M && M.trade) || M;
const scoring = (M && M.scoring) || M;
const resMod = (M && M.resources) || M;

function rAdd(pool, amounts, mult = 1) {
  if (resMod && typeof resMod.add === "function") return resMod.add(pool, amounts, mult);
  const out = { ...(pool || {}) };
  for (const [k, v] of Object.entries(amounts || {})) {
    out[k] = (out[k] || 0) + v * mult;
    if (out[k] <= 0) delete out[k];
  }
  return out;
}
function rAmount(pool, id) {
  if (resMod && typeof resMod.amountOf === "function") return resMod.amountOf(pool, id);
  return (pool && pool[id]) || 0;
}
function rCanAfford(pool, cost) {
  if (resMod && typeof resMod.canAfford === "function") return resMod.canAfford(pool, cost);
  for (const [k, v] of Object.entries(cost || {})) if (((pool || {})[k] || 0) < v) return false;
  return true;
}
function rPay(pool, cost) {
  if (resMod && typeof resMod.pay === "function") return resMod.pay(pool, cost);
  const out = { ...(pool || {}) };
  for (const [k, v] of Object.entries(cost || {})) {
    out[k] = (out[k] || 0) - v;
    if (out[k] <= 0) delete out[k];
  }
  return out;
}
function prodProduce(map, buildings, tiles, yieldOf, n) {
  if (production && typeof production.produce === "function") return production.produce(map, buildings, tiles, yieldOf, n);
  const gains = Array.from({ length: n }, () => ({}));
  const lk = hexmap.lookup(map);
  for (const id of tiles) {
    const a = yieldOf(id);
    if (!a) continue;
    for (const c of lk.tile.get(id).corners) {
      const b = buildings[c];
      if (!b) continue;
      for (let l = 0; l < b.level; l++) gains[b.owner] = rAdd(gains[b.owner], a);
    }
  }
  return gains;
}
function prodCollect(pools, gains) {
  if (production && typeof production.collect === "function") return production.collect(pools, gains);
  return pools.map((p, i) => rAdd(p, gains[i] || {}));
}
function tBankTrade(pool, give, get, rate) {
  if (trade && typeof trade.bankTrade === "function") return trade.bankTrade(pool, give, get, rate);
  if (give === get) throw new Error("same");
  if (rAmount(pool, give) < rate) throw new Error("needs");
  return rAdd(pool, { [give]: -rate, [get]: 1 });
}
function tBankOptions(pool, ids, rate) {
  if (trade && typeof trade.bankOptions === "function") return trade.bankOptions(pool, ids, rate);
  return ids.flatMap((g) => (rAmount(pool, g) >= rate ? ids.filter((x) => x !== g).map((x) => ({ give: g, get: x })) : []));
}
function tSwapOptions(pools, from, to, ids) {
  if (trade && typeof trade.swapOptions === "function") return trade.swapOptions(pools, from, to, ids);
  return ids.flatMap((g) => (rAmount(pools[from], g) > 0 ? ids.filter((x) => x !== g && rAmount(pools[to], x) > 0).map((x) => ({ from, to, give: { [g]: 1 }, get: { [x]: 1 } })) : []));
}
function tCanAccept(pools, offer) {
  if (trade && typeof trade.canAccept === "function") return trade.canAccept(pools, offer);
  const g = Object.entries(offer.give)[0];
  const gg = Object.entries(offer.get)[0];
  return (pools[offer.from][g[0]] || 0) >= g[1] && (pools[offer.to][gg[0]] || 0) >= gg[1];
}
function tSettle(pools, offer) {
  if (trade && typeof trade.settle === "function") return trade.settle(pools, offer);
  return pools.map((p, s) => {
    if (s === offer.from) return rAdd(rAdd(p, offer.give, -1), offer.get);
    if (s === offer.to) return rAdd(rAdd(p, offer.get, -1), offer.give);
    return p;
  });
}
function sWinners(scores) {
  if (scoring && typeof scoring.scoreWinners === "function") return scoring.scoreWinners(scores);
  const best = Math.max(...scores);
  const top = scores.flatMap((s, i) => (s === best ? [i] : []));
  return top.length === scores.length ? [] : top;
}

const RESOURCE_SPECS = [
  { id: "driftwood", name: "Driftwood", icon: "tree", color: "#8a5a33" },
  { id: "pandan", name: "Pandan", icon: "leaf", color: "#4e9b5f" },
  { id: "coconut", name: "Coconut", icon: "sprout", color: "#b98a3a" },
  { id: "pearl", name: "Mother-of-pearl", icon: "gem", color: "#d8b7d8" },
];
const RESOURCE_IDS = RESOURCE_SPECS.map((r) => r.id);
const RNAMES = { driftwood: "driftwood", pandan: "pandan", coconut: "coconut", pearl: "pearl" };
const TERRAIN_RESOURCE = { palm: "driftwood", strand: "pandan", copra: "coconut", shell: "pearl" };
const TERRAIN_LIST = ["palm", "strand", "copra", "shell"];
const VILLAGE_COST = { driftwood: 1, pandan: 1, coconut: 1 };
const TOWN_COST = { coconut: 2, pearl: 2 };
const LANTERN_COST = { driftwood: 1, coconut: 1, pearl: 1 };
const KEEP_COST = { pandan: 1, pearl: 1 };
const BANK_RATE = 3;

const COORDS = [...hexmap.radiusCoords(2), [3, -3], [3, -2], [2, -3], [-3, 3], [-3, 2], [-2, 3], [0, 3], [0, -3]];
const MAP = hexmap.buildHexMap(COORDS, 1, 0.6);
const TILE_INDEX = new Map(MAP.tiles.map((t, i) => [t.id, i]));
const OUTLINES = {
  tile: MAP.tiles.map((t) => hexmap.tilePolygon(MAP, t.id)),
  edge: MAP.edges.map((e) => hexmap.edgePolygon(MAP, e.id)),
  vertex: MAP.vertices.map((v) => hexmap.vertexPolygon(MAP, v.id)),
};
const LAGOON_IDX = [2, 10, 13, 16, 24];
const NAMED_IDX = { 2: "Honeymilk", 13: "Firefly", 24: "Wrenwater" };
const NAMED_TILES = Object.keys(NAMED_IDX).map((i) => `t${i}`);
const ATOLL_NAMES = ["Mallow", "Nettle", "Wren"];
const OTHER_NAMES = ["Sunspun","Coral Hush","Palm Shade","Copra Loft","Shell Whisper","Tea Calm","Reed Song","Drift Rest","Gull Perch","Warm Hollow","Pandan Braid","Honey Reef","Moon Wash","Soft Strand","Wren Call","Bramble Light","Sweet Pool","Nettle Bay","Quiet Keel","Lantern Row","Coconut Shade","Driftwood Song","Stillwater","Glasspool"];
const TIDE_BASE = [...Array(7).fill("palm"), ...Array(7).fill("strand"), ...Array(7).fill("copra"), ...Array(7).fill("shell")];

const COVE_DEFS = [
  { id: "sweetwater", name: "Sweetwater", wish: "Homes on two atolls", desc: "Tend homes in 2 atolls." },
  { id: "bramble", name: "Bramble", wish: "Two lanterns and a town", desc: "Tend 2 lanterns plus a town." },
  { id: "gullrest", name: "Gullrest", wish: "A cozy tag pair", desc: "Hold 2 keepsakes sharing a tag." },
  { id: "driftwood", name: "Driftwood", wish: "Four warm homes", desc: "Raise 4 villages or towns." },
];
const KEEP_NAMES = ["Hammock Auntie","Rope Uncle","Porch Cousin","Turtle Nap","Gull Cry","Hibiscus Tea","Moon Lullaby","Shell Singer","Drift Doula","Pandan Weaver","Pearl Diver","Coconut Granny","Lantern Minder","Tea Pourer","Net Mender","Star Counter","Reef Walker","Palm Husher","Song Keeper","Tide Waiter","Firefly Friend","Honey Cook","Wren Watcher","Shore Sitter"];
const KEEP_TAGS = ["Gull", "Turtle", "Hibiscus", "Moon"];
const KEEP_GAIN = { Gull: { pearl: 1 }, Turtle: { coconut: 1 }, Hibiscus: { pandan: 1 }, Moon: { driftwood: 1 } };
const KEEP_DEFS = KEEP_NAMES.map((name, i) => {
  const tag = KEEP_TAGS[i % 4];
  const points = i % 6 === 5 ? 2 : 1;
  const discountBridge = i === 0 || i === 1;
  return { id: `k${i}`, name, tags: [tag], points, triggerTag: discountBridge ? null : tag, gain: discountBridge ? null : KEEP_GAIN[tag], discountBridge };
});
function keepText(k) {
  if (k.discountBridge) return `${k.tags[0]} · Footbridges cost 1 driftwood. ${k.points}pt.`;
  const g = k.gain ? Object.entries(k.gain)[0] : null;
  return `${k.tags[0]} · When a ${k.triggerTag} friend arrives gain ${g ? `${g[1]} ${g[0]}` : "a bounty"}. ${k.points}pt.`;
}
function cap(s) { return s[0].toUpperCase() + s.slice(1); }
function badgeForTerrain(t) {
  if (t === "lagoon") return undefined;
  const r = TERRAIN_RESOURCE[t];
  return r === "driftwood" ? "D" : r === "pandan" ? "P" : r === "coconut" ? "C" : "R";
}
function terrainGround(t) {
  return t === "palm" ? "forest" : t === "strand" ? "grass" : t === "copra" ? "grain" : t === "shell" ? "stone" : "water";
}
function terrainOf(s, tile) { return s.terrain[TILE_INDEX.get(tile)]; }
function tileYield(s, tile) {
  const t = terrainOf(s, tile);
  if (t === "lagoon") return undefined;
  return { [TERRAIN_RESOURCE[t]]: 1 };
}
function lanternSpots(s) {
  const lk = hexmap.lookup(MAP);
  return MAP.vertices.filter((v) => {
    if (s.buildings[v.id] || s.lanterns[v.id]) return false;
    return v.tiles.some((t) => terrainOf(s, t) === "lagoon");
  }).map((v) => v.id);
}
function lanternCount(s, seat) { return Object.values(s.lanterns).filter((o) => o === seat).length; }
function townCount(s, seat) { return Object.values(s.buildings).filter((b) => b.owner === seat && b.level === 2).length; }
function glowLeader(s, tileId) {
  const lk = hexmap.lookup(MAP);
  const counts = Array.from({ length: s.numPlayers }, () => 0);
  for (const [v, owner] of Object.entries(s.lanterns)) {
    if (lk.vertex.get(v).tiles.includes(tileId)) counts[owner]++;
  }
  const best = Math.max(...counts);
  if (best <= 0) return null;
  const tops = counts.flatMap((c, i) => (c === best ? [i] : []));
  return tops.length === 1 ? tops[0] : null;
}
function hearthScore(s, seat) {
  let pts = 0;
  for (const b of Object.values(s.buildings)) if (b.owner === seat) pts += b.level;
  pts += lanternCount(s, seat) * 1;
  for (const t of NAMED_TILES) if (glowLeader(s, t) === seat) pts += 2;
  for (const [c, o] of Object.entries(s.coveClaimed || {})) if (o === seat) pts += 2;
  const keeps = (s.keepsakes[seat] || []);
  pts += keeps.reduce((a, k) => a + k.points, 0);
  const cnt = { Gull: 0, Turtle: 0, Hibiscus: 0, Moon: 0 };
  for (const k of keeps) for (const t of k.tags) if (cnt[t] !== undefined) cnt[t]++;
  pts += Math.min(cnt.Gull, cnt.Turtle, cnt.Hibiscus, cnt.Moon) * 2;
  return pts;
}
function coveSatisfied(s, seat, coveId) {
  const lk = hexmap.lookup(MAP);
  if (coveId === "sweetwater") {
    const at = new Set();
    for (const [v, b] of Object.entries(s.buildings)) {
      if (b.owner !== seat) continue;
      for (const t of lk.vertex.get(v).tiles) at.add(s.atoll[TILE_INDEX.get(t)]);
    }
    return at.size >= 2;
  }
  if (coveId === "bramble") return lanternCount(s, seat) >= 2 && townCount(s, seat) >= 1;
  if (coveId === "gullrest") {
    const c = {};
    for (const k of s.keepsakes[seat] || []) for (const t of k.tags) c[t] = (c[t] || 0) + 1;
    return Object.values(c).some((n) => n >= 2);
  }
  if (coveId === "driftwood") return Object.values(s.buildings).filter((b) => b.owner === seat).length >= 4;
  return false;
}
function claimCoves(s, seat) {
  let claimed = s.coveClaimed || {};
  let changed = false;
  const next = { ...claimed };
  for (const c of s.coves) {
    if (next[c.id] !== undefined) continue;
    if (coveSatisfied({ ...s, coveClaimed: next }, seat, c.id)) { next[c.id] = seat; changed = true; }
  }
  if (!changed) return s;
  return { ...s, coveClaimed: next };
}
function totalCount(pool) { return Object.values(pool || {}).reduce((a, v) => a + v, 0); }
function trimPool(pool, limit) {
  let out = { ...pool };
  while (totalCount(out) > limit) {
    const entries = Object.entries(out).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    const top = entries[0][0];
    out[top]--;
    if (out[top] <= 0) delete out[top];
  }
  return out;
}
function roadCostFor(s, seat) {
  if ((s.keepsakes[seat] || []).some((k) => k.discountBridge)) return { driftwood: 1 };
  return { driftwood: 1, pandan: 1 };
}
function cornerTerrains(s, vertex) {
  const names = hexmap.lookup(MAP).vertex.get(vertex).tiles.map((t) => terrainOf(s, t));
  return names.length <= 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
function setupSeat(s) { return s.setup.order[s.setup.step]; }
function rect(x, y, w, h) { return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]; }

module.exports = {
  meta: {
    id: "tidehearth",
    name: "Tidehearth",
    family: "map",
    mode: "competitive",
    minPlayers: 2,
    maxPlayers: 4,
    summary: "Settle a honey-warm atoll neighborhood where tides fill every pantry, neighbors swap bounties over tea, and firefly lanterns glow over quiet lagoons.",
    rules: [
      "Each turn pick one of two forecast tides; every village by that terrain gathers, towns double, and villages by your lit lagoons shell bonus coconut.",
      "Trade 3 of one bounty to the bank for any 1 or swap 1 for 1 with neighbors, then take up to 2 builds: bridges, villages, towns, lagoon lanterns or keepsakes.",
      "Lanterns moor on corners by lagoons for 1 point; most lanterns around Honeymilk, Firefly or Wrenwater holds its glow for 2 more.",
      "Keepsakes share Gull, Turtle, Hibiscus and Moon tags; matching arrivals pay bounties and full tag sets earn hearth points.",
      "Coves pay 2 to whoever first settles their wish; villages 1, towns 2. First to the target at end of turn wins.",
    ],
    resources: RESOURCE_SPECS,
  },
  params: [
    { key: "targetScore", label: "Points to Win", kind: "int", min: 8, max: 12, default: 10 },
    { key: "handLimit", label: "Basket Limit", kind: "int", min: 7, max: 12, default: 9 },
    { key: "coveWishes", label: "Cove Wishes", kind: "int", min: 2, max: 4, default: 3 },
    { key: "maxRounds", label: "Round limit", kind: "int", min: 15, max: 50, default: 30 },
  ],
  setup({ numPlayers, params, rng }) {
    const targetScore = params.targetScore ?? 10;
    const handLimit = params.handLimit ?? 9;
    const coveWishes = Math.max(2, Math.min(4, params.coveWishes ?? 3));
    const maxRounds = params.maxRounds ?? 30;
    const producing = [...Array(6).fill("palm"), ...Array(6).fill("strand"), ...Array(5).fill("copra"), ...Array(5).fill("shell")];
    const sh = rng.shuffle(producing);
    const terrain = Array(27).fill(null);
    let pi = 0;
    for (let i = 0; i < 27; i++) {
      if (LAGOON_IDX.includes(i)) terrain[i] = "lagoon";
      else terrain[i] = sh[pi++];
    }
    const atoll = Array.from({ length: 27 }, (_, i) => (i < 9 ? 0 : i < 18 ? 1 : 2));
    const tileNames = Array(27).fill("");
    let oi = 0;
    for (let i = 0; i < 27; i++) {
      if (NAMED_IDX[i] !== undefined) tileNames[i] = NAMED_IDX[i];
      else tileNames[i] = OTHER_NAMES[oi++];
    }
    const tideAll = rng.shuffle([...TIDE_BASE]);
    const forecast = [tideAll[0], tideAll[1]];
    const tideDeck = { drawPile: tideAll.slice(2), discard: [] };
    const keeps = rng.shuffle([...KEEP_DEFS]);
    const order = [...Array.from({ length: numPlayers }, (_, p) => p), ...Array.from({ length: numPlayers }, (_, p) => numPlayers - 1 - p)];
    return {
      numPlayers, targetScore, handLimit, maxRounds,
      terrain, atoll, tileNames,
      buildings: {}, roads: {}, lanterns: {},
      resources: Array.from({ length: numPlayers }, () => ({})),
      keepsakes: Array.from({ length: numPlayers }, () => []),
      keepsakeDrawPile: keeps.slice(3),
      keepsakeMarket: keeps.slice(0, 3),
      coves: COVE_DEFS.slice(0, coveWishes),
      coveClaimed: {},
      tideDeck, forecast, tidesFlipped: 0,
      phase: "setup",
      setup: { order, step: 0, settled: null },
      toMove: 0, round: 0,
      buildsLeft: 0, tradesLeft: 0, tidePicked: false,
    };
  },
  activePlayers(s) {
    if (module.exports.isTerminal(s)) return [];
    if (s.phase === "setup") return [setupSeat(s)];
    if (s.phase === "offer" && s.offer) return [s.offer.to];
    return [s.toMove];
  },
  legalMoves(s, player) {
    if (!module.exports.activePlayers(s).includes(player)) return [];
    if (s.phase === "setup") {
      if (s.setup.settled == null) {
        return hexmap.settleSpots(MAP, s.buildings, s.roads, player, false).map((vertex) => ({ type: "settle", vertex }));
      }
      const v = hexmap.lookup(MAP).vertex.get(s.setup.settled);
      if (!v) return [];
      return v.edges.filter((e) => s.roads[e] === undefined).map((edge) => ({ type: "road", edge }));
    }
    if (s.phase === "offer" && s.offer) {
      if (player !== s.offer.to) return [];
      return tCanAccept(s.resources, s.offer) ? [{ type: "accept" }, { type: "decline" }] : [{ type: "decline" }];
    }
    if (!s.tidePicked) {
      return s.forecast.map((_, i) => ({ type: "tide", index: i }));
    }
    const moves = [];
    const pool = s.resources[player];
    if (s.buildsLeft > 0) {
      const rc = roadCostFor(s, player);
      if (rCanAfford(pool, VILLAGE_COST)) {
        for (const v of hexmap.settleSpots(MAP, s.buildings, s.roads, player, true)) moves.push({ type: "village", vertex: v });
      }
      if (rCanAfford(pool, TOWN_COST)) {
        for (const [v, b] of Object.entries(s.buildings)) if (b.owner === player && b.level === 1) moves.push({ type: "town", vertex: v });
      }
      if (rCanAfford(pool, LANTERN_COST)) {
        for (const v of lanternSpots(s)) moves.push({ type: "lantern", vertex: v });
      }
      if (rCanAfford(pool, rc)) {
        for (const e of hexmap.roadSpots(MAP, s.buildings, s.roads, player)) moves.push({ type: "road", edge: e });
      }
      if (rCanAfford(pool, KEEP_COST)) {
        for (const k of s.keepsakeMarket) moves.push({ type: "keepsake", id: k.id });
      }
    }
    if (s.tradesLeft > 0) {
      for (const { give, get } of tBankOptions(pool, RESOURCE_IDS, BANK_RATE)) moves.push({ type: "bank", give, get });
      for (let to = 0; to < s.numPlayers; to++) {
        if (to === player) continue;
        for (const o of tSwapOptions(s.resources, player, to, RESOURCE_IDS)) {
          moves.push({ type: "offer", to, give: Object.keys(o.give)[0], get: Object.keys(o.get)[0] });
        }
      }
    }
    moves.push({ type: "end" });
    return moves;
  },
  applyMove(s, player, move, rng) {
    const pools = s.resources.map((r) => ({ ...r }));
    if (s.phase === "setup") {
      if (move.type === "settle") {
        if (!hexmap.canSettle(MAP, s.buildings, s.roads, move.vertex, player, false)) throw new Error("illegal settle");
        return { ...s, buildings: { ...s.buildings, [move.vertex]: { owner: player, level: 1 } }, resources: pools, setup: { ...s.setup, settled: move.vertex } };
      }
      if (move.type === "road") {
        const settled = s.setup.settled;
        const spot = settled == null ? null : hexmap.lookup(MAP).vertex.get(settled);
        if (!spot || !spot.edges.includes(move.edge) || s.roads[move.edge] !== undefined) throw new Error("illegal setup road");
        const step = s.setup.step + 1;
        const roads = { ...s.roads, [move.edge]: player };
        if (step < s.setup.order.length) return { ...s, roads, resources: pools, setup: { ...s.setup, step, settled: null } };
        const startRes = pools.map(() => ({ driftwood: 1, pandan: 1, coconut: 1 }));
        return { ...s, roads, resources: startRes, phase: "play", round: 1, toMove: 0, buildsLeft: 2, tradesLeft: 3, tidePicked: false, setup: { ...s.setup, step, settled: null } };
      }
      throw new Error("illegal setup move");
    }
    if (s.phase === "offer") {
      if (move.type === "accept") {
        return { ...s, phase: "play", resources: tSettle(s.resources, s.offer), offer: undefined };
      }
      if (move.type === "decline") return { ...s, phase: "play", offer: undefined };
      throw new Error("illegal offer move");
    }
    if (move.type === "tide") {
      if (s.tidePicked) throw new Error("tide already picked");
      const idx = move.index;
      if (idx !== 0 && idx !== 1) throw new Error("bad tide");
      if (!s.forecast[idx]) throw new Error("no forecast");
      const picked = s.forecast[idx];
      const other = s.forecast[1 - idx];
      let drawPile = [...s.tideDeck.drawPile];
      let discard = [...s.tideDeck.discard, picked];
      drawPile.push(other);
      const tiles = MAP.tiles.filter((t) => terrainOf(s, t.id) === picked).map((t) => t.id);
      const gains = prodProduce(MAP, s.buildings, tiles, (t) => tileYield(s, t), s.numPlayers);
      const lk = hexmap.lookup(MAP);
      const lagoonTiles = MAP.tiles.filter((t) => terrainOf(s, t.id) === "lagoon").map((t) => t.id);
      for (let p = 0; p < s.numPlayers; p++) {
        const lit = new Set();
        for (const [v, o] of Object.entries(s.lanterns)) {
          if (o !== p) continue;
          for (const t of lk.vertex.get(v).tiles) if (lagoonTiles.includes(t)) lit.add(t);
        }
        if (lit.size === 0) continue;
        let bonus = 0;
        for (const [v, b] of Object.entries(s.buildings)) {
          if (b.owner !== p) continue;
          if (lk.vertex.get(v).tiles.some((t) => lit.has(t))) bonus += b.level;
        }
        if (bonus > 0) gains[p] = rAdd(gains[p], { coconut: bonus });
      }
      let collected = prodCollect(s.resources, gains);
      collected = collected.map((p) => trimPool(p, s.handLimit));
      const newForecast = [];
      for (let i = 0; i < 2; i++) {
        if (drawPile.length === 0) {
          if (discard.length === 0) break;
          drawPile = rng.shuffle(discard);
          discard = [];
        }
        newForecast.push(drawPile.shift());
      }
      return { ...s, resources: collected, tideDeck: { drawPile, discard }, forecast: newForecast.length ? newForecast : [...s.forecast], tide: picked, tidePicked: true, tidesFlipped: s.tidesFlipped + 1 };
    }
    if (move.type === "village") {
      if (s.buildsLeft <= 0) throw new Error("no builds");
      if (!hexmap.canSettle(MAP, s.buildings, s.roads, move.vertex, player, true)) throw new Error("illegal village");
      pools[player] = rPay(pools[player], VILLAGE_COST);
      const ns = { ...s, resources: pools, buildings: { ...s.buildings, [move.vertex]: { owner: player, level: 1 } }, buildsLeft: s.buildsLeft - 1 };
      return claimCoves(ns, player);
    }
    if (move.type === "road") {
      if (s.buildsLeft <= 0) throw new Error("no builds");
      if (!hexmap.canRoad(MAP, s.buildings, s.roads, move.edge, player)) throw new Error("illegal road");
      pools[player] = rPay(pools[player], roadCostFor(s, player));
      return { ...s, resources: pools, roads: { ...s.roads, [move.edge]: player }, buildsLeft: s.buildsLeft - 1 };
    }
    if (move.type === "town") {
      if (s.buildings[move.vertex]?.owner !== player || s.buildings[move.vertex]?.level !== 1) throw new Error("illegal town");
      if (s.buildsLeft <= 0) throw new Error("no builds");
      pools[player] = rPay(pools[player], TOWN_COST);
      const ns = { ...s, resources: pools, buildings: { ...s.buildings, [move.vertex]: { owner: player, level: 2 } }, buildsLeft: s.buildsLeft - 1 };
      return claimCoves(ns, player);
    }
    if (move.type === "lantern") {
      if (s.buildsLeft <= 0) throw new Error("no builds");
      if (!lanternSpots(s).includes(move.vertex)) throw new Error("illegal lantern");
      pools[player] = rPay(pools[player], LANTERN_COST);
      const ns = { ...s, resources: pools, lanterns: { ...s.lanterns, [move.vertex]: player }, buildsLeft: s.buildsLeft - 1 };
      return claimCoves(ns, player);
    }
    if (move.type === "keepsake") {
      if (s.buildsLeft <= 0) throw new Error("no builds");
      const card = s.keepsakeMarket.find((k) => k.id === move.id);
      if (!card) throw new Error("no such keepsake");
      pools[player] = rPay(pools[player], KEEP_COST);
      let gain = { ...pools[player] };
      for (const prior of s.keepsakes[player] || []) {
        if (prior.triggerTag && card.tags.includes(prior.triggerTag) && prior.gain) gain = rAdd(gain, prior.gain);
      }
      pools[player] = gain;
      const market = s.keepsakeMarket.filter((k) => k.id !== move.id);
      let draw = [...s.keepsakeDrawPile];
      if (draw.length > 0) market.push(draw.shift());
      const tableau = s.keepsakes.map((arr, i) => (i === player ? [...arr, card] : [...arr]));
      const ns = { ...s, resources: pools, keepsakeMarket: market, keepsakeDrawPile: draw, keepsakes: tableau, buildsLeft: s.buildsLeft - 1 };
      return claimCoves(ns, player);
    }
    if (move.type === "bank") {
      pools[player] = tBankTrade(pools[player], move.give, move.get, BANK_RATE);
      return { ...s, resources: pools, tradesLeft: s.tradesLeft - 1 };
    }
    if (move.type === "offer") {
      return { ...s, phase: "offer", tradesLeft: s.tradesLeft - 1, offer: { from: player, to: move.to, give: { [move.give]: 1 }, get: { [move.get]: 1 } } };
    }
    if (move.type === "end") {
      const score = hearthScore(s, player);
      if (score >= s.targetScore) return { ...s, resources: pools, winner: player };
      const next = (player + 1) % s.numPlayers;
      const round = next === 0 ? s.round + 1 : s.round;
      if (round > s.maxRounds) return { ...s, resources: pools, round };
      return { ...s, resources: pools, toMove: next, round, buildsLeft: 2, tradesLeft: 3, tidePicked: false, tide: undefined };
    }
    throw new Error("unknown move");
  },
  isTerminal(s) { return s.winner !== undefined || s.round > s.maxRounds; },
  outcome(s) {
    const scores = Array.from({ length: s.numPlayers }, (_, p) => hearthScore(s, p));
    return { winners: s.winner !== undefined ? [s.winner] : sWinners(scores), scores };
  },
  view(s, player) {
    const copy = JSON.parse(JSON.stringify(s));
    copy.tideDeck = { drawPile: copy.tideDeck.drawPile.map(() => "hidden"), discard: [...copy.tideDeck.discard] };
    copy.keepsakeDrawPile = copy.keepsakeDrawPile.map((_, i) => ({ id: `hidden${i}`, name: "Hidden", tags: [], points: 0 }));
    return copy;
  },
  geometry(s, viewer) {
    const W = MAP.width, H = MAP.height;
    const sideX = W + 0.6, sideW = 2.4;
    const cells = MAP.tiles.map((t, i) => {
      const terrain = s.terrain[i];
      const isNamed = NAMED_TILES.includes(t.id);
      return { id: t.id, polygon: OUTLINES.tile[i], kind: terrain, label: s.tileNames[i], badge: terrain === "lagoon" ? (isNamed ? "2" : undefined) : badgeForTerrain(terrain), terrain: terrainGround(terrain), glow: undefined };
    });
    MAP.edges.forEach((e, i) => cells.push({ id: e.id, polygon: OUTLINES.edge[i], kind: "edge", owner: s.roads[e.id] }));
    MAP.vertices.forEach((v, i) => {
      const owner = s.buildings[v.id]?.owner ?? s.lanterns[v.id];
      cells.push({ id: v.id, polygon: OUTLINES.vertex[i], kind: "vertex", owner });
    });
    let y = 0.4;
    const fmk = (i) => {
      const tide = s.forecast[i];
      const c = { id: `forecast${i}`, polygon: rect(sideX, y, sideW, 1), kind: "pier", label: tide ? `${cap(tide)} tide` : "Pier", badge: tide ? badgeForTerrain(tide) : undefined };
      y += 1.15;
      return c;
    };
    cells.push(fmk(0), fmk(1));
    s.coves.forEach((c) => {
      cells.push({ id: `cove-${c.id}`, polygon: rect(sideX, y, sideW, 1), kind: "cove", label: c.name, badge: "2", owner: (s.coveClaimed || {})[c.id] });
      y += 1.15;
    });
    const status = s.phase === "setup" ? "Setup: village + bridge" : `Round ${Math.min(s.round, s.maxRounds)} of ${s.maxRounds} · ${s.tide ? cap(s.tide) + " tide" : "Pick tide"}`;
    cells.push({ id: "status", polygon: rect(sideX, y, sideW, 0.7), kind: "label", label: status });
    y += 1.0;
    const lk = hexmap.lookup(MAP);
    const pieces = [];
    for (const [id, b] of Object.entries(s.buildings)) {
      const [x, yy] = lk.vertex.get(id).at;
      pieces.push(b.level === 2 ? { id: `b-${id}`, x, y: yy, r: 0.22, owner: b.owner, shape: "square", kind: "town", cellId: id } : { id: `b-${id}`, x, y: yy, r: 0.19, owner: b.owner, shape: "disc", kind: "village", cellId: id });
    }
    for (const [id, o] of Object.entries(s.lanterns)) {
      const [x, yy] = lk.vertex.get(id).at;
      pieces.push({ id: `l-${id}`, x, y: yy, r: 0.26, owner: o, shape: "disc", kind: "lantern", label: "✦", glow: "#ffdf6b", cellId: id });
    }
    return { width: sideX + sideW + 0.3, height: Math.max(H, y + 0.3), cells, pieces };
  },
  panels(s, viewer) {
    const panels = [];
    const tideCards = (s.forecast || []).map((t, i) => ({ id: `forecast-card${i}`, title: `${cap(t)} tide`, text: `Villages by ${t} gather ${RNAMES[TERRAIN_RESOURCE[t]]}; towns double.`, tags: [t] }));
    panels.push({ id: "pier", title: "Forecast Pier", zone: "shared", cards: tideCards, counters: [{ id: "tide-deck", label: "Deck", value: s.tideDeck.drawPile.length }], note: s.tide ? `${cap(s.tide)} tide fills pantries` : "Pick today's tide" });
    panels.push({
      id: "market", title: "Hearth Market", zone: "shared",
      cards: s.keepsakeMarket.map((k) => ({ id: k.id, title: k.name, text: keepText(k), cost: { pandan: 1, pearl: 1 }, points: k.points, tags: k.tags })),
      counters: [{ id: "keepsake-deck", label: "Deck", value: s.keepsakeDrawPile.length }],
      note: `${s.keepsakeMarket.length} neighbors visiting`,
    });
    panels.push({
      id: "coves", title: "Cove Wishes", zone: "shared",
      cards: s.coves.map((c) => ({ id: `cove-${c.id}`, title: c.name, text: `${c.wish}. First: 2pts.`, points: 2 })),
      note: Object.keys(s.coveClaimed || {}).length ? "Some wishes settled" : "Three coves promise 2pts",
    });
    for (let p = 0; p < s.numPlayers; p++) {
      panels.push({
        id: `seat${p}`, title: `Family ${p + 1}`, zone: "players", owner: p,
        counters: [...RESOURCE_SPECS.map((r) => ({ id: `seat${p}-${r.id}`, label: r.name, value: rAmount(s.resources[p], r.id), resource: r.id })), { id: `seat${p}-score`, label: "Score", value: hearthScore(s, p) }],
        cards: (s.keepsakes[p] || []).map((k) => ({ id: k.id, title: k.name, text: keepText(k), points: k.points, tags: k.tags })),
        note: s.offer && s.offer.to === p ? `Offer: give 1 get 1` : `Glow + coves counted`,
      });
    }
    return panels;
  },
  moveTarget(s, move) {
    switch (move.type) {
      case "settle": case "village": case "town": return move.vertex;
      case "road": return move.edge;
      case "lantern": return move.vertex;
      case "keepsake": return move.id;
      case "tide": return `forecast${move.index}`;
      case "bank": return `seat${s.toMove}-${move.get}`;
      case "offer": return `seat${move.to}-${move.get}`;
      default: return undefined;
    }
  },
  describeMove(s, move) {
    switch (move.type) {
      case "settle": return `settle by ${cornerTerrains(s, move.vertex)}`;
      case "road": return s.phase === "setup" ? "lay a free footbridge" : "lay a footbridge";
      case "village": return `raise a village by ${cornerTerrains(s, move.vertex)}`;
      case "town": return `whiten a village into a town`;
      case "lantern": return `moor a lantern by ${cornerTerrains(s, move.vertex)}`;
      case "keepsake": {
        const k = [...s.keepsakeMarket, ...s.keepsakes.flat()].find((x) => x.id === move.id);
        return k ? `invite ${k.name}` : "invite a keepsake";
      }
      case "tide": return `call ${cap(s.forecast[move.index])} tide`;
      case "bank": return `bank trade 3 ${RNAMES[move.give]} for 1 ${RNAMES[move.get]}`;
      case "offer": return `offer P${move.to + 1} 1 ${RNAMES[move.give]} for 1 ${RNAMES[move.get]}`;
      case "accept": return "accept the swap";
      case "decline": return "decline the swap";
      case "end": return "end turn";
      default: return "pass";
    }
  },
};
