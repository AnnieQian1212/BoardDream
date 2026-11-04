// Still captures of the running app for the promo (video-shotcraft's capture step): every state is a
// full-page PNG at 2x (1920 x 1080 CSS pixels, 3840 x 2160 device pixels) plus the boxes of the
// elements the edit animates, in the page's CSS pixels, written to public/cap/<name>.png and
// public/cap/layout.json. Nothing is recorded as video; the motion is made in Remotion.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "../../record/node_modules/playwright-core/index.mjs";

export const BASE = process.env.BASE_URL ?? "http://localhost:5173";
const here = path.dirname(fileURLToPath(import.meta.url));
export const OUT = path.join(here, "..", "public", "cap");
mkdirSync(OUT, { recursive: true });
const LAYOUT = path.join(OUT, "layout.json");
export const SIZE = { width: 1920, height: 1080 };

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
export const log = (...a) => console.log(`${((Date.now() - t0) / 1000).toFixed(1).padStart(7)}s`, ...a);

export const AICHEN = { email: "aichen@example.com", password: "game-night-demo", name: "Aichen" };
export const MIRA = { email: "mira@example.com", password: "game-night-demo", name: "Mira" };

export async function launch() {
  return chromium.launch({ channel: "chrome", headless: true, args: ["--lang=en-US", "--enable-gpu-rasterization", "--ignore-gpu-blocklist"] });
}

export async function openPage(browser, { scale = 2 } = {}) {
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: scale, colorScheme: "light", locale: "en-US" });
  // Every game counts as seen, so no first-game guide covers a table.
  await context.addInitScript(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      return typeof key === "string" && key.startsWith("boarddream:rules-seen:") ? "1" : get.call(this, key);
    };
  });
  const page = await context.newPage();
  page.on("pageerror", (err) => log("pageerror:", String(err).slice(0, 200)));
  return page;
}

export async function signIn(page, account) {
  const res = await page.request.post(`${BASE}/api/auth/login`, { data: { email: account.email, password: account.password } });
  if (!res.ok()) throw new Error(`sign in as ${account.name}: ${res.status()} ${await res.text()}`);
}

/** Boxes of the given selectors (first visible match each), in CSS pixels of the viewport. */
async function boxes(page, selectors) {
  const out = {};
  for (const [key, sel] of Object.entries(selectors)) {
    const loc = page.locator(sel);
    const n = await loc.count().catch(() => 0);
    for (let i = 0; i < n; i++) {
      const b = await loc.nth(i).boundingBox().catch(() => null);
      if (b && b.width > 0 && b.height > 0) {
        out[key] = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
        break;
      }
    }
  }
  return out;
}

/** A full-viewport still and its element boxes. */
export async function shot(page, name, selectors = {}, extra = {}) {
  await page.evaluate(() => document.fonts.ready).catch(() => {});
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, animations: "allow" });
  const layout = existsSync(LAYOUT) ? JSON.parse(readFileSync(LAYOUT, "utf8")) : {};
  layout[name] = { ...extra, boxes: await boxes(page, selectors), t: Date.now() };
  writeFileSync(LAYOUT, JSON.stringify(layout, null, 1));
  log("shot", name);
}

/** An element-only still (for small parts shown large, e.g. the idea box while it is typed). */
export async function part(page, name, selector) {
  const loc = page.locator(selector).first();
  await loc.screenshot({ path: path.join(OUT, `${name}.png`), animations: "allow" });
}

export async function until(check, ms, every = 1000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check().catch(() => false)) return true;
    await wait(every);
  }
  return false;
}

export const visible = (page, sel) => page.locator(sel).first().isVisible().catch(() => false);
export const click = async (page, sel) => {
  await page.locator(sel).first().click();
  log("click", sel);
};
