// The demo video's takes (docs/VIDEO.md). Each is run on its own, after a rehearsal:
//   node video/record/takes.mjs <take> --rehearse     every selector checked, nothing recorded
//   node video/record/takes.mjs <take>                recorded to video/remotion/public/footage
// Takes: primer (Part 2's one continuous take, which makes a game for real), friends, table, cards,
// rivals, painted. The local servers must be running (web on :5173, API on :8787).
import { BASE, REHEARSE, SIZE, Take, drift, ensureVisible, glide, launch, log, moveAndClick, openPage, signIn, typeSlowly, wait } from "./lib.mjs";

const AICHEN = { email: "aichen@example.com", password: "game-night-demo", name: "Aichen" };
const MIRA = { email: "mira@example.com", password: "game-night-demo", name: "Mira" };
const TIDEHEARTH = "tidehearth-mw0zl535";
const CLOUDWAFT = "cloudwaft-harbor-mw0zp3es";
const FOGFALL = "fogfall-lanterns-mw0zerzb";
const HERO_IDEA = "Cafes on one busy street";
/** The game the primer take made; the after take plays it again with no guide over the table. */
const HERO = "copper-grind-mw166meu";
/** Close-ups are recorded at twice the pixels with --2x, saved as <take>-2x. */
const SCALE = process.argv.includes("--2x") ? 2 : 1;
const named = (take) => (SCALE > 1 ? `${take}-2x` : take);
const HOUSE_RULE = "Every cafe starts the game with one extra coin.";

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

