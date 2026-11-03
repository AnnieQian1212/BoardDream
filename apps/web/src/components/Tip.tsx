import { CircleAlert } from "lucide-react";
import { useId, type ReactNode } from "react";

/**
 * A small "!" beside a label whose note shows on hover or focus, so a form keeps its fields in
 * view and its fine print one glance away: how long a game takes at an effort, what an email is
 * used for. `label` is what a screen reader says for the mark.
 */
export function Tip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <span className="tip-mark" tabIndex={0} aria-describedby={id} aria-label={label}>
      <CircleAlert size={14} aria-hidden />
      <span className="library-tip" role="tooltip" id={id}>
        {children}
      </span>
    </span>
  );
}
