import { AlertTriangle, Check, Circle, ClipboardList, Code2, Dices, Library, Sparkles, Wrench, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { codeLines, progressOf, type Generation, type Round } from "../generation";

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
const seconds = (ms: number) => `${Math.max(1, Math.round(ms / 1000))} s`;
const pct = (x: number) => `${Math.round(x * 100)}%`;

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

/** The last lines of the rules as they are written, with a caret. */
function CodeTail({ code }: { code: string }) {
  const lines = codeLines(code);
  const shown = lines.slice(-6);
  return (
    <div className="gen-code">
      {shown.map((line, i) => (
        <div key={lines.length - shown.length + i} className="gen-line">
          <Highlighted line={line} />
          {i === shown.length - 1 && <span className="gen-caret" />}
        </div>
      ))}
    </div>
  );
}

/** One square per playtest game, filling as they are played. */
function PlaytestGrid({ done, total }: { done: number; total: number }) {
  const cols = 50;
  const size = 5;
  const gap = 1.6;
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
          rx={1.2}
          className={i < done ? (i >= done - 20 ? "fresh" : "played") : undefined}
        />
      ))}
    </svg>
  );
}

const Dots = () => (
  <span className="gen-dots" aria-hidden>
    <i />
    <i />
    <i />
  </span>
);

type State = "done" | "now" | "later" | "warn";

function Item({ state, icon, title, time, children }: { state: State; icon: ReactNode; title: string; time?: string; children?: ReactNode }) {
  return (
    <li className={`gen-item ${state}`}>
      <span className="gen-mark">{state === "done" ? <Check size={13} /> : state === "warn" ? <AlertTriangle size={12} /> : icon}</span>
      <div className="gen-item-body">
        <div className="gen-item-head">
          <strong>{title}</strong>
          {time && <span>{time}</span>}
        </div>
        {children}
      </div>
    </li>
  );
}

/** A round of rules: written, then playtested. */
function RoundItems({ round, g, now }: { round: Round; g: Generation; now: number }) {
  const live = !g.done && !g.error;
  const fixing = round.answers && (round.answers.ok ? "Improve the design" : "Fix the rules");
  const writing = round.writtenAt === undefined;
  const reason = round.answers ? (round.answers.ok ? round.answers.issues?.[0] : round.answers.problem) : undefined;
  return (
    <>
      <Item
        state={writing ? (live ? "now" : "later") : "done"}
        icon={round.answers ? <Wrench size={13} /> : <Code2 size={13} />}
        title={fixing ?? "Write the rules"}
        time={writing ? (live ? seconds(now - round.writingSince) : undefined) : seconds(round.writtenAt! - round.writingSince)}
      >
        {reason && <p className="gen-reason">{reason}</p>}
        {writing && live && (round.codeSince ? <p>{codeLines(g.code).length} lines so far</p> : <p>Planning the rules <Dots /></p>)}
        {writing && live && round.codeSince && <CodeTail code={g.code} />}
        {!writing && <p>{round.lines} lines of JavaScript</p>}
      </Item>
      {!writing && (
        <Item
          state={round.check ? (round.check.ok && !(round.check.issues?.length ?? 0) ? "done" : "warn") : live ? "now" : "later"}
          icon={<Dices size={13} />}
          title={round.attempt === 0 ? "Playtest" : `Playtest, round ${round.attempt + 1}`}
          time={round.check ? seconds(round.checkedAt! - round.writtenAt!) : live ? seconds(now - round.writtenAt!) : undefined}
        >
          {!round.check && round.checking && (
            <>
              <PlaytestGrid done={round.checking.done} total={round.checking.total} />
              <p>
                {round.checking.done.toLocaleString()} of {round.checking.total.toLocaleString()} games
              </p>
            </>
          )}
          {!round.check && !round.checking && live && <p>Loading the rules <Dots /></p>}
          {round.check && !round.check.ok && <p className="gen-reason">Found: {round.check.problem}</p>}
          {round.check?.ok && (round.check.issues?.length ? <p className="gen-reason">Works, but {round.check.issues[0]}</p> : <p>1,000 random games without a fault</p>)}
        </Item>
      )}
    </>
  );
}

