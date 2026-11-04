// Stills that spend nothing: Behind the scenes, the games shelf, the mochi game, two friends at one
// table, and the demo games' painted tables with bots in every seat.
//   node video/promo/capture/statics.mjs [part ...]
import { BASE, AICHEN, MIRA, launch, openPage, signIn, shot, until, visible, click, wait, log } from "./lib.mjs";

const TIDEHEARTH = "tidehearth-mw0zl535";
const CLOUDWAFT = "cloudwaft-harbor-mw0zp3es";
const table = (id, extra = "") => `${BASE}/?game=${id}${extra}&quality=medium`;
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const want = (name) => only.length === 0 || only.includes(name);

const browser = await launch();

async function run(name, fn) {
  if (!want(name)) return;
  try {
    await fn();
  } catch (err) {
    log("FAILED", name, String(err).slice(0, 400));
    process.exitCode = 1;
  }
}

await run("results", async () => {
  const page = await openPage(browser);
  await signIn(page, AICHEN);
  await page.goto(`${BASE}/?results`, { waitUntil: "networkidle" });
  await wait(3000);
  await page.mouse.move(960, 600);
  for (let i = 0; i < 6; i++) {
    await shot(page, `results-${i}`, { stat: ".stat", h2: "h2" });
    await page.mouse.wheel(0, 800);
    await wait(1200);
  }
  await page.context().close();
});

await run("library", async () => {
  const page = await openPage(browser);
  await signIn(page, AICHEN);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await wait(2000);
  await click(page, 'header button:has-text("Games")');
  await wait(3500);
  await shot(page, "library", {});
  await page.context().close();
});

await run("mochi", async () => {
  const page = await openPage(browser);
  await page.goto(`${BASE}/?mochi`, { waitUntil: "domcontentloaded" });
  await page.locator(".mochi-steamer").first().waitFor({ timeout: 20_000 });
  await wait(1000);
  const tools = page.locator(".mochi-test");
  const tool = (label) => tools.locator(`button:text-is("${label}")`).first().click();
  await tool("Clear it");
  await tools.locator("select").selectOption("0");
  await tool("Add two");
  await tools.locator("select").selectOption("1");
  await tool("Add two");
  await tools.locator("select").selectOption("2");
  await tool("Add two");
  await page.locator('button[aria-label="Hide the test tools"]').click();
  await wait(1200);
  const SEL = { strip: ".mochi-strip", steamer: ".mochi-steamer", spot: ".mochi-spot", order: ".mochi-order-main" };
  await shot(page, "mochi-0", SEL);
  await page.locator(".mochi-steamer").first().click();
  await wait(900);
  await shot(page, "mochi-1", SEL);
  const pts = await page.$$eval('.mochi-spot[aria-label="Mochi"]', (els) => els.map((el) => { const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
  if (pts.length >= 2) {
    await page.mouse.move(...pts[0]);
    await page.mouse.down();
    await page.mouse.move(pts[1][0], pts[1][1], { steps: 12 });
    await page.mouse.up();
    await wait(300);
    await shot(page, "mochi-2", SEL);
    await wait(1400);
    await shot(page, "mochi-3", SEL, { from: pts[0], to: pts[1] });
  }
  await page.context().close();
});

await run("friends", async () => {
  const host = await openPage(browser);
  const friend = await openPage(browser);
  await signIn(host, AICHEN);
  await signIn(friend, MIRA);
  await host.goto(table(CLOUDWAFT), { waitUntil: "networkidle" });
  await wait(4000);
  await click(host, 'button:has-text("Invite friends")');
  await wait(2500);
  const link = await host.locator('input[aria-label="Invite link"], .room-card input').first().inputValue();
  log("link", link);
  await shot(host, "friends-host-lobby", { room: ".room-card", link: 'input[aria-label="Invite link"], .room-card input' });
  await friend.goto(link, { waitUntil: "domcontentloaded" });
  await friend.locator(".room-card").first().waitFor({ timeout: 20_000 });
  await wait(3000);
  await shot(friend, "friends-friend-lobby", { room: ".room-card" });
  await shot(host, "friends-host-joined", { room: ".room-card" });
  await click(host, 'button:has-text("Start the game")');
  await wait(7000);
  await shot(host, "friends-host-table", { canvas: "canvas" });
  await shot(friend, "friends-friend-table", { canvas: "canvas" });
  await host.context().close();
  await friend.context().close();
});

await run("tables", async () => {
  for (const [id, name] of [[TIDEHEARTH, "tidehearth"], [CLOUDWAFT, "cloudwaft"]]) {
    const page = await openPage(browser);
    await page.goto(table(id, "&watch&bots"), { waitUntil: "networkidle" });
    await wait(5000);
    for (let i = 0; i < 4; i++) {
      await shot(page, `${name}-${i}`, { canvas: "canvas", actions: ".action-bar" });
      await wait(2500);
    }
    await page.context().close();
  }
});

await browser.close();
log("statics done");
