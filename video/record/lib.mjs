// Scripted recording of BoardDream for the demo video, after the ui-demo skill: discover the page,
// rehearse every selector, then record. Chrome (the installed one) is driven by Playwright; an
// oversized cursor is drawn over the page and moves before every click; typing is visible. Frames
// come straight from Chrome's compositor (CDP screencast) as JPEGs and are encoded into an MP4 at
// 30 fps with the ffmpeg Remotion ships, sharper than Playwright's own video. A take can slow its
// frame rate while it waits for a game to be made, and marks the moments the edit cuts on.
import { spawn, spawnSync } from "node:child_process";
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

/**
 * --screen: record Chrome's window instead of the screencast. The screencast tops out near 20
 * frames a second at these sizes (each frame a JPEG sent over the debugging connection and written
 * to disk), which shows as judder in a 60 fps film; measured on Tidehearth, the page itself draws 58
 * a second. With --screen, Chrome runs full screen on the main display (kiosk), the page laid out
 * at 1920 x 1080 and drawn at the display's 2560 x 1440, and ffmpeg's gfxcapture (Windows graphics
 * capture) takes that one window at 60 fps without touching the page, whatever lies in front of it.
 * Chrome is told to keep drawing when covered. Needs an ffmpeg with gfxcapture (SCREEN_FFMPEG) and
 * the display awake.
 */
export const SCREEN = process.argv.includes("--screen");
const SCREEN_FFMPEG = process.env.SCREEN_FFMPEG ?? "ffmpeg";
const SCREEN_SCALE = 2560 / SIZE.width;

export async function launch(scale = SCALE) {
  if (SCREEN)
    return chromium.launch({
      channel: "chrome",
      headless: false,
      ignoreDefaultArgs: ["--enable-automation"],
      args: [
        "--kiosk",
        // Chrome's own windows (the print preview) in English, whatever the system's language.
        "--lang=en-US",
        "--hide-scrollbars",
        "--no-default-browser-check",
        "--disable-infobars",
        `--force-device-scale-factor=${SCREEN_SCALE}`,
        // Keep drawing at full rate while another window covers this one.
        "--disable-features=CalculateNativeWinOcclusion",
        "--disable-backgrounding-occluded-windows",
        "--disable-renderer-backgrounding",
        "--disable-background-timer-throttling",
      ],
    });
  return chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--hide-scrollbars", `--force-device-scale-factor=${scale}`] });
}

/**
 * A page at the video's size (1920 x 1080 CSS pixels, drawn at SCALE), with the cursor drawn.
 * Every game counts as seen, so no first-game guide covers the table.
 */
export async function openPage(browser, { storageState, theme = "light", scale = SCALE } = {}) {
  // On screen the page takes the full-screen window as it is.
  const context = SCREEN
    ? await browser.newContext({ viewport: null, storageState, colorScheme: theme })
    : await browser.newContext({ viewport: SIZE, deviceScaleFactor: scale, storageState, colorScheme: theme });
  await context.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      return typeof key === "string" && key.startsWith("boarddream:rules-seen:") ? "1" : get.call(this, key);
    };
  });
  await context.addInitScript(CURSOR);
  const page = await context.newPage();
  if (SCREEN) {
    // Full screen on the display, so the page is drawn at its 2560 x 1440 (kiosk alone does not hold).
    const cdp = await context.newCDPSession(page);
    const { windowId } = await cdp.send("Browser.getWindowForTarget");
    await cdp.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "fullscreen" } });
    await wait(800);
  }
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
class FrameTake {
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
 * Records Chrome's window (--screen): ffmpeg's gfxcapture finds it by a title the page is given for
 * a moment, then follows that window at 60 fps into an MP4 at its own 2560 x 1440, the system
 * pointer left out (the page draws its own). The same marks as a screencast take; `rate` does
 * nothing, as every frame is kept.
 */
class ScreenTake {
  constructor(page, name) {
    this.page = page;
    this.name = name;
    this.marks = [];
  }

