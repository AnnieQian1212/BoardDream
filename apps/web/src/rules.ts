import type { GameModule, Params } from "@boarddream/engine";

/**
 * A game's rules for players, with tunables written as the numbers they are set to. Games
 * generated before the designer was told to write numbers sometimes name the param instead
 * ("each player gets startingCoins Coins", "play rounds rounds").
 */
export function rulesFor(game: GameModule, params: Params): string[] {
  const rules = game.meta.rules?.length ? game.meta.rules : [game.meta.summary];
  return rules.map((rule) => fillParams(rule, game, params));
}

export function fillParams(text: string, game: GameModule, params: Params): string {
  let out = text;
  for (const spec of game.params) {
    const value = params[spec.key];
    if (spec.kind !== "int" || typeof value !== "number") continue;
    const word = (pattern: string) => new RegExp(`\\b${pattern}\\b`, "g");
    // A key no one writes in prose (startingCoins, market_slots) is always the param; a plain word
    // (rounds) is the param only where it doubles up ("play rounds rounds").
    if (/[A-Z_0-9]/.test(spec.key)) out = out.replace(word(spec.key), String(value));
    else out = out.replace(word(`${spec.key} ${spec.key}`), `${value} ${spec.key}`);
  }
  return out;
}