interface Props {
  generation: Generation;
  onCancel(): void;
  /** Closes the steps once the game is ready or has failed. */
  onClose(): void;
}

/**
 * The making of a game, step by step, in the left column: the plan, the mechanics, each round of
 * rules and its playtest, then a summary. GenerationStage shows what is being made beside it.
 */
export function GenerationSteps({ generation: g, onCancel, onClose }: Props) {
  const running = !g.done && !g.error;
  const now = useNow(running);
  const finished = useRef<number>(undefined);
  if (!running) finished.current ??= Date.now();
  // The bar never goes back, even when an estimate does.
  const peak = useRef(0);
  peak.current = Math.max(peak.current, progressOf(g, now));
  const passed = g.checks.filter((c) => c.ok).at(-1);
  const failed = g.error ?? (g.done && !g.done.ok ? `“${g.done.title}” still fails after ${g.checks.length} rounds of playtesting.` : undefined);

  return (
    <section className="panel making" aria-live="polite">
      <div className="making-head">
        <h2>
          <Sparkles size={17} /> {g.done?.ok ? "Your game is ready" : failed ? "Not this time" : "Making your game"}
        </h2>
        <span className="gen-clock">{clock((finished.current ?? now) - g.started)}</span>
      </div>
      <div className="gen-bar" role="progressbar" aria-valuenow={Math.round(peak.current * 100)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: pct(peak.current) }} />
      </div>
      <blockquote className="gen-idea">{g.idea}</blockquote>
      <ol className="gen-timeline">
        <Item state={g.plan ? "done" : running ? "now" : "later"} icon={<ClipboardList size={13} />} title="Design the game" time={g.planAt ? seconds(g.planAt - g.started) : undefined}>
          <p>{g.plan ? g.plan.title : "Players, components, rules and how to win"}</p>
        </Item>
        <Item
          state={g.mechanics ? "done" : running ? "now" : "later"}
          icon={<Library size={13} />}
          title="Pick tested mechanics"
          time={g.mechanicsAt ? seconds(g.mechanicsAt - g.started) : undefined}
        >
          <p>{g.mechanics ? g.mechanics.map((m) => m.title).join(" · ") : "From the library of 26 modules"}</p>
        </Item>
        {g.rounds.map((round) => (
          <RoundItems key={round.attempt} round={round} g={g} now={now} />
        ))}
        {g.rounds.length === 0 && (
          <>
            <Item state="later" icon={<Code2 size={13} />} title="Write the rules" />
            <Item state="later" icon={<Dices size={13} />} title="Playtest" />
          </>
        )}
        <Item state={g.done?.ok ? "done" : "later"} icon={<Circle size={11} />} title="Ready to play">
          {g.done?.ok && passed?.play && (
            <ul className="gen-stats">
              <li>
                <strong>{passed.play.medianTurns}</strong> moves in a typical {passed.play.numPlayers}-player game
              </li>
              {passed.play.plannerWinRate !== undefined && (
                <li>
                  <strong>{pct(passed.play.plannerWinRate)}</strong> won by a player who plans ahead (fair share {pct(1 / passed.play.numPlayers)})
                </li>
              )}
            </ul>
          )}
        </Item>
      </ol>
      {failed && <p className="gen-reason">{failed}</p>}
      {running ? (
        <button type="button" className="action secondary wide" onClick={onCancel} title="Stop making this game">
          <X size={15} /> Cancel
        </button>
      ) : g.done?.ok ? (
        <button type="button" className="action wide" onClick={onClose}>
          Start playing
        </button>
      ) : (
        <button type="button" className="action secondary wide" onClick={onClose}>
          <X size={15} /> Close
        </button>
      )}
    </section>
  );
}
