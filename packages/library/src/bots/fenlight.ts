import type { Bot, PlayerId, Rng } from "@boarddream/engine";
import type { FenlightMove, FenlightState, Statement } from "../games/fenlight";

/**
 * How suspicious each seat looks to `me`, from the evidence on the table: who stood at lanterns
 * that went dark (weighted by how many dark lanterns were really dark rather than fog), what people
 * claimed, and how those claims and votes look once an exile reveals a role. With `privateInfo`
 * it also uses what only `me` knows: their own innocence or allies, and their sightings.
 */
export function suspicion(v: FenlightState, me: PlayerId, privateInfo = true): number[] {
  const sus = new Array<number>(v.numPlayers).fill(0);
  const iAmKeeper = privateInfo && v.roles[me] === "keeper";
  for (const report of v.reports) {
    // Of the lanterns that looked dark, this share really was.
    const real = report.dark.length ? report.lost / report.dark.length : 0;
    report.posts.forEach((post, i) => {
      if (!report.dark.includes(i)) {
        for (const seat of post) sus[seat] -= 0.15;
        return;
      }
      // A keeper who tended a dark lantern knows the blame falls on the others there.
      const suspects = iAmKeeper && post.includes(me) && post.length > 1 ? post.filter((seat) => seat !== me) : post;
      for (const seat of suspects) sus[seat] += real / suspects.length;
    });
  }
  // Claims weigh by how trustworthy the lanterns make the speaker look. A lantern someone put out
  // always looks dark at dawn, so saying a player at a lit lantern put one out is a lie.
  const base = sus.slice();
  const days: { night: number; statements: Statement[] }[] = [...v.days, { night: v.night, statements: v.statements }];
  for (const { night, statements } of days) {
    const report = v.reports.find((r) => r.night === night);
    for (const st of statements) {
      if (st.kind === "quiet") continue;
      if (st.kind === "report" && st.dimmed && report) {
        const post = report.posts.findIndex((p) => p.includes(st.target));
        if (post >= 0 && !report.dark.includes(post)) {
          sus[st.seat] += 1;
          continue;
        }
      }
      const trust = Math.min(1, Math.max(0, 1 - base[st.seat]));
      if (st.kind === "report") sus[st.target] += (st.dimmed ? 0.5 : -0.25) * trust;
      else if (st.kind === "accuse") sus[st.target] += 0.15 * trust;
      else sus[st.target] -= 0.1 * trust;
    }
  }
  // An exile reveals a role, and with it who argued and voted the wrong way.
  for (const day of v.days) {
    if (day.exiled === null) continue;
    const wasWisp = v.roles[day.exiled] === "wisp";
    day.ballots.forEach((ballot, seat) => {
      if (ballot === day.exiled) sus[seat] += wasWisp ? -0.2 : 0.35;
    });
    for (const st of day.statements) {
      if (st.kind === "quiet" || st.target !== day.exiled) continue;
      const blamed = st.kind === "accuse" || (st.kind === "report" && st.dimmed);
      if (blamed !== wasWisp) sus[st.seat] += 0.5;
    }
  }
  for (let seat = 0; seat < v.numPlayers; seat++) {
    const role = v.roles[seat];
    const known = !v.alive[seat] || privateInfo;
    if (known && role === "keeper") sus[seat] = -100;
    if (known && role === "wisp" && v.alive[seat]) sus[seat] = 100;
  }
  if (privateInfo) {
    for (const x of v.sightings) sus[x.target] = x.dimmed ? 100 : Math.min(sus[x.target], sus[x.target] - 0.6);
    sus[me] = -100;
  }
  return sus;
}

const argmax = (seats: PlayerId[], score: (seat: PlayerId) => number) =>
  seats.reduce<PlayerId | undefined>((best, seat) => (best === undefined || score(seat) > score(best) ? seat : best), undefined);

const same = (a: FenlightMove, b: FenlightMove) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Fenlight's own bot. Keepers tend, sometimes watch the prime suspect, report what they saw and
 * vote for whoever looks worst. Wisps put lanterns out (always when it wins), deflect blame onto
 * the keeper who looks worst in public, sometimes with a false report, and vote that way too.
 */