  async start() {
    if (REHEARSE) return this;
    await this.page.bringToFront();
    mkdirSync(FOOTAGE, { recursive: true });
    this.out = path.join(FOOTAGE, `${this.name}.mp4`);
    // A title only this window has, for the capture to find it by.
    const token = `boarddream-take-${this.name}-${Date.now()}`;
    await this.page.evaluate((t) => (document.title = t), token);
    await wait(400);
    const source = `gfxcapture=window_title=${token}:capture_cursor=0:max_framerate=60`;
    this.ff = spawn(SCREEN_FFMPEG, ["-hide_banner", "-y", "-f", "lavfi", "-i", source, "-vf", "hwdownload,format=bgra", "-fps_mode", "cfr", "-r", "60", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "15", "-pix_fmt", "yuv420p", "-movflags", "+faststart", this.out], { stdio: ["pipe", "ignore", "pipe"] });
    this.log = "";
    // The capture hands on a frame only when the window changes: on a still page, nudge the drawn
    // cursor a pixel back and forth until the first frames are in.
    const [cx, cy] = this.page.mouse.at ?? [SIZE.width / 2, SIZE.height / 2];
    let nudging = true;
    (async () => {
      for (let i = 0; nudging && i < 300; i++) {
        await this.page.mouse.move(cx + (i % 2), cy).catch(() => {});
        await wait(50);
      }
    })();
    // The take's clock starts when the first frames are in, worked back to the first one.
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${this.name}: ffmpeg took no frames: ${this.log.slice(-400)}`)), 15_000);
      this.ff.stderr.on("data", (d) => {
        this.log += d;
        const m = /frame=\s*(\d+)/.exec(String(d));
        if (this.first === undefined && m && Number(m[1]) > 0) {
          this.first = Date.now() / 1000 - Number(m[1]) / 60;
          clearTimeout(timer);
          resolve();
        }
      });
      this.ff.on("exit", (code) => reject(new Error(`${this.name}: ffmpeg stopped (${code}): ${this.log.slice(-400)}`)));
    }).finally(() => (nudging = false));
    await this.page.mouse.move(cx, cy).catch(() => {});
    log(`recording ${this.name} (screen)`);
    return this;
  }

  rate() {}

  mark(label) {
    if (REHEARSE || this.first === undefined) return;
    const t = Date.now() / 1000 - this.first;
    this.marks.push({ label, t: Math.round(t * 100) / 100 });
    log(`mark ${label} @ ${t.toFixed(1)}s`);
  }

  async stop() {
    if (REHEARSE) return;
    const end = Date.now() / 1000 - this.first;
    let exited = false;
    const done = new Promise((resolve) => this.ff.on("exit", () => resolve((exited = true))));
    this.ff.stdin.write("q");
    // The capture only hands on a frame when the window changes, and ffmpeg reads the q between
    // frames: on a still page, nudge the pointer until it has stopped.
    for (let i = 0; !exited && i < 100; i++) {
      await this.page.mouse.move(SIZE.width - 4 - (i % 2), SIZE.height - 4).catch(() => {});
      await wait(100);
    }
    await done;
    const dropped = /drop=\s*(\d+)/g;
    let last;
    for (let m; (m = dropped.exec(this.log)); ) last = m[1];
    writeFileSync(path.join(FOOTAGE, `${this.name}.json`), JSON.stringify({ duration: Math.round(end * 100) / 100, frames: Math.round(end * 60), marks: this.marks }, null, 2) + "\n");
    log(`saved ${this.out} (${end.toFixed(1)} s at 60 fps, ${last ?? 0} frames dropped)`);
  }
}

/** A take: from the screencast, or from the screen with --screen. */
export const Take = SCREEN ? ScreenTake : FrameTake;

const USER32 = `$ProgressPreference = 'SilentlyContinue'
Add-Type -Namespace W -Name U -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
[DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
[DllImport("user32.dll")] public static extern void mouse_event(uint f, uint x, uint y, int d, System.UIntPtr e);
[DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, uint f, System.UIntPtr e);
[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint s);
'@
[void][W.U]::SetProcessDPIAware()
`;

// The whole script goes in as one encoded command: piped in on stdin, a multi-line block such as
// the here-string above is skipped without a word.
const psArgs = (script) => ["-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(USER32 + script, "utf16le").toString("base64")];

const powershell = (script) =>
  new Promise((resolve, reject) => {
    const ps = spawn("powershell.exe", psArgs(script), { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    ps.stderr.on("data", (d) => (err += d));
    ps.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`powershell (${code}): ${err.slice(-300)}`))));
  });

/**
 * Keeps the display on through a long take: with no one at the keyboard Windows would dim and then
 * switch it off, and a screen that is off hands the capture no frames. Returns a stop function.
 */
export function keepAwake() {
  if (REHEARSE || !SCREEN) return () => {};
  // ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED, held while the script sleeps.
  const ps = spawn("powershell.exe", psArgs("[void][W.U]::SetThreadExecutionState(0x80000003)\nStart-Sleep -Seconds 7200\n"), { stdio: "ignore" });
  const stop = () => ps.kill();
  process.on("exit", stop);
  return stop;
}

/**
 * Chrome's print preview is the browser's own window, out of reach of the page's input, so it is
 * scrolled with the system's own pointer: after `before` ms for the preview to draw, to `[x, y]`
 * (CSS pixels of the 1920 x 1080 page), a click to give it the keys, `notches` turns of the wheel
 * `every` ms apart, a look, and Escape to close it. The pointer then rests where the page's drawn
 * cursor is, so the page sees it move nowhere.
 */
/** Escape, from the system's keyboard, with the pointer back where the page's drawn cursor is. */
export const pressEscape = (page) =>
  powershell(`[W.U]::keybd_event(0x1B, 0, 0, [System.UIntPtr]::Zero); Start-Sleep -Milliseconds 60; [W.U]::keybd_event(0x1B, 0, 2, [System.UIntPtr]::Zero)
[void][W.U]::SetCursorPos(${Math.round(page.mouse.at[0] * SCREEN_SCALE)}, ${Math.round(page.mouse.at[1] * SCREEN_SCALE)})
`);

export async function scrollPrintPreview(page, [x, y], { before = 2500, notches = 12, every = 450, look = 1500 } = {}) {
  const at = ([u, v]) => `${Math.round(u * SCREEN_SCALE)}, ${Math.round(v * SCREEN_SCALE)}`;
  await powershell(`Start-Sleep -Milliseconds ${before}
[void][W.U]::SetCursorPos(${at([x, y])})
Start-Sleep -Milliseconds 300
[W.U]::mouse_event(0x0002, 0, 0, 0, [System.UIntPtr]::Zero); Start-Sleep -Milliseconds 60; [W.U]::mouse_event(0x0004, 0, 0, 0, [System.UIntPtr]::Zero)
Start-Sleep -Milliseconds 700
for ($i = 0; $i -lt ${notches}; $i++) { [W.U]::mouse_event(0x0800, 0, 0, -120, [System.UIntPtr]::Zero); Start-Sleep -Milliseconds ${every} }
Start-Sleep -Milliseconds ${look}
[W.U]::keybd_event(0x1B, 0, 0, [System.UIntPtr]::Zero); Start-Sleep -Milliseconds 60; [W.U]::keybd_event(0x1B, 0, 2, [System.UIntPtr]::Zero)
Start-Sleep -Milliseconds 400
[void][W.U]::SetCursorPos(${at(page.mouse.at)})
`);
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
