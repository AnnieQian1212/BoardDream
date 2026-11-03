import { collectCards, createRng, randomPlayout, sampleSeats, type GameModule, type Params } from "@boarddream/engine";
import { useEffect, useMemo, useState } from "react";
import { startingGeometry } from "./art";
import { actionOf } from "./instructions";
import { rulesFor } from "./rules";

/**
 * A game's rules and cards in another language, for a player who reads little English (server:
 * apps/server/src/agent/translate.ts). The table stays in English; the rules card shows the game in
 * the player's language, with what the English words on the table mean.
 */

export type Language = "en" | "zh";

export interface Translation {
  name: string;
  summary: string;
  rules: string[];
  turn: string;
  choices: string;
  cards: { title: string; name: string; effect: string }[];
  terms: { en: string; zh: string }[];
}

/**
 * Everything a player reads about a game: its name, summary and rules, the cards it deals, and the
 * English words its table shows (resources, places on the board, panels and counters, and the
 * actions the turn's prompt and its menus name, read from a short random game).
 */
export function gameTexts(game: GameModule, params: Params) {
  const cards = [...new Map(collectCards(game).map((c) => [c.title, c])).values()].map(({ title, text, tags }) => ({ title, text, tags }));
  const terms = new Set<string>();
  for (const r of game.meta.resources ?? []) terms.add(r.name);
  for (const cell of startingGeometry(game)?.cells ?? []) if (cell.label && cell.kind !== "label" && !/^\d+$/.test(cell.label)) terms.add(cell.label);
  try {
    const state = game.setup({ numPlayers: sampleSeats(game), params, rng: createRng(1) });
    for (const panel of game.panels?.(state, 0) ?? []) {
      if (panel.zone !== "players") terms.add(panel.title);
      for (const counter of panel.counters ?? []) terms.add(counter.label);
    }
  } catch {
    // A game that cannot set up with these params still has its rules and cards.
  }
  const actions = new Set<string>();
  try {
    randomPlayout(game, { seed: 1, maxTurns: 80, params }, ({ state, seat, moves }) => {
      for (const move of moves.slice(0, 40)) {
        const action = actionOf(game.describeMove?.(state, move, seat) ?? "");
        if (action && action.length <= 40) actions.add(action);
      }
      if (actions.size >= 40) return false;
    });
  } catch {
    // The rules and cards are enough without them.
  }
  for (const action of actions) terms.add(action);
  return { name: game.meta.name, summary: game.meta.summary, rules: rulesFor(game, params), cards, terms: [...terms].filter((t) => t.trim()).slice(0, 150) };
}

type State = { status: "idle" } | { status: "loading" } | { status: "ready"; translation: Translation } | { status: "error"; message: string };

/** The game in `lang`, fetched when asked for (English needs nothing), with a way to try again. */
export function useTranslation(game: GameModule, params: Params, lang: Language): State & { retry(): void } {
  const [state, setState] = useState<State>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  const texts = useMemo(() => (lang === "en" ? undefined : gameTexts(game, params)), [game, params, lang]);
  useEffect(() => {
    if (!texts || lang === "en") {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    fetch(`/api/translate/${game.meta.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang, ...texts }) })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as Translation & { error?: string };
        if (cancelled) return;
        if (!res.ok) setState({ status: "error", message: body.error ?? res.statusText });
        else setState({ status: "ready", translation: body });
      })
      .catch((err: unknown) => !cancelled && setState({ status: "error", message: err instanceof Error ? err.message : String(err) }));
    return () => {
      cancelled = true;
    };
  }, [texts, lang, game.meta.id, attempt]);
  return { ...state, retry: () => setAttempt((a) => a + 1) };
}