export function fenlightBot({ watchRate = 0.25, dimRate = 0.5, lieRate = 0.3 } = {}): Bot {
  return ({ state, player, moves, rng }) => {
    const v = state as FenlightState;
    const legal = moves as FenlightMove[];
    const pick = (move: FenlightMove | undefined) => (move && legal.find((m) => same(m, move))) ?? rng.pick(legal);
    const others = v.alive.flatMap((alive, seat) => (alive && seat !== player ? [seat] : []));
    if (v.roles[player] === "wisp") return pick(wispMove(v, player, others, rng, dimRate, lieRate));
    return pick(keeperMove(v, player, others, rng, watchRate));
  };
}

function keeperMove(v: FenlightState, me: PlayerId, others: PlayerId[], rng: Rng, watchRate: number): FenlightMove {
  const sus = suspicion(v, me);
  const watched = new Set(v.sightings.map((x) => x.target));
  if (v.phase === "night") {
    const post = v.posts.find((p) => p.includes(me)) ?? [];
    const unsure = others.filter((seat) => !watched.has(seat) && Math.abs(sus[seat]) < 100);
    const target = argmax(unsure, (seat) => sus[seat]);
    // Slipping away leaves the lantern to a partner; never when standing alone.
    if (target !== undefined && post.length > 1 && rng.next() < watchRate) return { type: "watch", target };
    return { type: "tend" };
  }
  if (v.phase === "day") {
    const seen = v.sightings.find((x) => x.night === v.night);
    if (seen && v.alive[seen.target]) return { type: "report", target: seen.target, dimmed: seen.dimmed };
    const worst = argmax(others, (seat) => sus[seat]);
    if (worst !== undefined && sus[worst] >= 0.35) return { type: "accuse", target: worst };
    const best = argmax(others, (seat) => -sus[seat]);
    if (best !== undefined && sus[best] <= -0.3 && sus[best] > -100) return { type: "vouch", target: best };
    return { type: "quiet" };
  }
  const worst = argmax(others, (seat) => sus[seat]);
  return worst !== undefined && sus[worst] >= 0.25 ? { type: "vote", target: worst } : { type: "abstain" };
}

function wispMove(v: FenlightState, me: PlayerId, others: PlayerId[], rng: Rng, dimRate: number, lieRate: number): FenlightMove {
  const looks = suspicion(v, me, false);
  const keepers = others.filter((seat) => v.roles[seat] !== "wisp");
  const scapegoat = argmax(keepers, (seat) => looks[seat] + 0.01 * rng.next());
  if (v.phase === "night") {
    if (v.boatsLost + 1 >= v.lostLimit) return { type: "dim" };
    // Two wisps at one lantern: one of them is enough.
    const post = v.posts.find((p) => p.includes(me)) ?? [];
    if (post.some((seat) => seat < me && v.roles[seat] === "wisp")) return { type: "tend" };
    // A wisp under suspicion lies low.
    const rate = looks[me] > 0.6 ? dimRate / 3 : dimRate;
    return rng.next() < rate ? { type: "dim" } : { type: "tend" };
  }
  if (scapegoat === undefined) return v.phase === "vote" ? { type: "abstain" } : { type: "quiet" };
  if (v.phase === "day") {
    // A false report only holds up against a keeper whose lantern looked dark.
    const last = v.reports[v.reports.length - 1];
    const lookedDark = (seat: PlayerId) => last !== undefined && last.dark.includes(last.posts.findIndex((p) => p.includes(seat)));
    const framed = argmax(keepers.filter(lookedDark), (seat) => looks[seat]);
    const roll = rng.next();
    if (framed !== undefined && roll < lieRate) return { type: "report", target: framed, dimmed: true };
    if (roll < 0.85) return { type: "accuse", target: scapegoat };
    return { type: "quiet" };
  }
  return { type: "vote", target: scapegoat };
}
