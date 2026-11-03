// Renders single frames of the demo video to out/stills, to check a layout without a full render.
//   node stills.mjs 45 150 255 ...
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";

const frames = process.argv.slice(2).map(Number);
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
const composition = await selectComposition({ serveUrl, id: process.env.COMP ?? "DemoVideo" });
for (const frame of frames) {
  const output = path.resolve("out/stills", `${process.env.COMP ?? "f"}${String(frame).padStart(5, "0")}.png`);
  await renderStill({ serveUrl, composition, frame, output, scale: 0.5 });
  console.log(output);
}
