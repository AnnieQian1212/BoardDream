import type { PlayMode } from "@boarddream/engine";
import { ChevronDown, Dices, Wand2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { FAMILIES, INTERACTIONS, MECHANICS, mechanicLabel, MUST_USE_LIMIT, THEMES } from "../dials";
import type { Dials } from "../generation";

const MODES: { value: PlayMode; label: string }[] = [
  { value: "competitive", label: "Versus" },
  { value: "cooperative", label: "Co-op" },
  { value: "hidden-role", label: "Hidden role" },
];

/**
 * Ideas to start from, one per kind of game, so the first thing a visitor sees shows the range:
 * a card engine, a co-op against the clock, a bluffing game and tile laying.
 */
export const EXAMPLES: { label: string; idea: string; mode?: PlayMode }[] = [
  {
    label: "Perfumers drafting scents",
    idea: "Rival perfumers draft rare essences from a shared market and blend them into signature scents for the queen's ball; the best combinations earn royal favor.",
  },
  {
    label: "Co-op lighthouse in a storm",
    idea: "Together, keepers race to keep a lighthouse burning through a seven-night storm, sharing oil and repairs while the sea rises and ships close in.",
    mode: "cooperative",
  },
  {
    label: "Smugglers bluffing the watch",
    idea: "Smugglers slip crates past the harbor watch, declaring cargo that may be a lie; inspectors call bluffs and the boldest captain gets rich.",
  },
  {
    label: "A coral reef, tile by tile",
    idea: "Divers grow a coral reef tile by tile, matching polyp edges so fish return; whoever tends the richest stretch of reef wins.",
  },
];

const DEFAULT_DIALS: Dials = { minPlayers: 2, maxPlayers: 4, playMinutes: 60, complexity: 4, luck: 0.3, mode: "competitive" };

interface Props {
  /** False when no server can generate (e.g. the static demo); games generated earlier still play. */
  available: boolean;
  /** A game is being made. */
  busy: boolean;
  /** Makes a game; `invented` when the idea is Muse Spark's, unchanged. */
  onGenerate(prompt: string, dials: Dials, invented: boolean): void;
}

/**
 * The one thing the home page asks: what game to dream up. A sentence is enough; examples fill the
 * box, Surprise me has Muse Spark write one, and the dials (players, length, complexity, luck, mode,
 * type, theme, interaction, mechanics) wait under Advanced settings for whoever wants them.
 */
export function DreamForm({ available, busy, onGenerate }: Props) {
  const [prompt, setPrompt] = useState("");
  // "Surprise me" only writes an idea into the box; the player reads it, changes it or asks for
  // another, and makes the game when it appeals.
  const [invented, setInvented] = useState<string>();
  const [inventing, setInventing] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [options, setOptions] = useState(false);
  const [dials, setDials] = useState<Dials>(DEFAULT_DIALS);
  const box = useRef<HTMLTextAreaElement>(null);
  const set = <K extends keyof Dials>(key: K, value: Dials[K]) => setDials({ ...dials, [key]: value });
  const asked = dials.mustUse ?? [];
  const offered = MECHANICS.filter((m) => m.modes.includes(dials.mode) && !asked.includes(m.id));
  // Mechanics that do not suit the new mode are dropped.
  const setMode = (mode: PlayMode) => {
    const kept = asked.filter((id) => MECHANICS.find((m) => m.id === id)?.modes.includes(mode));
    setDials({ ...dials, mode, mustUse: kept.length ? kept : undefined });
  };
  const changed = countChanged(dials);
  const locked = busy || inventing || !available;

  // The thinking bar: running while Muse Spark writes an idea, then full for a moment once it lands.
  const [thinking, setThinking] = useState<"running" | "done">();
  useEffect(() => {
    if (thinking !== "done") return;
    const timer = setTimeout(() => setThinking(undefined), 700);
    return () => clearTimeout(timer);
  }, [thinking]);

  async function surprise() {
    setInventing(true);
    setThinking("running");
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
      setThinking("done");
    }
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (locked) return;
    // An empty box asks for an idea rather than doing nothing.
    if (!prompt.trim()) return box.current?.focus();
    onGenerate(prompt, dials, prompt.trim() === invented?.trim());
  };

  return (
    <form className="dream" onSubmit={submit}>
      <div className={["dream-box", locked && "locked"].filter(Boolean).join(" ")}>
        {thinking && <ThinkingBar done={thinking === "done"} />}
        <textarea
          ref={box}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            // Enter makes the game, as in a chat; Shift+Enter starts a new line.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
          }}
          placeholder={
            inventing
              ? "Muse Spark is thinking of an idea…"
              : available
                ? "Rival beekeepers trade nectar and wax to build hives across a flowering valley…"
                : "Dreaming up new games needs the full server; play a ready-made one below."
          }
          rows={3}
          readOnly={locked}
          aria-label="Describe the game you want to play"
          autoFocus={available}
        />
        <div className="dream-row">
          <button type="button" className="quiet" disabled={locked} onClick={() => void surprise()} title="Muse Spark writes an idea into the box; nothing is made until you press Dream it up">
            <Dices size={16} className={inventing ? "dream-dice rolling" : "dream-dice"} /> {inventing ? "Thinking of one…" : "Surprise me"}
          </button>
          <button
            type="button"
            className={["quiet", options && "on"].filter(Boolean).join(" ")}
            aria-expanded={options}
            aria-controls="dream-options"
            onClick={() => setOptions(!options)}
          >
            Advanced settings{changed > 0 && <span className="dream-count">{changed}</span>}
            <ChevronDown size={15} className="dream-chevron" />
          </button>
          <button type="submit" className="action dream-go" disabled={locked}>
            <Wand2 size={17} /> {busy ? "Dreaming…" : "Dream it up"}
          </button>
        </div>
      </div>

      {available && (
        <div className="dream-examples" aria-label="Example ideas">
          <span>Try</span>
          {EXAMPLES.map((example) => (
            <button
              key={example.label}
              type="button"
              disabled={locked}
              onClick={() => {
                setPrompt(example.idea);
                setInvented(undefined);
                if (example.mode && example.mode !== dials.mode) setMode(example.mode);
                else if (!example.mode && dials.mode === "cooperative") setMode("competitive");
                box.current?.focus();
              }}
            >
              {example.label}
            </button>
          ))}
        </div>
      )}
      {problem && <p className="dream-problem">{problem}</p>}

      {options && (
        <div className="dream-options" id="dream-options">
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
          <Range
            label="Complexity"
            display={["Gateway", "Medium-light", "Medium", "Medium-heavy", "Heavy"][dials.complexity - 1]}
            min={1}
            max={5}
            value={dials.complexity}
            onChange={(v) => set("complexity", v)}
          />
          <Range label="Luck" display={`${Math.round(dials.luck * 100)}%`} min={0} max={1} step={0.1} value={dials.luck} onChange={(v) => set("luck", v)} />
          <div className="field">
            <span>Mode</span>
            <div className="segmented" role="radiogroup" aria-label="Mode">
              {MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  role="radio"
                  aria-checked={dials.mode === mode.value}
                  className={dials.mode === mode.value ? "on" : ""}
                  onClick={() => setMode(mode.value)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <span>Interaction</span>
            <div className="segmented" role="radiogroup" aria-label="Interaction">
              {INTERACTIONS.map((level) => (
                <button
                  key={level.value}
                  type="button"
                  role="radio"
                  title={level.hint}
                  aria-checked={(dials.interaction ?? "some") === level.value}
                  className={(dials.interaction ?? "some") === level.value ? "on" : ""}
                  // "Some" is what the designer does anyway, so it is sent as no choice at all.
                  onClick={() => set("interaction", level.value === "some" ? undefined : level.value)}
                >
                  {level.label}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>Game type</span>
            <select value={dials.family ?? ""} onChange={(e) => set("family", (e.target.value || undefined) as Dials["family"])}>
              <option value="">Any</option>
              {FAMILIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Theme</span>
            <select value={dials.theme ?? ""} onChange={(e) => set("theme", (e.target.value || undefined) as Dials["theme"])}>
              <option value="">Any</option>
              {THEMES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <div className="field dream-mechanics">
            <span className="field-row">
              <span>Build around</span>
              <output>
                {asked.length} of {MUST_USE_LIMIT}
              </output>
            </span>
            {asked.length > 0 && (
              <div className="asked">
                {asked.map((id) => (
                  <button key={id} type="button" onClick={() => set("mustUse", asked.length > 1 ? asked.filter((a) => a !== id) : undefined)} title="Remove">
                    {mechanicLabel(id)} <X size={12} />
                  </button>
                ))}
              </div>
            )}
            <select
              value=""
              disabled={asked.length >= MUST_USE_LIMIT}
              onChange={(e) => e.target.value && set("mustUse", [...asked, e.target.value])}
              aria-label="Add a tested mechanic to build the game around"
            >
              <option value="">{asked.length >= MUST_USE_LIMIT ? "Three is the most" : asked.length ? "Add another mechanic" : "Any mechanics"}</option>
              {offered.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          {changed > 0 && (
            <button type="button" className="link dream-reset" onClick={() => setDials(DEFAULT_DIALS)}>
              Reset settings
            </button>
          )}
        </div>
      )}
    </form>
  );
}

/**
 * Progress while Muse Spark writes an idea. The reply comes in one piece after 3 to 8 seconds, so
 * the bar cannot know how far along it is: it runs quickly at first and ever more slowly toward
 * 92%, which reads as working at any wait, then fills when the idea lands. It is a CSS transition,
 * so nothing re-renders while it runs.
 */
function ThinkingBar({ done }: { done: boolean }) {
  const [started, setStarted] = useState(false);
  // Drawn at zero first, then widened on the next frame, so the transition has somewhere to start.
  useEffect(() => {
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setStarted(true)));
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div
      className={["dream-progress", started && "going", done && "done"].filter(Boolean).join(" ")}
      role="progressbar"
      aria-label="Thinking of an idea"
      aria-busy={!done}
    />
  );
}

/** How many dials differ from where they start, shown on the Options button. */
function countChanged(dials: Dials): number {
  const plain: (keyof Dials)[] = ["minPlayers", "maxPlayers", "playMinutes", "complexity", "luck", "mode"];
  return (
    plain.filter((key) => dials[key] !== DEFAULT_DIALS[key]).length +
    (dials.family ? 1 : 0) +
    (dials.theme ? 1 : 0) +
    (dials.interaction ? 1 : 0) +
    (dials.mustUse?.length ? 1 : 0)
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
