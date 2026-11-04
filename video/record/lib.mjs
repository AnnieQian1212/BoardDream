// Scripted recording of BoardDream for the demo video, after the ui-demo skill: discover the page,
// rehearse every selector, then record. Chrome (the installed one) is driven by Playwright; an
// oversized cursor is drawn over the page and moves before every click; typing is visible. Frames
// come straight from Chrome's compositor (CDP screencast) as JPEGs and are encoded into an MP4 at
// 30 fps with the ffmpeg Remotion ships, sharper than Playwright's own video. A take can slow its
// frame rate while it waits for a game to be made, and marks the moments the edit cuts on.
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

export const BASE = process.env.BASE_URL ?? "http://localhost:5173";
export const REHEARSE = process.argv.includes("--rehearse");
const here = path.dirname(fileURLToPath(import.meta.url));
export const FOOTAGE = path.join(here, "..", "remotion", "public", "footage");
const FFMPEG = path.join(here, "..", "remotion", "node_modules", "@remotion", "compositor-win32-x64-msvc", "ffmpeg.exe");
const FRAMES = process.env.FRAMES_DIR ?? path.join(os.tmpdir(), "boarddream-frames");
export const SIZE = { width: 1920, height: 1080 };

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const t0 = Date.now();
export const log = (...args) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(6)}s`, ...args);

/** The cursor drawn over the page: an ink-outlined arrow, larger than life, as in product reels. */
const CURSOR = `(() => {
  const add = () => {
    if (document.getElementById("demo-cursor")) return;
    const c = document.createElement("div");
    c.id = "demo-cursor";
    c.innerHTML = '<svg width="56" height="56" viewBox="0 0 24 24"><path d="M5 3L19 12L12 13L9 20L5 3Z" fill="#2b2118" stroke="#fffaf0" stroke-width="1.7" stroke-linejoin="round"/></svg>';
    c.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;left:-80px;top:-80px;filter:drop-shadow(1px 3px 3px rgba(0,0,0,.35));";
    document.documentElement.appendChild(c);
    const at = window.__demoCursor;
    if (at) { c.style.left = at[0] - 12 + "px"; c.style.top = at[1] - 7 + "px"; }
    addEventListener("mousemove", (e) => { window.__demoCursor = [e.clientX, e.clientY]; c.style.left = e.clientX - 12 + "px"; c.style.top = e.clientY - 7 + "px"; }, true);
  };
  if (document.readyState === "loading") addEventListener("DOMContentLoaded", add); else add();
})();`;

/**
 * Pages are drawn at this many device pixels per CSS pixel. Chrome's screencast sends frames at the
 * device size only when the scale is forced at launch (a context's deviceScaleFactor alone still
 * gives 1920 x 1080). Measured on Tidehearth with bots playing: 1.5 (2880 x 1620) keeps 39 frames
 * a second, the longest gap 0.08 s; 2 drops to 21-24, with gaps of 0.2 s.
 */
export const SCALE = Number(process.env.SCALE ?? 1.5);

export async function launch(scale = SCALE) {
  return chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--hide-scrollbars", `--force-device-scale-factor=${scale}`] });
}

/**
 * A page at the video's size (1920 x 1080 CSS pixels, drawn at SCALE), with the cursor drawn.
 * Every game counts as seen, so no first-game guide covers the table.
 */
export async function openPage(browser, { storageState, theme = "light", scale = SCALE } = {}) {
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: scale, storageState, colorScheme: theme });
  await context.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      return typeof key === "string" && key.startsWith("boarddream:rules-seen:") ? "1" : get.call(this, key);
    };
  });
  await context.addInitScript(CURSOR);
  const page = await context.newPage();
  page.on("pageerror", (err) => log("pageerror:", String(err)));
  page.mouse.at = [SIZE.width / 2, SIZE.height / 2];
  page.scale = scale;
  return page;
}

/** Signs a page's context in with the server's account API (the cookie lands in the context). */
export async function signIn(page, account) {
  const res = await page.request.post(`${BASE}/api/auth/login`, { data: { email: account.email, password: account.password } });
  if (!res.ok()) throw new Error(`sign in as ${account.name}: ${res.status()} ${await res.text()}`);
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * Glides the cursor to a point, easing in and out, in `ms`: each step goes where the clock says,
 * so a page slow to take mouse events (the 3D table) moves in fewer steps, not more slowly.
 */
export async function glide(page, [x, y], ms = 650) {
  const [x0, y0] = page.mouse.at;
  const start = Date.now();
  for (;;) {
    const t = Math.min(1, (Date.now() - start) / ms);
    await page.mouse.move(x0 + (x - x0) * ease(t), y0 + (y - y0) * ease(t));
    if (t >= 1) break;
    await wait(12);
  }
  page.mouse.at = [x, y];
}

const locate = (page, target) => (typeof target === "string" ? page.locator(target).first() : target);

/** Fails loudly when a step's element is not on the page (ui-demo's rehearsal). */
export async function ensureVisible(page, target, label) {
  const el = locate(page, target);
  const visible = await el.isVisible().catch(() => false);
  if (!visible) {
    const seen = await page.evaluate(() =>
      [...document.querySelectorAll("button, input, select, textarea, a, [role=tab]")]
        .filter((el) => el.offsetParent !== null)
        .map((el) => `${el.tagName} "${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 40)}"`)
        .join("\n  "),
    );
    throw new Error(`REHEARSAL FAIL: "${label}" is not on the page.\n  Visible:\n  ${seen}`);
  }
  log(`ok: ${label}`);
  return el;
}

/** Moves to an element, settles, and clicks it. */
export async function moveAndClick(page, target, label, { settle = 350, after = 900 } = {}) {
  const el = await ensureVisible(page, target, label);
  // A rehearsal clicks at once, to reach the next page; it records nothing.
  if (REHEARSE) {
    await el.click();
    await wait(500);
    return;
  }
  await el.scrollIntoViewIfNeeded();
  const box = await el.boundingBox();
  await glide(page, [box.x + box.width / 2, box.y + box.height / 2]);
  await wait(settle);
  await page.mouse.down();
  await wait(70);
  await page.mouse.up();
  await wait(after);
}

/** Types into a field a character at a time, as a person would. */
export async function typeSlowly(page, target, text, label, delay = 38) {
  await moveAndClick(page, target, label, { after: 250 });
  const el = locate(page, target);
  if (REHEARSE) return el.fill(text);
  await el.fill("");
  await el.pressSequentially(text, { delay });
  await wait(500);
}

/** Drifts the cursor along points with pauses, to show a surface without clicking (a pan). */
export async function drift(page, points, { ms = 900, pause = 300 } = {}) {
  if (REHEARSE) return;
  for (const point of points) {
    await glide(page, point, ms);
    await wait(pause);
  }
}

/**
 * Records a page: Chrome's screencast frames, written as JPEGs and encoded to an MP4 at 30 fps.
 * `rate(fps)` caps how many frames a second are kept (a long wait needs few); `mark(label)` notes
 * the take's time for the edit, saved beside the video as <name>.json.
 */
export class Take {
  constructor(page, name) {
    this.page = page;
    this.name = name;
    this.dir = path.join(FRAMES, name);
    this.frames = [];
    this.marks = [];
    this.fps = 30;
  }

  async start() {
    if (REHEARSE) return this;
    rmSync(this.dir, { recursive: true, force: true });
    mkdirSync(this.dir, { recursive: true });
    this.cdp = await this.page.context().newCDPSession(this.page);
    let last = -Infinity;
    this.cdp.on("Page.screencastFrame", async ({ data, metadata, sessionId }) => {
      if (this.stopped) return;
      const at = metadata.timestamp;
      if (this.first === undefined) this.first = { at, wall: Date.now() / 1000 };
      if (at - last >= 1 / this.fps - 0.004) {
        last = at;
        const file = path.join(this.dir, `${String(this.frames.length).padStart(6, "0")}.jpg`);
        writeFileSync(file, Buffer.from(data, "base64"));
        this.frames.push({ file, at: at - this.first.at });
      }
      await this.cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
    });
    const scale = this.page.scale ?? 1;
    await this.cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: SIZE.width * scale, maxHeight: SIZE.height * scale, everyNthFrame: 1 });
    log(`recording ${this.name}`);
    return this;
  }

  /** Keeps at most this many frames a second from now on. */
  rate(fps) {
    this.fps = fps;
  }

  /** Notes this moment of the take for the edit. */
  mark(label) {
    if (REHEARSE || !this.first) return;
    const t = Date.now() / 1000 - this.first.wall;
    this.marks.push({ label, t: Math.round(t * 100) / 100 });
    log(`mark ${label} @ ${t.toFixed(1)}s`);
  }

  async stop() {
    if (REHEARSE) return;
    this.stopped = true;
    await this.cdp.send("Page.stopScreencast").catch(() => {});
    const end = Date.now() / 1000 - (this.first?.wall ?? Date.now() / 1000);
    if (this.frames.length === 0) throw new Error(`${this.name}: no frames were recorded`);
    // Each frame lasts until the next one; the last until the take stopped.
    const lines = ["ffconcat version 1.0"];
    this.frames.forEach((frame, i) => {
      const next = i + 1 < this.frames.length ? this.frames[i + 1].at : Math.max(end, frame.at + 0.04);
      lines.push(`file '${frame.file.replaceAll("\\", "/")}'`, `duration ${Math.max(0.001, next - frame.at).toFixed(4)}`);
    });
    lines.push(`file '${this.frames.at(-1).file.replaceAll("\\", "/")}'`);
    const list = path.join(this.dir, "frames.txt");
    writeFileSync(list, lines.join("\n") + "\n");
    mkdirSync(FOOTAGE, { recursive: true });
    const out = path.join(FOOTAGE, `${this.name}.mp4`);
    const run = spawnSync(FFMPEG, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", list, "-fps_mode", "cfr", "-r", "30", "-pix_fmt", "yuv420p", "-c:v", "libx264", "-crf", "16", "-preset", (this.page.scale ?? 1) > 1 ? "fast" : "medium", "-movflags", "+faststart", out], { encoding: "utf8" });
    if (run.status !== 0) throw new Error(`ffmpeg: ${run.stderr}`);
    writeFileSync(path.join(FOOTAGE, `${this.name}.json`), JSON.stringify({ duration: Math.round(end * 100) / 100, frames: this.frames.length, marks: this.marks }, null, 2) + "\n");
    rmSync(this.dir, { recursive: true, force: true });
    log(`saved ${out} (${end.toFixed(1)} s, ${this.frames.length} frames)`);
  }
}

/**
 * A few moves in the mochi steamer, the game to play while a game is made: steam two friends, then
 * drag one onto another just like it, which merges them into the next friend. The steamer makes
 * friends by itself only within 20 s of a move, so a move now and then keeps it going on camera.
 */
export async function playMochi(page, { steams = 2 } = {}) {
  if (REHEARSE) return ensureVisible(page, ".mochi-steamer", "the mochi steamer");
  const steamer = page.locator(".mochi-steamer").first();
  if (!(await steamer.isVisible().catch(() => false))) return false;
  for (let i = 0; i < steams; i++) await moveAndClick(page, steamer, "steam a friend", { settle: 200, after: 700 });
  // The first two tiles holding the same friend.
  const pair = await page.$$eval(".mochi-spot.taken:not(.locked)", (spots) => {
    const seen = new Map();
    for (const el of spots) {
      const name = el.getAttribute("aria-label");
      const r = el.getBoundingClientRect();
      const at = [r.x + r.width / 2, r.y + r.height / 2];
      if (seen.has(name)) return [seen.get(name), at];
      seen.set(name, at);
    }
    return null;
  });
  if (!pair) return false;
  const [from, to] = pair;
  await glide(page, from, 600);
  await wait(250);
  await page.mouse.down();
  await glide(page, [from[0] + (to[0] - from[0]) * 0.15, from[1] - 6], 180);
  await glide(page, to, 700);
  await wait(150);
  await page.mouse.up();
  await wait(1200);
  return true;
}
