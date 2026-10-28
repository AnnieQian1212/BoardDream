const _mech = require("@boarddream/mechanics");
const _workers = _mech.workers || {};
const _majority = _mech.majority || {};
const _scoring = _mech.scoring || {};
const _resources = _mech.resources || {};
const _effects = _mech.effects || {};
const _market = _mech.market || {};

function _openSpaces(spaces, placed, player) {
  if (_workers.openSpaces) return _workers.openSpaces(spaces, placed, player);
  return spaces.filter((sp) => {
    const occ = placed[sp.id] || [];
    return sp.capacity === undefined || occ.length < sp.capacity;
  });
}
function _place(placed, space, player) {
  if (_workers.place) return _workers.place(placed, space, player);
  const occ = placed[space] || [];
  return { ...placed, [space]: [...occ, player] };
}
function _placedBy(placed, player) {
  if (_workers.placedBy) return _workers.placedBy(placed, player);
  return Object.values(placed).reduce((s, arr) => s + arr.filter((x) => x === player).length, 0);
}
function _nextToPlace(order, current, leftFn) {
  if (_workers.nextToPlace) return _workers.nextToPlace(order, current, leftFn);
  const at = order.indexOf(current);
  for (let k = 1; k <= order.length; k++) {
    const seat = order[(at + k) % order.length];
    if (leftFn(seat) > 0) return seat;
  }
  return undefined;
}
function _canAfford(pool, cost) {
  if (_resources.canAfford) return _resources.canAfford(pool, cost);
  for (const k of Object.keys(cost || {})) if ((pool[k] || 0) < cost[k]) return false;
  return true;
}
function _scoreWinners(scores, tie) {
  if (_scoring.scoreWinners) return _scoring.scoreWinners(scores, tie);
  let best = Math.max(...scores);
  let top = scores.flatMap((s, i) => (s === best ? [i] : []));
  if (tie && top.length > 1) {
    let bt = Math.max(...top.map((i) => tie[i]));
    top = top.filter((i) => tie[i] === bt);
  }
  return top.length === scores.length ? [] : top;
}
function _defId(inst) {
  if (_effects.defId) return _effects.defId(inst);
  return String(inst).split("#")[0];
}
function _buildDeck(defs) {
  if (_effects.buildDeck) return _effects.buildDeck(defs);
  return defs.map((d) => `${d.id}#1`);
}
function _rulesText(card, names, labels) {
  if (_effects.rulesText) return _effects.rulesText(card, names, labels);
  return "";
}

const POWERS = ["scribe", "vintner", "cellarer", "broker", "supplier", "chaplain", "illuminator", "librarian"];
const POWER_NAME = { scribe: "Scribe", vintner: "Vintner", cellarer: "Cellarer", broker: "Broker", supplier: "Supplier", chaplain: "Chaplain", illuminator: "Illuminator", librarian: "Librarian" };
const POWER_TEXT = {
  scribe: "Copy +1 Manuscript.",
  vintner: "Vineyard +1 Wine.",
  cellarer: "Press +1 Gold.",
  broker: "Sell +1 Gold per sale.",
  supplier: "Supply +1 Ink free.",
  chaplain: "Chapel +1 Devotion.",
  illuminator: "Illumination +1 Prestige.",
  librarian: "Library discard +1 Gold.",
};
const COMMISSION_DEFS = [];
for (let i = 0; i < 32; i++) {
  const power = POWERS[i % 8];
  const m = i % 3;
  const w = Math.floor(i / 3) % 3;
  const g = Math.floor(i / 9) % 3;
  const cost = {};
  if (m) cost.manuscript = m;
  if (w) cost.wine = w;
  if (g) cost.gold = g;
  const pts = 2 + m + w + g + (i % 2);
  COMMISSION_DEFS.push({
    id: `c${i + 1}`,
    name: `${POWER_NAME[power]} ${Math.floor(i / 8) + 1}${"ABCDEFGH"[i % 8]}`,
    cost,
    points: pts,
    tags: [power],
  });
}
const DEF_MAP = Object.fromEntries(COMMISSION_DEFS.map((d) => [d.id, d]));
function cardOf(inst) { return DEF_MAP[_defId(inst)]; }
const NAMES = { ink: "ink", manuscript: "manuscript", wine: "wine", gold: "gold" };
function cardView(inst) {
  const def = cardOf(inst);
  if (!def) return { id: inst, title: "Hidden", faceDown: true };
  const rt = _rulesText(def, NAMES, { onPlay: "Play", income: "Engine", endgame: "End" });
  const extra = POWER_TEXT[def.tags[0]] || "";
  const text = (rt ? rt + " " : "") + extra;
  return { id: inst, title: def.name, text, cost: { ...def.cost }, points: def.points, tags: [...def.tags] };
}

