import * as engine from "@boarddream/engine";
import { createRng, resolveParams, type GameModule, type Geometry } from "@boarddream/engine";
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
}

/**
 * Games generated earlier: those bundled with the web app (public/demo-games, so a static deploy
 * has some) and those the server saved, when one is running. A game that no longer loads, e.g.
 * after an engine change, is left out.
 */
export async function savedGames(): Promise<GameModule[]> {
  const fetchList = async (url: string): Promise<SavedGame[]> => {
    try {
      const res = await fetch(url);
      return res.ok ? ((await res.json()) as SavedGame[]) : [];
    } catch {
      return [];
    }
  };
  const bundled = `${import.meta.env.BASE_URL}demo-games/`;
  const sources = [
    ...(await fetchList(`${bundled}index.json`)).map((game) => ({ ...game, url: `${bundled}${game.id}.js` })),
    ...(await fetchList("/api/games")).map((game) => ({ ...game, url: `/api/games/${game.id}` })),
  ];
  const games: GameModule[] = [];
  for (const { id, title, rules, url } of sources) {
    if (games.some((g) => g.meta.id === id)) continue;
    try {
      const res = await fetch(url);
      if (res.ok) games.push(loadGeneratedGame(await res.text(), id, rules, title));
    } catch {
      // Skip it; the others still load.
    }
  }
  return games;
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
        const rng = createRng(seed);
        let state = game.setup({ numPlayers, params: resolveParams(game.params), rng });
        for (let step = 0; step < 400 && !game.isTerminal(state) && performance.now() < deadline; step++) {
          if (step % 3 === 0) reach(game.geometry!(state, viewer), box);
          const [seat] = game.activePlayers(state);
          state = game.applyMove(state, seat, rng.pick(game.legalMoves(state, seat)), rng);
        }
        reach(game.geometry!(state, viewer), box);
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
