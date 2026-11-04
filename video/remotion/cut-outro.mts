/**
 * The closing group photo's pieces, cut from the takes as stills (public/outro/*.png): one for each
 * thing the film shows, at the moment of the take it is shown. Regions are in the page's 1920 x
 * 1080 pixels; the takes are 2560 x 1440. Rerun after the takes are recorded again.
 *   FFMPEG=<ffmpeg> npx tsx cut-outro.mts
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, "public");
const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
const film = JSON.parse(readFileSync(path.join(pub, "footage", "film.json"), "utf8")) as { marks: { label: string; t: number }[] };
const at = (label: string, plus = 0) => {
  const m = film.marks.find((x) => x.label === label);
  if (!m) throw new Error(`no mark ${label} in film.json`);
  return m.t + plus;
};
const merge = JSON.parse(readFileSync(path.join(pub, "footage", "merge.json"), "utf8")) as { marks: { label: string; t: number }[] };
const S = 2560 / 1920;

type Piece = { name: string; src: string; t: number; x: number; y: number; w: number; h: number };
const PIECES: Piece[] = [
  { name: "idea", src: "film.mp4", t: at("idea", -0.3), x: 618, y: 380, w: 690, h: 150 },
  { name: "making", src: "film.mp4", t: at("ready", -20), x: 12, y: 50, w: 226, h: 446 },
  { name: "rivals", src: "film.mp4", t: at("rules", -6), x: 790, y: 1018, w: 340, h: 52 },
  { name: "versions", src: "film.mp4", t: at("version-two", -2), x: 1664, y: 376, w: 244, h: 254 },
  { name: "balance", src: "film.mp4", t: at("balance-ready", 2), x: 1664, y: 162, w: 244, h: 276 },
  { name: "table", src: "film.mp4", t: at("print", -1), x: 330, y: 150, w: 1100, h: 640 },
  { name: "home", src: "film.mp4", t: at("idea", -6), x: 0, y: 0, w: 1920, h: 1080 },
  { name: "mochi", src: "merge.mp4", t: (merge.marks.find((m) => m.label === "merge")?.t ?? 2.5) + 1.5, x: 494, y: 942, w: 526, h: 124 },
];

mkdirSync(path.join(pub, "outro"), { recursive: true });
for (const p of PIECES) {
  const crop = `crop=${Math.round(p.w * S)}:${Math.round(p.h * S)}:${Math.round(p.x * S)}:${Math.round(p.y * S)}`;
  const out = path.join(pub, "outro", `${p.name}.png`);
  const r = spawnSync(ffmpeg, ["-hide_banner", "-v", "error", "-y", "-ss", p.t.toFixed(3), "-i", path.join(pub, "footage", p.src), "-frames:v", "1", "-vf", crop, out], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg failed on ${p.name}`);
  console.log(`${p.name}: ${p.src} @ ${p.t.toFixed(2)} s`);
}