function spacesFor(numPlayers) {
  return [
    { id: "copy", capacity: 1 },
    { id: "illum", capacity: 1 },
    { id: "vine1", capacity: 1 },
    { id: "vine2", capacity: 1 },
    { id: "press", capacity: 1 },
    { id: "sell", capacity: 1 },
    { id: "supply", capacity: 1 },
    { id: "chapel", capacity: 1 },
    { id: "library", capacity: 1 },
    { id: "chapter", capacity: 3 * numPlayers },
  ];
}
function seasonOrder(abbot, n) {
  const o = [];
  for (let k = 0; k < n; k++) o.push((abbot + k) % n);
  return o;
}
function workersLeft(s, seat) { return s.monksSeason[seat] - _placedBy(s.placed, seat); }
function chapterCount(s, seat) { return (s.placed.chapter || []).filter((x) => x === seat).length; }
function wineCount(s, seat) { return s.wine[seat].length; }
function powerCount(s, seat, power) {
  let n = 0;
  for (const c of s.tableau[seat]) { const d = cardOf(c); if (d && d.tags[0] === power) n++; }
  return n;
}
function abbeyScore(s, seat) {
  return s.prestige[seat] + s.wine[seat].reduce((a, b) => a + b, 0);
}
function poolOf(s, seat) {
  return { manuscript: s.manuscript[seat], wine: wineCount(s, seat), gold: s.gold[seat] };
}
function costOf(inst) {
  const d = cardOf(inst);
  const c = (d && d.cost) || {};
  return { manuscript: c.manuscript || 0, wine: c.wine || 0, gold: c.gold || 0 };
}

function applyDevotion(st, seat, gain) {
  if (!gain) return st;
  const devotion = st.devotion.slice();
  const gold = st.gold.slice();
  const prestige = st.prestige.slice();
  const claimed = st.claimed.map((a) => a.slice());
  const extraPending = st.extraPending.slice();
  devotion[seat] += gain;
  const d = devotion[seat];
  if (d >= 4 && !claimed[seat][0]) { claimed[seat][0] = true; gold[seat] += 2; }
  if (d >= 8 && !claimed[seat][1]) { claimed[seat][1] = true; extraPending[seat] = true; }
  if (d >= 12 && !claimed[seat][2]) { claimed[seat][2] = true; prestige[seat] += 5; }
  return { ...st, devotion, gold, prestige, claimed, extraPending };
}

function refillRow(row, drawPile, discard, size, rng) {
  let r = row.slice();
  let dp = drawPile.slice();
  let dc = discard.slice();
  while (r.length < size) {
    if (dp.length === 0) {
      if (dc.length === 0) break;
      dp = rng.shuffle(dc);
      dc = [];
    }
    r.push(dp[0]);
    dp = dp.slice(1);
  }
  return { row: r, drawPile: dp, discard: dc };
}

function postAfterBase(s, seat, base) {
  let ink = s.ink[seat], manu = s.manuscript[seat], gold = s.gold[seat];
  let wc = wineCount(s, seat);
  let hand = s.hand[seat].slice();
  if (base.space === "copy") { ink -= 1; manu += 1 + powerCount(s, seat, "scribe"); }
  else if (base.space === "illum") { manu -= 1; gold -= 1; }
  else if (base.space === "vine1" || base.space === "vine2") { wc += (s.season >= 4 ? 3 : 2) + powerCount(s, seat, "vintner"); }
  else if (base.space === "press") { /* gold gain, no spend */ }
  else if (base.space === "sell") { manu -= (base.sellM || 0); wc -= ((base.sellM || 0) + (base.sellW || 0) > 0 ? (base.sellM || 0) + 0 : 0); /* handled below */ manu -= 0; wc = wineCount(s, seat) - (base.sellW || 0); manu = s.manuscript[seat] - (base.sellM || 0); gold += 0; }
  else if (base.space === "supply") { gold -= (base.buy || 0); }
  else if (base.space === "chapel") { ink += 1; }
  else if (base.space === "library" && base.lib === "discard") { hand = hand.filter((c) => c !== base.discard); gold += 2 + powerCount(s, seat, "librarian"); }
  return { ink, manu, gold, wc, hand };
}

