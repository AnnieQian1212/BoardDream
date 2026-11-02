/**
 * The mosaic: something to tap while a game is made. Each click lays tesserae (tiles) on a picture
 * whose faint outline shows where each color goes; every tile laid earns tesserae to spend on
 * upgrades, and a finished picture pays a bonus and starts the next. Pure rules, so the page and
 * the tests drive them alike.
 */

/** Wide enough to run the width of a laptop screen in tiles about as tall as they are wide. */
export const COLS = 72;
export const ROWS = 6;
export const CELLS = COLS * ROWS;

export interface Mosaic {
  /** Tesserae to spend. */
  chips: number;
  /** Pictures finished; the picture on the wall is number `level`. */
  level: number;
  /** One flag per cell, row by row: laid or not. */
  laid: boolean[];
  /** Upgrades owned. */
  trowel: number;
  apprentices: number;
  gild: number;
}

export type Upgrade = "trowel" | "apprentices" | "gild";

export const UPGRADES: { id: Upgrade; name: string; does: string; base: number; max: number }[] = [
  { id: "trowel", name: "Wider trowel", does: "lays a wider patch per click", base: 20, max: 4 },
  { id: "apprentices", name: "Apprentice", does: "lays a tile every second", base: 30, max: 12 },
  { id: "gild", name: "Gilded glass", does: "each tile is worth one more", base: 60, max: 6 },
];

export const fresh = (): Mosaic => ({ chips: 0, level: 0, laid: new Array(CELLS).fill(false), trowel: 0, apprentices: 0, gild: 0 });

/** What the next of an upgrade costs, or undefined at its maximum. */
export function costOf(m: Mosaic, id: Upgrade): number | undefined {
  const spec = UPGRADES.find((u) => u.id === id)!;
  return m[id] >= spec.max ? undefined : Math.round(spec.base * 1.7 ** m[id]);
}

export function buy(m: Mosaic, id: Upgrade): Mosaic {
  const cost = costOf(m, id);
  if (cost === undefined || m.chips < cost) return m;
  return { ...m, chips: m.chips - cost, [id]: m[id] + 1 };
}

/** The bonus a finished picture pays: a quarter of its tiles, growing with each picture. */
export const bonusOf = (level: number) => Math.round((CELLS / 4) * (1 + 0.15 * level));

/**
 * Lays the given cells (those not laid yet). Each pays 1 plus the gilding. Laying the last cell
 * finishes the picture: its bonus is paid and the next picture begins, empty.
 */
export function lay(m: Mosaic, cells: number[]): { mosaic: Mosaic; laid: number; finished: boolean } {
  const laid = [...m.laid];
  let count = 0;
  for (const c of cells) {
    if (c < 0 || c >= CELLS || laid[c]) continue;
    laid[c] = true;
    count++;
  }
  let next: Mosaic = { ...m, laid, chips: m.chips + count * (1 + m.gild) };
  const finished = count > 0 && laid.every(Boolean);
  if (finished) next = { ...next, chips: next.chips + bonusOf(m.level), level: m.level + 1, laid: new Array(CELLS).fill(false) };
  return { mosaic: next, laid: count, finished };
}

/** The cells a click on `cell` lays: the cell, and with a wider trowel a round patch about it. */
export function patch(cell: number, trowel: number): number[] {
  const [x0, y0] = [cell % COLS, Math.floor(cell / COLS)];
  const cells: number[] = [];
  const r = trowel;
  for (let y = y0 - r; y <= y0 + r; y++) {
    for (let x = x0 - r; x <= x0 + r; x++) {
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
      if ((x - x0) ** 2 + (y - y0) ** 2 <= r * r + r) cells.push(y * COLS + x);
    }
  }
  return cells;
}

/** `n` cells not yet laid, picked at random (an apprentice's work). */
export function emptyCells(m: Mosaic, n: number, random: () => number = Math.random): number[] {
  const empty = m.laid.flatMap((on, i) => (on ? [] : [i]));
  const out: number[] = [];
  for (let i = 0; i < n && empty.length > 0; i++) out.push(empty.splice(Math.floor(random() * empty.length), 1)[0]);
  return out;
}

/** Palettes in the storybook's colors, one per picture in turn. */
export const PALETTES = [
  ["#2f6f8f", "#4f9bb5", "#e2c27a", "#c8643c", "#f3ead7"],
  ["#3e6b3a", "#7aa257", "#d9b25a", "#a85c3a", "#efe3c9"],
  ["#5a3f7a", "#8c6bb0", "#e0a85a", "#c25b6a", "#f1e4d0"],
  ["#8a3f2c", "#c9693d", "#e8b45c", "#3f6f6a", "#f4ead6"],
];

/** Pictures, as a color index for each cell; one per picture in turn. */
const PICTURES: { name: string; at(x: number, y: number): number }[] = [
  { name: "Waves", at: (x, y) => Math.min(4, Math.floor(((Math.sin(x * 0.35 + y * 0.9) + 1) / 2) * 5)) },
  {
    name: "Sunrise",
    // A sun on the horizon, in rings of sky.
    at: (x, y) => {
      const d = Math.hypot((x - (COLS - 1) / 2) / 2.2, y - 5.5);
      if (d < 1.8) return 2;
      if (d < 2.8) return 3;
      return [4, 1, 0][Math.floor((d - 2.8) / 1.5) % 3];
    },
  },
  { name: "Chevrons", at: (x, y) => (Math.floor(x / 3) + Math.floor(Math.abs(y - 2.5))) % 5 },
  {
    name: "Hills",
    at: (x, y) => {
      const ground = 3 + 1.4 * Math.sin(x * 0.22);
      if (y > ground) return (x + y) % 3 === 0 ? 0 : 1;
      return Math.abs(x - COLS * 0.75) + Math.abs(y - 1.2) < 2.4 ? 2 : (x * 7 + y * 3) % 11 === 0 ? 3 : 4;
    },
  },
  { name: "Diamonds", at: (x, y) => Math.floor(Math.abs((x % 8) - 3.5) + Math.abs(y - 2.5)) % 5 },
];

/** The picture on the wall at a level: its name and each cell's color. */
export function picture(level: number): { name: string; colors: string[] } {
  const p = PICTURES[level % PICTURES.length];
  const palette = PALETTES[Math.floor(level / PICTURES.length + level) % PALETTES.length];
  return { name: p.name, colors: Array.from({ length: CELLS }, (_, i) => palette[p.at(i % COLS, Math.floor(i / COLS))]) };
}

/** A saved mosaic, made whole: missing or malformed fields fall back to a fresh one's. */
export function revive(value: unknown): Mosaic {
  const base = fresh();
  if (!value || typeof value !== "object") return base;
  const v = value as Partial<Record<keyof Mosaic, unknown>>;
  const count = (x: unknown, max = Infinity) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.min(max, Math.floor(x)) : 0);
  const laid = Array.isArray(v.laid) && v.laid.length === CELLS ? v.laid.map(Boolean) : base.laid;
  return {
    chips: count(v.chips),
    level: count(v.level),
    laid,
    trowel: count(v.trowel, UPGRADES[0].max),
    apprentices: count(v.apprentices, UPGRADES[1].max),
    gild: count(v.gild, UPGRADES[2].max),
  };
}
