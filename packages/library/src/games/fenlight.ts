import { rectPolygon, type CardView, type GameModule, type GeometryCell, type GeometryPiece, type Panel, type PlayerId, type Rng } from "@boarddream/engine";
import { dealRoles } from "../mechanics/roles";
import { tally } from "../mechanics/voting";

/**
 * Fenlight: a fen village keeps lanterns lit along its causeway through foggy nights, but some of
 * the keepers are wisps who want boats lost in the dark. Each night the keepers are paired at the
 * lanterns and choose in secret: tend, slip away to watch another player, or (wisps only) put the
 * lantern out. At dawn the lookout reports which lanterns looked dark and how many boats were
 * lost; fog makes some lit lanterns look dark too. By day everyone speaks once (accuse, vouch,
 * report what they watched, true or not), then all vote; a player with at least half the votes of
 * the living is exiled and their role revealed. Wisps win when enough boats are lost or they
 * outnumber the keepers; keepers win by exiling every wisp or seeing the last night through.
 */

export type FenRole = "keeper" | "wisp";
export type NightMove = { type: "tend" } | { type: "dim" } | { type: "watch"; target: PlayerId };
export type FenlightMove =
  | NightMove
  | { type: "accuse"; target: PlayerId }
  | { type: "vouch"; target: PlayerId }
  | { type: "report"; target: PlayerId; dimmed: boolean }
  | { type: "quiet" }
  | { type: "vote"; target: PlayerId }
  | { type: "abstain" };

export type Statement = { seat: PlayerId } & ({ kind: "accuse" | "vouch"; target: PlayerId } | { kind: "report"; target: PlayerId; dimmed: boolean } | { kind: "quiet" });

/** The lookout's dawn report: who stood at each lantern, which looked dark, and how many boats were lost. */
export interface NightReport {
  night: number;
  posts: PlayerId[][];
  /** Lanterns that looked dark: really dark, or lit but hidden by fog. */
  dark: number[];
  lost: number;
}

export interface DayRecord {
  night: number;
  statements: Statement[];
  /** Each seat's ballot: a seat, or null for an abstention (and for players already exiled). */
  ballots: (PlayerId | null)[];
  /** Who was still in the village to vote. */
  voters: PlayerId[];
  exiled: PlayerId | null;
}

/** What a watcher learned: whether their target put a lantern out that night. */
export interface Sighting {
  seat: PlayerId;
  night: number;
  target: PlayerId;
  dimmed: boolean;
}

export interface FenlightState {
  numPlayers: number;
  nights: number;
  lostLimit: number;
  fog: number;
  /** Everyone's role; in a view, null where the viewer does not know it. */
  roles: (FenRole | null)[];
  wisps: number;
  alive: boolean[];
  night: number;
  phase: "night" | "day" | "vote" | "over";
  /** Tonight's lanterns and who stands at each. */
  posts: PlayerId[][];
  /** Night choices so far; "hidden" in a view for other players' submitted choices. */
  choices: (NightMove | null | "hidden")[];
  speaker: PlayerId;
  firstSpeaker: PlayerId;
  statements: Statement[];
  /** Ballots so far: a seat, "abstain", null while still to vote; "hidden" in a view. */
  ballots: (PlayerId | "abstain" | null | "hidden")[];
  reports: NightReport[];
  days: DayRecord[];
  /** Private sightings; a view keeps only the viewer's own. */
  sightings: Sighting[];
  boatsLost: number;
  winner: FenRole | null;
}

export type FenlightParams = { nights: number; lostLimit: number; fog: number };

/**
 * Two wisps at every table size. Simulated with Fenlight's own bots, keepers win 50% of 6-player,
 * 64% of 7-player and 62% of 8-player games; three wisps at 7 or 8 players won almost every game.
 */
export const wispCount = (_numPlayers: number) => 2;

const living = (s: FenlightState) => s.alive.flatMap((alive, seat) => (alive ? [seat] : []));
const others = (s: FenlightState, seat: PlayerId) => living(s).filter((p) => p !== seat);
const name = (seat: PlayerId) => `P${seat + 1}`;

