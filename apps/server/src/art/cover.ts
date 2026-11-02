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
 * rather than naming a studio. It once also asked for lush grass, a river and cumulus clouds, and
 * every world, an undercity and an orbit among them, came back as the same green meadow. Told
 * instead to avoid green, with a list of places to choose from and "loving detail", it painted
 * brown canyons crammed with things. So the game's own words pick the place, and the picture stays
 * light, open and simple.
 */
export const COVER_STYLE =
  "Hand-painted illustration with the warm look of a classic hand-drawn animated fantasy film: soft watercolour and gouache with visible brush texture; simple, readable shapes and generous open space (open sky, water or open ground) so the picture reads at a glance; a fresh, light palette that suits the place (sky blues, creams and the place's own colours), never muddy or brown all over; calm, natural light with soft shadows, no dramatic backlight, no glow or lens flare; characters drawn with clean simple linework and soft cel shading, with friendly, natural faces and relaxed everyday poses; a moderate amount of detail: a few objects that show what the people do and one or two landmarks, but no crowds and no clutter; a cozy, hopeful mood";

/**
 * Framings, one per game, so a shelf of covers is not the same scene over and over. None is a
 * close-up of one person: asked for one, the painter drew the same young woman's head at the left
 * edge of every such cover.
 */
export const COMPOSITIONS = [
  "a wide view of the setting, the people small in the middle distance",
  "one or two objects of their trade large and close in the foreground, the people at work a little way beyond them",
  "the people seen from behind, walking toward the landmark",
  "a view from above, looking down on the people at work",
  "two people facing each other across their work, seen side-on from a few steps away",
  "the landmark tall in the middle of the picture, the people small at its foot",
  "the scene seen through an opening in the foreground (a doorway, an arch, a window or overhanging branches), the people beyond it",
  "the people at work on the right, the setting opening wide to the left",
];

/** The light and the time of year, where the setting has them; varied for the same reason. */
export const LIGHTS = [
  "a clear spring morning",
  "a bright, still midsummer noon",
  "a mild early-autumn afternoon, a few leaves turning",
  "a soft grey overcast day",
  "a fresh morning just after rain",
  "a bright winter day with a light dusting of snow",
  "the blue hour after sunset, the first lamps lit (soft light, no glare)",
];

/** People of every sort: left to itself the painter drew the same young brown-haired woman. */
const PEOPLE =
  "two or three of its people (humans, not animals in clothes), varied in age, build, skin tone and hair, men and women, busy with what they do; nobody's face fills the frame, and the people take up no more than a third of the picture";

export interface CoverLook {
  composition: number;
  light: number;
}

/**
 * FNV-1a with a final mix. A plain h * 31 + c gave two seeds a constant difference for ids of the
 * same length, so a game's framing decided its light.
 */
function hash(text: string, seed: number): number {
  let h = (0x811c9dc5 ^ seed) >>> 0;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  return h >>> 0;
}

/** A game's framing and light: the same every time it is painted, and independent of each other. */
export const lookFor = (gameId: string): CoverLook => ({
  composition: hash(gameId, 1) % COMPOSITIONS.length,
  light: hash(gameId, 2) % LIGHTS.length,
});

/**
 * What the cover shows: a scene from the game's world, never the game's own parts. Told it paints
 * a "box cover", the painter letters a title on it; told about boards and cards, it paints them. So
 * the subject is described as a scene, and lettering of every kind is ruled out. Its people are
 * people: animals in clothes would read as another game's woodland factions.
 */
export function coverPrompt(req: CoverRequest, look: CoverLook = { composition: 0, light: 0 }): string {
  const world = req.summary.trim().replace(/\.$/, "");
  return [
    `A wide illustration of the world of ${req.game}: ${world}.`,
    "Set it in the place that world's own words describe, with that place's landscape, buildings and colours; a green meadow only when the world is one.",
    `Show one quiet moment there: ${PEOPLE}, with a few of the objects of their trade and one or two landmarks.`,
    `Composition: ${COMPOSITIONS[look.composition % COMPOSITIONS.length]}.`,
    `Light: ${LIGHTS[look.light % LIGHTS.length]}, where the setting has daylight and seasons.`,
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
    prompt: coverPrompt(req, lookFor(gameId)),
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
