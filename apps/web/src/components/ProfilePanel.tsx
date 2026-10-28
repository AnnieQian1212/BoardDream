import type { GameProfile } from "@boarddream/engine";
import { Gauge } from "lucide-react";
import type { CSSProperties } from "react";

interface Props {
  profile?: GameProfile;
  /** The strategy score is still being measured. */
  pending: boolean;
  error?: string;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Board Game Arena's four axes, each measured by playing the game rather than by votes. */
export function ProfilePanel({ profile, pending, error }: Props) {
  const m = profile?.measures;
  return (
    <section className="panel">
      <h2>
        <Gauge size={17} /> Game profile
      </h2>
      {profile && m ? (
        <>
          <ul className="profile">
            <Axis
              label="Complexity"
              score={profile.complexity}
              why={`${m.moveKinds} kind${m.moveKinds === 1 ? "" : "s"} of move, ${Math.round(m.choices)} options a turn, ${m.components} components`}
            />
            <Axis
              label="Strategy"
              score={profile.strategy}
              why={
                m.plannerWinRate !== undefined
                  ? `A planner wins ${pct(m.plannerWinRate)} against random players (fair share ${pct(1 / m.numPlayers)})`
                  : pending
                    ? "Measuring with a planning bot…"
                    : "Not measured: the skill here is bluffing"
              }
            />
            <Axis
              label="Luck"
              score={profile.luck}
              why={`Chance decides ${pct(m.chanceRate)} of moves${m.setupChance ? "; the setup is shuffled" : ""}`}
            />
            <Axis
              label="Interaction"
              score={profile.interaction}
              why={`${pct(m.directRate)} of moves change a rival's holdings, ${pct(m.sharedRate)} the shared table`}
            />
          </ul>
          <p className="hint">Measured from {m.games} random games, not votes.</p>
        </>
      ) : (
        <p className="hint">{error ? `Could not measure: ${error}` : "Measuring…"}</p>
      )}
    </section>
  );
}

function Axis({ label, score, why }: { label: string; score?: number; why: string }) {
  return (
    <li>
      <span className="profile-row">
        {label}
        <b>{score === undefined ? "–" : score.toFixed(1)}</b>
      </span>
      <span className="meter" aria-hidden>
        <i style={{ "--fill": score === undefined ? 0 : score / 5 } as CSSProperties} />
      </span>
      <small>{why}</small>
    </li>
  );
}
