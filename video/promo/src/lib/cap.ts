// The app's stills (capture/*.mjs): full 1920 x 1080 pages drawn at 2x, and the boxes of the
// elements the edit animates, in the page's CSS pixels.
import { staticFile } from "remotion";
import layout from "../../public/cap/layout.json";

export type Box = { x: number; y: number; w: number; h: number };
type Entry = { boxes: Record<string, Box>; s?: number; now?: string; [k: string]: unknown };

export const LAYOUT = layout as unknown as Record<string, Entry>;

/** The still's file, for <Img src>. */
export const cap = (name: string) => staticFile(`cap/${name}.png`);

/** A box captured with a still (throws when it was not found, so a missing element is loud). */
export const box = (still: string, key: string): Box => {
  const b = LAYOUT[still]?.boxes?.[key];
  if (!b) throw new Error(`no box "${key}" in still "${still}"`);
  return b;
};

/** The making screen's stills in order, with their seconds since Dream it up. */
export const makingStills = () =>
  Object.keys(LAYOUT)
    .filter((k) => /^making-\d{3}$/.test(k))
    .sort()
    .map((k) => ({ name: k, s: LAYOUT[k].s ?? 0, now: LAYOUT[k].now ?? "" }));

/** Stills of a numbered series (e.g. "revise", "paint", "rivals"), in order. */
export const series = (prefix: string) =>
  Object.keys(LAYOUT)
    .filter((k) => new RegExp(`^${prefix}-\\d+$`).test(k))
    .sort()
    .map((k) => ({ name: k, s: LAYOUT[k].s ?? 0, entry: LAYOUT[k] }));
