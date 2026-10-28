import { BarChart3, X } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { art, generation, opponents, plan, reference, retrieval, UPDATED } from "../results";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** About three standard errors of a seat's win rate over 600 games. */
const UNEVEN = 0.06;
/** Draws leave every seat below 1/n, so a seat is compared with the seats' average. */
const uneven = (rates: number[]) => {
  const fair = rates.reduce((sum, r) => sum + r, 0) / rates.length;
  return rates.some((r) => Math.abs(r - fair) > UNEVEN);
};

const seated = reference.filter((r) => r.mode !== "hidden-role");
const teams = reference.filter((r) => r.mode === "hidden-role");

/** Everything BoardDream measures on one page: the evals, the reference games' balance and profiles. */
export function ResultsPage({ onClose }: { onClose(): void }) {
  return (
    <div className="results" role="dialog" aria-label="Results">
      <div className="results-sheet">
        <header className="results-head">
          <div>
            <h1>
              <BarChart3 size={22} /> Results
            </h1>
            <p className="hint">Measured by the benchmarks in the repository, updated {UPDATED}. Each section links to its write-up.</p>
          </div>
          <button type="button" className="ghost" onClick={onClose} aria-label="Close results">
            <X size={16} /> Close
          </button>
        </header>

        <div className="kpis">
          <Stat label="Ideas that became working games" value={`${generation.afterOneRepair} / ${generation.ideas}`} note={`${generation.firstDraft} on the first draft, the rest after one repair`} />
          <Stat label="Planner wins against random play" value={pct(generation.plannerWinRate)} note={`fair share ${pct(generation.fairShare)}, in ${generation.measured} measurable generated games`} />
          <Stat label="Retrieval nDCG@10" value={retrieval.systems[2].ndcg.toFixed(3)} note={`BM25 alone: ${retrieval.systems[0].ndcg.toFixed(3)}`} />
          <Stat label="Board tiles aligned by SAM 3.1" value={`${art.aligned} / ${art.tiles}`} note={`${art.game}, mean IoU ${art.meanIoU}`} />
        </div>

        <Section title="Generation: idea to working rules" source={generation.source}>
          <p className="hint">
            {generation.ideas} ideas for hobby strategy games, each designed by Muse Spark, written as code on retrieved mechanics, fuzzed with 1,000 strict
            random games, repaired on failure and playtested. "Planner wins" is how often a bot that plans ahead beats random players in 3-player games.
          </p>
          <table className="results-table">
            <thead>
              <tr>
                <th>Group</th>
                <th className="num">First draft passes</th>
                <th className="num">Pass after one repair</th>
                <th className="num">Planner wins</th>
              </tr>
            </thead>
            <tbody>
              {generation.groups.map((g) => (
                <tr key={g.name}>
                  <td>{g.name}</td>
                  <td className="num">
                    {g.firstDraft} / {g.ideas}
                  </td>
                  <td className="num">
                    {g.passed} / {g.ideas}
                  </td>
                  <td className="num">{g.planner === undefined ? "not measured" : pct(g.planner)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Retrieval: finding the right building blocks" source={retrieval.source}>
          <p className="hint">
            nDCG@10 on {retrieval.queries} game ideas against {retrieval.entries} library entries, with graded relevance judgments. Hover a bar for the other
            measures.
          </p>
          <RetrievalBars />
        </Section>

        <Section title="Reference games: profile" source={plan}>
          <p className="hint">Board Game Arena's four axes, scored 1–5 by playing each game: 20 random games plus 30 against a planning bot.</p>
          <table className="results-table">
            <thead>
              <tr>
                <th>Game</th>
                <th>Complexity</th>
                <th>Strategy</th>
                <th>Luck</th>
                <th>Interaction</th>
              </tr>
            </thead>
            <tbody>
              {reference.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  {[r.profile.complexity, r.profile.strategy, r.profile.luck, r.profile.interaction].map((score, i) => (
                    <td key={i}>
                      <span className="score-cell">
                        <b>{score === undefined ? "–" : score.toFixed(1)}</b>
                        <span className="meter" aria-hidden>
                          <i style={{ "--fill": (score ?? 0) / 5 } as CSSProperties} />
                        </span>
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <Section title="Reference games: seat balance" source={plan}>
          <p className="hint">Win rate of each seat, first player first, over 600 games between the game's own bots. The fair share is 50%, 33% and 25%.</p>
          <table className="results-table">
            <thead>
              <tr>
                <th>Game</th>
                <th className="num">2 players</th>
                <th className="num">3 players</th>
                <th className="num">4 players</th>
              </tr>
            </thead>
            <tbody>
              {seated.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  {[2, 3, 4].map((n) => {
                    const rates = r.balance.find((x) => x.numPlayers === n)?.winRateBySeat;
                    return (
                      <td key={n} className={rates && uneven(rates) ? "num uneven" : "num"}>
                        {rates ? rates.map((w) => Math.round(w * 100)).join(" / ") : "–"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="hint">Bold: a seat sits more than {Math.round(UNEVEN * 100)} points from the seats' average, more than 600 games can blame on chance.</p>
          {teams.map((r) => (
            <p key={r.id} className="hint">
              {r.name} deals hidden roles, so its balance is between sides: the larger side wins{" "}
              {r.balance.map((b) => `${pct(b.majorityWins ?? 0)} of ${b.numPlayers}-player games`).join(", ")}.
            </p>
          ))}
        </Section>

        <Section title="AI opponents" source={opponents.source}>
          <p className="hint">The model plays the social moves (offers, bids, calls) with the game's bot as an advisor; the seat rotates every game.</p>
          <table className="results-table">
            <thead>
              <tr>
                <th>Model</th>
                <th>Game</th>
                <th>Against</th>
                <th className="num">Games</th>
                <th className="num">Wins</th>
                <th className="num">Fair share</th>
              </tr>
            </thead>
            <tbody>
              {opponents.rows.map((r) => (
                <tr key={`${r.model}-${r.game}`}>
                  <td>{r.model}</td>
                  <td>{r.game}</td>
                  <td>{r.against}</td>
                  <td className="num">{r.games}</td>
                  <td className="num">{pct(r.winRate)}</td>
                  <td className="num">{pct(r.fair)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      <span className="stat-note">{note}</span>
    </div>
  );
}

function Section({ title, source, children }: { title: string; source: string; children: ReactNode }) {
  return (
    <section className="results-section">
      <h2>
        {title}
        <a href={source} target="_blank" rel="noreferrer">
          Details
        </a>
      </h2>
      {children}
    </section>
  );
}

/** One measure across three systems: the last (the pipeline the designer uses) is the point, so it alone wears the accent. */
function RetrievalBars() {
  const [hover, setHover] = useState<number>();
  const best = retrieval.systems.length - 1;
  return (
    <div className="bars" onMouseLeave={() => setHover(undefined)}>
      {retrieval.systems.map((s, i) => (
        <div key={s.name} className="bar-row" onMouseEnter={() => setHover(i)}>
          <span className="bar-label">{s.name}</span>
          <span className="bar-track">
            <i className={i === best ? "bar best" : "bar"} style={{ width: `${s.ndcg * 100}%` }} />
            <b style={{ left: `${s.ndcg * 100}%` }}>{s.ndcg.toFixed(3)}</b>
          </span>
          {hover === i && (
            <span className="bar-tip" role="tooltip">
              nDCG@10 {s.ndcg.toFixed(3)} · Recall@10 {s.recall.toFixed(3)} · MRR {s.mrr.toFixed(3)} · MAP {s.map.toFixed(3)}
            </span>
          )}
        </div>
      ))}
      <div className="bar-axis" aria-hidden>
        <span>0</span>
        <span>0.5</span>
        <span>1</span>
      </div>
    </div>
  );
}
