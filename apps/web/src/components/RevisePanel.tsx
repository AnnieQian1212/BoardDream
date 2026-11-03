import type { GameModule } from "@boarddream/engine";
import { PencilLine } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { DesignEvent, PlayStats, ReviseReply } from "../../../server/src/agent/protocol";
import { generatedSource, loadGeneratedGame } from "../generated";
import { DESIGN_SILENCE_MS, revisionStatus } from "../generation";
import { readEvents } from "../sse";

/** What the change did, kept until another game is revised. */
interface Comparison {
  request: string;
  gameId: string;
  before?: PlayStats;
  after?: PlayStats;
  added: string[];
  removed: string[];
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * Change a generated game in words: the server rewrites its rules, playtests them like a new game
 * and saves the result as a new version next to the old one. The panel then compares the two.
 */
export function RevisePanel({ game, onRevised }: { game: GameModule; onRevised(game: GameModule): void }) {
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [comparison, setComparison] = useState<Comparison>();
  const source = generatedSource(game);
  const shown = comparison?.gameId === game.meta.id ? comparison : undefined;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus("Starting…");
    try {
      const res = await fetch("/api/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: game.meta.id, source, request }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? res.statusText);
      let result: ReviseReply | undefined;
      let failure: string | undefined;
      await readEvents(
        res,
        (event, data) => {
          if (event === "design") {
            const status = revisionStatus(JSON.parse(data) as DesignEvent);
            if (status) setStatus(status);
          } else if (event === "result") result = JSON.parse(data) as ReviseReply;
          else if (event === "error") failure = data;
        },
        DESIGN_SILENCE_MS,
      );
      if (!result) throw new Error(failure ?? "the server closed the connection");
      if (!result.ok) {
        setStatus(`The change still fails playtesting after ${result.attempts.length} rounds; the game is unchanged.`);
        return;
      }
      const revised = loadGeneratedGame(result.source, result.id, result.rulesAfter, result.title);
      setComparison({
        request,
        gameId: revised.meta.id,
        before: result.before,
        after: result.after,
        added: result.rulesAfter.filter((rule) => !result!.rulesBefore.includes(rule)),
        removed: result.rulesBefore.filter((rule) => !result!.rulesAfter.includes(rule)),
      });
      setRequest("");
      setStatus("");
      onRevised(revised);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>
        <PencilLine size={17} /> Change the rules
      </h2>
      {shown ? (
        <RevisionReport comparison={shown} />
      ) : (
        <p className="hint">Say what to change, as you would after a playtest. BoardDream rewrites the rules, tests them again and keeps the old version.</p>
      )}
      <textarea
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        placeholder="Trading is too cheap: make it 3 for 1, and add a scoring round halfway through."
        rows={3}
        maxLength={600}
        required
      />
      <button type="submit" className="action wide" disabled={busy || !source}>
        <PencilLine size={16} /> {busy ? "Revising…" : "Apply the change"}
      </button>
      {status && <p className="hint status-line">{status}</p>}
    </form>
  );
}

function RevisionReport({ comparison }: { comparison: Comparison }) {
  const { before, after, added, removed, request } = comparison;
  const spread = (s: PlayStats) => {
    const rates = s.winRateBySeat.map((r) => Math.round(r * 100));
    return `${Math.min(...rates)}–${Math.max(...rates)}%`;
  };
  const rows: [string, (s: PlayStats) => string][] = [
    ["Median length, moves", (s) => String(s.medianTurns)],
    ["Seat win rates", spread],
    ["Turns with a choice", (s) => pct(s.choiceRate)],
    ["Planner beats random", (s) => (s.plannerWinRate === undefined ? "–" : pct(s.plannerWinRate))],
  ];
  return (
    <div className="revision">
      <p className="hint">“{request}”</p>
      {before && after && (
        <table className="revision-table">
          <thead>
            <tr>
              <th />
              <th>Before</th>
              <th>After</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, show]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{show(before)}</td>
                <td>{show(after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {added.length > 0 && (
        <>
          <h3>New or changed rules</h3>
          <ul>
            {added.map((rule, i) => (
              <li key={i}>{rule}</li>
            ))}
          </ul>
        </>
      )}
      {removed.length > 0 && <p className="hint">{removed.length === 1 ? "One rule was rewritten or dropped." : `${removed.length} rules were rewritten or dropped.`}</p>}
    </div>
  );
}
