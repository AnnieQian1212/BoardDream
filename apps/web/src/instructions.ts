/** The turn's instruction for a player who switched the glow off (prefs): nothing glows to click. */
export const unlit = (text: string | undefined) => text?.replace("Click anything that glows", "Click what you want to do").replace("Click a glowing ", "Click a ");

/**
 * What to tell a player whose turn it is, from the moves they can make: "Click a glowing corner to
 * settle", rather than "pick something that glows". Every game describes its moves in words
 * (describeMove), and a move with a target says what it acts on, so the instruction comes from the
 * verbs those descriptions start with and the kind of thing that glows.
 */

/** What a glowing target is, as a player would call it. */
export type TargetKind = "corner" | "edge" | "space" | "card" | "pile" | "counter" | "deck";

const STOP = new Set(["by", "at", "to", "for", "from", "on", "onto", "of", "in", "into", "with", "and", "or", "as", "then"]);
const ARTICLES = new Set(["a", "an", "the", "your", "their", "its"]);

/**
 * The action a move description starts with: its words up to the first that names a particular
 * (a number, a name, a seat like P2) or a preposition. "settle by lagoon" is "settle", "build a
 * village by quarry" is "build a village", "send crew to Timber +3" is "send crew", "offer P2 1
 * stone for 1 fish" is "offer".
 */
export function actionOf(description: string): string {
  const words = description.trim().split(/\s+/);
  const kept: string[] = [];
  for (const [i, word] of words.entries()) {
    const bare = word.replace(/[^\p{L}\p{N}'-]/gu, "");
    if (!bare) break;
    if (/\d/.test(bare) || /^P\d/.test(bare)) break;
    if (i > 0 && /^\p{Lu}/u.test(bare)) break;
    if (i > 0 && STOP.has(bare.toLowerCase())) break;
    kept.push(i === 0 ? bare.toLowerCase() : bare);
    if (/[:;,(]$/.test(word)) break;
  }
  while (kept.length > 1 && ARTICLES.has(kept.at(-1)!.toLowerCase())) kept.pop();
  return kept.join(" ");
}

const NOUNS: Record<TargetKind, [string, string]> = {
  corner: ["corner", "corners"],
  edge: ["edge", "edges"],
  space: ["space", "spaces"],
  card: ["card", "cards"],
  pile: ["pile", "piles"],
  counter: ["counter", "counters"],
  deck: ["deck", "decks"],
};

/** "a, b or c". */
function either(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} or ${items.at(-1)}`;
}

/**
 * The instruction for a turn: the targets' moves grouped by what glows, most common first, each
 * with at most two actions. Too many kinds of thing to click reads as a list nobody follows, so
 * past two it says only that everything glowing can be clicked.
 */
export function instruction(moves: { kind: TargetKind; description: string }[]): string | undefined {
  if (moves.length === 0) return undefined;
  const byKind = new Map<TargetKind, Map<string, number>>();
  for (const { kind, description } of moves) {
    const action = actionOf(description);
    if (!action) continue;
    const actions = byKind.get(kind) ?? new Map<string, number>();
    actions.set(action, (actions.get(action) ?? 0) + 1);
    byKind.set(kind, actions);
  }
  if (byKind.size === 0 || byKind.size > 2) return "Click anything that glows";
  const total = (actions: Map<string, number>) => [...actions.values()].reduce((a, b) => a + b, 0);
  const parts = [...byKind.entries()]
    .sort((a, b) => total(b[1]) - total(a[1]))
    .map(([kind, actions]) => {
      const verbs = [...merged(actions).entries()].sort((a, b) => b[1] - a[1]).map(([verb]) => verb);
      const shown = verbs.length > 2 ? `${verbs.slice(0, 2).join(", ")} and more` : either(verbs);
      return { kind, shown };
    });
  const [first, second] = parts;
  const head = `Click a glowing ${NOUNS[first.kind][0]} to ${first.shown}`;
  return second ? `${head}, or a ${NOUNS[second.kind][0]} to ${second.shown}` : head;
}

/**
 * Actions that start with the same verb read as that verb: "gather bamboo" and "gather glow-oil" are
 * "gather", "craft a violet lantern" and "craft ember lantern" are "craft".
 */
function merged(actions: Map<string, number>): Map<string, number> {
  const verb = (action: string) => action.split(" ")[0];
  const sharing = new Map<string, number>();
  for (const action of actions.keys()) sharing.set(verb(action), (sharing.get(verb(action)) ?? 0) + 1);
  const out = new Map<string, number>();
  for (const [action, count] of actions) {
    const key = (sharing.get(verb(action)) ?? 0) > 1 ? verb(action) : action;
    out.set(key, (out.get(key) ?? 0) + count);
  }
  return out;
}

/** The rule that says how the game is won, for the first-game guide; the summary if none does. */
export function goalOf(rules: string[], summary: string): string {
  const winning = rules.find((rule) => /\b(wins?|winner|winning|most points|highest score|game ends|victory)\b/i.test(rule));
  return winning ?? summary;
}
