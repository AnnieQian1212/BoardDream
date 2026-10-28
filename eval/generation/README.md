# Generation benchmark

Can BoardDream turn a one-sentence idea into rules that work and are worth playing?

`prompts.jsonl` has 24 ideas for hobby strategy games, four in each of six groups: engine and deck builders (g01–g04), worker placement and majorities (g05–g08), map, trade and build (g09–g12), tile placement (g13–g16), drafting, sets and deck building (g17–g20), and hidden roles, bluffing, sealed bids and co-op (g21–g24). All ask for complexity 3 or 4 of 5 and 30–75 minutes.

Each idea goes through the full pipeline: design, retrieval, rules code, then 1,000 strict random games. Failures go back to Muse Spark for repair (up to 4 rounds). Rules that pass get a playtest: 100 random games, plus 30 where a planner (the generic bot with short playouts) takes each seat in turn against random players. Design problems get one improvement round: games over too fast, mostly draws, a seat that never wins, no real choices, or a planner that barely beats random play.

## Results (Oct 28, 2026)

| | |
| --- | --- |
| Pass 1,000-game fuzzing on the first draft | 17 / 24 |
| Pass after one repair | 24 / 24 |
| Planner win rate in 3-player games (20 measurable games) | 88%, fair share 34% |
| Games where planning clearly pays (skill edge 0.25 or more) | 20 / 20 |
| Design problems found by the playtest | 2, both fixed in one round |
| Cost of the run | $4.23 (33 new Muse Spark 1.3 calls; specs and retrieval cached from the run below) |

- All seven failed drafts wired the table wrong: `moveTarget` named a card the table did not show (5), or two cards shared an id (2). The strict fuzzer caught each one and one repair fixed it.
- Skill edge runs from 0 (the planner wins its fair share) to 1 (it always wins). The four original reference games score 0.50–0.70. Bluffing and co-op games (g21–g24) are not measured: the planner cannot bluff, and co-op has no rival to beat.
- The playtest caught a 3-player game whose mid-game scores pointed the wrong way (g06, below) and a bluffing game where seat 1 never won in 100 games (g24).

| Idea | Designed as | Repairs | Planner wins |
| --- | --- | --- | --- |
| g01 coral reef engine builder | Reefborne | 0 | 73% |
| g02 rival observatories | First Light: Rival Observatories | 1 | 87% |
| g03 steampunk workshop | Cogwork & Copper | 1 | 57% |
| g04 deck-building musicians | Wandering Chorus | 0 | 100% |
| g05 monastery worker placement | Abbey of Ink and Vine | 1 | 100% |
| g06 harbor crews and colony majorities | Harbor Captains: Three Voyages | 0 | 97% |
| g07 clans in five valleys | Festivals of the Five Valleys | 0 | 97% |
| g08 factions in six districts | Six Districts: Council Ascendant | 0 | 73% |
| g09 volcanic island settlement | Emberchain: Ashfall Isles | 0 | 97% |
| g10 rail barons | Blackvein Rail Barons | 0 | 77% |
| g11 Mars domes and pipelines | Red Rim: Ares Export Authority | 0 | 100% |
| g12 two-player river delta | Siltwater Duel | 0 | 93% (2 players, fair share 50%) |
| g13 walled city tiles | Guildwalls | 0 | 97% |
| g14 coral archipelago tiles | Reefbound Archipelago | 0 | 100% |
| g15 botanical garden with secret goals | Bloom Commons | 1 | 83% |
| g16 subway map tiles | Cutoff Metro | 0 | 97% |
| g17 night market draft | Night Market: Lantern Row | 1 | 77% |
| g18 three-age spell draft | Inkbound: The Three-Age Grimoire | 0 | 100% |
| g19 bird flocks from a card row | Plume Rush: First Sightings | 0 | 70% |
| g20 spice company deck builder | Saffron Sails: The Spice Company | 1 | 80% |
| g21 hidden cultists on a mage council | The Hollow Council | 0 | not measured |
| g22 sealed bids for relics | Vault of Whispers | 0 | not measured |
| g23 co-op flooding sea station | Abyss Station: Four Cores Up | 1 | not measured |
| g24 prospectors' secret claims | Fools' Lode | 0 | not measured |

### Scores that mislead planning

The first run of these ideas, with the same specs and retrieval, passed 21 of 24 first drafts and all 24 after one repair ($5.06). But in three majority games the planner did worse than random players: 0% (g06), 23% (g07) and 13% (g08) of 3-player games. Their mid-game scores left out majorities that had not been scored yet, so a planner that follows the standings never contested them. The playtest called this "decisions barely matter", and one improvement round did not fix it.

Two changes followed:
- The compose prompt asks for mid-game scores that count points still to come (majorities, sets, end-game bonuses) as if they scored now.
- The playtest reports a planner below 75% of the fair share as misleading scores, with that fix, instead of as decisions that barely matter.

In the run above, g07 and g08 passed with 97% and 73% on the first draft, and g06 was flagged and fixed (0% → 97%). The same prompt change also asks for a color kind on every board cell and short panel notes. The first-draft pass rate fell from 21 to 17; with one run per idea we cannot tell sampling noise from an effect of the longer prompt.

### Earlier benchmark (Oct 27)

Before the focus on hobby games, the benchmark had 24 lighter ideas (8 engine builders, 8 map games and 8 others, including a kids' dice race): 23 of 24 first drafts passed, 24 after one repair, and the playtest caught a race with no real choices and an auction where seat 3 never won ($3.08).

## Run it

```sh
npm run eval:generation              # all prompts
npm run eval:generation -- g01,g09   # a subset
```

Model replies are cached in `cache/` (not committed), so a rerun is free. Generated rules and their records land in `out/`.
