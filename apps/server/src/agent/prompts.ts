import type { ChatMessage } from "../meta/client";
import type { RulesCheck } from "./check";
import type { Reference } from "./references";
import type { GameRequest, GameSpec } from "./spec";

// Iterated against the fuzz-repair benchmark in eval/generation.

export function specMessages(request: GameRequest): ChatMessage[] {
  return [
    {
      role: "system",
      content: `You are BoardDream's lead game designer. Turn a player's idea and dial settings into a compact,
implementable spec for a turn-based board game that runs in a browser.
- family: "engine" for tableau and engine building (cards that cost resources and pay income or bonuses); "map"
  for building on a hex map with production and trading; "grid" for boards, placement and abstract strategy;
  "race" for tracks and dice; "bluff" for hidden information, bidding and hidden roles.
- Respect the dials: player count range, play time, complexity (1 light to 5 heavy), luck (0 pure strategy
  to 1 pure luck) and mode.
- The game must be original: never a recreation of a published game, even renamed. Medium scale: 3-5
  resources, 20-40 distinct cards at most, a map of at most 19-37 tiles.
- Prefer a few well-known mechanics combined cleanly over novel complexity.
- tunables are integer knobs the rules read from params (board size, target score, hand size, round limit).
  Include 2-4, with ranges where every value still gives a playable game.
- mechanics lists plain mechanic names (e.g. "dice rolling", "track movement", "k in a row").`,
    },
    { role: "user", content: JSON.stringify(request) },
  ];
}

const CODE_RULES = `Write the rules as one JavaScript module in a single \`\`\`js block:
- CommonJS: module.exports = { meta, params, setup, activePlayers, legalMoves, applyMove, isTerminal, outcome,
  view?, geometry?, moveTarget?, describeMove? }, implementing the GameModule interface exactly.
- Only require("@boarddream/engine") and require("@boarddream/mechanics"). Use the retrieved mechanic helpers
  instead of re-implementing them.
- Pure functions: never mutate state or moves (they are frozen during testing); return new objects.
- States and moves must be plain JSON: objects, arrays, numbers, strings, booleans, null. No Map, Set,
  classes, functions or undefined inside arrays.
- Randomness only from the rng argument (ctx.rng in setup, rng in applyMove). Never Math.random or Date.
- Whenever isTerminal is false, activePlayers must return a player who has at least one legal move. Add a
  pass move where needed, and a round or turn limit so every game ends.
- params: one "int" ParamSpec per spec tunable, plus toggles if useful. Read them from ctx.params in setup
  and copy what later turns need into state.
- Hidden information: implement view(state, player) and redact everything that player cannot see.
- The table UI is built from two optional functions; implement whichever the game needs (most need both):
  - geometry(state, viewer): the board as cell polygons in board units, plus pieces; with a viewer, draw
    hidden things face down. Cells with kind "vertex" or "edge" render as building spots and roads.
  - panels(state, viewer): one "players" panel per seat (resource counters with a resource id, a victory
    point counter labelled "Score", played cards), "shared" panels (a market row, a supply, a deck counter
    labelled "Deck") and a "hand" panel for the viewer's own cards only. Counter ids and card ids must be
    unique.
- outcome(state).scores should also give the current standings before the game ends; bots read them.
- Declare meta.resources ([{ id, name, icon, color }]) when the game counts resources. Icons: droplet, sun,
  sprout, tree, trees, mountain, wheat, brick, coins, gem, fish, flame, leaf, star.
- moveTarget(state, move) returns the id of the board cell, card or counter the move acts on, or
  undefined for moves shown as buttons (end turn, pass). Several moves may share a target.
- Card games: write cards as data with the effects module (CardDef: cost, points, tags, onPlay, income,
  endgame), build the deck with buildDeck so every copy has a stable id like "fern#2", show text from
  rulesText, and keep a card's id the same in every zone so the UI can animate it.
- Map games: build the map once at module scope with hexmap.buildHexMap, keep only ids in state, and use
  canSettle / canRoad / settleSpots / roadSpots, production.produce and the trade helpers.
- Keep every rules function cheap; the fuzzer plays 1,000 full games. Bound the length of a game (a round or
  turn limit param) and of a turn (a cap on actions or trades).
- Implement describeMove(state, move, viewer) with short human-readable labels; when the viewer is not the
  mover, leave out anything hidden from them (e.g. which cards were really played face down).`;

