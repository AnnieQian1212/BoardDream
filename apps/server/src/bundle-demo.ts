// Bundles generated games into the web app (apps/web/public/demo-games), so a static deployment
// with no server can still offer them. Each game is fuzzed again first: one that breaks on the
// current engine does not ship.
//
//   npm run demo:games -- eval/generation/out/g05.js data/games/<id>.js ...
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fuzz } from "@boarddream/engine";
import { loadGameFromSource } from "./sandbox";

interface BundledGame {
  id: string;
  title: string;
  rules?: string[];
}

const OUT = new URL("../../web/public/demo-games/", import.meta.url);
const INDEX = new URL("index.json", OUT);

const slug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

mkdirSync(OUT, { recursive: true });
let index: BundledGame[] = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, "utf8")) : [];

for (const path of process.argv.slice(2)) {
  const source = readFileSync(path, "utf8");
  // Benchmark records and saved games both keep the designer's spec next to the rules.
  const { spec } = JSON.parse(readFileSync(path.replace(/\.js$/, ".json"), "utf8")) as { spec: { title: string; rules?: string[] } };
  const report = fuzz(loadGameFromSource(source), { runs: 200 });
  if (!report.ok) {
    console.log(`${path}: skipped, ${report.failures[0]?.kind}: ${report.failures[0]?.message}`);
    continue;
  }
  const id = slug(spec.title);
  writeFileSync(new URL(`${id}.js`, OUT), source);
  index = [...index.filter((game) => game.id !== id), { id, title: spec.title, rules: spec.rules }];
  console.log(`${path}: bundled as ${id}`);
}

writeFileSync(INDEX, JSON.stringify(index, null, 2) + "\n");