/** Lanterns for tonight: the living in random pairs, a trio when the count is odd. */
function pairUp(rng: Rng, seats: PlayerId[]): PlayerId[][] {
  const order = rng.shuffle(seats);
  const posts: PlayerId[][] = [];
  for (let i = 0; i + 1 < order.length; i += 2) posts.push([order[i], order[i + 1]]);
  if (order.length % 2 === 1) {
    if (posts.length === 0) posts.push([order[0]]);
    else posts[posts.length - 1].push(order[order.length - 1]);
  }
  return posts.map((post) => post.sort((a, b) => a - b));
}

export const postOf = (s: Pick<FenlightState, "posts">, seat: PlayerId) => s.posts.findIndex((post) => post.includes(seat));

/** Wisps and keepers still in the village (by the true roles; a view may not know them all). */
export function fenlightSides(s: FenlightState): { wisps: number; keepers: number } {
  const wisps = s.wisps - s.days.filter((d) => d.exiled !== null && s.roles[d.exiled] === "wisp").length;
  return { wisps, keepers: living(s).length - wisps };
}

function nextNight(s: FenlightState, rng: Rng): FenlightState {
  const seats = living(s);
  const after = (seat: PlayerId) => seats.find((p) => p > seat) ?? seats[0];
  return {
    ...s,
    night: s.night + 1,
    phase: "night",
    posts: pairUp(rng, seats),
    choices: s.alive.map(() => null),
    firstSpeaker: after(s.firstSpeaker),
    statements: [],
    ballots: s.alive.map(() => null),
  };
}

/** Dawn: lanterns go dark where a wisp put them out or nobody tended them; fog hides some lit ones. */
function dawn(s: FenlightState, rng: Rng): FenlightState {
  const choice = (seat: PlayerId) => s.choices[seat] as NightMove;
  const reallyDark = s.posts.map((post) => post.some((seat) => choice(seat).type === "dim") || post.every((seat) => choice(seat).type !== "tend"));
  const lit = s.posts.flatMap((_, i) => (reallyDark[i] ? [] : [i]));
  const fogged = rng.shuffle(lit).slice(0, s.fog);
  const dark = s.posts.flatMap((_, i) => (reallyDark[i] || fogged.includes(i) ? [i] : []));
  const lost = reallyDark.filter(Boolean).length;
  const sightings = [...s.sightings];
  for (const seat of living(s)) {
    const move = choice(seat);
    if (move.type === "watch") sightings.push({ seat, night: s.night, target: move.target, dimmed: choice(move.target).type === "dim" });
  }
  const boatsLost = s.boatsLost + lost;
  const next: FenlightState = {
    ...s,
    reports: [...s.reports, { night: s.night, posts: s.posts, dark, lost }],
    sightings,
    boatsLost,
  };
  if (boatsLost >= s.lostLimit) return { ...next, phase: "over", winner: "wisp" };
  const seats = living(s);
  const speaker = seats.includes(s.firstSpeaker) ? s.firstSpeaker : (seats.find((p) => p > s.firstSpeaker) ?? seats[0]);
  return { ...next, phase: "day", speaker, firstSpeaker: speaker, statements: [] };
}

/** The vote: whoever alone has the most votes, at least half of the living, is exiled. */
function resolveVote(s: FenlightState, rng: Rng): FenlightState {
  const ballots = s.ballots.map((b, seat) => (!s.alive[seat] || b === "abstain" ? null : (b as PlayerId)));
  const counts = tally(ballots, s.numPlayers);
  const best = Math.max(...counts);
  const top = counts.flatMap((n, seat) => (n === best ? [seat] : []));
  const exiled = best > 0 && top.length === 1 && best * 2 > living(s).length ? top[0] : null;
  const alive = s.alive.map((a, seat) => a && seat !== exiled);
  const next: FenlightState = { ...s, alive, days: [...s.days, { night: s.night, statements: s.statements, ballots, voters: living(s), exiled }] };
  const { wisps, keepers } = fenlightSides(next);
  if (wisps === 0) return { ...next, phase: "over", winner: "keeper" };
  if (wisps > keepers) return { ...next, phase: "over", winner: "wisp" };
  if (s.night >= s.nights) return { ...next, phase: "over", winner: "keeper" };
  return nextNight(next, rng);
}

