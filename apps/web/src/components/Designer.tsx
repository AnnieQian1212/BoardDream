import { X } from "lucide-react";
import type { ReactNode } from "react";

export type DesignerTab = "rules" | "balance" | "art";

const TABS: { id: DesignerTab; label: string }[] = [
  { id: "rules", label: "Rules" },
  { id: "balance", label: "Balance" },
  { id: "art", label: "Art" },
];

interface Props {
  open: boolean;
  tab: DesignerTab;
  onTab(tab: DesignerTab): void;
  onClose(): void;
  /** Each tab's panels; a tab with nothing to show is left out. */
  panels: Partial<Record<DesignerTab, ReactNode>>;
}

/**
 * The designer's bench, a drawer at the table's right that stays shut while playing: the rule
 * dials and plain-words changes, the balance and the measured profile, and the art. The game log is
 * part of playing and opens from the turn bar (MoveLog).
 */
export function Designer({ open, tab, onTab, onClose, panels }: Props) {
  const tabs = TABS.filter((t) => panels[t.id]);
  const shown = panels[tab] ? tab : tabs[0]?.id;
  return (
    <aside className={["designer", open && "open"].filter(Boolean).join(" ")} aria-label="Designer" aria-hidden={!open} inert={!open}>
      <header className="designer-head">
        <div role="tablist" aria-label="Designer">
          {tabs.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={t.id === shown} className={t.id === shown ? "on" : ""} onClick={() => onTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className="quiet icon-only" onClick={onClose} aria-label="Close the designer">
          <X size={17} />
        </button>
      </header>
      <div className="designer-body" role="tabpanel">
        {shown && panels[shown]}
      </div>
    </aside>
  );
}
