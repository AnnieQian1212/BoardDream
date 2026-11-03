import { collectCards, createRng, fitBounds, resolveParams, sampleSeats, type GameModule } from "@boarddream/engine";
import { useEffect, useState } from "react";
import { readEvents } from "./sse";
import type { BoardPaint } from "./three/Board3D";

/** The SAM 3.1 alignment check of a painted board (apps/server/src/art/board.ts). */
export interface BoardReport {
  width: number;
  height: number;
  sources: Record<string, [number, number][]>;
  meanIoU: number;
  alignedShare: number;
  tiles: number;
  firstMeanIoU: number;
  repainted: boolean;
}

export interface BoardArt {
  paint: BoardPaint;
  report: BoardReport;
}

const boardArt = (gameId: string, report: BoardReport, version: string): BoardArt => ({
  paint: { url: `/api/art/${gameId}/board.png?v=${version}`, width: report.width, height: report.height, sources: report.sources },
  report,
});

/** The board a game starts with: what the painter paints over. */
export function startingGeometry(game: GameModule) {
  const geometry = game.geometry?.(game.setup({ numPlayers: sampleSeats(game), params: resolveParams(game.params), rng: createRng(1) }));
  return geometry && fitBounds(geometry);
}

/**
 * Card art painted by Muse Image (server: apps/server/src/art/cards.ts). Art is keyed by card title,
 * so every copy of a card and every game state shares it.
 */

export type ArtMap = Map<string, string>;

const url = (gameId: string, file: string) => `/api/art/${gameId}/${file}`;

export { collectCards };

/** The game's art so far, plus a function that paints the missing cards and adds each one as it lands. */
export function useArt(game: GameModule) {
  const [art, setArt] = useState<ArtMap>(new Map());
  const [painting, setPainting] = useState<{ done: number; total: number } | null>(null);
  const [board, setBoard] = useState<BoardArt>();
  const [boardStep, setBoardStep] = useState<string | null>(null);
  const id = game.meta.id;

  useEffect(() => {
    setArt(new Map());
    setBoard(undefined);
    let cancelled = false;
    fetch(`/api/art/${id}/board`)
      .then((res) => (res.ok ? (res.json() as Promise<BoardReport>) : undefined))
      .then((report) => {
        if (!cancelled && report) setBoard(boardArt(id, report, report.meanIoU.toFixed(6)));
      })
      .catch(() => {});
    fetch(`/api/art/${id}`)
      .then((res) => (res.ok ? (res.json() as Promise<Record<string, string>>) : ({} as Record<string, string>)))
      .then((manifest) => {
        if (!cancelled) setArt(new Map(Object.entries(manifest).map(([title, file]) => [title, url(id, file)])));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function paint() {
    const cards = collectCards(game);
    const missing = cards.filter((c) => !art.has(c.title));
    if (missing.length === 0) return;
    setPainting({ done: 0, total: missing.length });
    try {
      const res = await fetch(`/api/art/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game: game.meta.name,
          summary: game.meta.summary,
          mode: game.meta.mode,
          family: game.meta.family,
          cards: cards.map(({ title, text, tags }) => ({ title, text, tags })),
        }),
      });
      if (!res.ok) throw new Error(res.statusText);
      await readEvents(res, (event, data) => {
        if (event !== "card") return;
        const { title, file } = JSON.parse(data) as { title: string; file: string };
        setArt((current) => new Map(current).set(title, url(id, file)));
        setPainting((p) => p && { ...p, done: p.done + 1 });
      });
    } finally {
      setPainting(null);
    }
  }

  async function paintBoard() {
    const geometry = startingGeometry(game);
    if (!geometry) return;
    setBoardStep("Starting…");
    try {
      const res = await fetch(`/api/art/${id}/board`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: game.meta.name, summary: game.meta.summary, geometry }),
      });
      if (!res.ok) throw new Error(res.statusText);
      await readEvents(res, (event, data) => {
        if (event === "step") setBoardStep(`${data[0].toUpperCase()}${data.slice(1)}…`);
        if (event === "done") setBoard(boardArt(id, JSON.parse(data) as BoardReport, String(Date.now())));
      });
    } finally {
      setBoardStep(null);
    }
  }

  return { art, painting, paint, board, boardStep, paintBoard };
}
