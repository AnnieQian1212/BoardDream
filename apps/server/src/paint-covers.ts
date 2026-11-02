// Paints a box cover (Muse Image) for every game that has none: the reference games and the games
// saved under data/games. The reference games' covers are then copied into the web app
// (apps/web/public/covers), so a static deployment with no server shows them too. Muse Image paints
// at 1920x1280 whatever size is asked for; the copies shipped there were then scaled to 960 px wide
// (about 170 KB each) with an image tool, which is worth redoing after a repaint: only a cover
// painted in this run, or one not shipped yet, replaces the shipped copy.
//
//   npm run covers                  paint what is missing, then bundle
//   npm run covers -- lantern-isles paint only these games (repainting them), then bundle
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { referenceGames } from "@boarddream/library";
import { coverFile, paintCover, type CoverRequest } from "./art/cover";
import { config } from "./config";
import { ModelClient } from "./meta/client";
import { listGames } from "./store";

const ART = new URL("../../../data/art/", import.meta.url);
const BUNDLE = new URL("../../web/public/covers/", import.meta.url);
const CONCURRENCY = 3;

if (!config.meta.apiKey) {
  console.error("MODEL_API_KEY is not set; copy .env.example to .env");
  process.exit(1);
}
const painter = new ModelClient({ ...config.meta, model: config.models.image });

const games: (CoverRequest & { id: string })[] = [
  ...referenceGames.map((g) => ({ id: g.meta.id, game: g.meta.name, summary: g.meta.summary })),
  ...listGames().map((g) => ({ id: g.id, game: g.title.replace(/ \(revised(?: \d+)?\)$/, ""), summary: g.pitch })),
];
const only = process.argv.slice(2);
const todo = only.length > 0 ? games.filter((g) => only.includes(g.id)) : games.filter((g) => !coverFile(g.id));
console.log(`${todo.length} cover${todo.length === 1 ? "" : "s"} to paint`);

const painted = new Set<string>();
let next = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    while (next < todo.length) {
      const game = todo[next++];
      const started = Date.now();
      try {
        const file = await paintCover(painter, config.models.image, game.id, game);
        painted.add(game.id);
        console.log(`${game.id}: ${file} in ${((Date.now() - started) / 1000).toFixed(0)} s`);
      } catch (err) {
        console.warn(`${game.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }),
);

// The reference games' covers ship with the web app.
mkdirSync(BUNDLE, { recursive: true });
const INDEX = new URL("index.json", BUNDLE);
const index = (existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, "utf8")) : {}) as Record<string, string>;
for (const game of referenceGames) {
  const file = coverFile(game.meta.id);
  if (!file) continue;
  const name = `${game.meta.id}.${file.split(".").pop()}`;
  if (painted.has(game.meta.id) || !existsSync(new URL(name, BUNDLE))) copyFileSync(new URL(`${game.meta.id}/${file}`, ART), new URL(name, BUNDLE));
  index[game.meta.id] = name;
}
writeFileSync(INDEX, JSON.stringify(index, null, 2) + "\n");
console.log(`bundled ${Object.keys(index).length} reference covers`);
