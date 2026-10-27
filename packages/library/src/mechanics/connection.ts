/** Connection win conditions: does a chain of a player's cells link two sides of the board? */

/**
 * Breadth-first search from `starts` through cells accepted by `passable`, stopping at the first
 * cell accepted by `isGoal`. Works on any board given its `neighbors` function.
 */
export function connects(
  starts: readonly number[],
  isGoal: (index: number) => boolean,
  passable: (index: number) => boolean,
  neighbors: (index: number) => readonly number[],
): boolean {
  const queue = starts.filter(passable);
  const seen = new Set(queue);
  while (queue.length > 0) {
    const cell = queue.shift()!;
    if (isGoal(cell)) return true;
    for (const next of neighbors(cell)) {
      if (!seen.has(next) && passable(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}
