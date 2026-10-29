import { createRng, resolveParams, type CardView, type GameModule, type Geometry, type Params } from "@boarddream/engine";
import { Printer, X } from "lucide-react";
import { useMemo } from "react";
import { startingGeometry } from "../art";
import { resourceById } from "../icons";
import { rulesFor } from "../rules";
import { Board } from "./Board";
import { Card } from "./Card";

const CARDS_PER_PAGE = 9;

/**
 * Every card design with its number of copies: bots play a few games and each distinct card id
 * (copies have their own, like "fern#2") seen face up counts once. A design is the whole face, not
 * just the title: two cards may share a name and differ (a starting oven and one for sale). Cards
 * nobody ever saw are missing, so the sheet says the counts come from play.
 */
function cardInventory(game: GameModule, art: Map<string, string> | undefined, games = 8): { card: CardView; copies: number }[] {
  const ids = new Map<string, Set<string>>();
  const views = new Map<string, CardView>();
  const players = game.meta.maxPlayers;
  for (let seed = 1; seed <= games; seed++) {
    const rng = createRng(seed);
    let state = game.setup({ numPlayers: players, params: resolveParams(game.params), rng });
    for (let step = 0; step < 800 && !game.isTerminal(state); step++) {
      for (let seat = 0; seat < players; seat++) {
        for (const panel of game.panels?.(state, seat) ?? []) {
          for (const card of panel.cards ?? []) {
            if (card.faceDown) continue;
            const design = JSON.stringify([card.title, card.text, card.cost, card.points, card.tags]);
            if (!views.has(design)) views.set(design, { ...card, art: card.art ?? art?.get(card.title) });
            ids.set(design, (ids.get(design) ?? new Set()).add(card.id));
          }
        }
      }
      const [seat] = game.activePlayers(state);
      state = game.applyMove(state, seat, rng.pick(game.legalMoves(state, seat)), rng);
    }
  }
  return [...views.entries()].map(([design, card]) => ({ card, copies: ids.get(design)!.size }));
}

/** A print-and-play kit: the rules, the components, the board and every card, laid out for A4 with cut lines. */
export function PrintSheet({ game, params, art, onClose }: { game: GameModule; params: Params; art?: Map<string, string>; onClose(): void }) {
  const resources = useMemo(() => resourceById(game.meta.resources), [game]);
  const inventory = useMemo(() => cardInventory(game, art), [game, art]);
  // The board as printed: its spaces and labels, without the pieces of one particular opening.
  const geometry = useMemo<Geometry | undefined>(() => {
    const start = startingGeometry(game);
    return start && { ...start, pieces: [] };
  }, [game]);
  const cards = inventory.flatMap(({ card, copies }) => Array.from({ length: copies }, (_, i) => ({ card, key: `${card.title}-${i}` })));
  const pages = Array.from({ length: Math.ceil(cards.length / CARDS_PER_PAGE) }, (_, i) => cards.slice(i * CARDS_PER_PAGE, (i + 1) * CARDS_PER_PAGE));
  const rules = rulesFor(game, params);
  const players = game.meta.minPlayers === game.meta.maxPlayers ? `${game.meta.minPlayers}` : `${game.meta.minPlayers}–${game.meta.maxPlayers}`;

  return (
    <div className="print-overlay">
      <div className="print-toolbar">
        <span>
          Print and play <b>{game.meta.name}</b>: {1 + (geometry ? 1 : 0) + pages.length} A4 pages. Cut along the dashed lines.
        </span>
        <button type="button" className="action" onClick={() => window.print()}>
          <Printer size={16} /> Print or save as PDF
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
          <Board geometry={geometry} targets={new Set()} onCell={() => {}} />
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
