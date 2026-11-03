import type { Panel } from "@boarddream/engine";

/**
 * Counters as players read them. A generated game may count points it has not scored yet as part
 * of a point (a majority still contested) and show 4.046666666666667; the table shows at most one
 * decimal, so that reads 4 and 3.8966 reads 3.9.
 */
export function tidyPanels(panels: Panel[]): Panel[] {
  const tidy = (value: number) => Math.round(value * 10) / 10;
  return panels.map((p) => {
    let out = p;
    // Parts generated rules sometimes leave out, made good for games saved before the check asked for
    // them (checkPanels): a seat's panel that names its seat `seat` rather than `owner`, a panel with
    // no title (a seat's becomes "Player N", a shared one's empty) and a card that names itself `name`
    // rather than `title`, either of which stopped the table drawing.
    const seat = (p as { seat?: unknown }).seat;
    if (out.zone === "players" && out.owner === undefined && Number.isInteger(seat)) out = { ...out, owner: seat as number };
    if (typeof out.title !== "string") out = { ...out, title: out.zone === "players" && out.owner !== undefined ? `Player ${out.owner + 1}` : "" };
    if (out.counters?.some((c) => c.value !== tidy(c.value) || typeof c.label !== "string")) {
      out = { ...out, counters: out.counters.map((c) => ({ ...c, value: tidy(c.value), label: typeof c.label === "string" ? c.label : (c.resource ?? c.id) })) };
    }
    if (out.cards?.some((c) => typeof c.title !== "string")) {
      out = { ...out, cards: out.cards.map((c) => (typeof c.title === "string" ? c : { ...c, title: String((c as { name?: unknown }).name ?? c.id) })) };
    }
    return out;
  });
}
