import { AlertTriangle, Check, ClipboardList, Code2, Dices, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { progressOf, stepOf, type Generation, type Step } from "../generation";

const STEPS: { step: Step; label: string; icon: ReactNode }[] = [
  { step: "plan", label: "Design", icon: <ClipboardList size={14} /> },
  { step: "rules", label: "Rules", icon: <Code2 size={14} /> },
  { step: "check", label: "Playtest", icon: <Dices size={14} /> },
  { step: "ready", label: "Ready", icon: <Sparkles size={14} /> },
];

const MODES: Record<string, string> = { competitive: "Versus", cooperative: "Co-op", "hidden-role": "Hidden role" };
const FAMILIES: Record<string, string> = { engine: "Engine building", map: "Map and trade", grid: "Tiles and areas", bluff: "Bluffing" };

/** A clock that ticks while `running`, for the elapsed time and the bar's creep. */
function useNow(running: boolean): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, [running]);
  return now;
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** What is happening now, in a line. */
function status(g: Generation): string {
  if (g.error) return g.error;
  if (g.done) return g.done.ok ? `“${g.done.title}” passed ${g.checks.length === 1 ? "on the first try" : `after ${g.checks.length} rounds of playtesting`}.` : `“${g.done.title}” still fails after ${g.checks.length} rounds.`;
  const last = g.checks.at(-1);
  const step = stepOf(g);
  if (step === "plan") return "Drafting the design and picking tested mechanics from the library…";
  if (step === "rules") {
    const fixing = g.attempt > 0 && last ? (last.ok ? `Improving the design: ${last.issues?.[0] ?? ""}` : `Fixing what the playtest found: ${last.problem ?? ""}`) : undefined;
    if (fixing) return fixing;
    return g.codeSince ? `Writing the rules as code · ${lines(g.code).length} lines` : "Muse Spark is planning the rules…";
  }
  return g.checking ? `Playtesting: ${g.checking.done.toLocaleString()} of ${g.checking.total.toLocaleString()} games` : "Starting the playtest…";
}

/** The code inside the reply's ```js block, as far as it has been written. */
const lines = (code: string) => (code.includes("```") ? code.replace(/^[\s\S]*?```[a-z]*\n?/, "").replace(/```[\s\S]*$/, "") : code).split("\n");

const TOKEN = /(\/\/.*$)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|\b(const|let|function|return|if|else|for|of|in|new|module|exports|require|true|false|null|undefined|while|break|continue|switch|case)\b/g;

