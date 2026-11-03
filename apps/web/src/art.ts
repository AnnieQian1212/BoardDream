import { collectCards, createRng, fitBounds, resolveParams, sampleSeats, type GameModule } from "@boarddream/engine";
import { useEffect, useRef, useState } from "react";
import { artShown, setArtShown, type ArtShown } from "./artShown";
import { paintingsOf, stepLabel, updatePaintings, usePaintings, type Underway } from "./paintings";
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

/** The paintings whose streams this page reads, as "<game>:board" or "<game>:cards"; others are followed on the server. */
const reading = new Set<string>();
/** How often a painting this page does not read is looked up while it goes on. */
const FOLLOW_MS = 3000;

/**
 * The game's art so far, plus functions that paint the missing cards and the board, adding each
 * piece as it lands; which parts the table shows (artShown.ts), and the art to put on the table
 * accordingly. A painting goes on when the player turns to another game or page: its progress is
 * kept per game (paintings.ts), what it finishes reaches the table only while its game is there,
 * and a game opened again, after a reload too, follows a painting the server is still making.
 */
export function useArt(game: GameModule) {
  const [art, setArt] = useState<ArtMap>(new Map());
  const [board, setBoard] = useState<BoardArt>();
  const id = game.meta.id;
  const current = useRef(id);
  current.current = id;
  const paintings = usePaintings(id);
  const follow = useRef<() => void>(() => {});
  const [shown, setShown] = useState<ArtShown>(() => artShown(id));
  const show = (part: keyof ArtShown, on: boolean) => setShown(setArtShown(id, part, on));

  useEffect(() => {
    setArt(new Map());
    setBoard(undefined);
    setShown(artShown(id));
    let cancelled = false;
    const loadBoard = () =>
      fetch(`/api/art/${id}/board`)
        .then((res) => (res.ok ? (res.json() as Promise<BoardReport>) : undefined))
        .then((report) => {
          if (!cancelled && report) setBoard(boardArt(id, report, reportVersion(report)));
        })
        .catch(() => {});
    const loadCards = () =>
      fetch(`/api/art/${id}`)
        .then((res) => (res.ok ? (res.json() as Promise<Record<string, string>>) : ({} as Record<string, string>)))
        .then((manifest) => {
          // Cards that landed while the list was on its way stay.
          if (!cancelled) setArt((landed) => new Map([...landed, ...Object.entries(manifest).map(([title, file]): [string, string] => [title, url(id, file)])]));
        })
        .catch(() => {});
    void loadBoard();
    void loadCards();

    // A painting this page does not read (it began before a reload, or in another tab) is looked
    // up until it ends, and what it made is loaded as it comes.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let seen: Omit<Underway, "boardError"> = {};
    const look = async () => {
      clearTimeout(timer);
      let now: Omit<Underway, "boardError"> = {};
      try {
        const res = await fetch(`/api/art/${id}/progress`);
        if (res.ok) now = (await res.json()) as typeof now;
      } catch {
        // No server: nothing is painted.
      }
      if (cancelled) return;
      const [boardAway, cardsAway] = [!reading.has(`${id}:board`), !reading.has(`${id}:cards`)];
      if (boardAway) {
        updatePaintings(id, { board: now.board ? stepLabel(now.board) : undefined });
        if (seen.board && !now.board) void loadBoard();
      }
      if (cardsAway) {
        updatePaintings(id, { cards: now.cards });
        if (seen.cards && now.cards?.done !== seen.cards.done) void loadCards();
      }
      seen = now;
      if ((boardAway && now.board) || (cardsAway && now.cards)) timer = setTimeout(() => void look(), FOLLOW_MS);
    };
    follow.current = () => void look();
    void look();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id]);

  async function paint() {
    const cards = collectCards(game);
    const missing = cards.filter((c) => !art.has(c.title));
    if (missing.length === 0 || paintingsOf(id).cards) return;
    const started = id;
    // Painting shows what it paints, even if the card art was hidden.
    show("cards", true);
    updatePaintings(started, { cards: { done: 0, total: missing.length } });
    reading.add(`${started}:cards`);
    let elsewhere = false;
    try {
      const res = await fetch(`/api/art/${started}`, {
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
      // Already being painted, from another page: followed instead.
      if (res.status === 409) {
        elsewhere = true;
        return;
      }
      if (!res.ok) throw new Error(res.statusText);
      await readEvents(res, (event, data) => {
        if (event !== "card") return;
        const { title, file } = JSON.parse(data) as { title: string; file: string };
        if (current.current === started) setArt((landed) => new Map(landed).set(title, url(started, file)));
        const so = paintingsOf(started).cards;
        if (so) updatePaintings(started, { cards: { ...so, done: so.done + 1 } });
      });
    } finally {
      reading.delete(`${started}:cards`);
      updatePaintings(started, { cards: undefined });
      if (elsewhere && current.current === started) follow.current();
    }
  }

  async function paintBoard() {
    const geometry = startingGeometry(game);
    if (!geometry || paintingsOf(id).board) return;
    const started = id;
    show("board", true);
    updatePaintings(started, { board: stepLabel("starting"), boardError: undefined });
    reading.add(`${started}:board`);
    let elsewhere = false;
    try {
      const res = await fetch(`/api/art/${started}/board`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: game.meta.name, summary: game.meta.summary, geometry }),
      });
      if (res.status === 409) {
        elsewhere = true;
        return;
      }
      if (!res.ok) throw new Error(res.statusText);
      await readEvents(res, (event, data) => {
        // Steps still on their way when it was stopped do not undo the "Stopping…".
        if (event === "step" && !paintingsOf(started).board?.startsWith("Stopping")) updatePaintings(started, { board: stepLabel(data) });
        if (event === "error") updatePaintings(started, { boardError: data });
        if (event === "done" && current.current === started) setBoard(boardArt(started, JSON.parse(data) as BoardReport, String(Date.now())));
      });
    } finally {
      reading.delete(`${started}:board`);
      updatePaintings(started, { board: undefined });
      if (elsewhere && current.current === started) follow.current();
    }
  }

  /** Stops the board being painted (from this page or another); the board keeps what it had. */
  async function cancelBoard() {
    if (!paintingsOf(id).board) return;
    updatePaintings(id, { board: stepLabel("stopping") });
    try {
      await fetch(`/api/art/${id}/board`, { method: "DELETE", headers: { "Content-Type": "application/json" } });
    } catch {
      // The server is gone; so is its painting.
    }
  }

  // What the table draws: each part only while it is shown.
  const onTable = { art: shown.cards ? art : undefined, boardPaint: shown.board ? board?.paint : undefined };
  return {
    art,
    painting: paintings.cards ?? null,
    paint,
    board,
    boardStep: paintings.board ?? null,
    boardError: paintings.boardError,
    paintBoard,
    cancelBoard,
    shown,
    show,
    onTable,
  };
}
