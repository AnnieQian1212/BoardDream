import type { PlayMode } from "@boarddream/engine";
import { Dices, Sparkles, Wand2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import type { Dials } from "../generation";

const MODES: { value: PlayMode; label: string }[] = [
  { value: "competitive", label: "Versus" },
  { value: "cooperative", label: "Co-op" },
  { value: "hidden-role", label: "Hidden role" },
];

interface Props {
  /** False when no server can generate (e.g. the static demo); games generated earlier still play. */
  available: boolean;
  /** A game is being made; its progress shows over the table (GenerationView). */
  busy: boolean;
  /** Makes a game; `invented` when the idea is Muse Spark's, unchanged. */
  onGenerate(prompt: string, dials: Dials, invented: boolean): void;
}

export function CreatePanel({ available, busy, onGenerate }: Props) {
  const [prompt, setPrompt] = useState("");
  // "Surprise me" only writes an idea into the box; the player reads it, changes it or asks for
  // another, and makes the game when it appeals.
  const [invented, setInvented] = useState<string>();
  const [inventing, setInventing] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [dials, setDials] = useState<Dials>({
    minPlayers: 2,
    maxPlayers: 4,
    playMinutes: 60,
    complexity: 4,
    luck: 0.3,
    mode: "competitive",
  });
  const set = <K extends keyof Dials>(key: K, value: Dials[K]) => setDials({ ...dials, [key]: value });

  async function surprise() {
    setInventing(true);
    setProblem(undefined);
    try {
      const res = await fetch("/api/idea", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dials }) });
      const reply = (await res.json()) as { idea?: string; error?: string };
      if (!res.ok || !reply.idea) throw new Error(reply.error ?? res.statusText);
      setPrompt(reply.idea);
      setInvented(reply.idea);
    } catch (err) {
      setProblem(`No idea this time: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setInventing(false);
    }
  }

  return (
    <form
      className="panel create"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        onGenerate(prompt, dials, prompt.trim() === invented?.trim());
      }}
    >
      <h2>
        <Sparkles size={17} /> Dream up a game
      </h2>
      <p className="hint">
        Describe it like you would to a friend, or let Muse Spark suggest one. BoardDream writes the rules, playtests them and deals you in.
      </p>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Rival beekeepers trade nectar and wax to build hives across a flowering valley…"
        rows={5}
        readOnly={busy || inventing}
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
      <div className="create-actions">
        <button type="submit" className="action" disabled={busy || !available}>
          <Wand2 size={16} /> {busy ? "Dreaming…" : "Generate game"}
        </button>
        <button
          type="button"
          className="action secondary"
          disabled={busy || inventing || !available}
          onClick={() => void surprise()}
          title="Muse Spark writes an idea that fits these settings into the box above; nothing is made until you press Generate game"
        >
          <Dices size={16} /> {inventing ? "Thinking of one…" : "Surprise me"}
        </button>
      </div>
      {problem && <p className="hint status-line">{problem}</p>}
      {!available && (
        <p className="hint">This online demo plays games BoardDream generated earlier: pick one from the game menu at the top. Generating new ones needs the full server with a model key (see the README).</p>
      )}
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
