import { resolveParams, type BalanceStats, type GameModule, type ParamSpec, type ParamValue, type Params } from "@boarddream/engine";
import { Scale, SlidersHorizontal } from "lucide-react";
import type { CSSProperties } from "react";
import { playerColor } from "../colors";

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
    <>
      <section className="panel">
        <h2>
          <SlidersHorizontal size={17} /> Tune the rules
        </h2>
        {game.meta.maxPlayers > game.meta.minPlayers && (
          <Slider label="Players" min={game.meta.minPlayers} max={game.meta.maxPlayers} value={numPlayers} onChange={(n) => onChange(n, params)} />
        )}
        {game.params.map((spec) => (
          <ParamControl key={spec.key} spec={spec} value={params[spec.key]} onChange={(v) => set(spec.key, v)} />
        ))}
      </section>

      <section className="panel">
        <h2>
          <Scale size={17} /> Balance
        </h2>
        {/* TODO(Oct 31): charts and parameter sweeps, built with the dataviz guidance. */}
        {stats ? (
          <>
            <ul className="stats">
              {stats.winRateBySeat.map((rate, seat) => (
                <li key={seat} style={{ "--seat": playerColor(seat) } as CSSProperties}>
                  <span className="seat-dot" />
                  Player {seat + 1} wins
                  <b>{pct(rate)}</b>
                </li>
              ))}
              <li>
                Draws <b>{pct(stats.drawRate)}</b>
              </li>
              <li>
                First-player edge
                <b>
                  {stats.firstPlayerEdge >= 0 ? "+" : ""}
                  {pct(stats.firstPlayerEdge)}
                </b>
              </li>
              <li>
                Median length <b>{stats.medianTurns} moves</b>
              </li>
              {stats.errors > 0 && (
                <li title={stats.firstError}>
                  Errors <b>{stats.errors}</b>
                </li>
              )}
            </ul>
            <p className="hint">{stats.games} games between bots, refreshed as you tune.</p>
          </>
        ) : (
          <p className="hint">Simulating…</p>
        )}
      </section>
    </>
  );
}

function ParamControl({ spec, value, onChange }: { spec: ParamSpec; value: ParamValue; onChange(v: ParamValue): void }) {
  switch (spec.kind) {
    case "int":
      return <Slider label={spec.label} min={spec.min} max={spec.max} step={spec.step} value={value as number} onChange={onChange} />;
    case "bool":
      return (
        <label className="toggle">
          <input type="checkbox" checked={value as boolean} onChange={(e) => onChange(e.target.checked)} />
          <span className="toggle-track" />
          {spec.label}
        </label>
      );
    case "choice":
      return (
        <label className="field">
          <span>{spec.label}</span>
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
    <label className="field">
      <span className="field-row">
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
