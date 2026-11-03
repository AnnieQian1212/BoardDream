import type { ChatMessage } from "../meta/client";
import type { RulesCheck } from "./check";
import type { Reference } from "./references";
import { dialsForModel } from "./dials";
import type { BoardShape, Dials, GameRequest, GameSpec, Goal, Interaction, Powers, RecentGame, Theme, Tone } from "./spec";

// Iterated against the fuzz-repair benchmark in eval/generation.

const INTERACTION: Record<Interaction, string | undefined> = {
  gentle:
    'interaction "gentle": players mostly build their own engine, tableau or area and race each other; they meet only at a shared market, shared goals or first-come spaces. No attacking, stealing or taking things away.',
  // The default the system prompt already describes.
  some: undefined,
  cutthroat:
    'interaction "cutthroat": players clash directly every round: blocking, stealing, attacking, or taking spaces and majorities away from each other. Keep it fair: nobody is knocked out, and the leader is the natural target.',
};

export const THEMES: Record<Theme, string> = {
  nature: "the natural world (forests, reefs, seasons, wildlife)",
  history: "the past (crafts, trades and journeys of long ago)",
  fantasy: "a fantasy world",
  scifi: "science fiction",
  myth: "myths and folklore of your own invention (spirits, legendary heroes, trickster tales), never a real religion",
  mystery: "a mystery (detectives, secrets, lost treasure, friendly ghost stories)",
  everyday: "everyday life today (cafes, gardens, street festivals, neighborhood shops)",
};

const BOARDS: Record<BoardShape, string> = {
  hex: "a hex map of terrain",
  network: "a network of places joined by routes",
  track: "a winding track of spaces that players advance along by choice, never by a roll",
  spaces: "a board of action spaces that players' workers claim",
  regions: "a map of irregular regions to hold and contest",
  tiles: "tiles laid edge to edge, so the board grows as the game goes",
  none: "no shared board: a market, a tableau and player boards",
};

const GOALS: Record<Goal, string> = {
  points: "the most points at the end wins, with points from several sources, some scored during play and some at the end",
  race: "a race: the first player to reach a target (a score, a finished set or building, a destination) ends the game and wins; make the target a tunable",
  secret:
    "secret objectives: deal each player one or two hidden objective cards at setup that score at the end on top of the shared scoring, so players read each other's plans",
};

const POWERS: Record<Powers, string> = {
  same: "every player starts with the same setup and abilities; differences come only from play",
  unique:
    "each player gets a different role, guild or character, dealt at random at setup, with its own special ability and starting resources. Keep them balanced so no seat wins much more often, and show each player's power on their panel",
};

const TONES: Record<Tone, string> = {
  cozy: "cozy: warm, small comforts and friendly rivalry",
  whimsical: "whimsical: playful, odd and charming details",
  tense: "tense: scarce resources, close calls and pressure every round",
  epic: "epic: grand stakes, sweeping journeys and long plans",
  mysterious: "mysterious: secrets, hidden places and slow revelations",
};

/**
 * What the player set beyond the basic dials, as lines for the designer. Empty when they set
 * nothing, so those requests read exactly as the benchmark's do.
 */
function wishes(dials: Dials): string {
  const lines = [
    dials.family && `family "${dials.family}": the player chose it, so use it whatever the idea suggests.`,
    dials.interaction && INTERACTION[dials.interaction],
    dials.theme && `theme: when the idea names no setting, set the game in ${THEMES[dials.theme]}.`,
    dials.board && `board: the player chose ${BOARDS[dials.board]}. Build the table that way, whatever the family or the idea suggests, and say so in board.`,
    dials.goal && `goal: ${GOALS[dials.goal]}.`,
    dials.powers && `powers: ${POWERS[dials.powers]}.`,
    dials.tone && `tone: make the game ${TONES[dials.tone]}. Let it show in the setting, the names, the components and the card text.`,
    dials.mustUse?.length && "mustUse: mechanics the player asked for. Build the game around every one of them and list them in mechanics.",
  ].filter(Boolean);
  return lines.length ? `\nThe player also set these dials:\n${lines.map((line) => `- ${line}`).join("\n")}` : "";
}

/**
 * The games made lately, for the designer to differ from. Left to itself it reaches for a hex map
 * of terrain with trading whenever an idea names a place, and names games "Grand X: Y Z", so a
 * shelf of generated games looks like one game reskinned.
 */
function recentGames(recent: RecentGame[] | undefined): string {
  if (!recent?.length) return "";
  const lines = recent.map((g) => `- ${g.title} (${g.family}; ${g.board}${g.mechanics?.length ? `; ${g.mechanics.slice(0, 3).join(", ")}` : ""})`);
  return `\nGames made here lately, newest first:\n${lines.join("\n")}
Where the idea and the dials leave it open, make this one differ from them: a family, a board shape and core
mechanics they use least, and a name unlike theirs.`;
}

