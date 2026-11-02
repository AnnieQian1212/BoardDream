import type { GameModule, Geometry } from "@boarddream/engine";
import { useState, type CSSProperties } from "react";
import { startingGeometry } from "../art";
import { Board } from "./Board";

/** Printed-cover colors: an ink for the pattern and a paper under it, one pair per game. */
const LOOKS = [
  { ink: "#4f7442", paper: "#e3ead2" },
  { ink: "#ad5236", paper: "#f3dfcf" },
  { ink: "#40688d", paper: "#dce6ef" },
  { ink: "#b7832a", paper: "#f4e5c3" },
  { ink: "#76558a", paper: "#e9deee" },
  { ink: "#357f7b", paper: "#d9ece8" },
];

const hash = (text: string) => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

/** A game's printed-cover colors, steady for its id. */
export const coverLook = (game: GameModule) => LOOKS[hash(game.meta.id) % LOOKS.length];

/**
 * A game's box cover: Muse Image's painting when there is one; until it loads, or for a game with
 * none, a printed cover in the game's own colors with a pattern of what it is played with (hexes
 * for a map, a fan of cards for an engine, a grid of tiles, masks for bluffing). With the pointer
 * on it, the cover fades into the game's opening board, drawn flat, so a shelf of games shows how
 * each is played as well as what it is about.
 */
export function GameCover({ game, cover, title }: { game: GameModule; cover?: string; title?: boolean }) {
  const [loaded, setLoaded] = useState<string>();
  // The board is laid out the first time the pointer comes over the cover, not for every game on the shelf.
  const [board, setBoard] = useState<Geometry | null>();
  const look = coverLook(game);
  const painted = cover !== undefined && loaded === cover;
  const showBoard = () => {
    if (board !== undefined) return;
    try {
      const geometry = startingGeometry(game);
      setBoard(geometry && geometry.cells.some((c) => c.kind !== "label") ? geometry : null);
    } catch {
      setBoard(null);
    }
  };
  return (
    <div
      className={["cover", painted && "painted", board && "has-board"].filter(Boolean).join(" ")}
      style={{ "--cover-ink": look.ink, "--cover-paper": look.paper } as CSSProperties}
      onPointerEnter={showBoard}
      aria-hidden
    >
      {!painted && <Motif family={game.meta.family} id={game.meta.id} />}
      {cover && <img src={cover} alt="" loading="lazy" decoding="async" onLoad={() => setLoaded(cover)} />}
      {board && (
        <div className="cover-board">
          <Board geometry={bareBoard(board)} targets={NO_TARGETS} onCell={() => {}} />
        </div>
      )}
      {title && <span className="cover-title">{game.meta.name}</span>}
    </div>
  );
}

const NO_TARGETS = new Set<string>();

/**
 * The board as the game starts: its places and their names only. No pieces, which would sit over
 * the names, no numbers, and no status lines ("Round 1/6"), which say nothing before a game. It is
 * cropped to its places, since room left for those would show as empty board.
 */
function bareBoard(geometry: Geometry): Geometry {
  const cells = geometry.cells.filter((c) => c.kind !== "label").map(({ badge: _badge, ...cell }) => cell);
  const xs = cells.flatMap((c) => c.polygon.map(([x]) => x));
  const ys = cells.flatMap((c) => c.polygon.map(([, y]) => y));
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
  return {
    ...geometry,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
    pieces: [],
    cells: cells.map((cell) => ({ ...cell, polygon: cell.polygon.map(([x, y]) => [x - minX, y - minY] as [number, number]) })),
  };
}

function Motif({ family, id }: { family: string; id: string }) {
  const pattern = `motif-${id}`;
  return (
    <svg className="cover-motif" viewBox="0 0 300 200" preserveAspectRatio="xMidYMid slice">
      <defs>
        {family === "map" ? (
          <pattern id={pattern} width="42" height="72.75" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
            <path d="M21 2 39 12.4v20.8L21 43.6 3 33.2V12.4Z M0 38.6 0 59.4 M42 38.6 42 59.4 M21 43.6 21 64" />
          </pattern>
        ) : family === "grid" ? (
          <pattern id={pattern} width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(12)">
            <rect x="3" y="3" width="28" height="28" rx="4" />
            <path d="M3 17h28M17 3v28" opacity="0.45" />
          </pattern>
        ) : family === "bluff" ? (
          <pattern id={pattern} width="56" height="44" patternUnits="userSpaceOnUse" patternTransform="rotate(-6)">
            <path d="M8 16c6-5 14-5 20 0c6-5 14-5 20 0c0 10-8 16-20 16S8 26 8 16Z" />
            <circle cx="20" cy="19" r="3" />
            <circle cx="36" cy="19" r="3" />
          </pattern>
        ) : (
          <pattern id={pattern} width="48" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(-10)">
            <rect x="6" y="6" width="26" height="38" rx="4" />
            <rect x="16" y="14" width="26" height="38" rx="4" />
          </pattern>
        )}
      </defs>
      <rect width="300" height="200" fill={`url(#${pattern})`} />
    </svg>
  );
}
