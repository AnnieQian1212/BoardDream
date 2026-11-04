/**
 * Writes the frames the film plays of the app's take (src/filmPlan.ts) out as one short clip,
 * public/footage/film-cut.mp4, frame for frame what the edit would take from the 20-minute take at
 * 60 fps; the edit then reads the clip (Short.tsx) while film-cut.json matches its plan.
 *   FFMPEG=<ffmpeg> npx tsx cut-film.mts
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PLAN, TAKE_SRC } from "./src/filmPlan";

const FPS = 60;
const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(here, "public");
const ffmpeg = process.env.FFMPEG ?? "ffmpeg";
const work = path.join(pub, "footage", "film-cut-parts");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });

const run = (args: string[]) => {
  const r = spawnSync(ffmpeg, ["-hide_banner", "-v", "error", "-y", ...args], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(" ")}`);
};

let start = 0;
const list: string[] = [];
PLAN.stretches.forEach((s, i) => {
  // The same frames as the edit's <Video trimBefore playbackRate> in a Sequence of these frames.
  const begin = start;
  start += s.seconds;
  const frames = Math.round(start * FPS) - Math.round(begin * FPS);
  const from = Math.round(s.from * FPS) / FPS;
  const out = path.join(work, `${String(i).padStart(2, "0")}.mp4`);
  console.log(`part ${i}: ${from.toFixed(2)} s at ${s.rate.toFixed(1)}x, ${frames} frames`);
  run(["-ss", String(from), "-i", path.join(pub, TAKE_SRC), "-an", "-vf", `setpts=(PTS-STARTPTS)/${s.rate},fps=${FPS}`, "-frames:v", String(frames), "-c:v", "libx264", "-preset", "veryfast", "-crf", "12", "-g", "30", "-pix_fmt", "yuv420p", out]);
  list.push(`file '${out.split("\\").join("/")}'`);
});
const listFile = path.join(work, "list.txt");
writeFileSync(listFile, list.join("\n") + "\n");
run(["-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", "-movflags", "+faststart", path.join(pub, "footage", "film-cut.mp4")]);
writeFileSync(path.join(pub, "footage", "film-cut.json"), JSON.stringify({ stretches: PLAN.stretches }, null, 2) + "\n");
rmSync(work, { recursive: true, force: true });
console.log(`wrote public/footage/film-cut.mp4 (${start.toFixed(2)} s)`);
