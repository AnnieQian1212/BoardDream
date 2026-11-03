import * as engine from "@boarddream/engine";
import { randomPlayout, type GameModule, type Geometry } from "@boarddream/engine";
import { referenceGames } from "@boarddream/library";
import * as mechanics from "@boarddream/library/mechanics";

const MODULES: Record<string, unknown> = {
  "@boarddream/engine": engine,
  "@boarddream/mechanics": mechanics,
};

const sources = new WeakMap<GameModule, string>();

/** The rules source a generated game was loaded from, so a worker can load it too. */
export const generatedSource = (game: GameModule) => sources.get(game);

interface SavedGame {
  id: string;
  title?: string;
  rules?: string[];
  createdAt?: string;
  idea?: string;
}

/** What is known about a generated game beyond its rules: when it was made, and from what idea. */
export interface GameOrigin {
  createdAt?: string;
  idea?: string;
}

const origins = new WeakMap<GameModule, GameOrigin>();

/** When a generated game was made and from what idea, where known. */
export const gameOrigin = (game: GameModule) => origins.get(game);

/** Records a generated game's origin (a game just made, which the server has not listed yet). */
export const rememberOrigin = (game: GameModule, origin: GameOrigin) => void origins.set(game, origin);

/**
 * The demo games: the best games BoardDream made, bundled with the web app (src/demo-games, written
 * by `npm run demo:games`) so they are on offer at once, with or without a server. In the bundle's
 * order, best first. A game that no longer loads, e.g. after an engine change, is left out.
 */
const BUNDLE = import.meta.glob<string>("./demo-games/*", { query: "?raw", import: "default", eager: true });
let demos: GameModule[] | undefined;

export function demoGames(): GameModule[] {
  if (demos) return demos;
  const index = JSON.parse(BUNDLE["./demo-games/index.json"] ?? "[]") as SavedGame[];
  demos = index.flatMap(({ id, title, rules, createdAt, idea }) => {
    const source = BUNDLE[`./demo-games/${id}.js`];
    if (source === undefined) return [];
    try {
      const game = loadGeneratedGame(source, id, rules, title);
      origins.set(game, { createdAt, idea });
      return [game];
    } catch {
      return [];
    }
  });
  return demos;
}

/** Whether a game is one of the demo games. */
export const isDemoGame = (game: GameModule) => demoGames().includes(game);

/**
 * One game by its id, wherever it lives: the library, the demo games, or the server's saved games.
 * For a table shared with friends, which names its game by id.
 */
export async function gameById(id: string): Promise<GameModule | undefined> {
  const known = [...referenceGames, ...demoGames()].find((g) => g.meta.id === id);
  if (known) return known;
  try {
    const res = await fetch("/api/games");
    if (!res.ok) return undefined;
    const entry = ((await res.json()) as SavedGame[]).find((g) => g.id === id);
    if (!entry) return undefined;
    const source = await fetch(`/api/games/${id}`);
    if (!source.ok) return undefined;
    const game = loadGeneratedGame(await source.text(), id, entry.rules, entry.title);
    origins.set(game, { createdAt: entry.createdAt, idea: entry.idea });
    return game;
  } catch {
    return undefined;
  }
}

/**
 * The games the server saved, when one is running, other than the demo games (the server that made
 * a demo game keeps it too). A game that no longer loads, e.g. after an engine change, is left out.
 */
export async function savedGames(): Promise<GameModule[]> {
  let listed: SavedGame[] = [];
  try {
    const res = await fetch("/api/games");
    if (res.ok) listed = (await res.json()) as SavedGame[];
  } catch {
    // No server: the static demo has only its demo games.
  }
  const hidden = hiddenGames();
  const games: GameModule[] = [];
  for (const { id, title, rules, createdAt, idea } of listed) {
    if (hidden.has(id) || games.some((g) => g.meta.id === id) || demoGames().some((g) => g.meta.id === id)) continue;
    try {
      const res = await fetch(`/api/games/${id}`);
      if (!res.ok) continue;
      const game = loadGeneratedGame(await res.text(), id, rules, title);
      origins.set(game, { createdAt, idea });
      games.push(game);
    } catch {
      // Skip it; the others still load.
    }
  }
  return games;
}

const HIDDEN = "boarddream:deleted-games";

