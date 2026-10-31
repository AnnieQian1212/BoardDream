import type { Panel } from "@boarddream/engine";

/**
 * Counters as players read them. A generated game may count points it has not scored yet as part
 * of a point (a majority still contested) and show 4.046666666666667; the table shows at most one
 * decimal, so that reads 4 and 3.8966 reads 3.9.
 */
export function tidyPanels(panels: Panel[]): Panel[] {
  const tidy = (value: number) => Math.round(value * 10) / 10;
  return panels.map((p) =>
    p.counters?.some((c) => c.value !== tidy(c.value)) ? { ...p, counters: p.counters.map((c) => ({ ...c, value: tidy(c.value) })) } : p,
  );
}
