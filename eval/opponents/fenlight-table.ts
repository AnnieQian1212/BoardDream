// A Fenlight table where the model plays every seat's statements and votes (Fenlight's own bot
// plays the nights and advises), written out as a transcript: who claimed what, why, and who was
// exiled. Replies are cached in cache/, the transcript lands in out/.
//
//   npx tsx eval/opponents/fenlight-table.ts [seed] [open]
import { mkdirSync, writeFileSync } from "node:fs";
import { createRng, resolveParams } from "@boarddream/engine";
import { fenlight, socialMoves, tableBot, tableText, type FenlightMove, type FenlightParams, type FenlightState } from "@boarddream/library";
import { chooseMove } from "../../apps/server/src/agent/opponent";
import { config } from "../../apps/server/src/config";
import { CachedModelClient } from "../../apps/server/src/meta/cache";

const here = new URL("./", import.meta.url);
const seed = Number(process.argv[2] ?? 11);
const open = process.argv[3] === "open";
const llm = new CachedModelClient(open ? config.openModel : { ...config.meta, model: config.models.designer }, new URL("cache/", here));
const NUM_PLAYERS = 7;

const rng = createRng(seed);
let state = fenlight.setup({ numPlayers: NUM_PLAYERS, params: resolveParams(fenlight.params) as FenlightParams, rng });
const history: { seat: number; before: FenlightState; move: FenlightMove }[] = [];
const lines = [`Roles: ${state.roles.map((role, seat) => `P${seat + 1} ${role}`).join(", ")}`];
let decisions = 0;
let overruled = 0;
let failures = 0;

while (!fenlight.isTerminal(state)) {
  const [seat] = fenlight.activePlayers(state);
  const moves = fenlight.legalMoves(state, seat);
  const advice = tableBot(fenlight)({ game: fenlight, state: fenlight.view!(state, seat), player: seat, moves, rng }) as FenlightMove;
  const social = socialMoves(fenlight, state, seat, moves) as FenlightMove[];
  let move = advice;
  let say = "";
  if (social.includes(advice)) {
    decisions++;
    try {
      const reply = await chooseMove(llm, {
        game: fenlight.meta.name,
        rules: fenlight.meta.rules ?? [],
        seat,
        numPlayers: NUM_PLAYERS,
        table: tableText(fenlight, state, seat),
        // Each seat hears the moves as it saw them: night choices and votes stay secret.
        recent: history.slice(-14).map((h) => `P${h.seat + 1} ${fenlight.describeMove!(h.before, h.move, seat)}`),
        moves: social.map((m) => fenlight.describeMove!(state, m, seat)),
        advice: social.indexOf(advice),
      });
      move = social[reply.move];
      say = reply.say;
      if (move !== advice) overruled++;
    } catch (err) {
      failures++;
      lines.push(`  (P${seat + 1} fell back to the bot: ${String(err).slice(0, 120)})`);
    }
  }
  const before = state;
  if (state.phase !== "night") {
    lines.push(`N${state.night} ${state.phase} P${seat + 1} (${state.roles[seat]}): ${fenlight.describeMove!(state, move)}${say ? ` - "${say}"` : ""}`);
  }
  history.push({ seat, before, move });
  state = fenlight.applyMove(state, seat, move, rng);
  if (state.reports.length > before.reports.length) {
    const r = state.reports[state.reports.length - 1];
    const posts = r.posts.map((post, i) => `${post.map((s) => `P${s + 1}`).join("+")}${r.dark.includes(i) ? " dark" : " lit"}`);
    lines.push(`--- Dawn ${r.night}: ${posts.join(", ")}; ${r.lost} boat${r.lost === 1 ? "" : "s"} lost`);
  }
  if (state.days.length > before.days.length) {
    const exiled = state.days[state.days.length - 1].exiled;
    lines.push(`--- Vote: ${exiled === null ? "nobody exiled" : `P${exiled + 1} exiled (${state.roles[exiled]})`}`);
  }
}

lines.push(
  `Winner: the ${state.winner}s, ${state.boatsLost} boats lost. ${decisions} decisions by ${llm.model}: ${overruled} overruled the bot, ${failures} fell back; ${llm.usage.calls} new calls, ${llm.hits} cached.`,
);
mkdirSync(new URL("out/", here), { recursive: true });
writeFileSync(new URL(`out/fenlight-${seed}.txt`, here), lines.join("\n") + "\n");
console.log(lines.join("\n"));
