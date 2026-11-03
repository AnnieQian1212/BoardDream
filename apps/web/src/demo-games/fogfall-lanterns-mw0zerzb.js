const { rectPolygon } = require("@boarddream/engine");
const { dealRoles } = require("@boarddream/mechanics").roles;
const { tally } = require("@boarddream/mechanics").voting;

const NAMES = ["Belfry Steps", "Moth Hollow", "Tide Reach", "Fog Bend", "Lamp Quay", "Skiff Rest"];
const MARKS = ["moth", "bell", "tide"];
const MAX_OIL = 3;
const MAX_HAND = 3;
const BOATS_TOTAL = 5;

const living = (s) => s.alive.flatMap((a, seat) => (a ? [seat] : []));
const othersAlive = (s, seat) => living(s).filter((p) => p !== seat);
const exiledWisps = (s) => s.roles.filter((r, i) => r === "wisp" && !s.alive[i]).length;
const pname = (p) => `P${p + 1}`;
const lname = (i) => NAMES[i] || `Lantern ${i + 1}`;

function teamScores(s) {
  const wProg = s.boatsLost / s.doomCount;
  const exW = exiledWisps(s);
  const kExile = exW / 2;
  const kTime = (s.night - 1) / s.nightLimit;
  const kProg = kExile * 0.6 + kTime * 0.4;
  return s.roles.map((r) => (r === "wisp" ? 1 + wProg - kProg : 1 + kProg - wProg));
}

function resolveNight(s, rng) {
  const L = s.lanternCount;
  let oil = s.oil.slice();
  for (const seat of living(s)) {
    const pk = s.picks[seat];
    if (pk && pk.deed === "tend") oil[seat] = Math.max(0, oil[seat] - 1);
  }
  const tendCount = Array.from({ length: L }, () => 0);
  const snuffCount = Array.from({ length: L }, () => 0);
  for (const seat of living(s)) {
    const pk = s.picks[seat];
    if (!pk) continue;
    if (pk.deed === "tend") tendCount[pk.lantern]++;
    else if (pk.deed === "snuff") snuffCount[pk.lantern]++;
  }
  const trulyLit = [];
  const trulyDark = [];
  for (let i = 0; i < L; i++) {
    if (tendCount[i] > 0 && snuffCount[i] === 0) trulyLit.push(i);
    else if (snuffCount[i] > 0 && tendCount[i] === 0) trulyDark.push(i);
  }
  const nonLit = [];
  for (let i = 0; i < L; i++) if (!trulyLit.includes(i)) nonLit.push(i);
  let fogLie = null;
  if (trulyLit.length > 0) fogLie = rng.shuffle(trulyLit.slice())[0];
  const reportedDark = nonLit.slice();
  if (fogLie !== null) reportedDark.push(fogLie);
  reportedDark.sort((a, b) => a - b);
  const lost = trulyDark.length;
  const boatsLost = s.boatsLost + lost;
  for (const seat of living(s)) {
    const pk = s.picks[seat];
    if (pk && pk.deed === "tend" && trulyLit.includes(pk.lantern)) oil[seat] = Math.min(MAX_OIL, oil[seat] + 1);
  }
  let hands = s.hands.map((h) => h.slice());
  let deck = s.deck.slice();
  let sightings = s.sightings.slice();
  for (const seat of living(s)) {
    const pk = s.picks[seat];
    if (pk && pk.deed === "slip") {
      const tgt = pk.watchTarget;
      if (typeof tgt === "number" && tgt >= 0 && tgt < s.numPlayers && s.picks[tgt]) {
        const tp = s.picks[tgt];
        sightings.push({ viewer: seat, night: s.night, target: tgt, stayed: tp.deed !== "slip", lantern: tp.lantern });
      }
      if (hands[seat].length < MAX_HAND && deck.length > 0) {
        const draw = deck[deck.length - 1];
        deck = deck.slice(0, deck.length - 1);
        hands = hands.map((h, i) => (i === seat ? [...h, draw] : h));
      }
    }
  }
  const reports = [...s.reports, { night: s.night, reportedDark, lost, trulyLit: trulyLit.slice(), trulyDark: trulyDark.slice(), fogLie }];
  const picks = s.picks.map((p) => (p ? { ...p } : null));
  if (boatsLost >= s.doomCount) {
    return { ...s, oil, hands, deck, sightings, reports, boatsLost, picks, phase: "over", winner: "wisp" };
  }
  const speakerOrder = living(s).slice();
  return {
    ...s, oil, hands, deck, sightings, reports, boatsLost, picks,
    phase: "day", speakerOrder, dayIndex: 0, dayStage: "speak", statements: [],
    ballots: s.alive.map((a) => (a ? -1 : -2)),
  };
}

