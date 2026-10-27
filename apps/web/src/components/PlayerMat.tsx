import type { Panel, ResourceSpec } from "@boarddream/engine";
import type { CSSProperties } from "react";
import { playerColor } from "../colors";
import { Card } from "./Card";
import { ResourceChip } from "./ResourceChip";

interface Props {
  panel: Panel;
  resources: Map<string, ResourceSpec>;
  you: boolean;
  active: boolean;
  /** Element ids that legal moves target. */
  targets: Set<string>;
  onTarget(id: string, event: React.MouseEvent): void;
  layout: "compact" | "wide";
}

/** One seat's area: name, score, resources and played cards. */
export function PlayerMat({ panel, resources, you, active, targets, onTarget, layout }: Props) {
  const color = playerColor(panel.owner);
  const counters = panel.counters ?? [];
  const score = counters.find((c) => /score|points|vp/i.test(c.label));
  const rest = counters.filter((c) => c !== score);
  return (
    <section className={["mat", layout, active && "active"].filter(Boolean).join(" ")} style={{ "--seat": color } as CSSProperties}>
      <header className="mat-head">
        <span className="seat-dot" />
        <span className="mat-name">{you ? "You" : panel.title}</span>
        {active && <span className="mat-turn">{you ? "your turn" : "thinking…"}</span>}
        {score && <ResourceChip variant="score" value={score.value} label={score.label} />}
      </header>
      <div className="mat-counters">
        {rest.map((counter) => (
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
      </div>
      {(panel.cards?.length ?? 0) > 0 && (
        <div className="mat-cards">
          {panel.cards!.map((card) => (
            <Card
              key={card.id}
              card={card}
              resources={resources}
              size="compact"
              target={targets.has(card.id)}
              onClick={(event) => onTarget(card.id, event)}
            />
          ))}
        </div>
      )}
      {panel.note && <p className="mat-note">{panel.note}</p>}
    </section>
  );
}
