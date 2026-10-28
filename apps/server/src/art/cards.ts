import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { ModelClient } from "../meta/client";

/**
 * Card illustrations from Muse Image. The first card sets the look; every later card is painted
 * with that first image as a style reference, so a whole deck reads as one illustrated set.
 * Images are saved under data/art/<game id>/ with a manifest from card title to file.
 */

const ROOT = new URL("../../../../data/art/", import.meta.url);

/** The house style every deck shares, so generated games look like they belong to one product. */
export const HOUSE_STYLE =
  "Soft watercolor and fine ink illustration on warm cream paper, gentle muted palette, one centered subject with breathing room, light paper texture, no text, no letters, no numbers, no border, no frame";

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

export function artFile(gameId: string, name: string): Buffer | undefined {
  if (!/^[a-z0-9-]+\.(webp|png|jpeg)$/.test(name)) return undefined;
  const file = new URL(name, folder(gameId));
  return existsSync(file) ? readFileSync(file) : undefined;
}

/** What to paint for one card: its name, in the game's world, without any rules text. */
export function subjectFor(req: ArtRequest, card: ArtCard): string {
  const tags = card.tags?.length ? ` (${card.tags.join(", ")})` : "";
  return `${card.title}${tags}: an illustration for this card in "${req.game}", a board game where ${req.summary.replace(/\.$/, "")}`;
}

interface ImageReply {
  data?: { b64_json?: string }[];
  output_format?: string;
}

async function paint(client: ModelClient, model: string, subject: string, anchor?: string): Promise<{ bytes: Buffer; format: string }> {
  const common = { model, n: 1, size: "1536x1024", reasoning_strength: "low" };
  const reply = (
    anchor
      ? await client.post("/images/edits", {
          ...common,
          prompt: `Paint a new illustration in exactly the same art style, palette and paper texture as the reference image: ${subject}. ${HOUSE_STYLE}.`,
          images: [{ image_url: anchor }],
        })
      : await client.post("/images/generations", { ...common, prompt: `${subject}. ${HOUSE_STYLE}.` })
  ) as ImageReply;
  const b64 = reply.data?.[0]?.b64_json;
  if (!b64) throw new Error("Muse Image returned no image");
  return { bytes: Buffer.from(b64, "base64"), format: reply.output_format ?? "webp" };
}

/**
 * Paints every card that has no art yet and reports each finished card. Cards that fail (for
 * example a safety filter) are skipped, so one bad card never blocks the deck.
 */
export async function paintDeck(
  client: ModelClient,
  model: string,
  gameId: string,
  req: ArtRequest,
  onCard: (title: string, file: string) => void,
): Promise<Manifest> {
  const dir = folder(gameId);
  mkdirSync(dir, { recursive: true });
  const manifest = readManifest(gameId);
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
    const image = await paint(client, model, subjectFor(req, first));
    store(first, image);
    anchor = `data:image/${image.format};base64,${image.bytes.toString("base64")}`;
  }

  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < todo.length) {
        const card = todo[next++];
        try {
          store(card, await paint(client, model, subjectFor(req, card), anchor));
        } catch (err) {
          console.warn(`[art] ${card.title}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }),
  );
  return manifest;
}
