// Rechecks saved painted boards (data/art/<game>/board.png) for tiles painted as the wrong
// terrain, without calling any model, and moves each to the kind its painting shows.
//
//   npx tsx apps/server/src/art/recheck.ts [--dry] [game ...]
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import type { BoardReport } from "./board";
import { relabelSources } from "./content";
import { decodePng } from "./png";

const ROOT = new URL("../../../../data/art/", import.meta.url);
const args = process.argv.slice(2);
const dry = args.includes("--dry");
const games = args.filter((a) => a !== "--dry");

for (const game of games.length ? games : readdirSync(ROOT)) {
  const [png, json] = [new URL(`${game}/board.png`, ROOT), new URL(`${game}/board.json`, ROOT)];
  if (!existsSync(png) || !existsSync(json)) continue;
  const report = JSON.parse(readFileSync(json, "utf8")) as BoardReport;
  const { sources, moved } = relabelSources(decodePng(readFileSync(png)), report.width, report.height, report.sources);
  for (const m of moved) console.log(`${game}: tile at (${m.at.map((v) => v.toFixed(2)).join(", ")}) is painted as ${m.to}, not ${m.from}`);
  if (moved.length === 0) console.log(`${game}: every tile shows its terrain`);
  if (dry || moved.length === 0) continue;
  writeFileSync(json, JSON.stringify({ ...report, sources, relabeled: [...(report.relabeled ?? []), ...moved] }, null, 2) + "\n");
}
