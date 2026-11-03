// ui-demo phase 1: lists what can be clicked and typed on each page the takes use.
//   node video/record/discover.mjs
import { BASE, launch, openPage, signIn, wait } from "./lib.mjs";

const dump = (page, title) =>
  page
    .evaluate(() =>
      [...document.querySelectorAll("button, input, select, textarea, a, [role=tab], [role=slider]")]
        .filter((el) => el.offsetParent !== null)
        .map((el) => {
          const r = el.getBoundingClientRect();
          const text = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").trim().replace(/\s+/g, " ").slice(0, 50);
          return `${el.tagName.toLowerCase()}${el.type ? `[${el.type}]` : ""}${el.className ? `.${String(el.className).split(" ")[0]}` : ""} "${text}" @${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}`;
        }),
    )
    .then((items) => console.log(`\n== ${title}\n  ${items.join("\n  ")}`));

const browser = await launch();
const page = await openPage(browser);
await signIn(page, { email: "aichen@example.com", password: "game-night-demo", name: "Aichen" });
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
await wait(1500);
await dump(page, "home");
await page.getByRole("button", { name: /Advanced settings/ }).click();
await wait(600);
await dump(page, "home, advanced settings open");

await page.goto(`${BASE}/?game=tidehearth-mw0zl535&bots`, { waitUntil: "networkidle" });
await wait(2500);
await dump(page, "table (Tidehearth)");
await page.keyboard.press("f");
await wait(700);
for (const tab of ["Rules", "Balance", "Art"]) {
  await page.getByRole("tab", { name: tab }).click().catch(() => page.getByRole("button", { name: tab, exact: true }).click());
  await wait(900);
  await dump(page, `designer: ${tab}`);
}
await page.keyboard.press("Escape");
await wait(400);
await page.getByRole("button", { name: /Invite friends/ }).click();
await wait(1500);
await dump(page, "invite friends");
console.log("\nurl:", page.url());
await browser.close();
