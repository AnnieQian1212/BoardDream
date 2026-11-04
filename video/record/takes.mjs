// The demo video's takes (docs/VIDEO.md). Each is run on its own, after a rehearsal:
//   node video/record/takes.mjs <take> [--name=<n>] [--game=<id>] --rehearse   every selector checked, nothing recorded or spent
//   node video/record/takes.mjs <take> [...]                                   recorded to video/remotion/public/footage
// Takes: make (a game made on camera from the hero idea; --name=make-1, make-2, ... for candidates),
// after (that game played on: --game=<id> --rule="..."), extras (its turn, rulebook, Balance tab and
// Behind the scenes: --game=<id>), mochi (the mochi game played through), rivals, friends, table,
// cards, painted.
// The local servers must be running (web on :5173, API on :8787). Pages are drawn at SCALE (lib.mjs).
import { writeFileSync } from "node:fs";
import path from "node:path";
import { BASE, FOOTAGE, REHEARSE, Take, drift, ensureVisible, glide, launch, log, moveAndClick, openPage, playMochi, signIn, typeSlowly, wait } from "./lib.mjs";

const AICHEN = { email: "aichen@example.com", password: "game-night-demo", name: "Aichen" };
const MIRA = { email: "mira@example.com", password: "game-night-demo", name: "Mira" };
const TIDEHEARTH = "tidehearth-mw0zl535";
const CLOUDWAFT = "cloudwaft-harbor-mw0zp3es";
const FOGFALL = "fogfall-lanterns-mw0zerzb";
/** The game made on camera: a map, trading and cards that chain, the richest kind BoardDream makes. */
const HERO_IDEA =
  "Rival families settle a ring of volcanic islands: gather spices and timber, trade with neighbours, build harbors and lighthouses, and play explorer cards that chain together.";

const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
/** The table at full quality: twice the pixels of the low tier, and shadows. */
const table = (id, extra = "") => `${BASE}/?game=${id}${extra}&quality=medium`;

/** Waits until `check` holds, looking every `every` ms, for at most `ms`. */
async function until(check, ms, every = 1500) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check().catch(() => false)) return true;
    await wait(every);
  }
  return false;
}

const visible = (page, selector) => page.locator(selector).first().isVisible();

/** Drags a range input's thumb to its far right end: its largest value. */
async function rangeToMax(page, label) {
  const input = page.locator("label.field", { hasText: label }).locator('input[type="range"]').first();
  await ensureVisible(page, input, label);
  const box = await input.boundingBox();
  if (REHEARSE || !box) return input.fill(String(await input.getAttribute("max")));
  await glide(page, [box.x + box.width * 0.55, box.y + box.height / 2], 600);
  await page.mouse.down();
  await glide(page, [box.x + box.width + 4, box.y + box.height / 2], 500);
  await page.mouse.up();
  await wait(500);
}

/** Picks an option in a select, showing the cursor go to it. */
async function choose(page, label, value) {
  const select = page.locator("label.field", { hasText: label }).locator("select").first();
  await ensureVisible(page, select, label);
  if (!REHEARSE) {
    const box = await select.boundingBox();
    await glide(page, [box.x + box.width / 2, box.y + box.height / 2], 600);
    await wait(250);
  }
  await select.selectOption(value);
  await wait(600);
}

