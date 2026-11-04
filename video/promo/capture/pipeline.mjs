// One game made for real from one sentence, and everything done to it after, as stills:
//   node video/promo/capture/pipeline.mjs                  the whole run (spends Muse Spark, Muse Image, SAM 3.1 and Muse Spark Open calls)
//   node video/promo/capture/pipeline.mjs --game=<id> --from=<phase>   picks up on a game already made
// Phases: home, making, table, rivals, revise, paint, balance, rules, print, invite.
import { BASE, AICHEN, launch, openPage, signIn, shot, part, until, visible, click, wait, log } from "./lib.mjs";

const IDEA = "Rival families settle volcanic islands: trade spice and timber, build harbors and lighthouses.";
const arg = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const PHASES = ["home", "making", "table", "rivals", "revise", "paint", "balance", "rules", "print", "invite"];
const from = PHASES.indexOf(arg("from", "home"));
const on = (phase) => PHASES.indexOf(phase) >= from;
let game = arg("game");
const table = (id, extra = "") => `${BASE}/?game=${id}${extra}&quality=medium`;

const browser = await launch();
const page = await openPage(browser);
await signIn(page, AICHEN);

const MAKING = {
  panel: "section.panel.making",
  code: ".gen-code",
  grid: ".gen-grid",
  timeline: ".gen-timeline",
  stage: ".gen-stage",
  sheet: ".stage-sheet",
  idea: ".gen-idea",
  bar: ".gen-bar",
  start: 'button:has-text("Start playing")',
};
const TABLE = { canvas: "canvas", actions: ".action-bar", designer: "aside.designer", topbar: "header", mochi: ".mochi-strip" };

