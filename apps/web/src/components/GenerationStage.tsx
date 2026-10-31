import { Circle, Dices, Hexagon, Layers, LayoutGrid, Library, Package, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { componentItems, stepOf, type Generation } from "../generation";

const MODES: Record<string, string> = { competitive: "Versus", cooperative: "Co-op", "hidden-role": "Hidden role" };
const FAMILIES: Record<string, string> = { engine: "Engine building", map: "Map and trade", grid: "Tiles and areas", bluff: "Bluffing" };

/** An icon for a component, from the words that name it. */
function componentIcon(item: string): ReactNode {
  const text = item.toLowerCase();
  if (/\b(board|map|atoll|plateau|valley|track)\b/.test(text)) return <LayoutGrid size={16} />;
  if (/\b(tiles?|hex(es)?)\b/.test(text)) return <Hexagon size={16} />;
  if (/\b(cards?|deck|decks)\b/.test(text)) return <Layers size={16} />;
  if (/\b(dice|die)\b/.test(text)) return <Dices size={16} />;
  if (/\b(cubes?|tokens?|markers?|coins?|discs?|meeples?|pawns?|workers?|ships?|wagons?|crystals?|chips?)\b/.test(text)) return <Circle size={16} />;
  return <Package size={16} />;
}

interface Props {
  generation: Generation;
  /** Bots are playing the latest draft on the table, so the stage steps aside. */
  previewing: boolean;
}

/**
 * The game being made, in the middle of the page: a box cover from the plan, the library's
 * mechanics dealt beside it, what is in the box and how it plays. Once a draft runs, the real table
 * takes over and the stage shrinks to a label.
 */
export function GenerationStage({ generation: g, previewing }: Props) {
  if (g.done?.ok) return null;
  const plan = g.plan;
  if (previewing && plan) {
    return (
      <div className="stage-label" aria-live="polite">
        <strong>{plan.title}</strong>
        <span>
          Draft {g.attempt + 1} on the table · bots are playing it while it is tested
        </span>
      </div>
    );
  }
  const step = stepOf(g);
  const ribbon =
    g.error || g.done
      ? undefined
      : step === "plan"
        ? "Drafting the design and picking mechanics from the library…"
        : step === "rules"
          ? "Writing the rules as code: the board appears as soon as they run."
          : "Loading the rules on to the table…";
  return (
    <div className="gen-stage">
      <div className="stage-sheet">
        <section className="stage-cover">
          <span className="rules-kicker">
            <Sparkles size={13} /> {g.surprise ? "A Muse Spark idea" : "Your idea"}, taking shape
          </span>
          {plan ? (
            <>
              <h1>{plan.title}</h1>
              <p className="stage-pitch">{plan.pitch}</p>
              <div className="gen-chips">
                <span>{plan.minPlayers === plan.maxPlayers ? plan.minPlayers : `${plan.minPlayers}–${plan.maxPlayers}`} players</span>
                <span>{MODES[plan.mode] ?? plan.mode}</span>
                <span>{FAMILIES[plan.family] ?? plan.family}</span>
              </div>
            </>
          ) : (
            <>
              <p className="stage-idea">{g.idea}</p>
              <div className="gen-skeleton" aria-hidden>
                <i />
                <i />
              </div>
            </>
          )}
        </section>

        <section className="stage-mechanics">
          <h4>
            <Library size={13} /> Building blocks from the library
          </h4>
          {g.mechanics ? (
            <ul>
              {g.mechanics.map((m, i) => (
                <li key={m.id} style={{ animationDelay: `${i * 110}ms`, ["--tilt" as string]: `${((i * 37) % 7) - 3}deg` }}>
                  <strong>{m.title}</strong>
                  <span>{m.description}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="gen-skeleton cards" aria-hidden>
              <i />
              <i />
              <i />
              <i />
            </div>
          )}
        </section>

        <section className="stage-parts">
          <h4>In the box</h4>
          {plan ? (
            <ul>
              {componentItems(plan.components).map((item, i) => (
                <li key={i} style={{ animationDelay: `${300 + i * 90}ms` }}>
                  {componentIcon(item)}
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="gen-skeleton" aria-hidden>
              <i />
              <i />
              <i />
            </div>
          )}
        </section>

        <section className="stage-rules">
          <h4>How it plays</h4>
          {plan ? (
            <>
              <ol>
                {plan.rules.map((rule, i) => (
                  <li key={i} style={{ animationDelay: `${600 + i * 120}ms` }}>
                    {rule}
                  </li>
                ))}
              </ol>
              <p className="stage-win" style={{ animationDelay: `${600 + plan.rules.length * 120}ms` }}>
                <strong>To win:</strong> {plan.winCondition}
              </p>
            </>
          ) : (
            <div className="gen-skeleton" aria-hidden>
              <i />
              <i />
              <i />
              <i />
            </div>
          )}
        </section>
        {ribbon && <p className="stage-ribbon">{ribbon}</p>}
      </div>
    </div>
  );
}
