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
 * figures, golden backlight, fine hatching, a deckled paper edge. That reads as machine-made. A
 * hobby box cover reads as drawn by hand: a few large figures, flat colour, one ink weight, calm
 * empty space. The author then found even three figures with their tools and crates too busy to
 * take in at a glance, so a cover holds at most five things.
 */
export const COVER_STYLE =
  "Flat graphic illustration with the hand-drawn look of a modern hobby board game box: bold dark-brown ink outlines of one even weight; big simple shapes with clean silhouettes and slightly chunky, whimsical proportions; flat colour fills with at most one hard-edged shadow tone per colour; a limited palette of about five colours (warm cream, ochre, rust red, moss green, slate blue) with one bright accent; very few elements, at most five things in the whole picture, each large and easy to read; a background of two or three plain flat colour bands with wide empty areas; no gradients, no glow, no sunbeams or backlight, no airbrushing, no crowds, no props scattered around, no clutter, no fine hatching or texture lines, no photorealism; matte paper with a faint grain";

/**
 * What the cover shows: a scene from the game's world, never the game's own parts. Told it paints
 * a "box cover", the painter letters a title on it; told about boards and cards, it paints them. So
 * the subject is described as a scene, and lettering of every kind is ruled out. Its people are
 * people: animals in clothes would read as another game's woodland factions.
 */
export function coverPrompt(req: CoverRequest): string {
  const world = req.summary.trim().replace(/\.$/, "");
  return [
    `A wide illustration of the world of ${req.game}: ${world}.`,
    "Show one simple moment from that world: one or two of its people (humans, not animals in clothes) with the one object that matters most to them, large in the foreground, and the place reduced to a simple silhouette behind them.",
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
    prompt: coverPrompt(req),
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
