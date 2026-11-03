import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { ModelClient } from "../meta/client";

/**
 * A game's player-facing text in another language, for a player who reads little English: its
 * name, summary and rules, how a turn goes and where its choices lie, what each card does, and
 * what the English words on the table mean. The table itself stays in English; this lets the player
 * learn the game and judge it. Muse Spark translates once per game and text; the answer is kept
 * under data/translations/.
 */

const ROOT = new URL("../../../../data/translations/", import.meta.url);

export const LANGUAGES = { zh: "Simplified Chinese" } as const;
export type Language = keyof typeof LANGUAGES;

export interface TranslateRequest {
  lang: Language;
  name: string;
  summary: string;
  rules: string[];
  cards: { title: string; text?: string; tags?: string[] }[];
  /** English words the player sees on the table: resources, places, panels, counters and actions. */
  terms: string[];
}

export interface Translation {
  name: string;
  summary: string;
  rules: string[];
  /** How one turn goes, in a few plain sentences. */
  turn: string;
  /** Where the game's real decisions and tensions are, honestly. */
  choices: string;
  cards: { title: string; name: string; effect: string }[];
  terms: { en: string; zh: string }[];
}

const MAX = { rules: 40, cards: 120, terms: 150, text: 500 };

/** The request with its lists and strings cut to size, or a reason it cannot be translated. */
export function cleanRequest(body: unknown): TranslateRequest | string {
  const req = body as Partial<TranslateRequest> | null;
  if (!req || typeof req !== "object") return "expected a JSON body";
  if (req.lang !== "zh") return "unsupported language";
  const text = (value: unknown) => (typeof value === "string" ? value.slice(0, MAX.text) : "");
  if (!text(req.name)) return "missing name";
  const list = <T>(value: unknown, most: number): T[] => (Array.isArray(value) ? (value.slice(0, most) as T[]) : []);
  return {
    lang: req.lang,
    name: text(req.name),
    summary: text(req.summary),
    rules: list<unknown>(req.rules, MAX.rules).map(text).filter(Boolean),
    cards: list<TranslateRequest["cards"][number]>(req.cards, MAX.cards)
      .filter((c) => c && typeof c.title === "string" && c.title)
      .map((c) => ({ title: text(c.title), text: text(c.text) || undefined, tags: Array.isArray(c.tags) ? c.tags.slice(0, 6).map(text) : undefined })),
    terms: [...new Set(list<unknown>(req.terms, MAX.terms).map(text).filter(Boolean))],
  };
}

const key = (req: TranslateRequest) => createHash("sha1").update(JSON.stringify(req)).digest("hex").slice(0, 16);

/** A saved translation of this text, if there is one. */
export function savedTranslation(gameId: string, req: TranslateRequest): Translation | undefined {
  if (!/^[a-z0-9-]+$/.test(gameId)) return undefined;
  const file = new URL(`${gameId}-${req.lang}-${key(req)}.json`, ROOT);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Translation) : undefined;
}

/**
 * The model's answer made whole: a rule, card or term it left out keeps its English, so the player
 * never loses a line of the game.
 */
export function completed(req: TranslateRequest, raw: Partial<Translation>): Translation {
  const rules = req.rules.map((rule, i) => (typeof raw.rules?.[i] === "string" && raw.rules[i].trim() ? raw.rules[i].trim() : rule));
  const cardsBy = new Map((raw.cards ?? []).map((c) => [c.title, c]));
  const termsBy = new Map((raw.terms ?? []).map((t) => [t.en, t.zh]));
  return {
    name: raw.name?.trim() || req.name,
    summary: raw.summary?.trim() || req.summary,
    rules,
    turn: raw.turn?.trim() ?? "",
    choices: raw.choices?.trim() ?? "",
    cards: req.cards.map((c) => ({ title: c.title, name: cardsBy.get(c.title)?.name?.trim() || c.title, effect: cardsBy.get(c.title)?.effect?.trim() || c.text || "" })),
    terms: req.terms.map((en) => ({ en, zh: termsBy.get(en)?.trim() || en })),
  };
}

export async function translateGame(llm: Pick<ModelClient, "chatJson">, gameId: string, req: TranslateRequest): Promise<Translation> {
  if (!/^[a-z0-9-]+$/.test(gameId)) throw new Error(`bad game id: ${gameId}`);
  const saved = savedTranslation(gameId, req);
  if (saved) return saved;
  const language = LANGUAGES[req.lang];
  const raw = await llm.chatJson<Partial<Translation>>(
    [
      {
        role: "system",
        content: [
          `You help a player who reads little English learn a board game and judge whether it is fun. Write everything in ${language}, plainly, as a friend explaining the game.`,
          "- name, summary, rules: translate faithfully, one rule for each rule given, in the same order; keep every number.",
          "- turn: how one turn goes, in two to four short sentences.",
          "- choices: where the game's real decisions and tensions are, in two to four sentences. Be honest: if a turn has few real choices, or one move is nearly always best, say so.",
          "- cards: for every card, by its English title, a natural name and what it does, from its text, in one sentence.",
          "- terms: for every English word given (resources, places, panels and counters seen on the table, and the actions the turn's prompt and menus name), a short meaning.",
        ].join("\n"),
      },
      { role: "user", content: JSON.stringify({ name: req.name, summary: req.summary, rules: req.rules, cards: req.cards, terms: req.terms }) },
    ],
    {
      name: "GameTranslation",
      schema: {
        type: "object",
        properties: {
          name: { type: "string" },
          summary: { type: "string" },
          rules: { type: "array", items: { type: "string" } },
          turn: { type: "string" },
          choices: { type: "string" },
          cards: {
            type: "array",
            items: { type: "object", properties: { title: { type: "string" }, name: { type: "string" }, effect: { type: "string" } }, required: ["title", "name", "effect"], additionalProperties: false },
          },
          terms: { type: "array", items: { type: "object", properties: { en: { type: "string" }, zh: { type: "string" } }, required: ["en", "zh"], additionalProperties: false } },
        },
        required: ["name", "summary", "rules", "turn", "choices", "cards", "terms"],
        additionalProperties: false,
      },
    },
    { reasoningEffort: "low" },
  );
  const translation = completed(req, raw);
  mkdirSync(ROOT, { recursive: true });
  writeFileSync(new URL(`${gameId}-${req.lang}-${key(req)}.json`, ROOT), JSON.stringify(translation, null, 2) + "\n");
  return translation;
}
