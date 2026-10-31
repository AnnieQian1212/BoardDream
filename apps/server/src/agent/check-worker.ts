// Worker entry for checkRulesIsolated: loads generated rules and either fuzzes a share of the
// runs or playtests them, announcing each run or game first so the parent can name the one that
// hangs and count progress.
import { parentPort, workerData } from "node:worker_threads";
import { fuzz, resolveParams, type GameModule } from "@boarddream/engine";
import { loadGameFromSource } from "../sandbox";
import type { WorkerMessage, WorkerTask } from "./check";
import { playIssues, playtest, playtestPlayers } from "./playtest";

const { source, task } = workerData as { source: string; task: WorkerTask };
const post = (message: WorkerMessage) => parentPort!.postMessage(message);

let game: GameModule | undefined;
try {
  game = loadGameFromSource(source);
} catch (err) {
  post({ type: "done", result: { ok: false, loadError: err instanceof Error ? err.message : String(err), failures: [] } });
}
if (game && task.kind === "fuzz") {
  const report = fuzz(game, { runs: task.runs, seed: task.seed, onRun: ({ seed, numPlayers, params }) => post({ type: "run", seed, numPlayers, params }) });
  post({ type: "done", result: { ok: report.ok, failures: report.failures } });
} else if (game) {
  // Rules that never break still get a quick playtest for games not worth playing.
  const numPlayers = playtestPlayers(game);
  const params = resolveParams(game.params);
  const play = playtest(game, { onGame: (seed) => post({ type: "run", seed, numPlayers, params }) });
  post({ type: "done", result: { ok: true, failures: [], play, issues: playIssues(play, game.meta.mode) } });
}
