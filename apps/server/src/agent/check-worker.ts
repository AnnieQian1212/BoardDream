// Worker entry for checkRulesIsolated: loads generated rules, fuzzes them and reports back,
// announcing each run first so the parent can name the run that hangs.
import { parentPort, workerData } from "node:worker_threads";
import { fuzz, resolveParams, type GameModule } from "@boarddream/engine";
import { loadGameFromSource } from "../sandbox";
import type { WorkerMessage } from "./check";
import { playIssues, playtest, playtestPlayers } from "./playtest";

const { source, runs } = workerData as { source: string; runs: number };
const post = (message: WorkerMessage) => parentPort!.postMessage(message);

let game: GameModule | undefined;
try {
  game = loadGameFromSource(source);
} catch (err) {
  post({ type: "done", result: { ok: false, loadError: err instanceof Error ? err.message : String(err), failures: [] } });
}
if (game) {
  const report = fuzz(game, { runs, onRun: ({ seed, numPlayers, params }) => post({ type: "run", seed, numPlayers, params }) });
  if (!report.ok) post({ type: "done", result: { ok: false, failures: report.failures } });
  else {
    // Rules that never break still get a quick playtest for games not worth playing. Each of its
    // games is announced too, so the watchdog can tell a slow playtest from a hung one.
    const numPlayers = playtestPlayers(game);
    const params = resolveParams(game.params);
    const play = playtest(game, { onGame: (seed) => post({ type: "run", seed, numPlayers, params }) });
    post({ type: "done", result: { ok: true, failures: [], play, issues: playIssues(play, game.meta.mode) } });
  }
}