function moveEqual(a, b) {
  return a.type === b.type && a.space === b.space && (a.sellM || 0) === (b.sellM || 0) && (a.sellW || 0) === (b.sellW || 0)
    && (a.buy || 0) === (b.buy || 0) && (a.lib || null) === (b.lib || null) && (a.discard || null) === (b.discard || null)
    && (a.fulfillSource || null) === (b.fulfillSource || null) && (a.fulfillCard || null) === (b.fulfillCard || null)
    && (a.card || null) === (b.card || null) && (a.choice || null) === (b.choice || null);
}

function endSeasonAwards(s, rng) {
  const n = s.numPlayers;
  const counts = Array.from({ length: n }, (_, i) => chapterCount(s, i));
  const mx = Math.max(...counts);
  let prestige = s.prestige.slice();
  let newAbbot = s.abbot;
  if (mx > 0) {
    let tied = counts.flatMap((c, i) => (c === mx ? [i] : []));
    if (tied.length > 1) {
      const bd = Math.max(...tied.map((i) => s.devotion[i]));
      tied = tied.filter((i) => s.devotion[i] === bd);
    }
    if (tied.length > 1) {
      const bw = Math.max(...tied.map((i) => wineCount(s, i)));
      tied = tied.filter((i) => wineCount(s, i) === bw);
    }
    tied.sort((a, b) => a - b);
    newAbbot = tied[0];
    prestige[newAbbot] += 3;
    for (let i = 0; i < n; i++) if (i !== newAbbot && counts[i] >= 1) prestige[i] += 1;
  }
  const wine = s.wine.map((arr) => arr.map((a) => a + 1));
  const ref = refillRow(s.row, s.drawPile, s.discard, s.rowSize, rng);
  return { counts, mx, prestige, wine, row: ref.row, drawPile: ref.drawPile, discard: ref.discard, newAbbot };
}

const rect = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