const describe = (move: FenlightMove): string => {
  switch (move.type) {
    case "tend":
      return "tend the lantern";
    case "dim":
      return "put the lantern out";
    case "watch":
      return `slip away to watch ${name(move.target)}`;
    case "accuse":
      return `accuse ${name(move.target)}`;
    case "vouch":
      return `vouch for ${name(move.target)}`;
    case "report":
      return `claim ${name(move.target)} ${move.dimmed ? "put a lantern out" : "kept their lantern lit"}`;
    case "quiet":
      return "stay quiet";
    case "vote":
      return `vote to exile ${name(move.target)}`;
    case "abstain":
      return "abstain";
  }
};

const said = (st: Statement) =>
  st.kind === "quiet" ? "stayed quiet" : describe(st.kind === "report" ? { type: "report", target: st.target, dimmed: st.dimmed } : { type: st.kind, target: st.target });

/** What `viewer` may know: their own role (and fellow wisps'), exiled roles, their own choices, ballots and sightings. */
function redact(s: FenlightState, viewer: PlayerId | undefined): FenlightState {
  const mine = viewer === undefined ? null : s.roles[viewer];
  const known = (seat: PlayerId) => s.phase === "over" || seat === viewer || !s.alive[seat] || (mine === "wisp" && s.roles[seat] === "wisp");
  return {
    ...s,
    roles: s.roles.map((role, seat) => (known(seat) ? role : null)),
    choices: s.choices.map((c, seat) => (seat === viewer || c === null ? c : "hidden")),
    ballots: s.ballots.map((b, seat) => (seat === viewer || b === null ? b : "hidden")),
    sightings: s.sightings.filter((x) => x.seat === viewer),
  };
}

/** Night choices and votes are made together; the runner and the table act for the first seat still to choose. */
const mover = (s: FenlightState) => fenlight.activePlayers(s)[0];

/** Where each living seat stood on each night, and how its lantern looked: the evidence people argue over. */
function record(s: FenlightState, seat: PlayerId): string {
  const nights = s.reports.map((r) => {
    const post = r.posts.findIndex((p) => p.includes(seat));
    return `N${r.night} ${post < 0 ? "-" : r.dark.includes(post) ? "dark" : "lit"}`;
  });
  return nights.join(", ");
}

const LANTERN_W = 2.6;
const BOARD_W = 16;
/** Top of the row of player spaces; chips sit above and vote figures below. */
const SEAT_Y = 5.6;