/** Generated games this browser's player deleted. Storage can be unavailable: then none are. */
function hiddenGames(): Set<string> {
  try {
    const ids = JSON.parse(localStorage.getItem(HIDDEN) ?? "[]") as unknown;
    return new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

/**
 * Deletes a generated game: the server moves its files aside, and this browser stops listing it,
 * which is all that happens where the server keeps it (the public demo).
 */
export async function deleteGeneratedGame(id: string): Promise<void> {
  try {
    localStorage.setItem(HIDDEN, JSON.stringify([...hiddenGames(), id]));
  } catch {
    // Not remembered here; the server's deletion still holds where it is allowed.
  }
  try {
    await fetch(`/api/games/${encodeURIComponent(id)}`, { method: "DELETE" });
  } catch {
    // No server: hidden in this browser only.
  }
}

/**
 * Runs generated rules that already passed server-side fuzzing and playtesting. `id` replaces the
 * game's own id (the saved game's id), so two generated games never collide, and `title` its
 * name, so a revision reads "(revised)" in the picker.
 */
export function loadGeneratedGame(source: string, id?: string, rules?: string[], title?: string): GameModule {
  const module = { exports: {} as Record<string, unknown> };
  const require = (id: string) => {
    if (id in MODULES) return MODULES[id];
    throw new Error(`require("${id}") is not allowed`);
  };
  new Function("module", "exports", "require", `"use strict";\n${source}`)(module, module.exports, require);
  const exported = module.exports as { default?: unknown; game?: unknown };
  const game = (exported.default ?? exported.game ?? exported) as GameModule;
  // The designer's rules fill in when the module does not state its own.
  const named = trimBoard({ ...game, meta: { ...game.meta, id: id ?? game.meta.id, name: title ?? game.meta.name, rules: game.meta.rules ?? rules } });
  sources.set(named, source);
  return named;
}

type Box = [minX: number, minY: number, maxX: number, maxY: number];

/** Widens `box` to take in a board's cells and pieces. */
function reach(geometry: Geometry, box: Box): Box {
  const take = (x: number, y: number, r = 0) => {
    box[0] = Math.min(box[0], x - r);
    box[1] = Math.min(box[1], y - r);
    box[2] = Math.max(box[2], x + r);
    box[3] = Math.max(box[3], y + r);
  };
  for (const cell of geometry.cells) for (const [x, y] of cell.polygon) take(x, y);
  for (const piece of geometry.pieces) take(piece.x, piece.y, piece.r);
  return box;
}

/** A board is trimmed when its cells and pieces leave more than this share of its width or height empty. */
const SLACK = 0.1;
/** The margin a trimmed board keeps around them, as a share of its longer side. */
const MARGIN = 0.03;

/**
 * Where a board's content sits within its declared size, found by playing a few quick random
 * games at every player count: how to shift it and the size that fits it, or null when it already
 * fits (or the game cannot be sampled).
 */
function trimFor(game: GameModule, first: Geometry, viewer?: number): { dx: number; dy: number; width: number; height: number } | null {
  const box = reach(first, [Infinity, Infinity, -Infinity, -Infinity]);
  try {
    const deadline = performance.now() + 120;
    for (let numPlayers = game.meta.minPlayers; numPlayers <= game.meta.maxPlayers; numPlayers++) {
      for (let seed = 1; seed <= 2 && performance.now() < deadline; seed++) {
        const end = randomPlayout(game, { numPlayers, seed, maxTurns: 400 }, ({ turn, state }) => {
          if (performance.now() >= deadline) return false;
          if (turn % 3 === 0) reach(game.geometry!(state, viewer), box);
        });
        reach(game.geometry!(end, viewer), box);
      }
    }
  } catch {
    return null;
  }
  const [minX, minY, maxX, maxY] = box;
  if (!(maxX > minX && maxY > minY)) return null;
  const pad = MARGIN * Math.max(maxX - minX, maxY - minY);
  const width = maxX - minX + 2 * pad;
  const height = maxY - minY + 2 * pad;
  if (width > (1 - SLACK) * first.width && height > (1 - SLACK) * first.height) return null;
  return { dx: pad - minX, dy: pad - minY, width, height };
}

/**
 * Generated boards often declare a larger size than their cells use, such as a 20 × 12 board with
 * a dial of radius 4.6 in the middle, and the table shows the rest as an empty slab. The first time
 * the board is drawn, the size it really needs is measured (trimFor), and every state's board is
 * then shifted and trimmed the same way, so it never jumps mid-game.
 */
export function trimBoard(game: GameModule): GameModule {
  if (!game.geometry) return game;
  let trim: ReturnType<typeof trimFor> | undefined;
  return {
    ...game,
    geometry(state, viewer) {
      const board = game.geometry!(state, viewer);
      trim ??= trimFor(game, board, viewer);
      if (!trim) return board;
      const { dx, dy, width, height } = trim;
      return {
        ...board,
        width,
        height,
        cells: board.cells.map((cell) => ({ ...cell, polygon: cell.polygon.map(([x, y]) => [x + dx, y + dy] as [number, number]) })),
        pieces: board.pieces.map((piece) => ({ ...piece, x: piece.x + dx, y: piece.y + dy })),
      };
    },
  };
}
