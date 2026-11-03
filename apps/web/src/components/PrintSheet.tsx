import { randomPlayout, type CardView, type GameModule, type Geometry, type Params } from "@boarddream/engine";
import type { ArtShown } from "../artShown";
import { Printer, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { startingGeometry } from "../art";
import { useEscape } from "../escape";
import { resourceById } from "../icons";
import { rulesFor } from "../rules";
import type { BoardPaint } from "../paintSource";
import { Board } from "./Board";
import { Card } from "./Card";

const CARDS_PER_PAGE = 9;

/**
 * Every card design with its number of copies: bots play a few games and each distinct card id
 * (copies have their own, like "fern#2") seen face up counts once. A design is the whole face, not
 * just the title: two cards may share a name and differ (a starting oven and one for sale). Cards
 * nobody ever saw are missing, so the sheet says the counts come from play.
 */
function cardInventory(game: GameModule, art: Map<string, string> | undefined, plain = false, games = 8): { card: CardView; copies: number }[] {
  const ids = new Map<string, Set<string>>();
  const views = new Map<string, CardView>();
  const players = game.meta.maxPlayers;
  for (let seed = 1; seed <= games; seed++) {
    randomPlayout(game, { numPlayers: players, seed, maxTurns: 800 }, ({ state }) => {
      for (let seat = 0; seat < players; seat++) {
        for (const panel of game.panels?.(state, seat) ?? []) {
          for (const card of panel.cards ?? []) {
            if (card.faceDown) continue;
            const design = JSON.stringify([card.title, card.text, card.cost, card.points, card.tags]);
            if (!views.has(design)) views.set(design, { ...card, art: plain ? undefined : (card.art ?? art?.get(card.title)) });
            ids.set(design, (ids.get(design) ?? new Set()).add(card.id));
          }
        }
      }
    });
  }
  return [...views.entries()].map(([design, card]) => ({ card, copies: ids.get(design)!.size }));
}

/** Widest a card's painting is printed: 63 mm at 300 dpi is about 750 pixels. */
const PRINT_ART_WIDTH = 800;

/**
 * Card paintings shrunk for paper. They are 1920 pixels wide, and a browser printing them to PDF
 * stores each one uncompressed: Waxbloom Valley's 24 paintings (21 MB) made a 120 MB kit. Each is
 * drawn at most PRINT_ART_WIDTH wide and kept as a JPEG. Undefined until every one is ready; a
 * painting that cannot be read (a server without art) is printed as it was.
 */
/** An image drawn at most `widest` pixels wide and kept as a JPEG; as it was if it cannot be read. */
const paperImage = (url: string, widest: number) =>
  new Promise<string>((done) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      const scale = Math.min(1, widest / image.width);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return done(url);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      try {
        done(canvas.toDataURL("image/jpeg", 0.85));
      } catch {
        done(url);
      }
    };
    image.onerror = () => done(url);
    image.src = url;
  });

function usePrintArt(art: Map<string, string> | undefined): Map<string, string> | undefined {
  const [small, setSmall] = useState<Map<string, string>>();
  useEffect(() => {
    let alive = true;
    void Promise.all([...(art ?? new Map<string, string>()).entries()].map(async ([title, url]) => [title, await paperImage(url, PRINT_ART_WIDTH)] as const)).then((entries) => {
      if (alive) setSmall(new Map(entries));
    });
    return () => {
      alive = false;
    };
  }, [art]);
  return small;
}

/**
 * A painted board as it is printed: the painting as a JPEG at most 2,400 pixels wide (an A4
 * landscape page at about 200 dpi). Undefined until ready; with no painting, null.
 */
function usePrintBoard(paint: BoardPaint | undefined): BoardPaint | null | undefined {
  const [ready, setReady] = useState<BoardPaint | null>();
  useEffect(() => {
    if (!paint) return setReady(null);
    let alive = true;
    void paperImage(paint.url, 2400).then((url) => alive && setReady({ ...paint, url }));
    return () => {
      alive = false;
    };
  }, [paint]);
  return ready;
}

