// Lines up saved painted boards (data/art/<game>/board.png) with their games' tiles (register.ts),
// without calling any model. The painting as it was is kept as board-unaligned.png.
//
//   npx tsx apps/server/src/art/realign.ts [--dry] [game ...]
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRng, fitBounds, resolveParams, sampleSeats, type GameModule, type Geometry } from "@boarddream/engine";
import { demoGames, fixtureGames, referenceGames } from "@boarddream/library";
import { loadGameFromSource } from "../sandbox";
import { lineUp, type BoardReport } from "./board";

const ROOT = new URL("../../../../data/art/", import.meta.url);
const GAMES = new URL("../../../../data/games/", import.meta.url);
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const games = args.filter((a) => a !== "--dry");
const library = new Map([...demoGames, ...referenceGames, ...fixtureGames].map((g) => [g.meta.id, g]));

/** The game's board as it is first laid out, as the web sends it to be painted (startingGeometry in apps/web/src/art.ts). */
function geometryOf(id: string): Geometry | undefined {
  const source = new URL(`${id}.js`, GAMES);
  const game: GameModule | undefined = library.get(id) ?? (existsSync(source) ? loadGameFromSource(readFileSync(source, "utf8")) : undefined);
  const geometry = game?.geometry?.(game.setup({ numPlayers: sampleSeats(game), params: resolveParams(game.params), rng: createRng(1) }));
  return geometry && fitBounds(geometry);
}

for (const game of games.length ? games : readdirSync(ROOT)) {
  const [png, json] = [new URL(`${game}/board.png`, ROOT), new URL(`${game}/board.json`, ROOT)];
  if (!existsSync(png) || !existsSync(json)) continue;
  const report = JSON.parse(readFileSync(json, "utf8")) as BoardReport;
  const geometry = geometryOf(game);
  if (!geometry || Math.abs(geometry.width - report.width) > 1e-6 || Math.abs(geometry.height - report.height) > 1e-6) {
    console.log(`${game}: no board of the painted size to line up with`);
    continue;
  }
  const { png: lined, registration: r } = lineUp(readFileSync(png), geometry);
  const moved = r.scaleX !== 1 || r.scaleY !== 1 || r.shiftX !== 0 || r.shiftY !== 0;
  console.log(
    `${game}: ${moved ? `shifted ${r.shiftX.toFixed(3)}, ${r.shiftY.toFixed(3)} units, stretched ${r.scaleX.toFixed(3)} × ${r.scaleY.toFixed(3)}` : "already lined up"} (fit ${r.before.toFixed(2)} → ${r.after.toFixed(2)})`,
  );
  if (dry || !moved) continue;
  copyFileSync(png, new URL(`${game}/board-unaligned.png`, ROOT));
  writeFileSync(png, lined);
  writeFileSync(json, JSON.stringify({ ...report, registration: r }, null, 2) + "\n");
}