/** A line of code lightly colored: comments, strings and keywords. */
function Highlighted({ line }: { line: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of line.matchAll(TOKEN)) {
    if (m.index > last) parts.push(line.slice(last, m.index));
    parts.push(
      <span key={m.index} className={m[1] ? "tok-comment" : m[2] ? "tok-string" : "tok-keyword"}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  parts.push(line.slice(last));
  return <>{parts}</>;
}

/** The rules as they are written: the last lines, numbered, with a caret. */
function CodeStream({ code, thinking }: { code: string; thinking: boolean }) {
  const all = lines(code);
  const shown = all.slice(-14);
  const first = all.length - shown.length + 1;
  if (thinking) {
    return (
      <div className="gen-code thinking">
        <span className="gen-dots">
          <i />
          <i />
          <i />
        </span>
        Planning the rules before writing them
      </div>
    );
  }
  return (
    <div className="gen-code">
      {shown.map((line, i) => (
        <div key={first + i} className="gen-line">
          <span className="gen-ln">{first + i}</span>
          <span>
            <Highlighted line={line} />
            {i === shown.length - 1 && <span className="gen-caret" />}
          </span>
        </div>
      ))}
    </div>
  );
}

/** One square per playtest game, filling as they are played. */
function PlaytestGrid({ done, total }: { done: number; total: number }) {
  const cols = 50;
  const size = 7;
  const gap = 2;
  const rows = Math.ceil(total / cols);
  return (
    <svg className="gen-grid" viewBox={`0 0 ${cols * (size + gap)} ${rows * (size + gap)}`} role="img" aria-label={`${done} of ${total} games played`}>
      {Array.from({ length: total }, (_, i) => (
        <rect
          key={i}
          x={(i % cols) * (size + gap)}
          y={Math.floor(i / cols) * (size + gap)}
          width={size}
          height={size}
          rx={1.6}
          className={i < done ? (i >= done - 20 ? "fresh" : "played") : undefined}
        />
      ))}
    </svg>
  );
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

interface Props {
  generation: Generation;
  onCancel(): void;
  /** Closes the view once the game is ready or has failed. */
  onClose(): void;
}

/**
 * A game taking shape: a progress bar over the steps, the plan filling a game box, the library's
 * mechanics, the rules as they are written, and the playtest's games one square at a time. Once a
 * draft loads, bots play it on the table and the view shrinks to a banner above it.
 */
export function GenerationView({ generation: g, onCancel, onClose }: Props) {
  const running = !g.done && !g.error;
  const now = useNow(running);
  // The bar never goes back, even when an estimate does.
  const peak = useRef(0);
  peak.current = Math.max(peak.current, progressOf(g, now));
  const step = stepOf(g);
  const order = STEPS.findIndex((s) => s.step === step);
  const compact = Boolean(g.draft) && running && !g.writing;
  const last = g.checks.at(-1);
  const passed = g.checks.filter((c) => c.ok).at(-1);
  const plan = g.plan;
  const finish = useMemo(() => (g.done || g.error ? Date.now() : undefined), [g.done, g.error]);

  const header = (
    <>
      <div className="gen-head">
        <div>
          <span className="rules-kicker">
            <Sparkles size={13} /> {g.surprise ? "Surprise game" : "Dreaming up your game"}
          </span>
          <h3>{plan?.title ?? "Your game"}</h3>
        </div>
        <span className="gen-clock">{clock((finish ?? now) - g.started)}</span>
        {running ? (
          <button type="button" className="ghost" onClick={onCancel} title="Stop making this game">
            <X size={15} /> Cancel
          </button>
        ) : g.done?.ok ? (
          <button type="button" className="action" onClick={onClose}>
            Start playing
          </button>
        ) : (
          <button type="button" className="ghost" onClick={onClose}>
            <X size={15} /> Close
          </button>
        )}
      </div>
      <div className="gen-bar" role="progressbar" aria-valuenow={Math.round(peak.current * 100)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: pct(peak.current) }} />
      </div>
      <ol className="gen-steps">
        {STEPS.map((s) => {
          const at = STEPS.indexOf(s);
          const state = g.done?.ok || at < order ? "done" : at === order && running ? "now" : "later";
          return (
            <li key={s.step} className={state}>
              {state === "done" ? <Check size={14} /> : s.icon} {s.label}
            </li>
          );
        })}
      </ol>
      <p className={["gen-status", (g.error || (g.done && !g.done.ok) || (g.attempt > 0 && g.writing && last && !last.ok)) && "warn"].filter(Boolean).join(" ")}>
        {(g.error || (g.done && !g.done.ok)) && <AlertTriangle size={14} />} {status(g)}
      </p>
    </>
  );

  if (compact) {
    return (
      <div className="gen-banner" aria-live="polite">
        {header}
        <p className="hint">Bots are playing this draft on the table while the playtest runs.</p>
      </div>
    );
  }

  return (
    <div className="gen-overlay" aria-live="polite">
      <div className="gen-card">
        {header}
        <div className="gen-body">
          <section className="gen-box">
            <blockquote className="gen-idea">{g.idea}</blockquote>
            {plan ? (
              <div className="gen-plan">
                <p className="gen-pitch">{plan.pitch}</p>
                <div className="gen-chips">
                  <span>
                    {plan.minPlayers === plan.maxPlayers ? plan.minPlayers : `${plan.minPlayers}–${plan.maxPlayers}`} players
                  </span>
                  <span>{MODES[plan.mode] ?? plan.mode}</span>
                  <span>{FAMILIES[plan.family] ?? plan.family}</span>
                </div>
                <h4>In the box</h4>
                <p className="gen-components">{plan.components}</p>
                <h4>How it plays</h4>
                <ol className="gen-rules">
                  {plan.rules.map((rule, i) => (
                    <li key={i} style={{ animationDelay: `${i * 90}ms` }}>
                      {rule}
                    </li>
                  ))}
                </ol>
                <p className="gen-win">
                  <strong>To win:</strong> {plan.winCondition}
                </p>
              </div>
            ) : (
              <div className="gen-skeleton" aria-hidden>
                <i />
                <i />
                <i />
                <i />
              </div>
            )}
          </section>
          <section className="gen-bench">
            <h4>Tested mechanics from the library</h4>
            {g.mechanics ? (
              <ul className="gen-mechanics">
                {g.mechanics.map((m, i) => (
                  <li key={m.id} style={{ animationDelay: `${i * 80}ms` }} title={m.description}>
                    <strong>{m.title}</strong>
                    <span>{m.description}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="gen-skeleton small" aria-hidden>
                <i />
                <i />
                <i />
              </div>
            )}
            {(step === "rules" || (step === "check" && !g.checking)) && g.plan && g.mechanics && (
              <>
                <h4>{g.attempt === 0 ? "Rules, as code" : `Rules, round ${g.attempt + 1}`}</h4>
                <CodeStream code={g.code} thinking={g.writing && !g.codeSince} />
              </>
            )}
            {step === "check" && g.checking && (
              <>
                <h4>Playtest</h4>
                <PlaytestGrid done={g.checking.done} total={g.checking.total} />
              </>
            )}
            {g.done?.ok && passed?.play && (
              <>
                <h4>Playtest</h4>
                <ul className="gen-stats">
                  <li>
                    <strong>{(1000).toLocaleString()}</strong> random games without a fault
                  </li>
                  <li>
                    <strong>{passed.play.medianTurns}</strong> moves in a typical {passed.play.numPlayers}-player game
                  </li>
                  {passed.play.plannerWinRate !== undefined && (
                    <li>
                      <strong>{pct(passed.play.plannerWinRate)}</strong> of games won by a player who plans ahead (fair share {pct(1 / passed.play.numPlayers)})
                    </li>
                  )}
                </ul>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
