// Bundles generated games into the web app as its demo games (apps/web/src/demo-games), offered
// first, at once, and on a static deployment with no server too. They are listed in the order
// given, best first. Each game is fuzzed again first: one that breaks on the current engine does
// not ship.
//
//   npm run demo:games -- eval/generation/out/g05.js data/games/<id>.js ...
//
// A saved game keeps its id, so on a server that has it too the two are one game (listed once, with
// its art) and its painted cover can ship under the same name (npm run covers). A benchmark record
// has no id and is bundled under its title.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fuzz } from "@boarddream/engine";
import { loadGameFromSource } from "./sandbox";

interface BundledGame {
  id: string;
  title: string;
  rules?: string[];
  /** When it was made and from what idea, which the game's card in the library shows. */
  createdAt?: string;
  idea?: string;
}

const OUT = new URL("../../web/src/demo-games/", import.meta.url);
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
  const record = JSON.parse(readFileSync(path.replace(/\.js$/, ".json"), "utf8")) as {
    id?: string;
    createdAt?: string;
    idea?: string;
    spec: { title: string; rules?: string[] };
  };
  const report = fuzz(loadGameFromSource(source), { runs: 200 });
  if (!report.ok) {
    console.log(`${path}: skipped, ${report.failures[0]?.kind}: ${report.failures[0]?.message}`);
    continue;
  }
  const id = record.id && /^[a-z0-9-]+$/.test(record.id) ? record.id : slug(record.spec.title);
  writeFileSync(new URL(`${id}.js`, OUT), source);
  const entry: BundledGame = { id, title: record.spec.title, rules: record.spec.rules, createdAt: record.createdAt, idea: record.idea };
  index = [...index.filter((game) => game.id !== id), entry];
  console.log(`${path}: bundled as ${id}`);
}

writeFileSync(INDEX, JSON.stringify(index, null, 2) + "\n");