/** A print-and-play kit: the rules, the components, the board and every card, laid out for A4 with cut lines. */
export function PrintSheet({
  game,
  params,
  art,
  boardPaint,
  shown,
  onClose,
}: {
  game: GameModule;
  params: Params;
  art?: Map<string, string>;
  boardPaint?: BoardPaint;
  /** What the table shows of the art (the Art panel's switches): the kit starts from the same. */
  shown?: ArtShown;
  onClose(): void;
}) {
  useEscape(onClose);
  const resources = useMemo(() => resourceById(game.meta.resources), [game]);
  // The paintings are printed unless the player leaves them off (to save ink, or to colour in by
  // hand): the card art, and a painted board, which then prints as its plain tiles.
  const [withCardArt, setWithCardArt] = useState(shown?.cards ?? true);
  const [withBoardArt, setWithBoardArt] = useState(shown?.board ?? true);
  const printArt = usePrintArt(art);
  // A board that has been painted prints painted, as the table shows it.
  const printBoard = usePrintBoard(boardPaint);
  const ready = printArt !== undefined && printBoard !== undefined;
  const inventory = useMemo(() => cardInventory(game, withCardArt ? printArt : undefined, !withCardArt), [game, printArt, withCardArt]);
  // The board as printed: its spaces and labels, without the pieces of one particular opening.
  const geometry = useMemo<Geometry | undefined>(() => {
    const start = startingGeometry(game);
    return start && { ...start, pieces: [] };
  }, [game]);
  // Keyed by design, not title: two designs may share a title.
  const cards = inventory.flatMap(({ card, copies }, design) => Array.from({ length: copies }, (_, i) => ({ card, key: `${design}-${i}` })));
  const pages = Array.from({ length: Math.ceil(cards.length / CARDS_PER_PAGE) }, (_, i) => cards.slice(i * CARDS_PER_PAGE, (i + 1) * CARDS_PER_PAGE));
  const rules = rulesFor(game, params);
  const players = game.meta.minPlayers === game.meta.maxPlayers ? `${game.meta.minPlayers}` : `${game.meta.minPlayers}–${game.meta.maxPlayers}`;

  return (
    <div className="print-overlay">
      <div className="print-toolbar">
        <span>
          Print and play <b>{game.meta.name}</b>: the rules{geometry ? ", the board" : ""} and {cards.length} cards on A4. Cut along the dashed lines.
        </span>
        {(art?.size ?? 0) > 0 && (
          <label className="print-option">
            <input type="checkbox" checked={withCardArt} onChange={(e) => setWithCardArt(e.target.checked)} /> Card art
          </label>
        )}
        {boardPaint && geometry && (
          <label className="print-option">
            <input type="checkbox" checked={withBoardArt} onChange={(e) => setWithBoardArt(e.target.checked)} /> Painted board
          </label>
        )}
        <button type="button" className="action" onClick={() => window.print()} disabled={!ready}>
          <Printer size={16} /> {ready ? "Print or save as PDF" : "Preparing the art…"}
        </button>
        <button type="button" className="ghost" onClick={onClose} aria-label="Close the print kit">
          <X size={16} /> Close
        </button>
      </div>

      <section className="print-page">
        <h1>{game.meta.name}</h1>
        <p className="print-lede">{game.meta.summary}</p>
        <p className="print-meta">{players} players · made with BoardDream</p>
        <h2>Rules</h2>
        <ol>
          {rules.map((rule, i) => (
            <li key={i}>{rule}</li>
          ))}
        </ol>
        <h2>Components</h2>
        <ul>
          {geometry && <li>The board (next page).</li>}
          {inventory.length > 0 && (
            <li>
              {cards.length} cards in {inventory.length} designs:{" "}
              {inventory.map(({ card, copies }) => `${card.title}${copies > 1 ? ` ×${copies}` : ""}`).join(", ")}. Copies are counted from simulated games, so a
              rare card may be missing.
            </li>
          )}
          {[...resources.values()].map((r) => (
            <li key={r.id}>{r.name}: a supply of tokens (coins, beads or cubes work).</li>
          ))}
          <li>A marker or pawn per player, in their color.</li>
        </ul>
      </section>

      {geometry && (
        <section className="print-page print-board">
          <Board geometry={geometry} paint={withBoardArt ? (printBoard ?? undefined) : undefined} targets={new Set()} onCell={() => {}} />
        </section>
      )}

      {pages.map((page, i) => (
        <section key={i} className="print-page print-cards">
          {page.map(({ card, key }) => (
            <div key={key} className="print-card">
              <Card card={card} resources={resources} />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
