import type { Outcome, PlayerId, PlayMode } from "@boarddream/engine";

/**
 * The end-of-game banner, from the human's seat. Cooperative games are won or lost by the whole
 * table, and hidden-role games by a side, so neither names a single winner.
 */
export function resultHeadline(mode: PlayMode, { winners }: Outcome, human: PlayerId): string {
  if (mode === "cooperative") return winners.length > 0 ? "The table wins!" : "The table lost";
  if (winners.length === 0) return "It's a draw";
  if (mode === "hidden-role") return winners.includes(human) ? "Your side wins!" : "Your side lost";
  if (winners.includes(human)) return winners.length > 1 ? "Shared victory" : "You win!";
  return winners.length > 1 ? `Players ${winners.map((w) => w + 1).join(" and ")} share the win` : `Player ${winners[0] + 1} wins`;
}
