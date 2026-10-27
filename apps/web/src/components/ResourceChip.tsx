import type { ResourceSpec } from "@boarddream/engine";
import { Star } from "lucide-react";
import { iconFor } from "../icons";

interface Props {
  value: number;
  label: string;
  resource?: ResourceSpec;
  /** "score" draws the points star. */
  variant?: "resource" | "score" | "plain";
  /** Clickable because a legal move targets it. */
  target?: boolean;
  onClick?(event: React.MouseEvent): void;
}

export function ResourceChip({ value, label, resource, variant = "resource", target, onClick }: Props) {
  const Icon = variant === "score" ? Star : iconFor(resource?.icon);
  const color = variant === "score" ? "#e6b64a" : (resource?.color ?? "#7d8a84");
  const className = ["chip", variant, target && "target"].filter(Boolean).join(" ");
  const content = (
    <>
      {variant !== "plain" && (
        <span className="chip-icon" style={{ background: color }}>
          <Icon size={13} strokeWidth={2.4} />
        </span>
      )}
      <span className="chip-value">{value}</span>
      {variant === "plain" && <span className="chip-label">{label}</span>}
    </>
  );
  return target ? (
    <button type="button" className={className} title={`${label}: ${value}`} onClick={onClick}>
      {content}
    </button>
  ) : (
    <span className={className} title={`${label}: ${value}`}>
      {content}
    </span>
  );
}

/** Cost pips on a card. */
export function CostPip({ amount, resource }: { amount: number; resource?: ResourceSpec }) {
  const Icon = iconFor(resource?.icon);
  return (
    <span className="pip" style={{ background: resource?.color ?? "#7d8a84" }} title={`${amount} ${resource?.name ?? ""}`}>
      <Icon size={11} strokeWidth={2.6} />
      <b>{amount}</b>
    </span>
  );
}