const takes = {
  /**
   * A game made on camera: the idea typed, the dials set (3-4 players, 90 minutes, heaviest, a map
   * and trade game on a hex map, High effort), Dream it up, and the making screen until the game is
   * ready, with a few moves in the mochi steamer while it waits. Saves the game's id with the take.
   */
  async make(browser) {
    const name = arg("name", "make");
    const page = await openPage(browser);
    await signIn(page, AICHEN);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await wait(1500);
    const before = REHEARSE ? [] : (await (await page.request.get(`${BASE}/api/games`)).json()).map((g) => g.id);
    const take = await new Take(page, name).start();
    await wait(300);
    take.mark("home");
    await drift(page, [[960, 300], [800, 390]], { ms: 800, pause: 250 });
    await typeSlowly(page, 'textarea[aria-label="Describe the game you want to play"]', HERO_IDEA, "the idea", 22);
    take.mark("idea");
    await moveAndClick(page, 'button:has-text("Advanced settings")', "Advanced settings", { after: 900 });
    take.mark("settings");
    await moveAndClick(page, '[aria-label="Model effort"] button:has-text("High")', "High effort", { after: 500 });
    const minPlayers = page.locator("label.field", { hasText: "Min players" }).locator("input").first();
    await moveAndClick(page, minPlayers, "fewest players", { after: 150 });
    if (!REHEARSE) {
      await page.keyboard.press("Control+A");
      await page.keyboard.type("3", { delay: 120 });
      await wait(400);
    }
    await rangeToMax(page, "Play time");
    await rangeToMax(page, "Complexity");
    await choose(page, "Game type", "map");
    await choose(page, "Board", "hex");
    await wait(800);
    if (REHEARSE) return ensureVisible(page, 'button:has-text("Dream it up")', "Dream it up");
    await moveAndClick(page, 'button:has-text("Dream it up")', "Dream it up", { after: 500 });
    take.mark("dream");

    // The making screen: the first half minute at full rate, then a few frames a second, with a
    // round in the mochi steamer about once a minute at full rate.
    await wait(28_000);
    take.rate(6);
    const seen = new Set();
    let nextMochi = Date.now() + 15_000;
    const ready = await until(
      async () => {
        for (const step of ["Pick tested mechanics", "Write the rules", "Playtest", "Fix the rules", "Ready to play"]) {
          if (!seen.has(step) && (await page.locator(`[class*="now"]:has-text("${step}")`).count()) > 0) {
            seen.add(step);
            take.mark(`step:${step}`);
          }
        }
        if (Date.now() > nextMochi) {
          take.rate(30);
          take.mark("mochi");
          await playMochi(page);
          take.rate(6);
          nextMochi = Date.now() + 60_000;
        }
        return visible(page, 'button:has-text("Start playing")');
      },
      25 * 60_000,
      2000,
    );
    take.rate(30);
    if (!ready) throw new Error("the game was not ready in 25 minutes");
    take.mark("ready");
    await drift(page, [[700, 520], [420, 860]], { ms: 1200, pause: 1500 });
    await wait(2500);
    await take.stop();
    // Which game it made: the newest saved since the take began.
    const games = (await (await page.request.get(`${BASE}/api/games`)).json()).filter((g) => !before.includes(g.id));
    const made = games.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    log("made:", made?.id, made?.title);
    writeFileSync(path.join(FOOTAGE, `${name}.game.json`), JSON.stringify({ id: made?.id, title: made?.title }, null, 2) + "\n");
  },

  /** The game made on camera, played on: its table, Muse Spark Open in the other seats, a house rule, the board painted, a link to share. */
  async after(browser) {
    const game = arg("game");
    const rule = arg("rule", "Every family starts the game with one extra timber.");
    if (!game) throw new Error("which game? --game=<id>");
    const page = await openPage(browser);
    await signIn(page, AICHEN);
    await page.goto(table(game, "&watch&bots"), { waitUntil: "networkidle" });
    await wait(3000);
    const take = await new Take(page, "after").start();
    await wait(300);
    take.mark("table");
    await drift(page, [[700, 420], [900, 520], [1150, 430]], { ms: 1300, pause: 600 });
    await wait(5000);

    await page.goto(table(game, "&watch"), { waitUntil: "networkidle" });
    take.mark("rivals");
    await wait(32_000);

    await page.goto(table(game), { waitUntil: "networkidle" });
    await wait(2500);
    take.mark("table-mine");
    await moveAndClick(page, 'button:has-text("Designer")', "Designer", { after: 1200 });
    take.mark("rules");
    await typeSlowly(page, "textarea", rule, "change the rules");
    // A rehearsal stops before anything that spends model calls: the change and the painting.
    if (REHEARSE) return ensureVisible(page, 'button:has-text("Apply the change")', "Apply the change");
    await moveAndClick(page, 'button:has-text("Apply the change")', "Apply the change", { after: 2500 });
    take.mark("revise");
    take.rate(6);
    const revised = await until(() => visible(page, 'button:has-text("Apply the change")'), 15 * 60_000, 2000);
    take.rate(30);
    take.mark(revised ? "revised" : "revise-timeout");
    await wait(7000);

    await moveAndClick(page, 'button:text-is("Art")', "Art tab", { after: 1200 });
    const paint = page.locator('button:has-text("Paint the board"), button:has-text("Repaint the board")').first();
    await moveAndClick(page, paint, "paint the board", { after: 1500 });
    take.mark("paint");
    take.rate(6);
    await until(async () => !(await visible(page, 'button:has-text("Cancel")')), 6 * 60_000, 2000);
    take.rate(30);
    take.mark("painted");
    await wait(4000);
    await moveAndClick(page, 'button[aria-label="Close the designer"]', "close the designer", { after: 2500 });
    take.mark("painted-table");
    await drift(page, [[600, 420], [900, 520], [1150, 400]], { ms: 1300, pause: 600 });
    await wait(2000);

    await moveAndClick(page, 'button:has-text("Invite friends")', "Invite friends", { after: 2500 });
    take.mark("invite");
    await moveAndClick(page, 'button:has-text("Copy")', "copy the link", { after: 3000 });
    await take.stop();
  },

  /** Two windows: Aichen opens a table, Mira joins by the link, Aichen deals. */
  async friends(browser) {
    const host = await openPage(browser);
    const friend = await openPage(browser);
    await signIn(host, AICHEN);
    await signIn(friend, MIRA);
    await host.goto(table(CLOUDWAFT), { waitUntil: "networkidle" });
    await friend.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await wait(1500);
    const hostTake = await new Take(host, "friends-host").start();
    const friendTake = await new Take(friend, "friends-friend").start();
    await moveAndClick(host, 'button:has-text("Invite friends")', "Invite friends", { after: 2000 });
    hostTake.mark("lobby");
    const link = REHEARSE ? `${BASE}/` : await host.locator('input[aria-label="Invite link"], .room-card input').first().inputValue();
    await moveAndClick(host, 'button:has-text("Copy")', "copy the link", { after: 1200 });
    // A table's page keeps a live connection open, so it never goes quiet: wait for the table instead.
    await friend.goto(link, { waitUntil: "domcontentloaded" });
    await friend.locator(".room-card").first().waitFor({ timeout: 15_000 });
    friendTake.mark("joined");
    hostTake.mark("joined");
    await wait(3500);
    if (REHEARSE) return ensureVisible(host, 'button:has-text("Start the game")', "Start the game");
    await moveAndClick(host, 'button:has-text("Start the game")', "Start the game", { after: 4000 });
    hostTake.mark("dealt");
    friendTake.mark("dealt");
    await drift(host, [[700, 420], [900, 380]], { ms: 900, pause: 400 });
    await drift(friend, [[1100, 450], [800, 400]], { ms: 900, pause: 400 });
    await wait(6000);
    await Promise.all([hostTake.stop(), friendTake.stop()]);
  },

  /** Tidehearth up close: bots building, the water rippling under the cursor. */
  async table(browser) {
    const page = await openPage(browser);
    await page.goto(table(TIDEHEARTH, "&watch&bots"), { waitUntil: "networkidle" });
    await wait(3000);
    const take = await new Take(page, "table").start();
    await drift(page, [[600, 420], [470, 470], [640, 380], [780, 330], [620, 600], [450, 600], [700, 520]], { ms: 1400, pause: 300 });
    await wait(3000);
    await take.stop();
  },

  /**
   * The made game's own pages, for Part 2: a turn at its table (only legal moves glow), its
   * rulebook, the designer's Balance tab, and BoardDream's Behind the scenes. Bots in the other
   * seats, so nothing is spent. --game=<id>, the revised game.
   */
  async extras(browser) {
    const game = arg("game");
    if (!game) throw new Error("which game? --game=<id>");
    const page = await openPage(browser);
    await signIn(page, AICHEN);
    await page.goto(table(game, "&bots"), { waitUntil: "networkidle" });
    await wait(3500);
    const take = await new Take(page, "extras").start();
    await wait(300);
    take.mark("turn");
    await drift(page, [[700, 420], [960, 880]], { ms: 1100, pause: 500 });
    await moveAndClick(page, 'button:has-text("fell timber")', "fell timber", { after: 2600 });
    await drift(page, [[900, 880], [1020, 880]], { ms: 900, pause: 400 });

    take.mark("rules");
    await moveAndClick(page, 'header button:has-text("Rules")', "Rules", { after: 1800 });
    for (let i = 0; i < 12; i++) {
      await page.mouse.wheel(0, 60);
      await wait(60);
    }
    await wait(1500);
    await page.keyboard.press("Escape");
    await wait(800);

    take.mark("balance");
    await moveAndClick(page, 'button:has-text("Designer")', "Designer", { after: 1000 });
    await moveAndClick(page, 'button:text-is("Balance")', "Balance tab", { after: 500 });
    // The tab plays its games in the page first; the edit starts once its numbers are in.
    if (!REHEARSE) await until(async () => !(await visible(page, "text=Simulating")) && !(await visible(page, "text=Measuring")), 120_000, 500);
    take.mark("balance-ready");
    await drift(page, [[1700, 420], [1740, 620]], { ms: 1200, pause: 1500 });
    await moveAndClick(page, 'button[aria-label="Close the designer"]', "close the designer", { after: 800 });

    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await wait(1200);
    take.mark("behind");
    await moveAndClick(page, 'button:has-text("Behind the scenes")', "Behind the scenes", { after: 1800 });
    await glide(page, [960, 600], 500);
    for (let i = 0; i < 40; i++) {
      await page.mouse.wheel(0, 40);
      await wait(70);
    }
    await wait(1500);
    await take.stop();
  },

  /**
   * The mochi game played through in one go, for Part 1: steam a friend, put two alike together,
   * hand the new friend to the guest who asked for it, open the shop and buy a golden batch. Set
   * up first with the test page's tools, off camera, and the tools folded away before recording;
   * the edit shows only the strip and the shop.
   */
  async mochi(browser) {
    const page = await openPage(browser);
    await page.goto(`${BASE}/?mochi`, { waitUntil: "domcontentloaded" });
    await page.locator(".mochi-steamer").first().waitFor({ timeout: 20_000 });
    await wait(1000);
    const tools = page.locator(".mochi-test");
    const tool = (label) => tools.locator(`button:text-is("${label}")`).first().click();
    // A clean blanket, coins for the shop, and guests at every place.
    await tool("Clear it");
    await tool("+100 coins");
    await tool("New guests now");
    await wait(1200);
    const names = ["Dewdrop", "Mochi", "Sakura mochi", "Matcha mochi", "Chick", "Bunny", "Kitty", "Bear", "Panda", "Moon"];
    const label = await page.locator(".mochi-order-main").first().getAttribute("aria-label");
    const want = names.indexOf(label.split(": ")[1].split(",")[0].trim());
    if (want < 1) throw new Error(`the first guest wants ${label}; start again for a guest who wants more than a dewdrop`);
    log(`the first guest: ${label}`);
    // Two of the friend one below what the guest wants, to put together on camera.
    await tools.locator("select").selectOption(String(want - 1));
    await tool("Add two");
    await page.locator('button[aria-label="Hide the test tools"]').click();
    await wait(800);

    const spotOf = async (name, skip = -1) => {
      const boxes = await page.$$eval(".mochi-spot", (els) => els.map((el) => [el.getAttribute("aria-label"), el.getBoundingClientRect().toJSON()]));
      const found = boxes.map(([n, r], i) => ({ n, r, i })).filter(({ n, i }) => n === name && i !== skip);
      return found.map(({ r, i }) => ({ i, at: [r.x + r.width / 2, r.y + r.height / 2] }));
    };
    const drag = async (from, to) => {
      await glide(page, from, 450);
      await wait(150);
      await page.mouse.down();
      await glide(page, [from[0] + (to[0] - from[0]) * 0.15, from[1] - 6], 140);
      await glide(page, to, 550);
      await wait(120);
      await page.mouse.up();
    };

    const take = await new Take(page, "mochi").start();
    await wait(400);
    take.mark("steam");
    await moveAndClick(page, ".mochi-steamer", "steam a friend", { settle: 120, after: 700 });
    take.mark("merge");
    const pair = await spotOf(names[want - 1]);
    if (pair.length < 2) throw new Error(`no pair of ${names[want - 1]} on the blanket`);
    await drag(pair[0].at, pair[1].at);
    await wait(700);
    take.mark("serve");
    const made = (await spotOf(names[want]))[0];
    const order = await page.locator(".mochi-order-main").first().boundingBox();
    await drag(made.at, [order.x + order.width / 2, order.y + order.height / 2]);
    await wait(1100);
    take.mark("shop");
    await moveAndClick(page, ".mochi-shop-open", "open the shop", { settle: 120, after: 900 });
    take.mark("buy");
    await moveAndClick(page, '.mochi-shop-menu button:has-text("Golden batch")', "buy a golden batch", { settle: 150, after: 1400 });
    await drift(page, [[760, 960]], { ms: 600, pause: 600 });
    await take.stop();
  },

  /**
   * One merge, for Part 1: the steamer clicked once, then the pointer goes right and puts one mochi
   * on another, which become a sakura mochi (a new friend met). Set up with the test page's tools,
   * off camera; the edit shows only the strip.
   */
  async merge(browser) {
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
    await page.locator('button[aria-label="Hide the test tools"]').click();
    await wait(800);
    const mochi = await page.$$eval('.mochi-spot[aria-label="Mochi"]', (els) => els.map((el) => { const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
    if (mochi.length < 2) throw new Error("no pair of mochi on the blanket");
    await glide(page, [430, 900], 300);

    const take = await new Take(page, "merge").start();
    await wait(500);
    take.mark("steam");
    await moveAndClick(page, ".mochi-steamer", "steam a friend", { settle: 150, after: 500 });
    take.mark("merge");
    const [from, to] = mochi;
    await glide(page, from, 700);
    await wait(150);
    await page.mouse.down();
    await glide(page, [from[0] + (to[0] - from[0]) * 0.15, from[1] - 6], 160);
    await glide(page, to, 650);
    await wait(120);
    await page.mouse.up();
    await wait(1600);
    await take.stop();
  },

  /**
   * Part 1's game being played: Tidehearth with bots in every seat, the pointer drawing slowly
   * across the water (its tiles near 767,197; 772,324; 617,377) so it ripples as the pieces land.
   */
  async play(browser) {
    const page = await openPage(browser);
    await page.goto(table(TIDEHEARTH, "&watch&bots"), { waitUntil: "networkidle" });
    await wait(3000);
    await glide(page, [600, 520], 300);
    const take = await new Take(page, "play").start();
    await wait(400);
    take.mark("play");
    await drift(page, [[767, 205], [790, 320], [620, 380], [700, 260], [767, 190], [620, 370], [760, 330]], { ms: 1500, pause: 250 });
    await wait(1500);
    await take.stop();
  },

  /**
   * Part 2's walk through the made game, in one take for the screen (--screen): its table with bots,
   * Muse Spark Open in the other seats, a house rule typed (not applied: the version two it makes
   * is in the after take), then the revised game: its painted table, a turn, its rulebook, its
   * print-and-play kit, the Balance tab, the invite link, and BoardDream's Behind the scenes.
   * --game=<id> --revised=<id>.
   * A rehearsal puts bots in Muse Spark Open's seats, so it spends nothing.
   */
  async walk(browser) {
    const game = arg("game");
    const revised = arg("revised");
    const rule = arg("rule", "Every kin starts the game with one extra timber.");
    if (!game || !revised) throw new Error("which games? --game=<id> --revised=<id>");
    const page = await openPage(browser);
    await signIn(page, AICHEN);
    await page.goto(table(game, "&watch&bots"), { waitUntil: "networkidle" });
    await wait(3000);
    const take = await new Take(page, "walk").start();
    await wait(400);
    take.mark("table");
    await drift(page, [[700, 420], [900, 520], [1150, 430]], { ms: 1300, pause: 600 });
    await wait(3000);

    await page.goto(table(game, REHEARSE ? "&watch&bots" : "&watch"), { waitUntil: "networkidle" });
    take.mark("rivals");
    await wait(REHEARSE ? 2000 : 30_000);

    await page.goto(table(game), { waitUntil: "networkidle" });
    await wait(2500);
    await moveAndClick(page, 'button:has-text("Designer")', "Designer", { after: 1200 });
    take.mark("rules");
    await typeSlowly(page, "textarea", rule, "change the rules");
    await wait(2500);

    await page.goto(table(revised, "&bots"), { waitUntil: "networkidle" });
    await wait(2500);
    take.mark("painted-table");
    await drift(page, [[600, 420], [900, 520], [1150, 400]], { ms: 1300, pause: 600 });
    await wait(1500);

    take.mark("turn");
    await drift(page, [[700, 420], [960, 880]], { ms: 1100, pause: 500 });
    await moveAndClick(page, 'button:has-text("fell timber")', "fell timber", { after: 2600 });
    await drift(page, [[900, 880], [1020, 880]], { ms: 900, pause: 400 });

    take.mark("rulebook");
    await moveAndClick(page, 'header button:has-text("Rules")', "Rules", { after: 1800 });
    for (let i = 0; i < 12; i++) {
      await page.mouse.wheel(0, 60);
      await wait(60);
    }
    await wait(1500);
    await page.keyboard.press("Escape");
    await wait(800);

    // Print and play: the rules, the board and the cards on A4 (the print button itself would open
    // the system's dialog, so the kit is only shown).
    take.mark("print");
    await moveAndClick(page, 'button[aria-label="More"]', "More", { after: 600 });
    await moveAndClick(page, '[role="menuitem"]:has-text("Print and play")', "Print and play", { after: 2500 });
    await glide(page, [960, 640], 400);
    for (let i = 0; i < 30; i++) {
      await page.mouse.wheel(0, 70);
      await wait(60);
    }
    await wait(1200);
    await moveAndClick(page, 'button[aria-label="Close the print kit"]', "close the print kit", { after: 1000 });

    take.mark("balance");
    await moveAndClick(page, 'button:has-text("Designer")', "Designer", { after: 1000 });
    await moveAndClick(page, 'button:text-is("Balance")', "Balance tab", { after: 500 });
    // The tab plays its games in the page first; the edit plays that wait fast.
    if (!REHEARSE) await until(async () => !(await visible(page, "text=Measuring")), 120_000, 300);
    take.mark("balance-ready");
    await drift(page, [[1700, 420], [1740, 620]], { ms: 1200, pause: 1500 });
    await moveAndClick(page, 'button[aria-label="Close the designer"]', "close the designer", { after: 1500 });

    take.mark("invite");
    await moveAndClick(page, 'button:has-text("Invite friends")', "Invite friends", { after: 2500 });
    await moveAndClick(page, 'button:has-text("Copy")', "copy the link", { after: 3000 });

    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await wait(1200);
    take.mark("behind");
    await moveAndClick(page, 'button:has-text("Behind the scenes")', "Behind the scenes", { after: 1800 });
    await glide(page, [960, 600], 500);
    for (let i = 0; i < 40; i++) {
      await page.mouse.wheel(0, 40);
      await wait(70);
    }
    await wait(1500);
    await take.stop();
  },

  /** Cloudwaft Harbor: bots launch charters and the cards' abilities fire gold. */
  async cards(browser) {
    const page = await openPage(browser);
    await page.goto(table(CLOUDWAFT, "&watch&bots"), { waitUntil: "networkidle" });
    await wait(2500);
    const take = await new Take(page, "cards").start();
    await drift(page, [[900, 600], [1200, 500], [800, 700]], { ms: 1500, pause: 1500 });
    await wait(18_000);
    await take.stop();
  },

  /** Fogfall Lanterns with Muse Spark Open in every seat: they speak, accuse and vote. */
  async rivals(browser) {
    const page = await openPage(browser);
    await page.goto(table(FOGFALL, "&watch"), { waitUntil: "networkidle" });
    await wait(2500);
    if (REHEARSE) return;
    const take = await new Take(page, "rivals").start();
    await wait(60_000);
    await take.stop();
  },

  /** Tidehearth's painted board switched off and on in the Art panel. */
  async painted(browser) {
    const page = await openPage(browser);
    await page.goto(table(TIDEHEARTH, "&bots"), { waitUntil: "networkidle" });
    await wait(3000);
    await page.keyboard.press("f");
    await wait(800);
    await page.locator('button:text-is("Art")').first().click();
    await wait(800);
    const toggle = page.locator("label.art-toggle").first();
    await ensureVisible(page, toggle, "show the painted board");
    if (REHEARSE) return;
    await toggle.click();
    await wait(1500);
    const take = await new Take(page, "painted").start();
    await wait(1500);
    await moveAndClick(page, toggle, "show the painted board", { after: 3500 });
    await drift(page, [[600, 420], [780, 520]], { ms: 1200, pause: 800 });
    await wait(1500);
    await take.stop();
  },
};

const name = process.argv[2];
if (!takes[name]) {
  console.error(`which take? ${Object.keys(takes).join(", ")}`);
  process.exit(1);
}
const browser = await launch();
try {
  await takes[name](browser);
  log(REHEARSE ? `REHEARSAL PASSED: ${name}` : `done: ${name}`);
} finally {
  await browser.close();
}
