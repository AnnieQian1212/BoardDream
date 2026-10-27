import { resolveParams, type BalanceStats, type GameModule, type ParamSpec, type ParamValue, type Params } from "@boarddream/engine";

interface Props {
  game: GameModule;
  numPlayers: number;
  params: Params;
  stats?: BalanceStats;
  onChange(numPlayers: number, params: Params): void;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function TuningPanel({ game, numPlayers, params, stats, onChange }: Props) {
  const set = (key: string, value: ParamValue) => onChange(numPlayers, resolveParams(game.params, { ...params, [key]: value }));
  return (
    <aside className="panel">
      <h2>Tune</h2>
      {game.meta.maxPlayers > game.meta.minPlayers && (
        <Slider
          label="Players"
          min={game.meta.minPlayers}
          max={game.meta.maxPlayers}
          value={numPlayers}
          onChange={(n) => onChange(n, params)}
        />
      )}
      {game.params.map((spec) => (
        <ParamControl key={spec.key} spec={spec} value={params[spec.key]} onChange={(v) => set(spec.key, v)} />
      ))}

      <h2>Balance</h2>
      {/* TODO(day 4): real charts, param sweeps and Monte Carlo bots for perfect-information games. */}
      {stats ? (
        <dl className="stats">
          {stats.winRateBySeat.map((rate, seat) => (
            <div key={seat}>
              <dt>P{seat + 1} wins</dt>
              <dd>{pct(rate)}</dd>
            </div>
          ))}
          <div>
            <dt>Draws</dt>
            <dd>{pct(stats.drawRate)}</dd>
          </div>
          <div>
            <dt>First-player edge</dt>
            <dd>
              {stats.firstPlayerEdge >= 0 ? "+" : ""}
              {pct(stats.firstPlayerEdge)}
            </dd>
          </div>
          <div>
            <dt>Median length</dt>
            <dd>{stats.medianTurns} moves</dd>
          </div>
          {stats.errors > 0 && (
            <div>
              <dt>Errors</dt>
              <dd title={stats.firstError}>{stats.errors}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="hint">Simulating…</p>
      )}
      {stats && <p className="hint">{stats.games} simulated games</p>}
    </aside>
  );
}

function ParamControl({ spec, value, onChange }: { spec: ParamSpec; value: ParamValue; onChange(v: ParamValue): void }) {
  switch (spec.kind) {
    case "int":
      return <Slider label={spec.label} min={spec.min} max={spec.max} step={spec.step} value={value as number} onChange={onChange} />;
    case "bool":
      return (
        <label className="control check">
          <input type="checkbox" checked={value as boolean} onChange={(e) => onChange(e.target.checked)} />
          {spec.label}
        </label>
      );
    case "choice":
      return (
        <label className="control">
          {spec.label}
          <select value={value as string} onChange={(e) => onChange(e.target.value)}>
            {spec.options.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
      );
  }
}

function Slider(props: { label: string; min: number; max: number; step?: number; value: number; onChange(v: number): void }) {
  return (
    <label className="control">
      <span className="control-row">
        <span>{props.label}</span>
        <output>{props.value}</output>
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