export function composeMessages(spec: GameSpec, engineInterface: string, references: Reference[]): ChatMessage[] {
  const refs = references
    .map(({ entry, code }) =>
      [
        `### ${entry.title} (${entry.kind})`,
        entry.description,
        entry.usage ? `Usage: ${entry.usage}` : "",
        code ? `\`\`\`ts\n${code}\n\`\`\`` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n");
  return [
    { role: "system", content: `You implement board game rules for the BoardDream engine.\n\n${CODE_RULES}` },
    {
      role: "user",
      content: `## Game spec\n${JSON.stringify(spec, null, 2)}\n\n## Engine interface\n\`\`\`ts\n${engineInterface}\n\`\`\`\n\n## Retrieved mechanics and reference games\n${refs}`,
    },
  ];
}

export function formatFailures(check: RulesCheck): string {
  if (check.loadError) return `- The module failed to load: ${check.loadError}`;
  if (check.stalled) {
    const { seed, numPlayers, params, afterMs } = check.stalled;
    return `- [hang] one game ran for over ${Math.round(afterMs / 1000)} s without finishing, almost certainly an infinite loop in setup, legalMoves, applyMove or another rules function (seed ${seed}, ${numPlayers} players, params ${JSON.stringify(params)}). Make every loop provably terminate.`;
  }
  if (check.aborted) return `- [aborted] ${check.aborted}. Keep each move cheap: no exhaustive search inside rules functions.`;
  return check.failures
    .map((f) => {
      const replay = `seed ${f.seed}, ${f.numPlayers} players, params ${JSON.stringify(f.params)}`;
      const moves = f.recentMoves.map((m) => `p${m.player}:${JSON.stringify(m.move)}`).join(" ");
      return `- [${f.kind}] ${f.message}\n  seen in ${f.count} runs; first at turn ${f.turn} (${replay})\n  last moves: ${moves || "(none)"}`;
    })
    .join("\n");
}

export function repairMessages(spec: GameSpec, source: string, failureText: string): ChatMessage[] {
  return [
    { role: "system", content: `You fix board game rules for the BoardDream engine.\n\n${CODE_RULES}` },
    {
      role: "user",
      content: `These rules failed automated playtesting (thousands of random games). Fix the root cause of every
failure without changing the game's design, and return the full corrected module.

## Failures
${failureText}

## Game spec
${JSON.stringify(spec, null, 2)}

## Current module
\`\`\`js
${source}
\`\`\``,
    },
  ];
}

export function designRepairMessages(spec: GameSpec, source: string, issues: string[]): ChatMessage[] {
  return [
    { role: "system", content: `You improve board game rules for the BoardDream engine.\n\n${CODE_RULES}` },
    {
      role: "user",
      content: `These rules pass automated testing, but statistics from random play show design problems:
${issues.map((issue) => `- ${issue}`).join("\n")}

Fix them with small rule changes that keep the game's identity (for example a longer round limit, more
choices each turn, or compensation for later seats), keep everything that already works, and return the
full corrected module.

## Game spec
${JSON.stringify(spec, null, 2)}

## Current module
\`\`\`js
${source}
\`\`\``,
    },
  ];
}

/** The first fenced code block in a reply, or the whole reply if there is none. */
export function extractCode(reply: string): string {
  const match = reply.match(/```(?:js|javascript)?[^\n]*\n([\s\S]*?)```/);
  return (match ? match[1] : reply).trim();
}
