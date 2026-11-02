import { fitBounds, type GameModule, type Panel, type ResourceSpec } from "@boarddream/engine";
import { Trophy } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { playerColor } from "../colors";
import { resourceById } from "../icons";
import { resultHeadline } from "../outcome";
import { tidyPanels } from "../panels";
import { Board } from "./Board";
import { turnOf, type MoveButton } from "../turn";
import { Hint, useHint } from "./Hint";
import { Card } from "./Card";
import { PlayerMat } from "./PlayerMat";
import { ResourceChip } from "./ResourceChip";

interface Props {
  game: GameModule;
  state: unknown;
  numPlayers: number;
  human: number;
  onMove(move: unknown): void;
  onRestart(): void;
}

interface Menu {
  x: number;
  y: number;
  moves: unknown[];
  /** Opens above the point (for a button in the move bar at the foot of the screen). */
  up?: boolean;
}

/** The play area: rival mats, board and market, your mat and hand, and the moves you can make. */
export function Table({ game, state, numPlayers, human, onMove, onRestart }: Props) {
  const [menu, setMenu] = useState<Menu | null>(null);
  useEffect(() => setMenu(null), [state]);
  const { hint, ask } = useHint(game, state, human);

  const resources = resourceById(game.meta.resources);
  const raw = game.geometry?.(state, human);
  const geometry = raw && fitBounds(raw);
  const panels = tidyPanels(game.panels?.(state, human) ?? []);
  // Whose turn, what glows and what each click does: shared with the 3D table.
  const { over, active, mine: myTurn, byTarget, targets, buttons, label, instruction: todo } = turnOf(game, state, human, panels, geometry);
  const pick = (id: string, event: React.MouseEvent) => {
    const options = byTarget.get(id);
    if (!options) return;
    if (options.length === 1) onMove(options[0]);
    else setMenu({ x: event.clientX, y: event.clientY, moves: options });
  };
  // A move-bar button plays its move, or opens a menu of its kind's moves above it.
  const press = (button: MoveButton, e: React.MouseEvent<HTMLButtonElement>) => {
    if (button.moves.length === 1) return onMove(button.moves[0]);
    const box = e.currentTarget.getBoundingClientRect();
    setMenu({ x: box.left + box.width / 2, y: box.top, moves: button.moves, up: true });
  };

  const seats = panels.filter((p) => p.zone === "players");
  const rivals = seats.filter((p) => p.owner !== human);
  const mine = seats.find((p) => p.owner === human);
  const shared = panels.filter((p) => p.zone === "shared");
  const hand = panels.find((p) => p.zone === "hand");

  const status = myTurn ? `Your turn${todo ? ` · ${todo}` : ""}` : active !== undefined ? `Player ${active + 1} is thinking…` : "";

  return (
    <div className="table">
      <div className="rivals">
        {rivals.length > 0
          ? rivals.map((panel) => (
              <PlayerMat
                key={panel.id}
                panel={panel}
                resources={resources}
                you={false}
                active={panel.owner === active}
                targets={targets}
                onTarget={pick}
                layout="compact"
              />
            ))
          : Array.from({ length: numPlayers }, (_, seat) => (
              <span key={seat} className={["seat-chip", seat === active && "active"].filter(Boolean).join(" ")} style={{ "--seat": playerColor(seat) } as CSSProperties}>
                <span className="seat-dot" />
                {seat === human ? "You" : `Player ${seat + 1}`}
              </span>
            ))}
      </div>

      <div className="center">
        {geometry && <Board geometry={geometry} targets={targets} onCell={pick} />}
        {shared.map((panel) => (
          <SharedPanel key={panel.id} panel={panel} resources={resources} targets={targets} onTarget={pick} />
        ))}
      </div>

      {mine && <PlayerMat panel={mine} resources={resources} you active={myTurn} targets={targets} onTarget={pick} layout="wide" />}

      {hand && (hand.cards?.length ?? 0) > 0 && (
        <div className="hand">
          {hand.cards!.map((card, i, all) => {
            const offset = i - (all.length - 1) / 2;
            return (
              <Card
                key={card.id}
                card={card}
                resources={resources}
                target={targets.has(card.id)}
                onClick={(event) => pick(card.id, event)}
                style={{ "--tilt": `${offset * 2.5}deg`, "--lift": `${Math.abs(offset) * 5}px` } as CSSProperties}
              />
            );
          })}
        </div>
      )}

      {!over && (
        <div className="action-bar">
          <span className="status">{status}</span>
          {myTurn && <Hint hint={hint} onAsk={ask} onMove={onMove} />}
          {buttons.map((button) => (
            <button key={button.label} type="button" className={buttons.length <= 3 ? "action" : "action secondary"} onClick={(e) => press(button, e)}>
              {button.label}
            </button>
          ))}
        </div>
      )}

      {menu && (
        <div className={menu.up ? "choice-menu up" : "choice-menu"} style={{ left: menu.x, top: menu.y }} onMouseLeave={() => setMenu(null)}>
          {menu.moves.map((move, i) => (
            <button key={i} type="button" onClick={() => onMove(move)}>
              {label(move)}
            </button>
          ))}
        </div>
      )}

      {over && <Result game={game} state={state} human={human} onRestart={onRestart} />}
    </div>
  );
}

function SharedPanel(props: { panel: Panel; resources: Map<string, ResourceSpec>; targets: Set<string>; onTarget(id: string, e: React.MouseEvent): void }) {
  const { panel, resources, targets, onTarget } = props;
  return (
    <section className="shared">
      <header className="shared-head">
        <h3>{panel.title}</h3>
        {panel.note && <span className="shared-note">{panel.note}</span>}
        <span className="shared-counters">
          {panel.counters?.map((counter) => (
            <ResourceChip
              key={counter.id}
              value={counter.value}
              label={counter.label}
              resource={counter.resource ? resources.get(counter.resource) : undefined}
              variant={counter.resource ? "resource" : "plain"}
              target={targets.has(counter.id)}
              onClick={(event) => onTarget(counter.id, event)}
            />
          ))}
        </span>
      </header>
      <div className="shared-cards">
        {panel.cards?.map((card) => (
          <Card key={card.id} card={card} resources={resources} target={targets.has(card.id)} onClick={(event) => onTarget(card.id, event)} />
        ))}
      </div>
    </section>
  );
}

export function Result({ game, state, human, onRestart }: { game: GameModule; state: unknown; human: number; onRestart(): void }) {
  const outcome = game.outcome(state);
  const { scores } = outcome;
  const headline = resultHeadline(game.meta.mode, outcome, human);
  return (
    <div className="overlay">
      <div className="result">
        <Trophy size={34} className="result-icon" />
        <h3>{headline}</h3>
        {scores && (
          <ol className="result-scores">
            {scores
              .map((score, seat) => ({ score, seat }))
              .sort((a, b) => b.score - a.score)
              .map(({ score, seat }) => (
                <li key={seat} style={{ "--seat": playerColor(seat) } as CSSProperties}>
                  <span className="seat-dot" />
                  {seat === human ? "You" : `Player ${seat + 1}`}
                  <b>{score}</b>
                </li>
              ))}
          </ol>
        )}
        <button type="button" className="action" onClick={onRestart}>
          Play again
        </button>
      </div>
    </div>
  );
}