export const fenlight: GameModule<FenlightState, FenlightMove, FenlightParams> = {
  meta: {
    id: "fenlight",
    name: "Fenlight",
    family: "bluff",
    mode: "hidden-role",
    minPlayers: 6,
    maxPlayers: 8,
    summary: "Keep the causeway lanterns lit through foggy nights while hidden wisps put them out; argue, vote and exile.",
    rules: [
      "Two players are secret wisps who know each other; everyone else is a keeper.",
      "Each night players are paired at lanterns and choose in secret: tend it, slip away to watch another player, or (wisps only) put it out. A lantern goes dark if anyone puts it out or nobody tends it, and every dark lantern loses a boat.",
      "At dawn everyone learns which lanterns looked dark and how many boats were lost, but fog can make a lit lantern look dark. Watchers privately learn whether their target put a lantern out.",
      "By day each player speaks once: accuse, vouch for someone, report what they watched (truthfully or not) or stay quiet. Then everyone votes; a player with at least half the votes of the living is exiled and their role revealed.",
      "Wisps win when 4 boats are lost or they outnumber the keepers; keepers win by exiling both wisps or seeing the 6th night through.",
    ],
  },
  params: [
    { key: "nights", label: "Nights", kind: "int", min: 4, max: 8, default: 6 },
    { key: "lostLimit", label: "Boats the wisps must sink", kind: "int", min: 3, max: 6, default: 4 },
    { key: "fog", label: "Lanterns hidden by fog", kind: "int", min: 0, max: 2, default: 1 },
  ],

  setup: ({ numPlayers, params, rng }) => {
    const wisps = wispCount(numPlayers);
    const seats = Array.from({ length: numPlayers }, (_, seat) => seat);
    return {
      numPlayers,
      nights: params.nights,
      lostLimit: params.lostLimit,
      fog: params.fog,
      roles: dealRoles(rng, numPlayers, { wisp: wisps }, "keeper") as FenRole[],
      wisps,
      alive: seats.map(() => true),
      night: 1,
      phase: "night",
      posts: pairUp(rng, seats),
      choices: seats.map(() => null),
      speaker: 0,
      firstSpeaker: 0,
      statements: [],
      ballots: seats.map(() => null),
      reports: [],
      days: [],
      sightings: [],
      boatsLost: 0,
      winner: null,
    };
  },

  activePlayers(s) {
    if (s.phase === "night") return living(s).filter((seat) => s.choices[seat] === null);
    if (s.phase === "day") return [s.speaker];
    if (s.phase === "vote") return living(s).filter((seat) => s.ballots[seat] === null);
    return [];
  },

  legalMoves(s, player) {
    if (!s.alive[player]) return [];
    const targets = others(s, player);
    if (s.phase === "night") {
      if (s.choices[player] !== null) return [];
      const moves: FenlightMove[] = [{ type: "tend" }, ...targets.map((target) => ({ type: "watch" as const, target }))];
      if (s.roles[player] === "wisp") moves.push({ type: "dim" });
      return moves;
    }
    if (s.phase === "day") {
      if (s.speaker !== player) return [];
      return [
        { type: "quiet" },
        ...targets.flatMap((target): FenlightMove[] => [
          { type: "accuse", target },
          { type: "vouch", target },
          { type: "report", target, dimmed: true },
          { type: "report", target, dimmed: false },
        ]),
      ];
    }
    if (s.phase === "vote") {
      if (s.ballots[player] !== null) return [];
      return [{ type: "abstain" }, ...targets.map((target) => ({ type: "vote" as const, target }))];
    }
    return [];
  },

  applyMove(s, player, move, rng) {
    if (s.phase === "night") {
      const choices = s.choices.map((c, seat) => (seat === player ? (move as NightMove) : c));
      const next = { ...s, choices };
      return living(s).every((seat) => choices[seat] !== null) ? dawn(next, rng) : next;
    }
    if (s.phase === "day") {
      const statement: Statement =
        move.type === "report"
          ? { seat: player, kind: "report", target: move.target, dimmed: move.dimmed }
          : move.type === "accuse" || move.type === "vouch"
            ? { seat: player, kind: move.type, target: move.target }
            : { seat: player, kind: "quiet" };
      const seats = living(s);
      const following = seats.find((p) => p > player) ?? seats[0];
      const statements = [...s.statements, statement];
      if (following === s.firstSpeaker) return { ...s, statements, phase: "vote", ballots: s.alive.map(() => null) };
      return { ...s, statements, speaker: following };
    }
    // The vote.
    const ballot = move.type === "vote" ? move.target : "abstain";
    const ballots = s.ballots.map((b, seat) => (seat === player ? ballot : b));
    const next = { ...s, ballots };
    return living(s).every((seat) => ballots[seat] !== null) ? resolveVote(next, rng) : next;
  },

  isTerminal: (s) => s.phase === "over",

  outcome(s) {
    if (!s.winner) return { winners: [] };
    return { winners: s.roles.flatMap((role, seat) => (role === s.winner ? [seat] : [])) };
  },

  view: (s, viewer) => redact(s, viewer),

  geometry(s, viewer) {
    const v = redact(s, viewer);
    const cells: GeometryCell[] = [];
    const pieces: GeometryPiece[] = [];
    const last = v.reports[v.reports.length - 1];
    // Tonight's lanterns along the causeway; by day they show how the lookout saw them at dawn.
    const shown = v.phase === "night" ? undefined : last;
    const posts = shown?.posts ?? v.posts;
    const gap = (BOARD_W - posts.length * LANTERN_W) / (posts.length + 1);
    posts.forEach((post, i) => {
      const x = gap + i * (LANTERN_W + gap);
      const kind = shown ? (shown.dark.includes(i) ? "dark-lantern" : "lit-lantern") : "lantern";
      cells.push({ id: `post-${i}`, polygon: rectPolygon(x, 1.2, LANTERN_W, 2.2), kind, label: `Lantern ${i + 1}` });
      post.forEach((seat, k) => {
        pieces.push({ id: `keeper-${seat}`, x: x + ((k + 1) * LANTERN_W) / (post.length + 1), y: 3.0, r: 0.32, owner: seat, shape: "pawn", cellId: `post-${i}` });
      });
    });
    // The village: one space per player, the exiled shown with their revealed role.
    const seatW = Math.min(2.2, (BOARD_W - 1) / v.numPlayers - 0.3);
    const seatGap = (BOARD_W - v.numPlayers * seatW) / (v.numPlayers + 1);
    const seatX = (seat: PlayerId) => seatGap + seat * (seatW + seatGap);
    for (let seat = 0; seat < v.numPlayers; seat++) {
      const role = v.roles[seat];
      const kind = !v.alive[seat] ? `exiled-${role}` : role === "wisp" && seat !== viewer ? "known-wisp" : "villager";
      const label = !v.alive[seat] ? `${name(seat)} ${role === "wisp" ? "wisp" : "keeper"}` : seat === viewer ? `${name(seat)} you` : name(seat);
      cells.push({ id: `seat-${seat}`, polygon: rectPolygon(seatX(seat), SEAT_Y, seatW, 1.6), kind, label, owner: v.alive[seat] ? seat : undefined });
    }
    // Who said what, as chips in the speaker's color on the seat they spoke about: discs above it
    // for accusations (and claims it put a lantern out), squares for vouches (and claims it kept its
    // lantern lit). Figures below a seat are the votes it drew in the last vote.
    const rows = new Map<string, PlayerId[]>();
    const chip = (row: string, target: PlayerId, seat: PlayerId) => rows.set(`${row}:${target}`, [...(rows.get(`${row}:${target}`) ?? []), seat]);
    for (const st of v.statements) {
      if (st.kind === "quiet") continue;
      chip(st.kind === "accuse" || (st.kind === "report" && st.dimmed) ? "against" : "for", st.target, st.seat);
    }
    const lastDay = v.days[v.days.length - 1];
    lastDay?.ballots.forEach((ballot, seat) => ballot !== null && chip("vote", ballot, seat));
    const ROW_Y: Record<string, number> = { against: SEAT_Y - 0.95, for: SEAT_Y - 0.45, vote: SEAT_Y + 2.05 };
    for (const [key, seats] of rows) {
      const [row, target] = key.split(":");
      const step = Math.min(0.42, (seatW - 0.3) / Math.max(1, seats.length - 1));
      const x0 = seatX(Number(target)) + seatW / 2 - (step * (seats.length - 1)) / 2;
      seats.forEach((seat, i) => {
        pieces.push({
          id: `${row}-${target}-${seat}`,
          x: x0 + i * step,
          y: ROW_Y[row],
          r: row === "vote" ? 0.24 : 0.19,
          owner: seat,
          shape: row === "against" ? "disc" : row === "for" ? "square" : "pawn",
          cellId: `seat-${target}`,
        });
      });
    }
    const status =
      v.phase === "over"
        ? `${v.winner === "wisp" ? "The wisps" : "The keepers"} win · ${v.boatsLost} boats lost`
        : `Night ${v.night} of ${v.nights} · ${v.boatsLost}/${v.lostLimit} boats lost · ${v.phase === "night" ? "night" : v.phase === "day" ? `${name(v.speaker)} speaks` : "vote"}`;
    cells.push({ id: "status", polygon: rectPolygon(0.5, 9.0, BOARD_W - 1, 0.8), kind: "label", label: status });
    cells.push({ id: "legend", polygon: rectPolygon(0.5, 9.8, BOARD_W - 1, 0.6), kind: "label", label: "Discs: accused by · Squares: vouched for by · Figures: last vote" });
    if (last) {
      const fog = v.fog ? `, fog hid ${v.fog}` : "";
      cells.push({ id: "report", polygon: rectPolygon(0.5, 0.1, BOARD_W - 1, 0.8), kind: "label", label: `Dawn ${last.night}: ${last.dark.length} looked dark, ${last.lost} boat${last.lost === 1 ? "" : "s"} lost${fog}` });
    }
    return { width: BOARD_W, height: 10.6, cells, pieces };
  },

  panels(s, viewer) {
    const v = redact(s, viewer);
    const panels: Panel[] = [];
    const today = (seat: PlayerId) => v.statements.find((st) => st.seat === seat);
    const lastDay = v.days[v.days.length - 1];
    for (let seat = 0; seat < v.numPlayers; seat++) {
      const st = today(seat);
      const ballot = lastDay?.ballots[seat];
      const parts = [
        !v.alive[seat] ? `exiled, ${v.roles[seat]}` : undefined,
        st ? said(st) : undefined,
        !st && lastDay?.voters.includes(seat) ? (ballot === null ? "abstained" : `voted ${name(ballot!)}`) : undefined,
        v.reports.length ? record(v, seat) : undefined,
      ].filter(Boolean);
      panels.push({
        id: `seat-panel-${seat}`,
        title: seat === viewer ? "You" : name(seat),
        zone: "players",
        owner: seat,
        counters: [{ id: `votes-${seat}`, label: "Votes", value: lastDay ? lastDay.ballots.filter((b) => b === seat).length : 0 }],
        note: parts.join(" · "),
      });
    }
    panels.push({
      id: "causeway",
      title: "Causeway",
      zone: "shared",
      counters: [
        { id: "night", label: "Night", value: v.night },
        { id: "boats", label: "Boats lost", value: v.boatsLost },
        { id: "wisps-left", label: "Wisps at large", value: fenlightSides(s).wisps },
      ],
      note: `Wisps win at ${v.lostLimit} boats lost`,
    });
    if (viewer !== undefined) {
      const role = v.roles[viewer];
      const friends = v.roles.flatMap((r, seat) => (r === "wisp" && seat !== viewer ? [name(seat)] : []));
      const cards: CardView[] = [
        {
          id: "role",
          title: role === "wisp" ? "Wisp" : "Keeper",
          text: role === "wisp" ? `Put lanterns out unseen. Fellow wisps: ${friends.join(", ") || "none left"}.` : "Keep the lanterns lit and find the wisps.",
          tags: [role ?? "keeper"],
        },
        ...v.sightings.map((x) => ({
          id: `sighting-${x.night}`,
          title: `Night ${x.night} watch`,
          text: `${name(x.target)} ${x.dimmed ? "put a lantern out" : "did not put a lantern out"}.`,
          tags: ["watch"],
        })),
      ];
      panels.push({ id: "hand", title: "Your role", zone: "hand", owner: viewer, cards });
    }
    return panels;
  },

  moveTarget(s, move) {
    if (move.type === "tend" || move.type === "dim") return `post-${postOf(s, mover(s))}`;
    if ("target" in move) return `seat-${move.target}`;
    return undefined;
  },

  describeMove(s, move, viewer) {
    // Night choices are secret: others only see that a choice was made.
    if (s.phase === "night") return viewer === undefined || viewer === mover(s) ? describe(move) : "makes a night choice";
    if (s.phase === "vote") return viewer === undefined || viewer === mover(s) ? describe(move) : "casts a vote";
    return describe(move);
  },
};
