import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { collectCards, type GameModule } from "@boarddream/engine";
import type { ModelClient } from "../meta/client";

/**
 * Card illustrations from Muse Image, in a style chosen for the game: a cozy game as a storybook, a
 * game of secrets as a woodcut, a voyage of trade as a copper engraving, a space game as a retro
 * poster, a myth in watercolor. The first card sets the look; every later card is painted with that
 * first image as a style reference, so a whole deck reads as one illustrated set. Each card's picture
 * is written first, for the whole deck at once, so no two cards show the same thing. Images are saved
 * under data/art/<game id>/ with a manifest from card title to file, the style in style.json and the
 * pictures in scenes.json.
 */

const ROOT = new URL("../../../../data/art/", import.meta.url);

export type ArtStyle = "storybook" | "woodcut" | "engraving" | "poster" | "watercolor";

/** How each style is painted, and the kind of game it suits (which the style picker reads). */
export const ART_STYLES: Record<ArtStyle, { paint: string; suits: string }> = {
  storybook: {
    paint:
      "Storybook illustration with confident hand-inked dark brown outlines and flat, softly shaded colors in a warm muted palette of ochre, rust, moss green and slate blue, light paper grain on cream paper",
    suits: "cozy, everyday, family and nature games: gardens, cafes, villages, animals, farms",
  },
  woodcut: {
    paint:
      "Hand-cut woodcut print: bold black carved lines and solid black shapes on cream paper, visible gouge marks, strong contrast, one or two flat spot colors (deep red, ochre) printed slightly off register",
    suits: "tense games of secrets and danger: hidden roles, bluffing, crime, smuggling, war, horror, survival",
  },
  engraving: {
    paint:
      "Copperplate engraving: fine hatching and cross-hatching in dark brown-black ink on warm cream paper, delicate stippled shading, lightly hand-tinted with a few soft transparent washes, like a plate in an old book of voyages",
    suits: "history, trade and exploration: merchants, guilds, voyages, empires, expeditions, early science",
  },
  poster: {
    paint:
      "Retro screen-printed poster: bold flat shapes in a limited palette of four or five inks (teal, coral, mustard, deep navy, cream), clean geometric silhouettes, soft halftone grain",
    suits: "science fiction: space, planets, robots, future cities, machines",
  },
  watercolor: {
    paint: "Luminous watercolor with a fine ink line: loose washes that bleed softly, glowing light, a few rich colors on textured cold-press paper",
    suits: "epic fantasy and myth: gods, legends, magic, dragons, spirits, sky islands",
  },
};

/**
 * What every painting keeps whatever its style: a card is small, so one clear subject on a quiet
 * ground (the first woodcut and engraving samples, busy with whole scenes, blurred at card size),
 * and no lettering, which the painter otherwise adds. Where the subject stands and how near it is
 * are left to each card's picture: always in the middle, every card looked alike.
 */
const COMPOSITION = "one clear subject, readable at a small size, an uncluttered background, no text, no letters, no numbers, no border, no frame";

const styleWords = (style: ArtStyle) => `${ART_STYLES[style].paint}, ${COMPOSITION}`;

/** The storybook style, which painted boards and every deck painted before styles were chosen share. */
export const HOUSE_STYLE = styleWords("storybook");

const CONCURRENCY = 4;

export interface ArtCard {
  title: string;
  text?: string;
  tags?: string[];
}

export interface ArtRequest {
  game: string;
  summary: string;
  cards: ArtCard[];
  /** The game's play mode and family, which help pick its style. */
  mode?: string;
  family?: string;
}

/** Card title to file name in the game's art folder. */
export type Manifest = Record<string, string>;

const safeId = (id: string) => /^[a-z0-9-]+$/.test(id);
const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50) || "card";

function folder(gameId: string): URL {
  if (!safeId(gameId)) throw new Error(`bad game id: ${gameId}`);
  return new URL(`${gameId}/`, ROOT);
}

export function readManifest(gameId: string): Manifest {
  const file = new URL("manifest.json", folder(gameId));
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Manifest) : {};
}

