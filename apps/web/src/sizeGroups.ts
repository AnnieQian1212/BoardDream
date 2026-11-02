import type { Geometry } from "@boarddream/engine";

/**
 * Places of one kind and about one size (within 5% each way) share a group, so their names can be
 * printed at one size. Sizes are compared, not rounded: 2.25 units measured at different places on
 * the board rounds to 2.2 for some and 2.3 for others.
 */
export function sizeGroups(cells: Geometry["cells"]): (cell: Geometry["cells"][number]) => string {
  const reps: { kind: string; w: number; h: number; id: string }[] = [];
  const of = new Map<string, string>();
  for (const cell of cells) {
    const xs = cell.polygon.map(([x]) => x);
    const ys = cell.polygon.map(([, y]) => y);
    const [w, h] = [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)];
    const kind = cell.kind ?? "";
    const near = (a: number, b: number) => Math.abs(a - b) <= 0.05 * Math.max(a, b);
    let rep = reps.find((r) => r.kind === kind && near(r.w, w) && near(r.h, h));
    if (!rep) reps.push((rep = { kind, w, h, id: `${kind}#${reps.length}` }));
    of.set(cell.id, rep.id);
  }
  return (cell) => of.get(cell.id) ?? cell.id;
}