function resolveVote(s) {
  const voters = living(s);
  const expanded = [];
  for (const v of voters) {
    const w = 1 + (s.extraVotes[v] || 0);
    const b = s.ballots[v];
    const cand = b === null ? s.numPlayers : b;
    for (let k = 0; k < w; k++) expanded.push(cand);
  }
  const counts = tally(expanded, s.numPlayers + 1);
  let best = 0;
  for (const c of counts) if (c > best) best = c;
  const top = [];
  for (let i = 0; i < counts.length; i++) if (counts[i] === best && best > 0) top.push(i);
  let exiled = null;
  if (top.length === 1 && top[0] !== s.numPlayers) exiled = top[0];
  let alive = s.alive.slice();
  if (exiled !== null && alive[exiled]) alive[exiled] = false;
  else exiled = null;
  const days = [...s.days, { night: s.night, statements: s.statements.slice(), ballots: s.ballots.slice(), exiled }];
  if (exiledWisps({ ...s, alive }) >= 2) return { ...s, alive, days, phase: "over", winner: "keeper" };
  if (s.night >= s.nightLimit) return { ...s, alive, days, phase: "over", winner: "keeper" };
  return {
    ...s, alive, days, night: s.night + 1, phase: "night",
    picks: Array.from({ length: s.numPlayers }, () => null),
    speakerOrder: [], dayIndex: 0, dayStage: "speak", statements: [],
    ballots: alive.map((a) => (a ? -1 : -2)),
  };
}

function redact(s, viewer) {
  const over = s.phase === "over";
  const v = viewer === undefined ? null : viewer;
  const mine = v === null ? null : s.roles[v];
  const roles = s.roles.map((r, seat) => {
    if (over) return r;
    if (v !== null && seat === v) return r;
    if (!s.alive[seat]) return r;
    if (mine === "wisp" && r === "wisp") return r;
    return null;
  });
  const picks = s.picks.map((p, seat) => {
    if (p === null) return null;
    if (over) return { ...p };
    if (v !== null && seat === v) return { ...p };
    return "hidden";
  });
  const hands = s.hands.map((h, seat) => {
    if (over) return h.map((c) => ({ ...c }));
    if (v !== null && seat === v) return h.map((c) => ({ ...c }));
    return h.map((_, i) => ({ id: `back-${seat}-${i}`, mark: "unknown" }));
  });
  const deck = s.deck.map((_, i) => ({ id: `back-deck-${i}`, mark: "unknown" }));
  const ballots = s.ballots.map((b, seat) => {
    if (b === -1 || b === -2) return b;
    if (over) return b;
    if (v !== null && seat === v) return b;
    return "hidden";
  });
  const sightings = v === null ? [] : s.sightings.filter((x) => x.viewer === v);
  const reports = over
    ? s.reports.map((r) => ({ ...r, reportedDark: r.reportedDark.slice(), trulyLit: r.trulyLit.slice(), trulyDark: r.trulyDark.slice() }))
    : s.reports.map((r) => ({ night: r.night, reportedDark: r.reportedDark.slice(), lost: r.lost, trulyLit: [], trulyDark: [], fogLie: null }));
  return { ...s, roles, picks, hands, deck, ballots, sightings, reports };
}

