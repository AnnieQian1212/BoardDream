import type { GameModule, PlayMode } from "@boarddream/engine";
import { Sparkles, Wand2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { loadGeneratedGame } from "../generated";
import { readEvents } from "../sse";

/** Mirrors Dials in apps/server/src/agent/spec.ts. */
interface Dials {
  minPlayers: number;
  maxPlayers: number;
  playMinutes: number;
  complexity: number;
  luck: number;
  mode: PlayMode;
}

interface GenerateResult {
  /** Where the server saved the game; it joins the picker on later visits. */
  id?: string;
  ok: boolean;
  spec: { title: string; rules?: string[] };
  source: string;
  retrieved: string[];
  attempts: unknown[];
}

/** Friendly text for the designer's progress events. */
function progressText(event: string): string {
  if (event === "drafting spec") return "Drafting the design…";
  if (event === "retrieving mechanics") return "Finding mechanics in the library…";
  if (event === "writing rules") return "Writing the rules…";
  const fuzzing = event.match(/^fuzzing attempt (\d+)/);
  if (fuzzing) return Number(fuzzing[1]) === 0 ? "Playtesting 1,000 games…" : `Playtesting fix ${fuzzing[1]}…`;
  if (event.startsWith("repairing")) return `Fixing what broke (${event.replace(/^repairing:?\s*/, "")})…`;
  return event;
}

const MODES: { value: PlayMode; label: string }[] = [
  { value: "competitive", label: "Versus" },
  { value: "cooperative", label: "Co-op" },
  { value: "hidden-role", label: "Hidden role" },
];

/** `available` is false when no server can generate (e.g. the static demo); games generated earlier still play. */
export function CreatePanel({ available, onGenerated }: { available: boolean; onGenerated(game: GameModule): void }) {
  const [prompt, setPrompt] = useState("");
  const [dials, setDials] = useState<Dials>({
    minPlayers: 2,
    maxPlayers: 4,
    playMinutes: 60,
    complexity: 4,
    luck: 0.3,
    mode: "competitive",
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const set = <K extends keyof Dials>(key: K, value: Dials[K]) => setDials({ ...dials, [key]: value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus("Starting…");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, dials }),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error?: string }).error ?? res.statusText);
      let result: GenerateResult | undefined;
      let failure: string | undefined;
      await readEvents(res, (event, data) => {
        if (event === "progress") setStatus(progressText(data));
        else if (event === "result") result = JSON.parse(data) as GenerateResult;
        else if (event === "error") failure = data;
      });
      if (!result) throw new Error(failure ?? "the server closed the connection");
      const tries = `${result.attempts.length} playtest round${result.attempts.length === 1 ? "" : "s"}`;
      if (!result.ok) {
        setStatus(`“${result.spec.title}” still fails playtesting after ${tries}.`);
        return;
      }
      onGenerated(loadGeneratedGame(result.source, result.id, result.spec.rules));
      setStatus(`“${result.spec.title}” passed after ${tries}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel create" onSubmit={submit}>
      <h2>
        <Sparkles size={17} /> Dream up a game
      </h2>
      <p className="hint">Describe it like you would to a friend. BoardDream writes the rules, playtests them and deals you in.</p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Rival beekeepers trade nectar and wax to build hives across a flowering valley…"
        rows={5}
        required
      />
      <div className="field-pair">
        <label className="field">
          <span>Min players</span>
          <input type="number" min={1} max={6} value={dials.minPlayers} onChange={(e) => set("minPlayers", Number(e.target.value))} />
        </label>
        <label className="field">
          <span>Max players</span>
          <input type="number" min={1} max={6} value={dials.maxPlayers} onChange={(e) => set("maxPlayers", Number(e.target.value))} />
        </label>
      </div>
      <Range label="Play time" display={`${dials.playMinutes} min`} min={10} max={90} step={5} value={dials.playMinutes} onChange={(v) => set("playMinutes", v)} />
      <Range label="Complexity" display={["Gateway", "Medium-light", "Medium", "Medium-heavy", "Heavy"][dials.complexity - 1]} min={1} max={5} value={dials.complexity} onChange={(v) => set("complexity", v)} />
      <Range label="Luck" display={`${Math.round(dials.luck * 100)}%`} min={0} max={1} step={0.1} value={dials.luck} onChange={(v) => set("luck", v)} />
      <div className="segmented" role="radiogroup" aria-label="Mode">
        {MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            role="radio"
            aria-checked={dials.mode === mode.value}
            className={dials.mode === mode.value ? "on" : ""}
            onClick={() => set("mode", mode.value)}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <button type="submit" className="action wide" disabled={busy || !available}>
        <Wand2 size={16} /> {busy ? "Dreaming…" : "Generate game"}
      </button>
      {!available && (
        <p className="hint">This online demo plays games BoardDream generated earlier: pick one from the game menu at the top. Generating new ones needs the full server with a model key (see the README).</p>
      )}
      {status && <p className="hint status-line">{status}</p>}
    </form>
  );
}

function Range(props: { label: string; display: string; min: number; max: number; step?: number; value: number; onChange(v: number): void }) {
  return (
    <label className="field">
      <span className="field-row">
        <span>{props.label}</span>
        <output>{props.display}</output>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}