export function specMessages(request: GameRequest): ChatMessage[] {
  return [
    {
      role: "system",
      content: `You are BoardDream's lead game designer. Turn a player's idea and dial settings into a compact,
implementable spec for a turn-based board game that runs in a browser.
- The players are experienced hobby gamers, teens and adults. Even when the idea sounds simple, design a
  strategy game with real depth:
  - every turn offers several meaningful options with trade-offs, and planning ahead (building an engine,
    timing, position) wins more often than luck;
  - players interact: they compete for shared spaces, market cards or majorities, trade, or block;
  - two or three systems interlock, e.g. an economy feeding a building or card engine, a map or majority
    layer, and public goals or end-game bonuses that pull players in different directions.
  Never design roll-and-move, single-decision or children's games.
- family: "engine" for tableau and engine building (cards that cost resources and pay income or bonuses) and
  worker placement; "map" for building on a hex map with production and trading; "grid" for tile placement
  and area control on a board; "bluff" for hidden information, bidding and hidden roles.
- Let the setting decide the parts and the table, so every game looks like its own world:
  - components are things from the setting (perfume vials and recipe cards, kites and wind gauges, oil
    and lamp wicks), never generic cubes and cards;
  - board is the shape of the table in one sentence, taken from the place: a river is a line of ports,
    a festival a ring of stalls, a city a grid of districts, a mountain pass a winding track, a court a
    set of action spaces, a coast a network of harbors joined by routes. Use a hex map of terrain only
    when the game is about exploring and settling open land, and no board at all (a market, a tableau
    and player boards) when the game lives in cards.
- title: one to three evocative words that fit the setting ("Lamplight Reach", "Saltglass"). No colon,
  no subtitle, never "X: Y".
- Respect the dials: player count range, play time, complexity (1 gateway hobby game to 5 heavy strategy
  game), luck (0 pure strategy to 1 mostly luck) and mode.
- The game must be original: never a recreation of a published game, even renamed. Medium scale: 3-5
  resources, 20-40 distinct cards at most, a map of at most 19-37 tiles.
- Depth comes from tension between a few proven mechanics, not from piles of exceptions.
- When the game has cards, give them distinct abilities that work together: a card that rewards playing
  another kind of card, one that makes a kind cheaper, tags that end-game bonuses count. The order cards
  are played in should build combos, and no card should be a plain copy of another with a new name.
- tunables are integer knobs the rules read from params (board size, target score, hand size, round limit).
  Include 2-4, with ranges where every value still gives a playable game.
- rules: plain sentences a new player can follow, with each tunable written as its default number
  ("after 6 rounds"), never as its key.
- mechanics lists plain mechanic names (e.g. "card market", "worker placement", "area majority").${wishes(request.dials)}${recentGames(request.recent)}`,
    },
    { role: "user", content: JSON.stringify({ prompt: request.prompt, dials: request.dials.mustUse ? dialsForModel(request.dials) : request.dials }) },
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
    hidden things face down. Give every cell a kind naming what it is (a terrain, a district, an action
    space); each kind gets its own color. Cells with kind "vertex" or "edge" render as building spots and roads.
    Light sources (lanterns, fires, beacons) can take a glow color and shine. Name water cells with a plain word (sea, lake,
    river, lagoon, reef) and the table draws them as water; grassland (meadow, pasture, plains),
    forest (forest, woodland, grove), grain (fields, wheat, farmland) and stony ground (quarry, rocks,
    mountains) grow grass and flowers, trees, wheat, or boulders. A place with a made-up name (an
    island "Emberfall") can say what its ground is with terrain: water, grass, forest, grain or stone.
    Draw the board the spec's board field describes; it need not be hexes. A track or river is a line or
    bend of square spaces, action spaces a grid of labelled rectangles, regions irregular polygons, a
    network round places with "edge" cells as the routes between them. Lay it out as one compact block
    with no large empty part: the main area in the middle, side areas (action spaces, tracks) in rows or
    columns around it, none longer than the side it lies along, and width and height just covering the
    cells; never a long column of spaces beside a small grid. A cell may lie wholly inside
    a larger one (a sea around its harbors), drawn beneath it; otherwise cells never overlap: a bridge
    is an "edge" cell between two places, not a tile laid across a river.
    Make a map look like a landscape: give its places varied ground (set terrain where the kind does not
    say it), with water somewhere (a lake, a river bend, a harbor) when the theme allows. Water or scenery
    no rule uses can be extra cells in geometry only, never in the rules' map, as long as no move targets them.
    A map cell's label is the place's name as players would say it ("Copper Steps", "Emberfall", "Lamp
    Quay"), each different, never an id or code like "E1" or "T12". A number players read off the cell
    (an elevation, a yield, a cost) goes in badge (1-3 characters), printed on a round token under the name.
    When pieces fight over places, settle each fight with combat.battle and return the latest as
    geometry's battle (combat.battleView, with an id that changes every battle); the table plays it
    out with dice.
  - panels(state, viewer): one "players" panel per seat (resource counters with a resource id, a victory
    point counter labelled "Score", played cards), "shared" panels (a market row, a supply, a deck counter
    labelled "Deck") and a "hand" panel for the viewer's own cards only. Counter ids and card ids must be
    unique. A panel's note is one short status line (under 50 characters); numbers belong in counters.
- outcome(state).scores should also give the current standings before the game ends, counting points that
  are still to be scored as if they scored now (majorities, sets, end-game bonuses). Bots plan by them, so
  they must track who is really winning.
- meta.rules: 3-6 short sentences that teach the game to a new player (also read by AI opponents).
- Declare meta.resources ([{ id, name, icon, color }]) when the game counts resources. Icons: droplet, sun,
  sprout, tree, trees, mountain, wheat, brick, coins, gem, fish, flame, leaf, star.
- moveTarget(state, move) returns the id of the board cell, card or counter the move acts on, or
  undefined for moves shown as buttons (end turn, pass). Several moves may share a target.
- Card games: write cards as data with the effects module (CardDef: cost, points, tags, onPlay, income,
  endgame, whenever, discount), build the deck with buildDeck so every copy has a stable id like "fern#2",
  show text from rulesText, and keep a card's id the same in every zone so the UI can animate it; a card
  is in exactly one place at a time. Cards may set each other off with whenever (fires when its owner
  plays another card with a tag) and discount (cards with a tag cost less). To play a card: pay costOf,
  then playToTableau, which moves it from the seat's hand to its tableau and applies its effects; pay
  income with applyIncome. Optionally set each card view's pulse with pulseOf(seat, id) so it flashes.
- Drafting: keep a drafting.Draft in state. Picks are simultaneous: activePlayers returns drafting.waiting,
  view hides rival hands and picks with drafting.hideDraft, and the applyMove that records the last pick also
  calls drafting.resolve to reveal the picks and pass the hands. Open drafts from a shared row use snakeOrder.
- Deck building: one deckbuilding.PlayerDeck per seat; bought cards go to the discard pile (gainCard), each
  turn ends with cleanup, and view hides draw piles and rival hands with hideDeck. Score collections with
  sets (countKinds, scoreByKind, scoreDistinctSets, fullSets).
- Cooperative games: meta.mode "cooperative"; the game is the opponent. Keep threat per place with
  threat.strike (overflow spreads to neighbors) and threat.relieve, draw events with threat.drawEvents at the
  rate threat.rate gives, and return threat.teamOutcome (everyone wins, or winners is empty for a loss).
- Map games: build the map once at module scope with hexmap.buildHexMap, keep only ids in state, and use
  canSettle / canRoad / settleSpots / roadSpots, production.produce and the trade helpers.
- Worker placement: keep placements as workers.Placements and use openSpaces / place / nextToPlace; draw
  action spaces as labelled board cells with the workers as pieces (shape "pawn") on them. Majorities: keep
  per-region counts and score them with majority.majorityAwards or scoreRegions.
- Tile placement: build the board once at module scope with tiles.hexBoard or tiles.squareBoard, keep placed
  tiles as { [cellId]: { edges, owner } } with edges already turned by tiles.rotate, offer tiles.frontier
  cells (tiles.placements when edges must match), and score with tiles.regions (complete when open is 0).
  Draw placed tiles as cells whose segments are their edges; the table paints each edge's terrain.
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

/**
 * What the repair prompts know about the game: the designer's spec for a new game, or for a
 * revision the game's name, pitch and the change the designer asked for.
 */
export type DesignBrief = GameSpec | { title: string; pitch: string; designerRequest: string };

export function revisionMessages(source: string, request: string): ChatMessage[] {
  return [
    { role: "system", content: `You revise board game rules for the BoardDream engine.\n\n${CODE_RULES}` },
    {
      role: "user",
      content: `A designer playtested this game and asks for a change:

> ${request}

Change the rules to do what they ask, in the spirit of the request, and keep everything else as it is
unless the change needs it. Update meta.rules, describeMove, panels and geometry so they match the new
rules, add a param for any new number a designer might want to tune, keep meta.id and meta.name, and
return the full module.

## Current module
\`\`\`js
${source}
\`\`\``,
    },
  ];
}

export function repairMessages(spec: DesignBrief, source: string, failureText: string): ChatMessage[] {
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

export function designRepairMessages(spec: DesignBrief, source: string, issues: string[]): ChatMessage[] {
  return [
    { role: "system", content: `You improve board game rules for the BoardDream engine.\n\n${CODE_RULES}` },
    {
      role: "user",
      content: `These rules pass automated testing, but random play and a look at the board show design problems:
${issues.map((issue) => `- ${issue}`).join("\n")}

Fix them with small rule changes that keep the game's identity (for example a longer round limit, more
choices each turn, compensation for later seats, or, when decisions barely matter, scarcer actions,
bigger rewards for planning ahead and less luck); fix a board problem by moving cells in geometry(),
keeping their ids. Keep everything that already works, and return the full corrected module.

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