module.exports = {
  meta: {
    id: "abbey-ink-vine",
    name: "Abbey of Ink and Vine",
    family: "engine",
    mode: "competitive",
    minPlayers: 2,
    maxPlayers: 4,
    summary: "Command rival orders of monks, turning ink and grapes into manuscripts and aged wine to win commissions and pack the Chapter House to seize the Abbot's blessing.",
    rules: [
      "Play over 4 seasons; each season take turns placing one monk to an empty circle or the Chapter House until all monks are placed.",
      "Use Copy, Vineyard, Press, Sell, Supply, Chapel, Library and Illumination to gain ink, manuscripts, wine, gold, devotion and prestige.",
      "When you place you may also fulfill one hand or row commission by paying its cost to gain prestige and a permanent engine power.",
      "Chapter monks each give devotion; most Chapter monks becomes Abbot for 3 prestige, first turn and 2 gold or ink, others with monks gain 1.",
      "Devotion pays at 4, 8 and 12; stored wine ages each season for 1 prestige per marker; most prestige wins.",
    ],
    resources: [
      { id: "ink", name: "Ink", icon: "droplet", color: "#2b6cb0" },
      { id: "manuscript", name: "Manuscript", icon: "wheat", color: "#b7791f" },
      { id: "wine", name: "Wine", icon: "flame", color: "#9b2c2c" },
      { id: "gold", name: "Gold", icon: "coins", color: "#d69e2e" },
    ],
  },
  params: [
    { key: "seasonCount", label: "Seasons per game", kind: "int", min: 3, max: 5, default: 4 },
    { key: "monkCount", label: "Monks per player", kind: "int", min: 4, max: 6, default: 5 },
    { key: "commissionRow", label: "Commission row size", kind: "int", min: 3, max: 5, default: 4 },
  ],

  setup(ctx) {
    const n = ctx.numPlayers;
    const seasonCount = Number(ctx.params.seasonCount ?? 4);
    const monkCount = Number(ctx.params.monkCount ?? 5);
    const rowSize = Number(ctx.params.commissionRow ?? 4);
    const pile = ctx.rng.shuffle(_buildDeck(COMMISSION_DEFS));
    const hand = Array.from({ length: n }, () => []);
    let idx = 0;
    for (let p = 0; p < n; p++) { hand[p] = [pile[idx++]]; }
    const row = pile.slice(idx, idx + rowSize);
    idx += rowSize;
    const drawPile = pile.slice(idx);
    return {
      numPlayers: n,
      seasonCount, monkCount, rowSize,
      season: 1, abbot: 0, toMove: 0,
      monksSeason: new Array(n).fill(monkCount),
      placed: {},
      ink: new Array(n).fill(2),
      manuscript: new Array(n).fill(0),
      gold: new Array(n).fill(1),
      wine: Array.from({ length: n }, () => [0]),
      prestige: new Array(n).fill(2),
      devotion: new Array(n).fill(0),
      claimed: Array.from({ length: n }, () => [false, false, false]),
      extraPending: new Array(n).fill(false),
      hand, tableau: Array.from({ length: n }, () => []),
      row, drawPile, discard: [],
      pendingKeep: null, pendingAbbotChoice: null,
      over: false,
    };
  },

  activePlayers(s) {
    if (s.over) return [];
    if (s.pendingKeep) return [s.pendingKeep.player];
    if (s.pendingAbbotChoice !== null && s.pendingAbbotChoice !== undefined) return [s.pendingAbbotChoice];
    return [s.toMove];
  },

  legalMoves(s, player) {
    if (s.over) return [];
    if (s.pendingAbbotChoice !== null && s.pendingAbbotChoice !== undefined) {
      if (player !== s.pendingAbbotChoice) return [];
      return [{ type: "abbot", choice: "gold" }, { type: "abbot", choice: "ink" }];
    }
    if (s.pendingKeep) {
      if (player !== s.pendingKeep.player) return [];
      return s.pendingKeep.options.map((c) => ({ type: "keep", card: c }));
    }
    if (player !== s.toMove) return [];
    if (workersLeft(s, player) <= 0) return [];
    const spaces = spacesFor(s.numPlayers);
    const open = _openSpaces(spaces, s.placed, player);
    const ink = s.ink[player], manu = s.manuscript[player], gold = s.gold[player];
    const wc = wineCount(s, player);
    const chap = chapterCount(s, player);
    const bases = [];
    for (const sp of open) {
      const id = sp.id;
      if (id === "copy") { if (ink >= 1) bases.push({ space: id }); }
      else if (id === "illum") { if (manu >= 1 && gold >= 1) bases.push({ space: id }); }
      else if (id === "vine1" || id === "vine2") bases.push({ space: id });
      else if (id === "press") bases.push({ space: id });
      else if (id === "sell") {
        if (manu + wc < 1) continue;
        for (let m = 0; m <= Math.min(manu, 6); m++) {
          for (let w = 0; w <= Math.min(wc, 6 - m); w++) {
            if (m + w === 0) continue;
            if (m + w > 6 && (m !== manu || w !== wc)) continue;
            bases.push({ space: id, sellM: m, sellW: w });
          }
        }
        if (manu + wc > 6) bases.push({ space: id, sellM: manu, sellW: wc });
      }
      else if (id === "supply") {
        const max = Math.min(2, gold);
        for (let b = 1; b <= max; b++) bases.push({ space: id, buy: b });
      }
      else if (id === "chapel") bases.push({ space: id });
      else if (id === "library") {
        if (s.drawPile.length >= 2) bases.push({ space: id, lib: "draw" });
        for (const c of s.hand[player]) bases.push({ space: id, lib: "discard", discard: c });
      }
      else if (id === "chapter") { if (chap < 3) bases.push({ space: id }); }
    }
    bases.push({ space: "pass" });
    const moves = [];
    for (const b of bases) {
      const isLibDraw = b.space === "library" && b.lib === "draw";
      if (isLibDraw) {
        const mv = { type: "place", space: b.space, lib: b.lib };
        moves.push(mv);
        continue;
      }
      const post = postAfterBase(s, player, b);
      const pool = { manuscript: post.manu, wine: post.wc, gold: post.gold };
      const fulfillables = [];
      for (const c of s.hand[player]) {
        const cost = costOf(c);
        if (b.space === "library" && b.lib === "discard" && b.discard === c) continue;
        if (_canAfford(pool, cost)) fulfillables.push({ src: "hand", card: c });
      }
      for (const c of s.row) {
        const cost = costOf(c);
        if (_canAfford(pool, cost)) fulfillables.push({ src: "row", card: c });
      }
      const baseMove = { type: "place", space: b.space };
      if (b.sellM !== undefined) { baseMove.sellM = b.sellM; baseMove.sellW = b.sellW; }
      if (b.buy !== undefined) baseMove.buy = b.buy;
      if (b.lib !== undefined) baseMove.lib = b.lib;
      if (b.discard !== undefined) baseMove.discard = b.discard;
      moves.push(baseMove);
      for (const f of fulfillables) {
        const mv = { ...baseMove, fulfillSource: f.src, fulfillCard: f.card };
        moves.push(mv);
      }
    }
    return moves;
  },

  applyMove(s, player, move, rng) {
    const legal = module.exports.legalMoves(s, player);
    if (!legal.some((m) => moveEqual(m, move))) throw new Error(`illegal move ${JSON.stringify(move)}`);
    if (move.type === "abbot") {
      const ink = s.ink.slice(), gold = s.gold.slice();
      if (move.choice === "gold") gold[player] += 2; else ink[player] += 2;
      const monksSeason = s.monksSeason.map((m, i) => (s.extraPending[i] ? s.monkCount + 1 : s.monkCount));
      const extraPending = s.extraPending.map((e, i) => (s.extraPending[i] && monksSeason[i] !== s.monksSeason[i] ? false : e));
      // consume extra for those who get it now
      const cleared = s.extraPending.map((e, i) => (e ? false : false));
      void extraPending;
      return {
        ...s, ink, gold,
        season: s.season + 1,
        monksSeason: s.monksSeason.map((_, i) => (s.extraPending[i] ? s.monkCount + 1 : s.monkCount)),
        extraPending: s.extraPending.map(() => false),
        placed: {},
        toMove: s.abbot,
        pendingAbbotChoice: null,
      };
    }
    if (move.type === "keep") {
      const opts = s.pendingKeep.options;
      const kept = move.card;
      const other = opts.find((c) => c !== kept);
      const hand = s.hand.map((h, i) => (i === player ? [...h, kept] : h.slice()));
      const drawPile = [...s.drawPile.slice(), other];
      let next = { ...s, hand, drawPile, pendingKeep: null };
      // advance turn
      const order = seasonOrder(next.abbot, next.numPlayers);
      const leftFn = (seat) => next.monksSeason[seat] - _placedBy(next.placed, seat);
      const following = _nextToPlace(order, player, leftFn);
      if (following === undefined) {
        // season end
        const end = endSeasonAwards(next, rng);
        let st = { ...next, prestige: end.prestige, wine: end.wine, row: end.row, drawPile: end.drawPile, discard: end.discard, abbot: end.newAbbot };
        if (st.season >= st.seasonCount) return { ...st, over: true };
        if (end.mx === 0) {
          const monksSeason = st.monksSeason.map((_, i) => (st.extraPending[i] ? st.monkCount + 1 : st.monkCount));
          const extraPending = st.extraPending.map(() => false);
          return { ...st, season: st.season + 1, placed: {}, monksSeason, extraPending, toMove: st.abbot };
        }
        return { ...st, pendingAbbotChoice: end.newAbbot };
      }
      return { ...next, toMove: following };
    }
    // place
    let ink = s.ink.slice(), manu = s.manuscript.slice(), gold = s.gold.slice();
    let wine = s.wine.map((a) => a.slice());
    let prestige = s.prestige.slice();
    let hand = s.hand.map((h) => h.slice());
    let drawPile = s.drawPile.slice(), discard = s.discard.slice(), row = s.row.slice();
    let st = { ...s, ink, manuscript: manu, gold, wine, prestige, hand, drawPile, discard, row };
    const scribes = powerCount(s, player, "scribe");
    const vintners = powerCount(s, player, "vintner");
    const cellarers = powerCount(s, player, "cellarer");
    const brokers = powerCount(s, player, "broker");
    const suppliers = powerCount(s, player, "supplier");
    const chaplains = powerCount(s, player, "chaplain");
    const illums = powerCount(s, player, "illuminator");
    const librarians = powerCount(s, player, "librarian");
    let devGain = 0;
    const sp = move.space;
    if (sp === "copy") { ink[player] -= 1; manu[player] += 1 + scribes; }
    else if (sp === "illum") { manu[player] -= 1; gold[player] -= 1; prestige[player] += 4 + illums; devGain += 1; }
    else if (sp === "vine1" || sp === "vine2") {
      const base = s.season >= 4 ? 3 : 2;
      for (let k = 0; k < base + vintners; k++) wine[player].push(0);
    }
    else if (sp === "press") { gold[player] += Math.floor(wine[player].length / 2) + cellarers; }
    else if (sp === "sell") {
      const m = move.sellM || 0, w = move.sellW || 0;
      manu[player] -= m;
      wine[player] = wine[player].slice(w);
      const tot = m + w;
      gold[player] += 2 * tot + (tot >= 3 ? 1 : 0) + (tot > 0 ? brokers : 0);
    }
    else if (sp === "supply") {
      const b = move.buy || 0;
      gold[player] -= b;
      ink[player] += b + suppliers;
      if (b === 2) prestige[player] += 1;
    }
    else if (sp === "chapel") { devGain += 2 + chaplains; ink[player] += 1; }
    else if (sp === "library" && move.lib === "discard") {
      hand[player] = hand[player].filter((c) => c !== move.discard);
      discard = [...discard, move.discard];
      gold[player] += 2 + librarians;
    }
    else if (sp === "chapter") { devGain += 1; }
    st = { ...st, ink, manuscript: manu, gold, wine, prestige, hand, drawPile, discard, row };
    st = applyDevotion(st, player, devGain);
    ink = st.ink; manu = st.manuscript; gold = st.gold; wine = st.wine; prestige = st.prestige;
    // library draw creates pending
    let pendingKeep = null;
    if (sp === "library" && move.lib === "draw") {
      const a = st.drawPile[0], b = st.drawPile[1];
      drawPile = st.drawPile.slice(2);
      pendingKeep = { player, options: [a, b] };
      st = { ...st, drawPile };
    }
    // fulfill after placement (not with lib draw)
    if (move.fulfillCard && !(sp === "library" && move.lib === "draw")) {
      const cost = costOf(move.fulfillCard);
      const pool = { manuscript: st.manuscript[player], wine: st.wine[player].length, gold: st.gold[player] };
      if (!_canAfford(pool, cost)) throw new Error("cannot afford commission");
      const nm = st.manuscript.slice(), ng = st.gold.slice();
      const nw = st.wine.map((a) => a.slice());
      nm[player] -= cost.manuscript;
      ng[player] -= cost.gold;
      nw[player] = nw[player].slice(cost.wine);
      const def = cardOf(move.fulfillCard);
      const np = st.prestige.slice();
      np[player] += def ? def.points : 0;
      let nh = st.hand.map((h) => h.slice()), nr = st.row.slice(), ndp = st.drawPile.slice(), ndc = st.discard.slice();
      if (move.fulfillSource === "hand") nh[player] = nh[player].filter((c) => c !== move.fulfillCard);
      else nr = nr.filter((c) => c !== move.fulfillCard);
      const nt = st.tableau.map((t, i) => (i === player ? [...t, move.fulfillCard] : t.slice()));
      const ref = refillRow(nr, ndp, ndc, st.rowSize, rng);
      st = { ...st, manuscript: nm, gold: ng, wine: nw, prestige: np, hand: nh, tableau: nt, row: ref.row, drawPile: ref.drawPile, discard: ref.discard };
    }
    const placed = sp === "pass" ? _place(s.placed, "pass", player) : _place(st.placed, sp, player);
    st = { ...st, placed };
    if (pendingKeep) return { ...st, pendingKeep };
    const order = seasonOrder(st.abbot, st.numPlayers);
    const leftFn = (seat) => st.monksSeason[seat] - _placedBy(st.placed, seat);
    const following = _nextToPlace(order, player, leftFn);
    if (following === undefined) {
      const end = endSeasonAwards(st, rng);
      let ns = { ...st, prestige: end.prestige, wine: end.wine, row: end.row, drawPile: end.drawPile, discard: end.discard, abbot: end.newAbbot };
      if (ns.season >= ns.seasonCount) return { ...ns, over: true };
      if (end.mx === 0) {
        return {
          ...ns, season: ns.season + 1, placed: {},
          monksSeason: ns.monksSeason.map((_, i) => (ns.extraPending[i] ? ns.monkCount + 1 : ns.monkCount)),
          extraPending: ns.extraPending.map(() => false),
          toMove: ns.abbot,
        };
      }
      return { ...ns, pendingAbbotChoice: end.newAbbot };
    }
    return { ...st, toMove: following };
  },

  isTerminal(s) { return s.over === true; },

  outcome(s) {
    const scores = Array.from({ length: s.numPlayers }, (_, i) => abbeyScore(s, i));
    return { winners: s.over ? _scoreWinners(scores, s.devotion) : [], scores };
  },

  view(s, player) {
    const hand = s.hand.map((h, i) => (i === player ? h.slice() : h.map(() => "hidden")));
    const drawPile = s.drawPile.map(() => "hidden");
    let pendingKeep = s.pendingKeep;
    if (pendingKeep) {
      pendingKeep = pendingKeep.player === player
        ? { player, options: pendingKeep.options.slice() }
        : { player: pendingKeep.player, options: pendingKeep.options.map(() => "hidden") };
    }
    return { ...s, hand, drawPile, pendingKeep };
  },

  geometry(s) {
    const cells = [
      { id: "space-copy", polygon: rect(0.4, 0.4, 2.9, 2.0), kind: "copy", label: "Copy Desk" },
      { id: "space-illum", polygon: rect(3.5, 0.4, 2.9, 2.0), kind: "illum", label: "Illumination Loft" },
      { id: "space-vine1", polygon: rect(6.6, 0.4, 2.9, 2.0), kind: "vineyard", label: "Vineyard Terrace" },
      { id: "space-vine2", polygon: rect(9.7, 0.4, 2.9, 2.0), kind: "vineyard", label: "Vineyard Terrace" },
      { id: "space-press", polygon: rect(0.4, 2.7, 2.9, 2.0), kind: "press", label: "Press Cellar" },
      { id: "space-sell", polygon: rect(3.5, 2.7, 2.9, 2.0), kind: "sell", label: "Sell Stall" },
      { id: "space-supply", polygon: rect(6.6, 2.7, 2.9, 2.0), kind: "supply", label: "Supply Stall" },
      { id: "space-chapel", polygon: rect(9.7, 2.7, 2.9, 2.0), kind: "chapel", label: "Chapel" },
      { id: "space-library", polygon: rect(0.4, 5.0, 2.9, 2.0), kind: "library", label: "Library" },
      { id: "space-chapter", polygon: rect(3.5, 5.0, 9.1, 2.0), kind: "chapter", label: "Chapter House" },
      { id: "season", polygon: rect(0.4, 7.3, 12.2, 0.6), kind: "label", label: s.over ? "Final season" : `Season ${s.season}/${s.seasonCount} Abbot P${s.abbot + 1}` },
    ];
    const centers = {
      copy: [1.85, 1.4], illum: [4.95, 1.4], vine1: [8.05, 1.4], vine2: [11.15, 1.4],
      press: [1.85, 3.7], sell: [4.95, 3.7], supply: [8.05, 3.7], chapel: [11.15, 3.7],
      library: [1.85, 6.0], chapter: [8.05, 6.0],
    };
    const pieces = [];
    for (const [space, arr] of Object.entries(s.placed)) {
      if (space === "pass") continue;
      const c = centers[space] || [8.05, 6.0];
      arr.forEach((seat, i) => {
        let x = c[0], y = c[1];
        if (space === "chapter") { x = 4.2 + (i % 8) * 0.55; y = 5.7 + Math.floor(i / 8) * 0.6; }
        else if (arr.length > 1) x += (i - (arr.length - 1) / 2) * 0.5;
        pieces.push({ id: `monk-${space}-${i}`, x, y, r: 0.24, owner: seat, shape: "pawn", kind: "monk", cellId: `space-${space}` });
      });
    }
    return { width: 13, height: 8.2, cells, pieces };
  },

  panels(s, viewer) {
    const panels = [
      {
        id: "commissions",
        title: "Commission Row",
        zone: "shared",
        cards: s.row.map(cardView),
        counters: [{ id: "deck", label: "Deck", value: s.drawPile.length + s.discard.length }],
        note: s.over ? "Game over" : `Season ${s.season}/${s.seasonCount} Abbot P${s.abbot + 1}`,
      },
    ];
    for (let p = 0; p < s.numPlayers; p++) {
      const left = Math.max(0, s.monksSeason[p] - _placedBy(s.placed, p));
      panels.push({
        id: `seat${p}`,
        title: `Player ${p + 1}`,
        zone: "players",
        owner: p,
        counters: [
          { id: `seat${p}-ink`, label: "Ink", value: s.ink[p], resource: "ink" },
          { id: `seat${p}-manuscript`, label: "Manuscript", value: s.manuscript[p], resource: "manuscript" },
          { id: `seat${p}-wine`, label: "Wine", value: wineCount(s, p), resource: "wine" },
          { id: `seat${p}-gold`, label: "Gold", value: s.gold[p], resource: "gold" },
          { id: `seat${p}-devotion`, label: "Devotion", value: s.devotion[p] },
          { id: `seat${p}-score`, label: "Score", value: abbeyScore(s, p) },
        ],
        cards: s.tableau[p].map(cardView),
        note: s.abbot === p && !s.over ? "Abbot" : `${left} monks left`,
      });
    }
    if (s.pendingKeep) {
      const isChooser = viewer === s.pendingKeep.player;
      const isSpectator = viewer === undefined || viewer === null;
      let cards;
      if (isChooser || isSpectator) {
        cards = s.pendingKeep.options.map((c, idx) => {
          if (typeof c !== "string" || c === "hidden" || c.indexOf("hidden") === 0) {
            return { id: `keep-hidden-${idx}`, title: "Hidden", faceDown: true };
          }
          return cardView(c);
        });
      } else {
        cards = s.pendingKeep.options.map((_, idx) => ({ id: `keep-hidden-${idx}`, title: "Hidden", faceDown: true }));
      }
      panels.push({
        id: "study",
        title: "Library Choice",
        zone: "shared",
        cards,
        note: isChooser ? "Choose 1 to keep" : "Opponent choosing",
      });
    }
    if (viewer !== undefined && viewer !== null) {
      panels.push({ id: "hand", title: "Your hand", zone: "hand", owner: viewer, cards: s.hand[viewer].map(cardView) });
    }
    return panels;
  },

  moveTarget(s, move) {
    if (!move) return undefined;
    if (move.type === "keep") return move.card;
    if (move.type === "abbot") return undefined;
    if (move.type === "place") {
      if (move.space === "pass") return undefined;
      return `space-${move.space}`;
    }
    return undefined;
  },

  describeMove(s, move, viewer) {
    const mover = s.pendingKeep ? s.pendingKeep.player : (s.pendingAbbotChoice !== null && s.pendingAbbotChoice !== undefined ? s.pendingAbbotChoice : s.toMove);
    const hidden = viewer !== undefined && viewer !== mover;
    if (move.type === "abbot") return move.choice === "gold" ? "take Abbot bonus: 2 Gold" : "take Abbot bonus: 2 Ink";
    if (move.type === "keep") {
      if (hidden) return "choose a commission to keep";
      const d = cardOf(move.card);
      return d ? `keep ${d.name}` : "keep a commission";
    }
    let base = "";
    if (move.space === "pass") base = "pass (forfeit monk)";
    else if (move.space === "copy") base = "copy manuscript";
    else if (move.space === "illum") base = "illuminate (+prestige, +devotion)";
    else if (move.space === "vine1" || move.space === "vine2") base = "harvest wine";
    else if (move.space === "press") base = "press wine for gold";
    else if (move.space === "sell") base = `sell ${move.sellM || 0} manuscripts + ${move.sellW || 0} wine`;
    else if (move.space === "supply") base = `buy ${move.buy || 0} ink`;
    else if (move.space === "chapel") base = "pray at chapel";
    else if (move.space === "library" && move.lib === "draw") base = "study: draw 2 keep 1";
    else if (move.space === "library") base = hidden && move.discard ? "discard a card for gold" : `discard ${move.discard ? (cardOf(move.discard) || {}).name || "card" : "card"} for gold`;
    else if (move.space === "chapter") base = "join Chapter House";
    else base = `go to ${move.space}`;
    if (move.fulfillCard) {
      if (hidden && move.fulfillSource === "hand") base += " + fulfill hand commission";
      else {
        const d = cardOf(move.fulfillCard);
        base += d ? ` + fulfill ${d.name} (+${d.points})` : " + fulfill commission";
      }
    }
    return base;
  },
};