module.exports = {
  meta: {
    id: "fogfall-lanterns",
    name: "Fogfall Lanterns",
    family: "bluff",
    mode: "hidden-role",
    minPlayers: 5,
    maxPlayers: 6,
    summary: "Tend causeway lanterns while two secret wisps snuff them; watch, speak, and vote to exile.",
    rules: [
      "Two players are secret wisps who know each other; the rest are keepers.",
      "Each night pick a lantern and a deed: Tend for 1 oil, Slip Away to watch a player, or Snuff (wisps only).",
      "A lantern with Tend and no Snuff stays truly lit; Snuff with no Tend goes truly dark and loses a boat, while mixed or empty lanterns only look dark.",
      "At dawn all dark-looking lanterns are reported, including one fog lie over a truly lit lantern; lit tenders regain oil and slippers draw veils.",
      "By day speak in seat order and optionally play one veil or discard a pair for a vote pebble, then vote to exile; wisps win at doomed boats, keepers by exiling both wisps or surviving the last night.",
    ],
    resources: [
      { id: "oil", name: "Tallow Oil", icon: "flame", color: "#e8932e" },
      { id: "veil", name: "Whisper Veil", icon: "star", color: "#9a8fd0" },
      { id: "pebble", name: "Vote Pebble", icon: "coins", color: "#8a8f98" },
      { id: "boat", name: "Boat", icon: "fish", color: "#4d8fb5" },
    ],
  },
  params: [
    { key: "lanternCount", label: "Lantern Posts", kind: "int", min: 4, max: 6, default: 5 },
    { key: "nightLimit", label: "Night Limit", kind: "int", min: 4, max: 6, default: 5 },
    { key: "doomCount", label: "Doomed Boats", kind: "int", min: 2, max: 4, default: 3 },
  ],

  setup({ numPlayers, params, rng }) {
    const lanternCount = params.lanternCount;
    const nightLimit = params.nightLimit;
    const doomCount = params.doomCount;
    const roles = dealRoles(rng, numPlayers, { wisp: 2 }, "keeper");
    let deck = [];
    for (const m of MARKS) for (let i = 1; i <= 8; i++) deck.push({ id: `${m}#${i}`, mark: m });
    deck = rng.shuffle(deck);
    const hands = [];
    let idx = 0;
    for (let p = 0; p < numPlayers; p++) {
      hands.push([deck[idx], deck[idx + 1]]);
      idx += 2;
    }
    deck = deck.slice(idx);
    return {
      numPlayers, lanternCount, nightLimit, doomCount,
      roles: roles.slice(), alive: Array.from({ length: numPlayers }, () => true),
      night: 1, phase: "night",
      picks: Array.from({ length: numPlayers }, () => null),
      speakerOrder: [], dayIndex: 0, dayStage: "speak", statements: [],
      oil: Array.from({ length: numPlayers }, () => 3),
      hands, deck, discard: [],
      extraVotes: Array.from({ length: numPlayers }, () => 0),
      sightings: [], reports: [], days: [],
      ballots: Array.from({ length: numPlayers }, () => -1),
      boatsLost: 0, winner: null,
    };
  },

  activePlayers(s) {
    if (s.phase === "night") return living(s).filter((seat) => s.picks[seat] === null);
    if (s.phase === "day") {
      if (s.speakerOrder.length === 0) return [];
      const cur = s.speakerOrder[s.dayIndex];
      return cur !== undefined && s.alive[cur] ? [cur] : [];
    }
    if (s.phase === "vote") return living(s).filter((seat) => s.ballots[seat] === -1);
    return [];
  },

  legalMoves(s, player) {
    if (!s.alive[player]) return [];
    if (s.phase === "night") {
      if (s.picks[player] !== null) return [];
      const moves = [];
      for (let l = 0; l < s.lanternCount; l++) {
        if (s.oil[player] > 0) moves.push({ type: "night", lantern: l, deed: "tend", watchTarget: null });
        if (s.roles[player] === "wisp") moves.push({ type: "night", lantern: l, deed: "snuff", watchTarget: null });
      }
      for (let l = 0; l < s.lanternCount; l++) {
        for (const t of othersAlive(s, player)) moves.push({ type: "night", lantern: l, deed: "slip", watchTarget: t });
      }
      if (moves.length === 0) moves.push({ type: "night", lantern: 0, deed: "slip", watchTarget: null });
      return moves;
    }
    if (s.phase === "day") {
      const cur = s.speakerOrder[s.dayIndex];
      if (cur !== player) return [];
      if (s.dayStage === "speak") {
        const moves = [{ type: "speak", kind: "quiet", target: null, claimedStayed: null, claimedLantern: null }];
        for (const t of othersAlive(s, player)) {
          moves.push({ type: "speak", kind: "accuse", target: t, claimedStayed: null, claimedLantern: null });
          moves.push({ type: "speak", kind: "vouch", target: t, claimedStayed: null, claimedLantern: null });
          moves.push({ type: "speak", kind: "report", target: t, claimedStayed: false, claimedLantern: null });
          for (let l = 0; l < s.lanternCount; l++) moves.push({ type: "speak", kind: "report", target: t, claimedStayed: true, claimedLantern: l });
        }
        return moves;
      }
      const moves = [{ type: "veil", action: "pass", cardId: null, cardIds: null, mothTarget: null }];
      for (const c of s.hands[player]) {
        if (c.mark === "moth") {
          for (const t of othersAlive(s, player)) moves.push({ type: "veil", action: "play", cardId: c.id, cardIds: null, mothTarget: t });
        } else {
          moves.push({ type: "veil", action: "play", cardId: c.id, cardIds: null, mothTarget: null });
        }
      }
      for (const m of MARKS) {
        const ids = s.hands[player].filter((c) => c.mark === m).map((c) => c.id);
        if (ids.length >= 2) moves.push({ type: "veil", action: "discard", cardId: null, cardIds: [ids[0], ids[1]], mothTarget: null });
      }
      return moves;
    }
    if (s.phase === "vote") {
      if (s.ballots[player] !== -1) return [];
      const moves = [{ type: "vote", target: null }];
      for (const t of othersAlive(s, player)) moves.push({ type: "vote", target: t });
      return moves;
    }
    return [];
  },

  applyMove(s, player, move, rng) {
    if (s.phase === "night" && move.type === "night") {
      const picks = s.picks.map((p, i) => (i === player ? { lantern: move.lantern, deed: move.deed, watchTarget: move.watchTarget } : p));
      const next = { ...s, picks };
      return living(s).every((seat) => picks[seat] !== null) ? resolveNight(next, rng) : next;
    }
    if (s.phase === "day" && move.type === "speak") {
      const st = { seat: player, kind: move.kind, target: move.target, claimedStayed: move.claimedStayed, claimedLantern: move.claimedLantern };
      return { ...s, statements: [...s.statements, st], dayStage: "veil" };
    }
    if (s.phase === "day" && move.type === "veil") {
      let hands = s.hands.map((h) => h.slice());
      let discard = s.discard.slice();
      let oil = s.oil.slice();
      let extraVotes = s.extraVotes.slice();
      let sightings = s.sightings.slice();
      if (move.action === "play" && move.cardId) {
        const hi = hands[player].findIndex((c) => c.id === move.cardId);
        if (hi >= 0) {
          const [card] = hands[player].splice(hi, 1);
          hands = hands.map((h, i) => (i === player ? h : h));
          discard = [...discard, card];
          if (card.mark === "tide") oil[player] = Math.min(MAX_OIL, oil[player] + 1);
          else if (card.mark === "bell") extraVotes[player] = extraVotes[player] + 1;
          else if (card.mark === "moth" && typeof move.mothTarget === "number") {
            const tp = s.picks[move.mothTarget];
            if (tp) sightings.push({ viewer: player, night: s.night, target: move.mothTarget, stayed: tp.deed !== "slip", lantern: tp.lantern });
          }
          hands = s.hands.map((h, i) => {
            if (i !== player) return h.slice();
            return h.filter((c) => c.id !== move.cardId);
          });
        }
      } else if (move.action === "discard" && move.cardIds && move.cardIds.length === 2) {
        const [a, b] = move.cardIds;
        const hasA = hands[player].some((c) => c.id === a);
        const hasB = hands[player].some((c) => c.id === b);
        if (hasA && hasB) {
          hands = s.hands.map((h, i) => (i === player ? h.filter((c) => c.id !== a && c.id !== b) : h.slice()));
          const ca = s.hands[player].find((c) => c.id === a);
          const cb = s.hands[player].find((c) => c.id === b);
          if (ca && cb) discard = [...discard, ca, cb];
          extraVotes[player] = extraVotes[player] + 1;
        }
      }
      const order = s.speakerOrder.slice();
      if (s.dayIndex + 1 >= order.length) {
        return { ...s, hands, discard, oil, extraVotes, sightings, phase: "vote", ballots: s.alive.map((a) => (a ? -1 : -2)) };
      }
      return { ...s, hands, discard, oil, extraVotes, sightings, dayIndex: s.dayIndex + 1, dayStage: "speak" };
    }
    if (s.phase === "vote" && move.type === "vote") {
      const ballots = s.ballots.map((b, i) => (i === player ? move.target : b));
      const next = { ...s, ballots };
      return living(s).every((seat) => ballots[seat] !== -1) ? resolveVote(next) : next;
    }
    return s;
  },

  isTerminal: (s) => s.phase === "over",

  outcome(s) {
    if (s.phase !== "over" || !s.winner) return { winners: [], scores: teamScores(s) };
    if (s.winner === "wisp") {
      const winners = s.roles.flatMap((r, i) => (r === "wisp" ? [i] : []));
      return { winners, scores: s.roles.map((r) => (r === "wisp" ? 1 : 0)) };
    }
    const winners = s.roles.flatMap((r, i) => (r === "keeper" ? [i] : []));
    return { winners, scores: s.roles.map((r) => (r === "keeper" ? 1 : 0)) };
  },

  view: (s, viewer) => redact(s, viewer),

  geometry(s, viewer) {
    const v = redact(s, viewer);
    const L = s.lanternCount;
    const names = NAMES.slice(0, L);
    const lw = 2.0, lgap = 0.4;
    const causeW = L * lw + (L - 1) * lgap;
    const belfW = 1.8, moorW = 1.8, sg = 0.5;
    const W = 0.5 + belfW + sg + causeW + sg + moorW + 0.5;
    const H = 8.6;
    const cells = [];
    const pieces = [];
    const last = v.reports[v.reports.length - 1];
    const railText = last
      ? `Dawn ${last.night}: ${last.reportedDark.length} dark, ${last.lost} boat${last.lost === 1 ? "" : "s"} lost`
      : `Night ${v.night} of ${v.nightLimit}: tend the lights`;
    cells.push({ id: "rail", polygon: rectPolygon(0.5, 0.25, W - 1, 0.7), kind: "rail", label: railText });
    cells.push({ id: "belfry", polygon: rectPolygon(0.5, 1.5, belfW, 2.0), kind: "belfry", label: "Bell Belfry", terrain: "stone" });
    const lx0 = 0.5 + belfW + sg;
    for (let i = 0; i < L; i++) {
      const x = lx0 + i * (lw + lgap);
      let kind = "lantern";
      let glow;
      if (v.phase === "night") {
        kind = "lantern";
        glow = "#ffc35a";
      } else if (last) {
        kind = last.reportedDark.includes(i) ? "dark-lantern" : "lit-lantern";
        if (kind === "lit-lantern") glow = "#ffc35a";
      }
      const cell = { id: `lantern-${i}`, polygon: rectPolygon(x, 1.5, lw, 2.0), kind, label: names[i], badge: String(i + 1), terrain: "stone" };
      if (glow) cell.glow = glow;
      cells.push(cell);
    }
    const mx = lx0 + causeW + sg;
    cells.push({ id: "mooring", polygon: rectPolygon(mx, 1.5, moorW, 2.0), kind: "mooring", label: "Boat Mooring", badge: String(Math.max(0, BOATS_TOTAL - v.boatsLost)), terrain: "water" });
    const dockW = 2.4;
    const availW = W - 1 - dockW - 0.4;
    const seatGap = 0.3;
    const seatW = Math.min(2.0, (availW - (v.numPlayers - 1) * seatGap) / v.numPlayers);
    const seatsX0 = 0.5;
    const seatY = 4.3, seatH = 1.5;
    const seatX = (seat) => seatsX0 + seat * (seatW + seatGap);
    for (let seat = 0; seat < v.numPlayers; seat++) {
      const role = v.roles[seat];
      const kind = !v.alive[seat] ? `exiled-${role}` : "villager";
      const label = !v.alive[seat] ? `${pname(seat)} ${role === "wisp" ? "wisp" : "keeper"}` : seat === viewer ? `${pname(seat)} you` : pname(seat);
      const cell = { id: `seat-${seat}`, polygon: rectPolygon(seatX(seat), seatY, seatW, seatH), kind, label };
      if (v.alive[seat]) cell.owner = seat;
      cells.push(cell);
    }
    cells.push({ id: "dock", polygon: rectPolygon(W - 0.5 - dockW, seatY, dockW, seatH), kind: "dock", label: "Exile Skiff Dock", terrain: "grass" });
    const status = v.phase === "over"
      ? `${v.winner === "wisp" ? "Wisps" : "Keepers"} win: ${v.boatsLost}/${v.doomCount} boats lost`
      : `Night ${v.night}/${v.nightLimit} · ${v.boatsLost}/${v.doomCount} lost · ${v.phase === "night" ? "night" : v.phase === "day" ? `${pname(v.speakerOrder[v.dayIndex])} speaks` : "vote"}`;
    cells.push({ id: "status", polygon: rectPolygon(0.5, 6.5, W - 1, 0.7), kind: "label", label: status });
    cells.push({ id: "legend", polygon: rectPolygon(0.5, 7.3, W - 1, 0.6), kind: "label", label: "Discs accused · Squares vouched · Pawns votes" });
    const moorCx = mx + moorW / 2;
    const remain = Math.max(0, BOATS_TOTAL - v.boatsLost);
    for (let i = 0; i < remain; i++) {
      pieces.push({ id: `boat-${i}`, x: moorCx, y: 2.0 + i * 0.32, r: 0.14, shape: "square", kind: "boat", cellId: "mooring" });
    }
    if (last && v.phase !== "night") {
      for (const d of last.reportedDark) {
        const x = lx0 + d * (lw + lgap) + lw / 2;
        pieces.push({ id: `fog-${d}`, x, y: 1.85, r: 0.16, shape: "disc", kind: "fog", cellId: `lantern-${d}` });
      }
    }
    const showAll = v.phase === "over";
    const pawnAt = (seat, lanternIdx, pid) => {
      const x = lx0 + lanternIdx * (lw + lgap) + lw / 2;
      pieces.push({ id: pid, x, y: 3.05, r: 0.26, owner: seat, shape: "pawn", cellId: `lantern-${lanternIdx}` });
    };
    if (viewer !== undefined && viewer !== null) {
      const p = v.picks[viewer];
      if (p && p !== "hidden" && typeof p.lantern === "number") pawnAt(viewer, p.lantern, `keeper-${viewer}`);
    } else if (showAll || viewer === undefined) {
      for (let seat = 0; seat < v.numPlayers; seat++) {
        const p = v.picks[seat];
        if (p && p !== "hidden" && typeof p.lantern === "number" && v.alive[seat]) pawnAt(seat, p.lantern, `keeper-${seat}`);
      }
    }
    v.alive.forEach((a, seat) => {
      if (!a) pieces.push({ id: `exiled-${seat}`, x: W - 0.5 - dockW / 2, y: 5.1, r: 0.24, owner: seat, shape: "pawn", cellId: "dock" });
    });
    const rows = new Map();
    const chip = (row, target, seat) => rows.set(`${row}:${target}`, [...(rows.get(`${row}:${target}`) || []), seat]);
    for (const st of v.statements) {
      if (st.kind === "quiet") continue;
      if (st.kind === "accuse") chip("against", st.target, st.seat);
      else chip("for", st.target, st.seat);
    }
    const lastDay = v.days[v.days.length - 1];
    if (lastDay) lastDay.ballots.forEach((b, seat) => {
      if (b !== -1 && b !== -2 && b !== "hidden" && b !== null) chip("vote", b, seat);
    });
    const ROW_Y = { against: seatY - 0.45, for: seatY - 0.18, vote: seatY + seatH + 0.25 };
    for (const [key, seats] of rows) {
      const [row, target] = key.split(":");
      const t = Number(target);
      if (Number.isNaN(t) || t < 0 || t >= v.numPlayers) continue;
      const step = Math.min(0.4, (seatW - 0.2) / Math.max(1, seats.length));
      const x0 = seatX(t) + seatW / 2 - (step * (seats.length - 1)) / 2;
      seats.forEach((seat, i) => {
        pieces.push({
          id: `${row}-${target}-${seat}`, x: x0 + i * step, y: ROW_Y[row], r: row === "vote" ? 0.22 : 0.17,
          owner: seat, shape: row === "against" ? "disc" : row === "for" ? "square" : "pawn", cellId: `seat-${target}`,
        });
      });
    }
    return { width: W, height: H, cells, pieces };
  },

  panels(s, viewer) {
    const v = redact(s, viewer);
    const panels = [];
    const today = (seat) => v.statements.find((st) => st.seat === seat);
    const lastDay = v.days[v.days.length - 1];
    for (let seat = 0; seat < v.numPlayers; seat++) {
      const st = today(seat);
      const parts = [];
      if (!v.alive[seat]) parts.push("exiled");
      else if (v.phase === "day" && v.speakerOrder[v.dayIndex] === seat) parts.push("speaking");
      else if (v.phase === "night" && v.picks[seat] !== null) parts.push("chose");
      else if (v.phase === "night") parts.push("choosing");
      else if (v.phase === "vote") parts.push(v.ballots[seat] === -1 ? "voting" : "voted");
      else parts.push("waiting");
      if (st && st.kind !== "quiet") parts.push(st.kind);
      const note = parts.join(" · ").slice(0, 48);
      panels.push({
        id: `seat-panel-${seat}`, title: seat === viewer ? "You" : pname(seat), zone: "players", owner: seat,
        counters: [
          { id: `oil-${seat}`, label: "Oil", value: v.oil[seat], resource: "oil" },
          { id: `veils-${seat}`, label: "Veils", value: v.hands[seat].length, resource: "veil" },
          { id: `pebbles-${seat}`, label: "Pebbles", value: v.extraVotes[seat], resource: "pebble" },
        ],
        note,
      });
    }
    panels.push({
      id: "causeway", title: "Causeway", zone: "shared",
      counters: [
        { id: "night", label: "Night", value: v.night },
        { id: "boats", label: "Boats lost", value: v.boatsLost, resource: "boat" },
        { id: "deck", label: "Deck", value: s.deck.length },
      ],
      note: `Wisps win at ${v.doomCount} boats lost`,
    });
    if (viewer !== undefined && viewer !== null) {
      const role = v.roles[viewer];
      const friends = v.roles.flatMap((r, seat) => (r === "wisp" && seat !== viewer ? [pname(seat)] : []));
      const cards = [
        {
          id: "role", title: role === "wisp" ? "Wisp Shroud" : "Keeper Shroud",
          text: role === "wisp" ? `Snuff unseen. Kin: ${friends.join(", ") || "none"}.` : "Tend the lights; find both wisps.",
          tags: [role || "keeper"],
        },
        ...v.hands[viewer].filter((c) => c.mark !== "unknown").map((c) => ({
          id: c.id, title: `${c.mark[0].toUpperCase() + c.mark.slice(1)} Veil`,
          text: c.mark === "moth" ? "Play: spy a lantern. Pair: +1 vote." : c.mark === "bell" ? "Play: +1 vote pebble." : "Play: +1 oil.",
          tags: [c.mark],
        })),
        ...v.sightings.map((x, si) => ({
          id: `sighting-${x.night}-${x.target}-${si}`, title: `Watch N${x.night}`,
          text: `${pname(x.target)} ${x.stayed ? `kept ${lname(x.lantern)}` : `slipped from ${lname(x.lantern)}`}.`,
          tags: ["watch"],
        })),
      ];
      panels.push({ id: "hand", title: "Your veils", zone: "hand", owner: viewer, cards });
    }
    return panels;
  },

  moveTarget(s, move) {
    if (move.type === "night") return `lantern-${move.lantern}`;
    if (move.type === "speak") return move.target === null ? undefined : `seat-${move.target}`;
    if (move.type === "veil") {
      if (move.action === "play") return move.cardId || undefined;
      if (move.action === "discard" && move.cardIds) return move.cardIds[0];
      return undefined;
    }
    if (move.type === "vote") return move.target === null ? undefined : `seat-${move.target}`;
    return undefined;
  },

  describeMove(s, move, viewer) {
    if (move.type === "night") {
      if (viewer !== undefined && viewer !== null) return "makes a night choice";
      if (move.deed === "tend") return `tend ${lname(move.lantern)}`;
      if (move.deed === "snuff") return `snuff ${lname(move.lantern)}`;
      return move.watchTarget === null ? `slip away at ${lname(move.lantern)}` : `slip away to watch ${pname(move.watchTarget)}`;
    }
    if (move.type === "speak") {
      if (move.kind === "quiet") return "stay quiet";
      if (move.kind === "accuse") return `accuse ${pname(move.target)}`;
      if (move.kind === "vouch") return `vouch for ${pname(move.target)}`;
      return move.claimedStayed ? `claim ${pname(move.target)} kept ${lname(move.claimedLantern)}` : `claim ${pname(move.target)} slipped away`;
    }
    if (move.type === "veil") {
      if (move.action === "pass") return "hold veils";
      if (move.action === "discard") return "discard a veil pair for a pebble";
      const prefix = typeof move.cardId === "string" ? move.cardId.split("#")[0] : "veil";
      if (prefix === "moth" && typeof move.mothTarget === "number") return `play Moth veil to spy ${pname(move.mothTarget)}`;
      if (prefix === "bell") return "play Bell veil for a vote";
      if (prefix === "tide") return "play Tide veil for oil";
      return "play a whisper veil";
    }
    if (move.type === "vote") {
      if (viewer !== undefined && viewer !== null) return "casts a vote";
      return move.target === null ? "vote for no exile" : `vote to exile ${pname(move.target)}`;
    }
    return "pass";
  },
};