/** The style a game's cards are painted in; a deck painted before styles were chosen is storybook. */
export function readStyle(gameId: string): ArtStyle | undefined {
  const file = new URL("style.json", folder(gameId));
  if (!existsSync(file)) return Object.keys(readManifest(gameId)).length > 0 ? "storybook" : undefined;
  const { style } = JSON.parse(readFileSync(file, "utf8")) as { style?: string };
  return style && style in ART_STYLES ? (style as ArtStyle) : "storybook";
}

/**
 * A style for a game from words in its name and summary, for when the style picker cannot be asked:
 * secrets and danger as a woodcut, space as a poster, myth as watercolor, trade and voyages as an
 * engraving, anything else as a storybook.
 */
export function styleByWords(req: Pick<ArtRequest, "game" | "summary" | "mode" | "family">): ArtStyle {
  const words = `${req.game} ${req.summary}`.toLowerCase();
  if (req.mode === "hidden-role" || req.family === "bluff") return "woodcut";
  if (/\b(space|planet|orbit|galax|star ?ship|rocket|robot|android|cyber|asteroid|alien)/.test(words)) return "poster";
  if (/\b(dragon|myth|god|goddess|legend|wizard|magic|spirit|giant|titan|oracle|sky island)/.test(words)) return "watercolor";
  if (/\b(smuggl|spy|spies|heist|thief|thieves|murder|betray|traitor|saboteur|haunt|crime|war\b|siege)/.test(words)) return "woodcut";
  if (/\b(merchant|trade|trading|voyage|guild|empire|expedition|explor|caravan|harbou?r|charter|royal|century)/.test(words)) return "engraving";
  return "storybook";
}

/** Card title to the picture its painting shows (cardScenes). */
export type Scenes = Record<string, string>;

export function readScenes(gameId: string): Scenes {
  const file = new URL("scenes.json", folder(gameId));
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as Scenes) : {};
}

/**
 * What each card's painting shows, written by Muse Spark for the whole deck at once so the cards can
 * be told apart. Painted from its title and the game's summary alone, every card of Farlight Reefs
 * came out as the same keeper crouched by a barrel on the shore: the summary outweighed a title like
 * "Deep to Gullrest". Cards that share a word share what it names (every wreck card shows a wreck)
 * and differ by the rest. An empty answer when the call fails: the cards are then painted from their
 * titles, as before.
 */
