import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import type { ModelClient } from "../meta/client";

/**
 * Box covers from Muse Image: one wide painting per game of its world, in the house style, so a
 * shelf of games shows what each is about instead of how its board is laid out. Saved as
 * data/art/<game id>/cover.<format>.
 */

const ROOT = new URL("../../../../data/art/", import.meta.url);
const COVER = /^cover\.(webp|png|jpeg)$/;

export interface CoverRequest {
  /** The game's name. */
  game: string;
  /** Its one-sentence pitch. */
  summary: string;
}

const safeId = (id: string) => /^[a-z0-9-]+$/.test(id);

/**
 * How a cover is drawn. The storybook house style alone came back busy and glowing: crowds of tiny
 * figures, golden backlight, fine hatching, a deckled paper edge, which read as machine-made. A
 * flat graphic style with at most five things then read as too empty. The author asked for the
 * warm, hand-painted look of classic animated fantasy films; the prompt describes its qualities
 * rather than naming a studio: painted backgrounds, soft daylight, lush nature, simple clean
 * figures, and a handful of things to look at.
 */
export const COVER_STYLE =
  "Hand-painted illustration with the warm look of a classic hand-drawn animated fantasy film: soft watercolour and gouache backgrounds with visible brush texture; lush, gently detailed nature (grass, trees, water, big cumulus clouds in a clear sky); calm, soft natural daylight with soft shadows, no dramatic backlight, no glow or lens flare; characters drawn with clean simple linework and soft cel shading, with friendly, natural faces and relaxed everyday poses; a gentle palette of fresh greens, sky blues, warm creams and earthy browns; a moderate amount of detail: two or three people, a few objects that show what they do, and a clear landscape with a few landmarks, but no crowds and no clutter; a cozy, hopeful mood";

/**
 * Framings, one per game (by its id), so a shelf of covers is not the same three figures in the
 * middle every time.
 */
export const COMPOSITIONS = [
  "a wide view of the landscape, the people small in the middle distance",
  "one person close up in the foreground, looking out over the landscape where the others work",
  "the people seen from behind, walking toward the landmark",
  "a view from above, looking down on the people at work",
  "two people facing each other across their work, the landscape between them",
  "the people at work on the left, the landscape opening wide to the right",
];

/** A game's framing: the same every time it is painted. */
export const compositionFor = (gameId: string) => [...gameId].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % COMPOSITIONS.length;

/**
 * What the cover shows: a scene from the game's world, never the game's own parts. Told it paints
 * a "box cover", the painter letters a title on it; told about boards and cards, it paints them. So
 * the subject is described as a scene, and lettering of every kind is ruled out. Its people are
 * people: animals in clothes would read as another game's woodland factions.
 */
export function coverPrompt(req: CoverRequest, composition = 0): string {
  const world = req.summary.trim().replace(/\.$/, "");
  return [
    `A wide illustration of the world of ${req.game}: ${world}.`,
    "Show one quiet moment from that world: two or three of its people (humans, not animals in clothes) busy with what they do, with a few of the objects of their trade, in their landscape with one or two landmarks.",
    `Composition: ${COMPOSITIONS[composition % COMPOSITIONS.length]}.`,
    "The picture fills the whole frame edge to edge, with no paper margin, border or frame.",
    "Never a game board, a map, playing cards, tokens or a diagram.",
    "The picture carries no title, caption, logo, lettering, numbers or signs of any kind.",
    `${COVER_STYLE}.`,
  ].join(" ");
}

interface ImageReply {
  data?: { b64_json?: string }[];
  output_format?: string;
}

/** The game's cover file name, if it has one. */
export function coverFile(gameId: string): string | undefined {
  if (!safeId(gameId)) return undefined;
  const dir = new URL(`${gameId}/`, ROOT);
  if (!existsSync(dir)) return undefined;
  return readdirSync(dir).find((name) => COVER.test(name));
}

/** Every game with a cover, as a URL the web app can show (versioned, since art is cached for good). */
export function listCovers(): Record<string, string> {
  if (!existsSync(ROOT)) return {};
  const covers: Record<string, string> = {};
  for (const id of readdirSync(ROOT)) {
    const file = coverFile(id);
    if (!file) continue;
    const version = Math.round(statSync(new URL(`${id}/${file}`, ROOT)).mtimeMs).toString(36);
    covers[id] = `/api/art/${id}/${file}?v=${version}`;
  }
  return covers;
}

/** Paints a game's cover, replacing any earlier one, and returns its file name. */
export async function paintCover(client: ModelClient, model: string, gameId: string, req: CoverRequest): Promise<string> {
  if (!safeId(gameId)) throw new Error(`bad game id: ${gameId}`);
  const reply = (await client.post("/images/generations", {
    model,
    n: 1,
    size: "1536x1024",
    reasoning_strength: "low",
    prompt: coverPrompt(req, compositionFor(gameId)),
  })) as ImageReply;
  const b64 = reply.data?.[0]?.b64_json;
  if (!b64) throw new Error("Muse Image returned no image");
  const format = reply.output_format ?? "webp";
  const dir = new URL(`${gameId}/`, ROOT);
  mkdirSync(dir, { recursive: true });
  for (const old of readdirSync(dir).filter((name) => COVER.test(name))) unlinkSync(new URL(old, dir));
  const name = `cover.${format}`;
  writeFileSync(new URL(name, dir), Buffer.from(b64, "base64"));
  return name;
}

/** A revised game keeps the cover of the game it revises; false when that game has none. */
export function copyCover(fromId: string, toId: string): boolean {
  const file = coverFile(fromId);
  if (!file || !safeId(toId)) return false;
  const dir = new URL(`${toId}/`, ROOT);
  mkdirSync(dir, { recursive: true });
  copyFileSync(new URL(`${fromId}/${file}`, ROOT), new URL(file, dir));
  return true;
}

/**
 * Paints a cover in the background, for a game just saved: the game is playable at once and its
 * cover turns up on the shelf when ready. A failure only costs the cover.
 */
export function paintCoverLater(client: ModelClient, model: string, gameId: string, req: CoverRequest): void {
  paintCover(client, model, gameId, req).catch((err: unknown) => console.warn(`[cover] ${gameId}: ${err instanceof Error ? err.message : String(err)}`));
}