const takes = {
  /** Part 2: home, a game made for real, played, changed, painted, shared; then the games. */
  async primer(browser) {
    const page = await openPage(browser);
    await signIn(page, AICHEN);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await wait(1500);
    const take = await new Take(page, "primer").start();
    take.mark("home");
    await drift(page, [[960, 300], [760, 400], [1180, 420]], { ms: 900, pause: 250 });
    await moveAndClick(page, `button:has-text("${HERO_IDEA}")`, "example idea", { after: 1400 });
    take.mark("idea");
    await moveAndClick(page, 'button:has-text("Advanced settings")', "Advanced settings", { after: 1000 });
    const minPlayers = page.locator('input[type="number"]').first();
    await moveAndClick(page, minPlayers, "fewest players", { after: 200 });
    if (!REHEARSE) {
      await page.keyboard.press("Control+A");
      await page.keyboard.type("3", { delay: 120 });
      await wait(900);
    }
    take.mark("settings");
    if (REHEARSE) return ensureVisible(page, 'button:has-text("Dream it up")', "Dream it up");
    await moveAndClick(page, 'button:has-text("Dream it up")', "Dream it up", { after: 500 });
    take.mark("dream");

    // The making screen: the first half minute at full rate, then a few frames a second until it is ready.
    await wait(25_000);
    take.rate(6);
    const seen = new Set();
    const ready = await until(async () => {
      for (const step of ["Pick tested mechanics", "Write the rules", "Playtest"]) {
        if (!seen.has(step) && (await page.locator(`.gen-step.now:has-text("${step}"), [class*=step][class*=now]:has-text("${step}")`).count()) > 0) {
          seen.add(step);
          take.mark(`step:${step}`);
        }
      }
      return visible(page, 'button:has-text("Start playing")');
    }, 20 * 60_000, 2000);
    if (!ready) throw new Error("the game was not ready in 20 minutes");
    take.rate(30);
    take.mark("ready");
    await wait(2500);
    await moveAndClick(page, 'button:has-text("Start playing")', "Start playing", { after: 2500 });
    take.mark("table");
    if (await visible(page, 'button:has-text("Got it")')) {
      await wait(3500);
      await moveAndClick(page, 'button:has-text("Got it")', "Got it", { after: 1200 });
    }
    const hero = new URL(page.url()).searchParams.get("game");
    log("hero game:", hero);
    await drift(page, [[700, 400], [900, 500], [1100, 420]], { ms: 1000, pause: 400 });

    // The rivals: Muse Spark Open plays every seat and talks.
    await page.goto(`${BASE}/?game=${hero}&watch`, { waitUntil: "networkidle" });
    take.mark("rivals");
    await wait(30_000);

    // A house rule, in words.
    await page.goto(`${BASE}/?game=${hero}`, { waitUntil: "networkidle" });
    await wait(2000);
    if (await visible(page, 'button:has-text("Got it")')) await moveAndClick(page, 'button:has-text("Got it")', "Got it", { after: 800 });
    await moveAndClick(page, 'button:has-text("Designer")', "Designer", { after: 1200 });
    take.mark("rules");
    await typeSlowly(page, "textarea", HOUSE_RULE, "change the rules");
    if (REHEARSE) return ensureVisible(page, 'button:has-text("Apply the change")', "Apply the change");
    await moveAndClick(page, 'button:has-text("Apply the change")', "Apply the change", { after: 3000 });
    take.mark("revise");
    take.rate(6);
    const revised = await until(() => visible(page, 'button:has-text("Apply the change")'), 15 * 60_000, 2000);
    take.rate(30);
    take.mark(revised ? "revised" : "revise-timeout");
    await wait(6000);

    // The board, painted and checked.
    await moveAndClick(page, 'button:text-is("Art")', "Art tab", { after: 1200 });
    const paint = page.locator('button:has-text("Paint the board"), button:has-text("Repaint the board")').first();
    if (await paint.isVisible().catch(() => false)) {
      await moveAndClick(page, paint, "paint the board", { after: 1500 });
      take.mark("paint");
      take.rate(6);
      await until(async () => !(await visible(page, 'button:has-text("Cancel")')), 6 * 60_000, 2000);
      take.rate(30);
      take.mark("painted");
      await wait(3500);
    }
    await moveAndClick(page, 'button[aria-label="Close the designer"]', "close the designer", { after: 2500 });
    await drift(page, [[600, 420], [900, 520], [1150, 400]], { ms: 1100, pause: 500 });

    // Friends, by a link.
    await moveAndClick(page, 'button:has-text("Invite friends")', "Invite friends", { after: 2500 });
    take.mark("invite");
    await moveAndClick(page, 'button:has-text("Copy")', "copy the link", { after: 2500 });

    // The games, and home.
    await page.goto(`${BASE}/?games`, { waitUntil: "networkidle" });
    take.mark("games");
    await wait(1500);
    if (!REHEARSE) {
      for (let i = 0; i < 6; i++) {
        await page.mouse.wheel(0, 260);
        await wait(450);
      }
    }
    await wait(1500);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    take.mark("close");
    await drift(page, [[960, 250], [960, 420]], { ms: 1200, pause: 1500 });
    await wait(3000);
    await take.stop();
  },

  /** The home page up close: an example idea picked, the cursor over Dream it up. */
  async home(browser) {
    const page = await openPage(browser, { scale: SCALE });
    await signIn(page, AICHEN);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    await wait(1500);
    const take = await new Take(page, named("home")).start();
    await drift(page, [[960, 330], [700, 400]], { ms: 900, pause: 300 });
    await moveAndClick(page, `button:has-text("${HERO_IDEA}")`, "example idea", { after: 1200 });
    const dream = await ensureVisible(page, 'button:has-text("Dream it up")', "Dream it up");
    if (!REHEARSE) {
      const box = await dream.boundingBox();
      await glide(page, [box.x + box.width / 2, box.y + box.height / 2], 900);
      await wait(2500);
    }
    await take.stop();
  },

  /** A house rule typed into Change the rules, up close; not applied. */
  async rule(browser) {
    const page = await openPage(browser, { scale: SCALE });
    await page.goto(`${BASE}/?game=${HERO}&bots`, { waitUntil: "networkidle" });
    await wait(2500);
    await moveAndClick(page, 'button:has-text("Designer")', "Designer", { after: 1200 });
    const take = await new Take(page, named("rule")).start();
    await wait(600);
    await typeSlowly(page, "textarea", HOUSE_RULE, "change the rules", 55);
    const apply = await ensureVisible(page, 'button:has-text("Apply the change")', "Apply the change");
    if (!REHEARSE) {
      const box = await apply.boundingBox();
      await glide(page, [box.x + box.width / 2, box.y + box.height / 2], 800);
      await wait(2000);
    }
    await take.stop();
  },

  /** After the game is made: Copper Grind played, Muse Spark Open in the other seats, a house rule, the board painted, a link to share. */
  async after(browser) {
    const page = await openPage(browser);
    await signIn(page, AICHEN);
    await page.goto(`${BASE}/?game=${HERO}&watch&bots`, { waitUntil: "networkidle" });
    await wait(2500);
    const take = await new Take(page, "after").start();
    take.mark("table");
    await drift(page, [[700, 420], [900, 520], [1150, 430]], { ms: 1300, pause: 600 });
    await wait(5000);

    await page.goto(`${BASE}/?game=${HERO}&watch`, { waitUntil: "networkidle" });
    take.mark("rivals");
    await wait(32_000);

    await page.goto(`${BASE}/?game=${HERO}`, { waitUntil: "networkidle" });
    await wait(2500);
    take.mark("table-mine");
    await moveAndClick(page, 'button:has-text("Designer")', "Designer", { after: 1200 });
    take.mark("rules");
    await typeSlowly(page, "textarea", HOUSE_RULE, "change the rules");
    // A rehearsal stops before anything that spends model calls: the change and the painting.
    if (REHEARSE) {
      await ensureVisible(page, 'button:has-text("Apply the change")', "Apply the change");
      return;
    }
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
    await host.goto(`${BASE}/?game=${CLOUDWAFT}`, { waitUntil: "networkidle" });
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
    const page = await openPage(browser, { scale: SCALE });
    await page.goto(`${BASE}/?game=${TIDEHEARTH}&watch&bots`, { waitUntil: "networkidle" });
    await wait(2500);
    const take = await new Take(page, named("table")).start();
    await drift(page, [[600, 420], [470, 470], [640, 380], [780, 330], [620, 600], [450, 600], [700, 520]], { ms: 1400, pause: 300 });
    await wait(3000);
    await take.stop();
  },

  /** Cloudwaft Harbor: bots launch charters and the cards' abilities fire gold. */
  async cards(browser) {
    const page = await openPage(browser, { scale: SCALE });
    await page.goto(`${BASE}/?game=${CLOUDWAFT}&watch&bots`, { waitUntil: "networkidle" });
    await wait(2000);
    const take = await new Take(page, named("cards")).start();
    await drift(page, [[900, 600], [1200, 500], [800, 700]], { ms: 1500, pause: 1500 });
    await wait(18_000);
    await take.stop();
  },

  /** Fogfall Lanterns with Muse Spark Open in every seat: they speak, accuse and vote. */
  async rivals(browser) {
    const page = await openPage(browser);
    await page.goto(`${BASE}/?game=${FOGFALL}&watch`, { waitUntil: "networkidle" });
    await wait(2000);
    if (REHEARSE) return;
    const take = await new Take(page, "rivals").start();
    await wait(60_000);
    await take.stop();
  },

  /** Tidehearth's painted board switched off and on in the Art panel. */
  async painted(browser) {
    const page = await openPage(browser, { scale: SCALE });
    await page.goto(`${BASE}/?game=${TIDEHEARTH}&bots`, { waitUntil: "networkidle" });
    await wait(2500);
    await page.keyboard.press("f");
    await wait(800);
    await page.locator('button:text-is("Art")').first().click();
    await wait(800);
    const toggle = page.locator("label.art-toggle").first();
    await ensureVisible(page, toggle, "show the painted board");
    if (REHEARSE) return;
    await toggle.click();
    await wait(1500);
    const take = await new Take(page, named("painted")).start();
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
void SIZE;
void glide;
