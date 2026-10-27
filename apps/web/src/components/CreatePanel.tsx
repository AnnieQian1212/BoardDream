import type { GameModule, PlayMode } from "@boarddream/engine";
import { useState, type FormEvent } from "react";
import { loadGeneratedGame } from "../generated";

/** Mirrors Dials in apps/server/src/agent/spec.ts. */
interface Dials {
  minPlayers: number;
  maxPlayers: number;
  playMinutes: number;
  complexity: number;
  luck: number;
  mode: PlayMode;
}

interface GenerateResponse {
  ok: boolean;
  spec: { title: string };
  source: string;
  attempts: unknown[];
  error?: string;
}

export function CreatePanel({ onGenerated }: { onGenerated(game: GameModule): void }) {
  const [prompt, setPrompt] = useState("");
  const [dials, setDials] = useState<Dials>({
    minPlayers: 2,
    maxPlayers: 4,
    playMinutes: 20,
    complexity: 2,
    luck: 0.3,
    mode: "competitive",
  });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const set = <K extends keyof Dials>(key: K, value: Dials[K]) => setDials({ ...dials, [key]: value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus("Designing, writing rules and playtesting…");
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, dials }),
      });
      const data = (await res.json()) as GenerateResponse;
      if (!res.ok) throw new Error(data.error ?? res.statusText);
      const tries = `${data.attempts.length} fuzz pass${data.attempts.length === 1 ? "" : "es"}`;
      if (!data.ok) {
        setStatus(`“${data.spec.title}” still fails playtesting after ${tries}.`);
        return;
      }
      onGenerated(loadGeneratedGame(data.source));
      setStatus(`“${data.spec.title}” passed playtesting after ${tries}.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>Create</h2>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="A race through a haunted mansion where you can push rivals into trapdoors…"
        rows={5}
        required
      />
      <div className="control-pair">
        <label className="control">
          Min players
          <input type="number" min={1} max={8} value={dials.minPlayers} onChange={(e) => set("minPlayers", Number(e.target.value))} />
        </label>
        <label className="control">
          Max players
          <input type="number" min={1} max={8} value={dials.maxPlayers} onChange={(e) => set("maxPlayers", Number(e.target.value))} />
        </label>
      </div>
      <Range label="Play time" display={`${dials.playMinutes} min`} min={5} max={90} step={5} value={dials.playMinutes} onChange={(v) => set("playMinutes", v)} />
      <Range label="Complexity" display={`${dials.complexity} / 5`} min={1} max={5} value={dials.complexity} onChange={(v) => set("complexity", v)} />
      <Range label="Luck vs strategy" display={`${Math.round(dials.luck * 100)}% luck`} min={0} max={1} step={0.1} value={dials.luck} onChange={(v) => set("luck", v)} />
      <label className="control">
        Mode
        <select value={dials.mode} onChange={(e) => set("mode", e.target.value as PlayMode)}>
          <option value="competitive">Competitive</option>
          <option value="cooperative">Cooperative</option>
          <option value="hidden-role">Hidden role</option>
        </select>
      </label>
      <button type="submit" disabled={busy}>
        {busy ? "Generating…" : "Generate game"}
      </button>
      {status && <p className="hint">{status}</p>}
    </form>
  );
}

function Range(props: { label: string; display: string; min: number; max: number; step?: number; value: number; onChange(v: number): void }) {
  return (
    <label className="control">
      <span className="control-row">
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