export async function cardScenes(llm: Pick<ModelClient, "chatJson">, req: ArtRequest, style: ArtStyle): Promise<Scenes> {
  const cards = [...new Map(req.cards.map((c) => [c.title, c])).values()];
  if (cards.length === 0) return {};
  try {
    const { scenes } = await llm.chatJson<{ scenes: { title: string; picture: string }[] }>(
      [
        {
          role: "system",
          content: [
            "You art-direct the paintings on a board game's cards. Each card gets one painting, and players must tell the cards apart at a glance by their pictures.",
            "For every card, write the one picture it shows, in at most 30 words: a concrete subject, where it is, and how near we are.",
            "- Show what the card's title names. Cards whose titles share a word all show that thing (every 'Wreck ...' card shows a wreck), and the rest of the title (a place, a person, a good) makes each one different.",
            "- Vary the deck: people at work, animals, objects up close, buildings and places, weather and events; close-ups, middle views and wide views; dawn, day, dusk, night and storm.",
            "- No two pictures share a subject or a composition, and no person appears in more than two.",
            "- Nothing written anywhere in a picture: no signs, letters, numbers or labels.",
            "- Keep every picture fit for all ages: a struggle or a danger is shown by its moment (a storm, a chase, a standoff), never by blood, wounds, bodies or a weapon striking.",
            `- Stay in the game's world and period. The cards are painted as: ${ART_STYLES[style].paint}.`,
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({
            game: req.game,
            summary: req.summary,
            cards: cards.map(({ title, tags, text }) => ({ title, tags, text: text?.slice(0, 200) })),
          }),
        },
      ],
      {
        name: "CardScenes",
        schema: {
          type: "object",
          properties: {
            scenes: {
              type: "array",
              items: { type: "object", properties: { title: { type: "string" }, picture: { type: "string" } }, required: ["title", "picture"], additionalProperties: false },
            },
          },
          required: ["scenes"],
          additionalProperties: false,
        },
      },
      { reasoningEffort: "low" },
    );
    const titles = new Set(cards.map((c) => c.title));
    return Object.fromEntries(scenes.filter((s) => titles.has(s.title) && s.picture.trim()).map((s) => [s.title, s.picture.trim()]));
  } catch (err) {
    console.warn(`[art] scenes: ${err instanceof Error ? err.message : String(err)}`);
    return {};
  }
}

/**
 * How a deck's paintings are planned: the style for the whole deck, and each card's picture. Muse
 * Spark plans them (plannerFrom); without it, words pick the style and cards are painted from their
 * titles.
 */
export interface DeckPlanner {
  style(req: ArtRequest): Promise<ArtStyle>;
  scenes(req: ArtRequest, style: ArtStyle): Promise<Scenes>;
}

export const plannerFrom = (llm: Pick<ModelClient, "chatJson">): DeckPlanner => ({
  style: (req) => chooseStyle(llm, req),
  scenes: (req, style) => cardScenes(llm, req, style),
});

const byWords: DeckPlanner = { style: async (req) => styleByWords(req), scenes: async () => ({}) };

/** Muse Spark picks the style that suits a game; words decide when it cannot be asked. */
export async function chooseStyle(llm: Pick<ModelClient, "chatJson">, req: ArtRequest): Promise<ArtStyle> {
  const styles = Object.keys(ART_STYLES) as ArtStyle[];
  try {
    const { style } = await llm.chatJson<{ style: string }>(
      [
        {
          role: "system",
          content: `You choose the illustration style for a board game's cards. The styles, with the games each suits:\n${styles.map((s) => `- ${s}: ${ART_STYLES[s].suits}`).join("\n")}\nPick the one that suits the game's world and mood best.`,
        },
        { role: "user", content: JSON.stringify({ game: req.game, summary: req.summary, mode: req.mode, family: req.family }) },
      ],
      { name: "ArtStyle", schema: { type: "object", properties: { style: { type: "string", enum: styles } }, required: ["style"], additionalProperties: false } },
      { reasoningEffort: "low" },
    );
    if (styles.includes(style as ArtStyle)) return style as ArtStyle;
  } catch (err) {
    console.warn(`[art] style: ${err instanceof Error ? err.message : String(err)}`);
  }
  return styleByWords(req);
}

export function artFile(gameId: string, name: string): Buffer | undefined {
  if (!/^[a-z0-9-]+\.(webp|png|jpeg)$/.test(name)) return undefined;
  const file = new URL(name, folder(gameId));
  return existsSync(file) ? readFileSync(file) : undefined;
}

/**
 * What a card's painting shows: its picture (cardScenes), or else its subject as a scene or a
 * character from the game's world. Given as "Name (tags): an illustration for this card", the
 * painter letters the name across the top; told it is "a card", it paints cards and maps. So the
 * subject is described, never framed.
 */
export function subjectFor(req: ArtRequest, card: ArtCard, scene?: string): string {
  const never = "never as a playing card, a game board, a map or a diagram. The picture carries no caption, title, name, label or lettering of any kind";
  if (scene) return `An illustration from the world of ${req.game}: ${scene.replace(/\.$/, "")}. Paint it as one scene; ${never}`;
  const tags = card.tags?.length ? ` (${card.tags.join(", ").toLowerCase()})` : "";
  return `An illustration of ${card.title}${tags} from the world of ${req.game}, where ${req.summary.replace(/\.$/, "")}. Show it as one scene, a character at work or an object in its place; ${never}`;
}

interface ImageReply {
  data?: { b64_json?: string }[];
  output_format?: string;
}

async function paint(client: ModelClient, model: string, subject: string, style: ArtStyle, anchor?: string): Promise<{ bytes: Buffer; format: string }> {
  const common = { model, n: 1, size: "1536x1024", reasoning_strength: "low" };
  const reply = (
    anchor
      ? await client.post("/images/edits", {
          ...common,
          prompt: `Paint a new, completely different illustration in exactly the same art style as the reference image (its drawing technique, line, palette and paper texture): ${subject}. Take only the style from the reference: none of its figures, objects, setting or composition. ${styleWords(style)}.`,
          images: [{ image_url: anchor }],
        })
      : await client.post("/images/generations", { ...common, prompt: `${subject}. ${styleWords(style)}.` })
  ) as ImageReply;
  const b64 = reply.data?.[0]?.b64_json;
  if (!b64) throw new Error("Muse Image returned no image");
  return { bytes: Buffer.from(b64, "base64"), format: reply.output_format ?? "webp" };
}

/**
 * Paints every card that has no art yet and reports each finished card. A deck's first painting
 * picks its style, kept in style.json for the cards painted later, and the pictures of the cards
 * still to paint, kept in scenes.json (`planner`). Cards that fail (for example a safety filter) are
 * skipped, so one bad card never blocks the deck.
 */
export async function paintDeck(
  client: ModelClient,
  model: string,
  gameId: string,
  req: ArtRequest,
  onCard: (title: string, file: string) => void,
  planner: DeckPlanner = byWords,
): Promise<Manifest> {
  const dir = folder(gameId);
  mkdirSync(dir, { recursive: true });
  const manifest = readManifest(gameId);
  let style = readStyle(gameId);
  if (!style) {
    style = await planner.style(req);
    writeFileSync(new URL("style.json", dir), JSON.stringify({ style }) + "\n");
  }
  const save = () => writeFileSync(new URL("manifest.json", dir), JSON.stringify(manifest, null, 2) + "\n");
  const unique = [...new Map(req.cards.map((c) => [c.title, c])).values()];
  const todo = unique.filter((c) => !manifest[c.title]);
  // Pictures for the cards still to paint, written with the whole deck in view.
  let scenes = readScenes(gameId);
  if (todo.some((c) => !scenes[c.title])) {
    const fresh = await planner.scenes(req, style);
    scenes = { ...fresh, ...Object.fromEntries(Object.entries(scenes).filter(([title]) => manifest[title])) };
    if (Object.keys(fresh).length > 0) writeFileSync(new URL("scenes.json", dir), JSON.stringify(scenes, null, 2) + "\n");
  }

  const store = (card: ArtCard, image: { bytes: Buffer; format: string }) => {
    // Named for its content too: paintings are served to be cached for good, so a card painted again
    // under its old name kept showing the old picture.
    const name = `${slug(card.title)}-${createHash("sha1").update(image.bytes).digest("hex").slice(0, 8)}.${image.format}`;
    writeFileSync(new URL(name, dir), image.bytes);
    manifest[card.title] = name;
    save();
    onCard(card.title, name);
  };

  // The style anchor: an existing painting, or the first card painted from the house style alone.
  const existing = Object.values(manifest)[0];
  let anchor: string | undefined;
  if (existing) {
    const format = existing.split(".").pop();
    anchor = `data:image/${format};base64,${readFileSync(new URL(existing, dir)).toString("base64")}`;
  } else {
    // The first card the painter accepts sets the look: Galebound Mutiny's first picture was turned
    // down by the content filter, and the whole deck with it.
    while (!anchor && todo.length > 0) {
      const first = todo.shift()!;
      try {
        const image = await paint(client, model, subjectFor(req, first, scenes[first.title]), style);
        store(first, image);
        anchor = `data:image/${image.format};base64,${image.bytes.toString("base64")}`;
      } catch (err) {
        console.warn(`[art] ${first.title}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < todo.length) {
        const card = todo[next++];
        try {
          store(card, await paint(client, model, subjectFor(req, card, scenes[card.title]), style, anchor));
        } catch (err) {
          console.warn(`[art] ${card.title}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }),
  );
  return manifest;
}

/** What painting a game's deck asks for: its name, summary, mode and family, and every card it shows. */
export function deckRequest(game: GameModule): ArtRequest {
  return {
    game: game.meta.name,
    summary: game.meta.summary,
    mode: game.meta.mode,
    family: game.meta.family,
    cards: collectCards(game).map(({ title, text, tags }) => ({ title, text, tags })),
  };
}

/**
 * Paints a new game's whole deck in the background, as its cover is, so a game opens with its cards
 * painted rather than waiting for the art panel's button. Cards that fail are tried once more.
 */
export function paintDeckLater(client: ModelClient, model: string, gameId: string, req: ArtRequest, planner: DeckPlanner): void {
  if (req.cards.length === 0) return;
  const run = () => paintDeck(client, model, gameId, req, () => {}, planner);
  run()
    .then((manifest) => (req.cards.some((c) => !manifest[c.title]) ? run() : manifest))
    .catch((err: unknown) => console.warn(`[art] ${gameId}: ${err instanceof Error ? err.message : String(err)}`));
}
