import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { ModelClient } from "../meta/client";

/**
 * Card illustrations from Muse Image, in a style chosen for the game: a cozy game as a storybook, a
 * game of secrets as a woodcut, a voyage of trade as a copper engraving, a space game as a retro
 * poster, a myth in watercolor. The first card sets the look; every later card is painted with that
 * first image as a style reference, so a whole deck reads as one illustrated set. Images are saved
 * under data/art/<game id>/ with a manifest from card title to file, and the style in style.json.
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
 * and no lettering, which the painter otherwise adds.
 */
const COMPOSITION =
  "one clear subject in the middle with breathing room and a simple background, readable at a small size, no text, no letters, no numbers, no border, no frame";

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

/** What to paint for one card: its name, in the game's world, without any rules text. */
/**
 * What a card's painting shows: its subject as a scene or a character from the game's world. Given
 * as "Name (tags): an illustration for this card", the painter letters the name across the top;
 * told it is "a card", it paints cards and maps. So the subject is described, never framed.
 */
export function subjectFor(req: ArtRequest, card: ArtCard): string {
  const tags = card.tags?.length ? ` (${card.tags.join(", ").toLowerCase()})` : "";
  return `An illustration of ${card.title}${tags} from the world of ${req.game}, where ${req.summary.replace(/\.$/, "")}. Show it as one scene, a character at work or an object in its place; never as a playing card, a game board, a map or a diagram. The picture carries no caption, title, name, label or lettering of any kind`;
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
          prompt: `Paint a new illustration in exactly the same art style, palette and paper texture as the reference image: ${subject}. ${styleWords(style)}.`,
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
 * picks its style (`choose`), kept in style.json for the cards painted later. Cards that fail (for
 * example a safety filter) are skipped, so one bad card never blocks the deck.
 */
export async function paintDeck(
  client: ModelClient,
  model: string,
  gameId: string,
  req: ArtRequest,
  onCard: (title: string, file: string) => void,
  choose: (req: ArtRequest) => Promise<ArtStyle> = async (r) => styleByWords(r),
): Promise<Manifest> {
  const dir = folder(gameId);
  mkdirSync(dir, { recursive: true });
  const manifest = readManifest(gameId);
  let style = readStyle(gameId);
  if (!style) {
    style = await choose(req);
    writeFileSync(new URL("style.json", dir), JSON.stringify({ style }) + "\n");
  }
  const save = () => writeFileSync(new URL("manifest.json", dir), JSON.stringify(manifest, null, 2) + "\n");
  const unique = [...new Map(req.cards.map((c) => [c.title, c])).values()];
  const todo = unique.filter((c) => !manifest[c.title]);

  const store = (card: ArtCard, image: { bytes: Buffer; format: string }) => {
    const name = `${slug(card.title)}.${image.format}`;
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
  } else if (todo.length > 0) {
    const first = todo.shift()!;
    const image = await paint(client, model, subjectFor(req, first), style);
    store(first, image);
    anchor = `data:image/${image.format};base64,${image.bytes.toString("base64")}`;
  }

  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < todo.length) {
        const card = todo[next++];
        try {
          store(card, await paint(client, model, subjectFor(req, card), style, anchor));
        } catch (err) {
          console.warn(`[art] ${card.title}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }),
  );
  return manifest;
}