try {
  if (on("home") && !game) {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await wait(2500);
    const box = 'textarea[aria-label="Describe the game you want to play"]';
    await shot(page, "home", { idea: box, dream: 'button:has-text("Dream it up")', surprise: 'button:has-text("Surprise me")', form: "form" });
    // The idea typed a word at a time: the box alone, after each word.
    await page.locator(box).click();
    const words = IDEA.split(" ");
    for (let i = 1; i <= words.length; i++) {
      await page.locator(box).fill(words.slice(0, i).join(" "));
      await wait(60);
      await part(page, `idea-${String(i).padStart(2, "0")}`, box);
    }
    await shot(page, "home-typed", { idea: box, dream: 'button:has-text("Dream it up")', form: "form" }, { words: words.length });
    await click(page, 'button:has-text("Advanced settings")');
    await wait(800);
    await page.locator("label.field", { hasText: "Game type" }).locator("select").first().selectOption("map");
    await page.locator("label.field", { hasText: "Board" }).locator("select").first().selectOption("hex");
    await wait(600);
    await shot(page, "home-settings", { idea: box, dream: 'button:has-text("Dream it up")', form: "form" });
  }

  if (on("making") && !game) {
    const before = (await (await page.request.get(`${BASE}/api/games`)).json()).map((g) => g.id);
    await click(page, 'button:has-text("Dream it up")');
    const started = Date.now();
    let n = 0;
    const ready = await until(
      async () => {
        const now = await page
          .locator(".gen-item.now .gen-item-head")
          .first()
          .innerText()
          .catch(() => "");
        await shot(page, `making-${String(n++).padStart(3, "0")}`, MAKING, { s: Math.round((Date.now() - started) / 1000), now: now.split("\n")[0] });
        return visible(page, MAKING.start);
      },
      35 * 60_000,
      2500,
    );
    if (!ready) throw new Error("not ready in 35 minutes");
    await wait(1500);
    await shot(page, "making-ready", MAKING, { s: Math.round((Date.now() - started) / 1000) });
    const games = (await (await page.request.get(`${BASE}/api/games`)).json()).filter((g) => !before.includes(g.id));
    game = games.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]?.id;
    log("MADE", game, games[0]?.title);
    await click(page, MAKING.start);
    await wait(6000);
    await shot(page, "table-made", TABLE);
  }
  if (!game) throw new Error("no game");

  if (on("table")) {
    await page.goto(table(game, "&bots"), { waitUntil: "networkidle" });
    await wait(6000);
    await shot(page, "table-turn", { ...TABLE, move: ".action-bar > button.action" });
  }

  if (on("rivals")) {
    // Muse Spark Open in the other seats, playing and talking.
    await page.goto(table(game, "&watch"), { waitUntil: "networkidle" });
    await wait(4000);
    for (let i = 0; i < 18; i++) {
      await shot(page, `rivals-${String(i).padStart(2, "0")}`, { ...TABLE, log: ".log-panel", chat: '[class*="chat"], [class*="speech"], [class*="bubble"]' });
      await wait(2200);
    }
  }

  if (on("revise")) {
    await page.goto(table(game, "&bots"), { waitUntil: "networkidle" });
    await wait(4000);
    await click(page, 'button:has-text("Designer")');
    await wait(1200);
    const rule = /timber/i.test(await page.locator("body").innerText())
      ? "Every family starts the game with one extra timber."
      : "Every family starts the game with one extra of each resource.";
    await page.locator("aside.designer textarea").first().fill(rule);
    await wait(400);
    await shot(page, "revise-typed", { designer: "aside.designer", text: "aside.designer textarea", apply: 'button:has-text("Apply the change")' }, { rule });
    await click(page, 'button:has-text("Apply the change")');
    let n = 0;
    const started = Date.now();
    const done = await until(
      async () => {
        await shot(page, `revise-${String(n++).padStart(3, "0")}`, { designer: "aside.designer", bar: '[aria-label="Changing the rules"]' }, { s: Math.round((Date.now() - started) / 1000) });
        return (await visible(page, ".revision-table")) || (await visible(page, 'button:has-text("Apply the change"):not([disabled])'));
      },
      15 * 60_000,
      3000,
    );
    if (!done) throw new Error("revision not done in 15 minutes");
    await wait(2000);
    await shot(page, "revise-done", { designer: "aside.designer", table: ".revision-table", body: ".designer-body" });
    await click(page, 'button[aria-label="Close the designer"]');
    await wait(4000);
    await shot(page, "table-v2", TABLE);
  }

  if (on("paint")) {
    if (!(await visible(page, 'button:has-text("Designer")'))) {
      await page.goto(table(game, "&bots"), { waitUntil: "networkidle" });
      await wait(4000);
    }
    await click(page, 'button:has-text("Designer")');
    await wait(1000);
    await click(page, 'button:text-is("Art")');
    await wait(1200);
    await shot(page, "art-before", { designer: "aside.designer" });
    await click(page, 'button:has-text("Paint the board"), button:has-text("Repaint the board")');
    let n = 0;
    const started = Date.now();
    await until(
      async () => {
        await shot(page, `paint-${String(n++).padStart(3, "0")}`, { designer: "aside.designer", bar: '[aria-label="Painting the board"]' }, { s: Math.round((Date.now() - started) / 1000) });
        return !(await visible(page, 'button:has-text("Cancel")'));
      },
      10 * 60_000,
      3000,
    );
    await wait(3000);
    await shot(page, "art-done", { designer: "aside.designer", report: ".align-report", problem: ".art-problem" });
    await click(page, 'button[aria-label="Close the designer"]');
    await wait(5000);
    await shot(page, "table-painted", TABLE);
  }

  if (on("balance")) {
    await click(page, 'button:has-text("Designer")');
    await wait(800);
    await click(page, 'button:text-is("Balance")');
    await until(async () => !(await visible(page, "text=Simulating")) && !(await visible(page, "text=Measuring")), 180_000, 700);
    await wait(1500);
    await shot(page, "balance", { designer: "aside.designer", body: ".designer-body" });
    await click(page, 'button[aria-label="Close the designer"]');
    await wait(1500);
  }

  if (on("rules")) {
    await click(page, 'header button:has-text("Rules")');
    await wait(2000);
    await shot(page, "rules", { card: '[role="dialog"], .rules-card' });
    const zh = page.locator('button:has-text("中文")').first();
    if (await zh.isVisible().catch(() => false)) {
      await zh.click();
      await until(async () => /[一-鿿]{6}/.test(await page.locator('[role="dialog"], .rules-card').first().innerText()), 90_000, 1000);
      await wait(1500);
      await shot(page, "rules-zh", { card: '[role="dialog"], .rules-card' });
    }
    await page.keyboard.press("Escape");
    await wait(1000);
  }

  if (on("print")) {
    await click(page, 'button[aria-label="More"]');
    await wait(600);
    await click(page, '[role="menuitem"]:has-text("Print and play")');
    await until(() => visible(page, 'button:has-text("Print or save as PDF")'), 120_000, 500);
    await wait(2500);
    await page.mouse.move(960, 620);
    for (let i = 0; i < 8; i++) {
      await shot(page, `print-${i}`, { print: 'button:has-text("Print or save as PDF")' });
      await page.mouse.wheel(0, 900);
      await wait(1200);
    }
    await click(page, 'button[aria-label="Close the print kit"]');
    await wait(1500);
  }

  if (on("invite")) {
    await click(page, 'button:has-text("Invite friends")');
    await wait(3000);
    await shot(page, "invite", { room: ".room-card", link: 'input[aria-label="Invite link"]' });
  }
  log("DONE", game);
} catch (err) {
  log("FAILED", game, err);
  await shot(page, "zz-failed").catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
}
