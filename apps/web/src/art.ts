import { collectCards, createRng, fitBounds, resolveParams, sampleSeats, type GameModule } from "@boarddream/engine";
import { useEffect, useState } from "react";
import { artShown, setArtShown, type ArtShown } from "./artShown";
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

/**
 * A version for the painting's address, from the whole report: the image is served to be cached
 * for good, and a painting lined up again in place (apps/server/src/art/realign.ts) keeps its
 * scores, so a version from its IoU alone kept showing the old image.
 */
export function reportVersion(report: BoardReport): string {
  let h = 0;
  for (const ch of JSON.stringify(report)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h.toString(36);
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

/**
 * The game's art so far, plus a function that paints the missing cards and adds each one as it
 * lands; which parts the table shows (artShown.ts), and the art to put on the table accordingly.
 */
export function useArt(game: GameModule) {
  const [art, setArt] = useState<ArtMap>(new Map());
  const [painting, setPainting] = useState<{ done: number; total: number } | null>(null);
  const [board, setBoard] = useState<BoardArt>();
  const [boardStep, setBoardStep] = useState<string | null>(null);
  const id = game.meta.id;
  const [shown, setShown] = useState<ArtShown>(() => artShown(id));
  const show = (part: keyof ArtShown, on: boolean) => setShown(setArtShown(id, part, on));

  useEffect(() => {
    setArt(new Map());
    setBoard(undefined);
    setShown(artShown(id));
    let cancelled = false;
    fetch(`/api/art/${id}/board`)
      .then((res) => (res.ok ? (res.json() as Promise<BoardReport>) : undefined))
      .then((report) => {
        if (!cancelled && report) setBoard(boardArt(id, report, reportVersion(report)));
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
    // Painting shows what it paints, even if the card art was hidden.
    show("cards", true);
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
    show("board", true);
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

  // What the table draws: each part only while it is shown.
  const onTable = { art: shown.cards ? art : undefined, boardPaint: shown.board ? board?.paint : undefined };
  return { art, painting, paint, board, boardStep, paintBoard, shown, show, onTable };
}
