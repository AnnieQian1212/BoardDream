# Generation benchmark

Can BoardDream turn a one-sentence idea into rules that work and are worth playing?

`prompts.jsonl` has 24 ideas for hobby strategy games, four in each of six groups: engine and deck builders (g01–g04), worker placement and majorities (g05–g08), map, trade and build (g09–g12), tile placement (g13–g16), drafting, sets and deck building (g17–g20), and hidden roles, bluffing, sealed bids and co-op (g21–g24). All ask for complexity 3 or 4 of 5 and 30–75 minutes.

Each idea goes through the full pipeline: design, retrieval, rules code, then 1,000 strict random games. Failures go back to Muse Spark for repair (up to 4 rounds). Rules that pass get a playtest: 100 random games, plus 30 where a planner (the generic bot with short playouts) takes each seat in turn against random players. Design problems get one improvement round: games over too fast, mostly draws, a seat that never wins, no real choices, or a planner that barely beats random play.

## The player picks the effort (Nov 2, 2026)

Advanced settings now offer low, medium (the default) and high effort for a game, with about how long each takes. Single real generations on the evening of Nov 2, when the API was slower than on Nov 1 (planning alone took 2–3 minutes):

| | Low | Medium | High |
| --- | --- | --- | --- |
| Idea to final rules | 3.4 min (two repairs) | 6.7 min (one repair) | 7.3, 6.7 and 5.5 min (two passed on the first draft) |
| Two games each, three at a time (later that evening) | 3.3 and 2.7 min; one more failed after four repairs | 6.1 and 5.0 min | 9.7 and 13.2 min; 12.5 min for a remake |

The tip beside the effort picker says about 3–5, 5–8 and 6–13 minutes. The first high-effort run failed: Muse Spark thought for more than five minutes before the first piece of the rules, and Node's fetch drops a response silent for that long. The server's model calls now wait up to 20 minutes (`apps/server/src/meta/patient.ts`).

## Reasoning effort, measured again (Nov 1, 2026): what the app uses

Since the low-effort run below, the rules prompt grew (cards that set each other off, named places, scenery, varied boards), and at low effort first drafts suffered most. The same 24 ideas, with the current prompt, at three settings:

| | Medium (the app's setting) | Low | Default |
| --- | --- | --- | --- |
| Pass 1,000-game fuzzing on the first draft | 16 / 24 | 5 / 24 | 20 / 24 |
| Pass after one repair | 24 / 24 | 18 / 24 (24 after four) | 24 / 24 |
| Planner win rate in 3-player games (20 measurable) | 78%, fair share 34% | 73% | 82% |
| Games where planning clearly pays (skill edge 0.25 or more) | 18 / 20 | 17 / 20 | 18 / 20 |
| Design problems found, fixed in one round | 4, 2 fixed | 8, 5 fixed | 7, 5 fixed |
| Time from idea to final rules, three ideas at a time | median 189 s (137–304 s) | median 100 s (49–222 s) | median 270 s (165–422 s) |
| Cost of the run | $4.09 (no cached calls) | $3.07 (specs and retrieval cached) | $5.13 (specs and retrieval cached) |

The app now runs at medium effort (`DESIGNER_EFFORT`, default `medium`). Low effort is still the fastest, but most of its first drafts fail (wrong geometry, a rules function that throws) and its playtests flag more mid-game scores that mislead a planner; repairs eat most of the time it saves and show the player failed drafts. Medium passes every idea within one repair and is about 30% faster than the default. Medium's weakest group is the engine builders: two of them (g02, g03) leave the planner at 50%, and g04's planner wins only its fair share, which one design round did not fix. A setting still moves single games a lot from run to run, so the planner rates are within the noise of one run per idea.

## Faster rules (Oct 31, 2026)

At its default reasoning effort Muse Spark 1.3 thinks for about 25,000 tokens before it writes 8,000–9,000 tokens of rules, so a game took four to five minutes from idea to table. From Oct 31 to Nov 1 the app asked for low reasoning effort on every call (`DESIGNER_EFFORT`; `default` restores the old setting).

Time per step, two ideas each (Oct 31):

| Step | Default effort | Medium | Low | Muse Spark Open (Baseten, low) |
| --- | --- | --- | --- | --- |
| Plan (spec) | 22 s | 14–20 s | 8 s | 7 s |
| Query expansion and rerank | 11–18 s | 10–12 s | 5–6 s | 4–5 s |
| Rules | 124–129 s | 48–84 s | 27 s | 18–21 s |
| First draft passes 300 random games | 2 / 2 | 1 / 2 | 2 / 2 | 2 / 2 |

The same 24 ideas at low effort, against the default-effort run below:

| | Low effort (Oct 31) | Default effort (Oct 28) |
| --- | --- | --- |
| Pass 1,000-game fuzzing on the first draft | 15 / 24 | 17 / 24 |
| Pass after one repair, after two | 22 / 24, 24 / 24 | 24 / 24 |
| Planner win rate in 3-player games (20 measurable) | 83%, fair share 34% | 88%, fair share 34% |
| Games where planning clearly pays (skill edge 0.25 or more) | 18 / 20 | 20 / 20 |
| Design problems found, fixed in one round | 4, 2 fixed | 2, both fixed |
| Time from idea to final rules | median 75 s (35–140 s), three ideas at a time | about 4–5 minutes |
| Model cost per game | about $0.10 | about $0.30–0.40 |

- Every idea still ends with rules that pass 1,000 strict games. The two games where planning does not pay, g03 (steampunk workshop) and g04 (deck-building musicians), have mid-game scores that mislead the planner; one design round did not fix them.
- Two other settings did no better. Planning the spec at high effort (rules at low): 12 / 24 first drafts, 17 / 20 games where planning pays, median 94 s. Fixing design problems at high effort, or allowing a second design round: g03 and g04 stayed below the fair share in both. Run to run, single games move a lot (g02's planner won 100% in one low-effort run and 20% in another), so 18 / 20 against 20 / 20 is within the noise of one run per idea; the direction is still slightly against low effort.
- Muse Spark Open writes rules fastest, but its rules for g09 took 38 s to check (the planner's playtest ran out of time) against 10 s for Spark's; it was not run on all 24.

The checking also got faster. The 1,000 runs are shared among four worker threads (their failures merged in a fixed order, so a rerun from the cache reproduces every repair) and the playtest runs beside them. The planner gets 30 s: a slow game plays fewer planner games rather than failing the check, and fewer than 12 are not used to call a game shallow. g13's planner played 27 or 30 games in two otherwise identical runs, the only difference between them. A check that took 15–19 s on one thread takes 5–10 s.

## Results at default effort (Oct 28, 2026)

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

Since this run the compose prompt has gained one bullet, for cooperative games and the shared-threat module; it has not been benchmarked yet.

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
npm run eval:generation                 # all prompts, default effort
npm run eval:generation -- g01,g09      # a subset
npm run eval:generation -- --setup=medium  # medium effort, as the app runs (also low, open), into out/medium/
```

Model replies are cached in `cache/` (not committed), so a rerun is free. Generated rules and their records land in `out/`; each record has the seconds it took from idea to final rules.
