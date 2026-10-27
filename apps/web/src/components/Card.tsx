import type { CardView, ResourceSpec } from "@boarddream/engine";
import { Star } from "lucide-react";
import type { CSSProperties } from "react";
import { tagStyle } from "../icons";
import { CostPip } from "./ResourceChip";

interface Props {
  card: CardView;
  resources: Map<string, ResourceSpec>;
  size?: "full" | "compact";
  /** A legal move targets this card. */
  target?: boolean;
  onClick?(event: React.MouseEvent): void;
  style?: CSSProperties;
}

export function Card({ card, resources, size = "full", target, onClick, style }: Props) {
  const { color, icon: ArtIcon } = tagStyle(card.tags?.[0]);
  const className = ["card", size, target && "target", card.faceDown && "face-down"].filter(Boolean).join(" ");
  if (card.faceDown) return <div className={className} style={style} />;

  const body = (
    <>
      <div className="card-top">
        <div className="card-cost">
          {Object.entries(card.cost ?? {})
            .filter(([, n]) => n > 0)
            .map(([id, n]) => (
              <CostPip key={id} amount={n} resource={resources.get(id)} />
            ))}
        </div>
        {card.points !== undefined && card.points > 0 && (
          <span className="card-points">
            <Star size={10} strokeWidth={0} fill="currentColor" />
            {card.points}
          </span>
        )}
      </div>
      <div className="card-art" style={{ "--tag": color } as CSSProperties}>
        {card.art ? <img src={card.art} alt="" /> : <ArtIcon size={size === "full" ? 34 : 24} strokeWidth={1.6} />}
      </div>
      <div className="card-title">{card.title}</div>
      {size === "full" && (
        <>
          <div className="card-tags">
            {card.tags?.map((tag) => (
              <span key={tag} style={{ color: tagStyle(tag).color }}>
                {tag}
              </span>
            ))}
          </div>
          {card.text && <p className="card-text">{card.text}</p>}
        </>
      )}
    </>
  );

  const title = size === "compact" ? [card.title, card.text].filter(Boolean).join(" — ") : undefined;
  return target ? (
    <button type="button" className={className} style={{ ...style, "--tag": color } as CSSProperties} onClick={onClick} title={title}>
      {body}
    </button>
  ) : (
    <div className={className} style={{ ...style, "--tag": color } as CSSProperties} title={title}>
      {body}
    </div>
  );
}
