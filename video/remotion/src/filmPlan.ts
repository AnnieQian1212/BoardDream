import film from "../public/footage/film.json";

/**
 * How the film plays the app's one take (public/footage/film.mp4): each part ends on a mark of the
 * take at a film time, so the take runs on without a cut, fast through its waits and at its own pace
 * for its moments. Shared by the edit (Short.tsx) and cut-film.mts, which writes exactly these
 * frames out as a short clip, so a render reads 25 s of video instead of seeking through 20 minutes.
 */

export type Stretch = { from: number; rate: number; seconds: number };

/** The music's beat (House Vibez, 122 BPM measured) and bar: the film cuts on bars. */
export const BEAT = 60 / 122;
export const BAR = 4 * BEAT;
/** The app's part of the film: eleven bars, and half the hex it opens in before that. */
export const APP_SECONDS = 11 * BAR;
export const HEX = 0.3;

type Mark = { label: string; t: number };
const marks = (film as { marks: Mark[] }).marks;
const markAt = (label: string) => marks.find((m) => m.label === label)?.t;
export const TAKE_SRC = (film as { src?: string }).src ?? "footage/film.mp4";

export const PARTS: { until: string; plus?: number; seconds: number }[] = [
  // The first part also covers the hex the window opens in.
  { until: "idea", seconds: 1.3 + HEX },
  { until: "dream", plus: 0.3, seconds: 1.0 },
  { until: "ready", plus: 2.5, seconds: 3.4 },
  { until: "table", seconds: 1.0 },
  { until: "rivals", seconds: 1.6 },
  { until: "rules", seconds: 1.5 },
  { until: "revise", seconds: 1.2 },
  { until: "revised", plus: 0.6, seconds: 2.2 },
  { until: "version-two", seconds: 1.2 },
  { until: "balance-ready", plus: 0.4, seconds: 1.2 },
  { until: "paint", seconds: 0.8 },
  { until: "painted", plus: 0.4, seconds: 1.4 },
  { until: "print", seconds: 1.0 },
  { until: "print-ready", plus: 0.3, seconds: 0.8 },
  { until: "print-scrolled", seconds: 2.6 },
  { until: "invite", seconds: 0.4 },
  { until: "end", seconds: 1.0 },
];

/** The stretches, and the film time each part starts at (for words and badges) and its speed. */
function plan(): { stretches: Stretch[]; starts: Record<string, number>; rates: Record<string, number> } {
  if ((film as { placeholder?: boolean }).placeholder) return { stretches: [{ from: 1, rate: 4, seconds: APP_SECONDS + HEX }], starts: {}, rates: {} };
  let take = (markAt("home") ?? 0) + 0.3;
  let filmAt = 0;
  const stretches: Stretch[] = [];
  const starts: Record<string, number> = {};
  const rates: Record<string, number> = {};
  // The parts' seconds are shares: scaled so the take fills the app's time exactly.
  const scale = (APP_SECONDS + HEX) / PARTS.reduce((sum, p) => sum + p.seconds, 0);
  for (const written of PARTS) {
    const part = { ...written, seconds: written.seconds * scale };
    const end = part.until === "end" ? (film as { duration: number }).duration - 0.3 : (markAt(part.until) ?? take) + (part.plus ?? 0);
    const rate = Math.max(0.25, (end - take) / part.seconds);
    stretches.push({ from: take, rate, seconds: part.seconds });
    starts[part.until] = filmAt;
    rates[part.until] = rate;
    take = end;
    filmAt += part.seconds;
  }
  return { stretches, starts, rates };
}
export const PLAN = plan();
