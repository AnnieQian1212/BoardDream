# BoardDream Build Plan

- **Submission deadline: Wed Nov 4, 9:00 PM ET.** Target submitting by noon Nov 4 to leave a buffer.
- Get the main loop working first (describe → generate → fuzz → repair → play), then add balance sliders, AI opponents and art. Every day should end with a version good enough to record.
- Commit daily and add a line to the "Built during the hackathon" table in the README. The rules require a clear record of what was built during the event.
- `TODO(day N)` comments in the code map to the schedule below.

## Direction (updated Oct 27, night)

BoardDream is for teen and adult hobby players: strategy games with rich rules and real depth, the kind played on Board Game Arena and in the BoardGameGeek "Top 50 Must-Have Boardgames" geeklist, never children's games. Reference games are original designs, never recreations of existing titles. The small classic games built on Oct 26–27 (Line Up, Reversi, Snakes and Ladders, ...) are engine test fixtures and retrieval-eval documents only; the app does not offer them and generation does not aim for them.

- Generated games are capped at medium scale: about 20–40 cards, 3–5 resources, 30–60 minutes.
- The UI must look polished, because it is what the demo video shows. Every UI change is checked with screenshots before it is pushed.
- Rules come from data where possible: cards are described in a small effect language that the engine interprets, so the model writes card data plus a little rules code instead of thousands of lines.

## Priorities

| Level | Scope | If cut |
| --- | --- | --- |
| **P0** | Engine interface with player panels and card effects, two genre reference games, mechanic library, retrieval, generate → fuzz → repair loop, polished playable web app | No project |
| **P1** | Balance sliders with heuristic bots, Muse Spark opponents that trade and negotiate, card and map art with alignment metrics | Big hit to the Demo and Use of Meta AI Tooling scores |
| **P2** | Auto-balance, cooperative mode, Muse Spark Open opponents, werewolf-style voting game | Safe to drop |

## Game families

All original designs or public-domain games. No trademarked names (e.g. Connect Four, Othello, Catan, Wingspan).

| Family | Reference games | Shows off |
| --- | --- | --- |
| `engine` engine building | Glasshouse (original): grow a greenhouse whose plants pay income and score bonuses that chain together | Card effect language, market, tableau UI, card art from Muse Image |
| `map` map, trade and build | Original hex-map settlement game: production, building on vertices and edges, bank and player trades | Hex map art with SAM alignment, Muse Spark trade negotiation (the CICERO angle in the proposal) |
| `engine` worker placement and majorities | Highsail (original): airship crews on a skyport's action spaces, charters that score, pay income or end-game bonuses, outposts that win majorities on five sky islands | Worker placement and area majority modules, blocking, two scoring rounds |
| `grid` tile placement | Wildmere (original): hex tiles with a terrain on each edge, laid into a shared valley; matching edges pay funds and join regions that score when enclosed, for whoever laid most of them | Tile placement module (rotation, edge matching, regions, open edges), edge-matched tiles on the 3D table, a tile market priced by position |
| test fixtures (not in the app) | Line Up, Reversi, Hex, Race Home, Snakes and Ladders, Liar's Dice, I Doubt It | Engine features (grids, dice, tracks, hidden hands, simultaneous play), retrieval eval, the Liar's Dice opponents benchmark |

### AI opponents: layered so a game never depends on the LLM

| Layer | What it does | On failure |
| --- | --- | --- |
| Heuristic bot (local, free) | Game-specific baseline, e.g. the Liar's Dice probability bot or the Glasshouse greedy planter | This is the floor |
| Muse Spark move choice | Picks only from the legal move list, seeing only its own view | Illegal move or timeout falls back to the heuristic bot |
| Table talk and trades | Proposes, accepts and rejects trades; taunts and bluffs | Turn it off; moves are unaffected |

Evaluate on Oct 31: Muse Spark vs the heuristic bot over 50 games. If it loses, or the talk reads as fake, drop the talk and give that video time to generation and art.

## Daily plan

### Mon Oct 26: setup
- [x] Project skeleton (see "Skeleton status" below)
- [x] Apply for the $150 Meta API credits
- [x] Confirm the credits arrived on the Billing page and set a Spend Limit
- [x] Apply for Baseten ($100) and Modal ($100) credits
- [x] Add `MODEL_API_KEY` to `.env`; smoke test passed for chat, image generation and SAM (Oct 27)
- [x] Confirm the track (Indie Developer) on the Cerebral Valley registration
- [x] Introduce yourself in Discord #intros
- [x] Repository public on GitHub

### Tue Oct 27: lock the engine, finish the reference games
- Hand-write the race and bluff reference games, plus the bluff probability bot. Use them to check that the interface handles dice, hidden information and simultaneous moves.
- Change the interface today if needed, then freeze it; all generated code depends on it.
- Make both new games playable in the web app (non-board moves use the move button list).
- 12:00 PM: Agents 101 livestream.
- **Done when:** all three reference games pass `fuzz`.
- **Status: done.** Race Home and Liar's Dice added; all three games pass 1,000-run fuzzing. The interface is frozen with one addition, `geometry(state, viewer)`, so hidden dice draw face down; simultaneous moves are verified with a test game. Strict fuzzing now also checks `geometry`, `moveTarget` and `describeMove`. The Liar's Dice probability bot wins over 75% against random play.

### Wed Oct 28: mechanic library, retrieval and eval set
- 10–15 mechanic modules, each with unit tests (the "verified" in the proposal): dice, track, capture-by-landing, deck/hand, bidding, hidden roles, voting, flanking capture, connection, round limit, scoring.
- Two reference games per family.
- Retrieval eval set: 40–60 game-description queries with graded qrels. Muse Spark can draft labels for human review.
- Compare BM25, BM25 + LLM query expansion, and + Muse Spark rerank; cross-check with `ir_measures`.
- 12:00 PM: Agents 102 (verifiable agents), directly relevant to the fuzz-repair loop.
- **Done when:** `npm run eval:retrieval` compares all three systems.
- **Status: done early, on Oct 27.** 13 mechanic modules, 7 reference games (Reversi, Hex, Snakes and Ladders and I Doubt It added), all passing 1,000-run fuzzing. A 39-entry catalog and a 50-query graded eval set (judgments pending author review). Expansion + rerank lifts nDCG@10 from 0.845 to 0.969 and Recall@10 from 0.851 to 0.988 over BM25, cross-checked with `ir_measures`; the designer now uses that pipeline. Details in `eval/retrieval/README.md`.
- [x] **Author:** review `eval/retrieval/qrels.txt`. Done on Oct 27: 13 borderline judgments checked, 10 changed; on 62 queries nDCG@10 is now 0.818 for BM25, 0.894 with expansion and 0.968 with expansion plus rerank ("Author review" in the eval README).

### Tue Oct 27 (evening): new direction, engine-building family
- Engine: player panels (resources, tableau, hand, market) next to the board, resource icons, card views; moves can target cards as well as board cells.
- Mechanics: resources, market, and the card effect language (gain, pay, draw, points, per-tag bonuses; on play, income and end-game triggers) with auto-generated rules text.
- Glasshouse, an original engine-building reference game with ~30 plant cards and a greedy bot.
- Web app redesign: tabletop look, card components, player areas; verified with screenshots.
- **Status: done.** `panels(state, viewer)` with counters and card views, resource icons in `meta.resources`, moves that target cards and counters (several moves on one target open a choice menu); strict fuzzing validates panels and targets. Resources, market and card-effect modules with auto-generated rules text and `validateCards`. Glasshouse: 32 plants, 38 cards, 1,000-run fuzz clean, greedy bot beats random play over 80% of the time. The web app now has a felt table, illustrated cards, player mats, a fanned hand, bots that move one at a time, a result screen, and `?game=<id>&watch` for self-playing tables (video b-roll).
- Not yet in the catalog: the resources, market and effects modules and Glasshouse; they go in with the map modules on Oct 28, followed by an eval rerun.

### Tue Oct 27 (night): 3D tabletop
- The flat felt table read as cheap on video, so the play area is now a three.js scene (react-three-fiber): a lit walnut table, cloth player mats, card stock with printed faces and backs, resource tokens, raised board tiles and lacquered pieces, with ambient occlusion, bloom and soft shadows.
- **Status: done.** A generic layout places any game's panels and board: rival mats along the far edge, the board and shared supply in the middle, the viewer's mat in front and the hand held up toward the camera. Cards keep their ids across zones, so they fly from the deck to the market, from the market into a hand and from a hand onto a mat. Card faces are painted on canvas (cost pills, points medallion, illustration window, rules text) and magnified on hover. Legal moves glow gold. The camera frames the table inside whatever the side panels leave free; `F` (or the Focus button) hides the panels for recording. Scores and counts are HTML pinned to 3D points. `?flat` keeps the 2D table, which is also the fallback without WebGL. A layout test walks every reference game and checks that each card is placed once, every legal move has something to click, and the camera keeps the table in frame.

### Tue Oct 27 (late): performance on integrated GPUs, light theme
- The first 3D table ran at ~15 fps on the author's laptop (Intel Iris Xe driving a 2560x1440 screen at 150%): it rendered every frame at full resolution with ambient occlusion, bloom, 4x MSAA in the composer and clearcoat materials, and the dark brown palette still read as muddy.
- **Status: done.** The canvas renders on demand: animated objects request frames only while they move, so a settled table costs nothing (no idle drift or pulsing). Quality tiers (`lowest`, `low`, `medium`, `high`) set pixel ratio, shadow maps and ambient occlusion; integrated and software GPUs start at `low` (1.25x pixels, contact shadows from soft decals, no post-processing), discrete GPUs at `medium`, and the table steps down and remembers it when animation runs under 30 fps. `?quality=` pins a tier. Side panels dropped `backdrop-filter`. On the same laptop and screen, frame pacing in a self-playing game went from a 67 ms median (167 ms p95) to under 7 ms median (12 ms p95) in headless Chrome. New look: light oak table, navy market and game boards with gold trim, pastel seat mats with a band in the seat color, ivory cards with soft shadows, white panels, and teal for everything a legal move can act on.

### Wed Oct 28: map, trade and build family
- Mechanics: hex map vertices and edges (settlement spots, road adjacency), production, bank and player-to-player trades.
- An original hex-map settlement reference game with a heuristic bot, and the map UI to match.
- Add genre queries (engine building, trading, worker placement, drafting) to the retrieval eval; resume the qrels review.
- **Status: map family done early, on Oct 27.** `hexmap` (vertex and edge graph for any set of axial tiles, the distance rule, connected roads blocked by rival buildings, geometry cells of kind `vertex` and `edge`), `production` (tiles pay the buildings on their corners by level; event decks that reshuffle), `trade` (bank rates, one-for-one offers the other player accepts or declines). Lantern Isles, an original archipelago game: snake-order free placements, a tide deck instead of dice decides which terrain produces, villages, towns, roads and lanterns lit on lagoons, up to three trades a turn, first to 10. 1,000-run strict fuzz clean; the heuristic bot beats random play in every test game, and bot-vs-bot seat win rates are 52/48 (2 players), 37/30/33 (3) and 23/28/24/24 (4). The 3D board raises building spots and roads above the tiles in seat colors; bank trades and offers target resource piles on the mats. Seven catalog entries added (resources, market, effects, hex map, production, Glasshouse, Lantern Isles) and the planned trading entry now points at real code; 12 genre queries (q51–q62) join the eval set. On 62 queries, nDCG@10 is 0.825 for BM25, 0.893 with expansion and 0.964 with expansion plus rerank.

### Tue Oct 27 (night): Oct 29 – Nov 1 items done early
- **Generation:** prompts for the engine and map families; fuzzing in a killable worker thread (a hung game is reported with its replay seed); a 100-game playtest after fuzzing with one design-repair round; generation progress streamed to the create panel; passing games saved and listed in the picker. Benchmark: 24 of 24 ideas pass, 23 on the first draft, 2 design problems found and fixed (`eval/generation/README.md`).
- **Bots:** a generic heuristic bot for any game (score lead from `outcome()` or a Score counter, resources, cards, board presence, optional playouts); balance simulation in a Web Worker with running stats.
- **Opponents:** Muse Spark plays the social moves with the bot's move as advice and talks at the table; 70% wins against the Liar's Dice probability bot over 20 games, even with the heuristic bots in Lantern Isles (`eval/opponents/README.md`).
- **Art:** Muse Image card art with the first card as style reference; board art over a rendered guide, checked tile by tile with SAM 3.1 (Lantern Isles 19/19 tiles aligned, mean IoU 0.87–0.89), textures mapped by tile kind so reshuffled and generated maps work.
- **Still open:** Results page with all metrics, deploy with rate limits, optional Muse Spark Open opponents on Baseten, UI polish. The author's qrels review is done (see Oct 28 above).

### Tue Oct 27 (late night): hobby games only
- The author does not want children's games such as Reversi: the product is for teen and adult players, with complex rules and real depth.
- **Done:** the app offers only the original reference games and generated games; the classic games are now `fixtureGames`, used by tests and the retrieval eval. The spec prompt designs for experienced players (meaningful choices every turn, planning over luck, player interaction, two or three interlocking systems), drops the roll-and-move family, and the complexity dial runs from "Gateway" to "Heavy" (default "Medium-heavy", 60 minutes). The playtest now measures strategic depth: a planner (the heuristic bot with playouts) takes each seat against random players, and if it wins barely more than its fair share, "decisions barely matter" goes back to the designer. Glasshouse and Lantern Isles both score 77% in 3-player games (fair share 33%); a pure dice race does no better than its fair share. Bluffing games are not measured, because the planner cannot bluff.
- **Next, from the BoardGameGeek top-50 list:** the mechanics most of those games share and the library lacks, in order: worker placement and area majority (Stone Age, Agricola, Caylus, Small World, Dominant Species, Tigris & Euphrates), tile placement (Carcassonne, Kingdom Builder, Ingenious), card drafting, deck building and set collection (7 Wonders, Dominion, Ticket to Ride), a cooperative shared threat (Pandemic, Elder Sign), and a social-deduction game whose Muse Spark players argue and vote (The Resistance, Werewolves). Each new mechanic gets a module with tests; worker placement plus area majority also gets a third original reference game. Then the generation benchmark is rebuilt on hobby-weight ideas across these families and reports the planner win rate.
- From Board Game Arena: show each game's profile on BGA's four axes (complexity, strategy, luck, interaction), measured by simulation instead of player votes.
- **Done (worker placement and majorities):** `workers` (action spaces with capacities, open spaces, placement, next seat with crew left) and `majority` (standings, controller, awards with ties splitting the places they span, scoring every region) with unit tests; both catalog entries are now ready. Highsail, the third original reference game: 2–4 players send crew to 11 action spaces on a skyport, take and launch 24 charters (cargo scores, surveys pay income, envoys score at the end) and build outposts on five sky islands that pay majorities after the middle and last rounds; recruiting adds crew, the Admiralty takes first place, otherwise the trailing seat goes first. 1,000-run strict fuzz clean. Its bot beats random play in 100% (2 players), 96% (3) and 91% (4) of games; bot-vs-bot seat win rates over 800 games are 50/47, 35/37/33 and 28/29/26/25 after giving the first seat a fourth coin (with equal coins it won least: 32% of 3-player games). The generic planner wins 67% of 3-player games against random play. Retrieval eval rerun with Highsail in the collection: nDCG@10 0.814 / 0.895 / 0.966.
- **Done (tile placement), Oct 28:** `tiles` (square and hex boards, rotation, the frontier, edge matching strict or counted, segments, regions joined across matching edges with open and rim edge counts) with unit tests; the catalog entry is now ready, and geometry cells can carry `segments` (a terrain per edge) that the 3D table and the flat board paint as wedges. Wildmere, the fourth original reference game, for 2–4 players: take one of four hex tiles from a market row (each skipped tile costs a fund, left on it for whoever takes it), turn it and lay it next to the valley; every matching edge after the first pays a fund. A woodland, meadow, wetland or heath region scores the moment none of its edges faces an empty space: a point per tile to whoever laid the most of it, half to the runner-up with 3+ players. Rangers (2 funds) count as two tiles in a region until it scores. The game ends when the 37-space valley is full; 3 leftover funds score a point, and ties go to the most funds. 1,000-run strict fuzz clean. Its bot beats random play in every test game; bot-vs-bot seat win rates over 200 games are 53/47, 33/39/28 and 23/28/28/22 after giving the first seat 2 funds and the others 3 (with equal funds the first seat won 49% of 3-player games and the last 25%). The generic planner wins 80% of 3-player games against random play. Retrieval eval rerun: nDCG@10 0.811 / 0.901 / 0.967.
- **Done (card games), Oct 28:** `drafting` (simultaneous pick and pass with hidden hands and picks, alternating directions, snake order for open drafts), `deckbuilding` (a personal draw pile, hand, cards in play and discards per player; buying into the discards, cleanup with reshuffle, trashing, hiding draw piles and rival hands) and `sets` (counts by kind, sets of matching and of different kinds, full sets, point tables), with unit tests. Card drafting and set collection are now ready in the catalog, and a new deck-building entry joins it with one new eval query (q63). Retrieval eval rerun on 63 queries: nDCG@10 0.807 / 0.897 / 0.966.
- **Done (generation benchmark rebuilt), Oct 28:** 24 hobby-game ideas, four per group (engine and deck builders, worker placement and majorities, map and trade, tile placement, drafting and sets, hidden roles, bluffing and co-op); the runner reports the planner's win rate. The first run showed three majority games where the planner lost to random players because mid-game scores left out majorities still to be scored; the compose prompt now asks for projected standings (and a color kind per board cell, short notes), and the playtest names misleading scores. Second run: 17/24 first drafts pass, 24/24 after one repair, the planner wins 88% of 3-player games (fair share 34%) and clears a 0.25 skill edge in all 20 measurable games. Details in `eval/generation/README.md`.
- **Done (open-weight opponents), Oct 28:** Muse Spark Open (`meta-models/muse-spark-open-1026` on Baseten) plays the AI opponents when configured, at low reasoning effort. Opponents benchmark: 46% of 50 Liar's Dice games against the probability bot (fair share 50%), 20% of 15 Lantern Isles games (33%).
- **Done (table polish for generated games), Oct 28:** board labels sized by measured width and the board's cell size (generated boards drawn in large units printed 5 px text), two-line labels, mat notes kept inside their mat, deck stacks capped so they do not hide mat titles.

### Thu Oct 29: generation for the new genres
- Spec, compose and repair prompts that produce card data in the effect language plus rules code.
- Move fuzzing into `worker_threads` with a kill timeout so an infinite loop in generated code cannot hang the server.
- Optional: generate TypeScript and run `tsc` first, feeding compile errors into the repair loop.

### Fri Oct 30: end-to-end generation (the critical P0 day)
- Repair benchmark: 20–30 prompts across the families. Record round-0 pass rate, cumulative pass rate by round k, mean repair rounds, and the failure-type breakdown.
- **Done when:** a one-paragraph description becomes an engine-building or map game that loads and plays in the web app.
- 12:00 PM: Fireworks / Muse Open livestream. No office hours on weekends; ask any API questions today.

### Sat Oct 31: bots, balance and AI opponents
- Simulation in a Web Worker; sliders update first-player win rate, score spread and game length live, with a parameter sweep chart.
- Heuristic and Monte Carlo bots so balance numbers mean something for strategy games.
- Muse Spark opponents choose from legal moves and negotiate trades; run the 50-game evaluation above.
- Optional: opponents on Muse Spark Open via Baseten (`meta-models/muse-spark-open-1026`) for the Best Open Weight prize.

### Sun Nov 1: art
- Card illustrations from Muse Image with one style anchor per game, so a generated deck looks like one product.
- Map art: render geometry to PNG, paint over it with Muse Image, check every hex with SAM 3.1 box prompts (`boxPrompt()` is ready), compute IoU against `expectedCellMasks()`, repaint misaligned cells. Record `meanIoU` and `alignedShare` before and after repair.
- Fallback: if Muse Image cannot hold the geometry, still show detection + metrics, with the SVG interaction layer drawn over the art.

### Mon Nov 2: metrics and demo polish
- Collect all four metrics on one Results page (table below).
- Pick one demo prompt per family and rerun them until they are reliable.
- P2 items if time allows.

### Tue Nov 3: deploy and document (last day for technical questions)
- Deploy: static hosting for the web app, server on Render, Fly or Modal. Generated code runs in isolation (worker or Modal sandbox).
- Rate-limit generation and serve cached demo games so strangers cannot drain the credits.
- README: architecture diagram, metrics, list of what was built during the hackathon.
- Make the repository public.

### Wed Nov 4: video and submission
- Record the 3-minute demo video.
- Post on X (Most Viral prize).
- Submit by noon; hard deadline 9:00 PM ET.
- Check: repo public, video link accessible, every team member listed on the submission.

## 3-minute video outline (draft)

| Time | Content |
| --- | --- |
| 0:00–0:20 | The problem: turning a tabletop idea into a playable prototype takes weeks |
| 0:20–1:10 | Live generation of an engine-building game: prompt and dials → retrieved mechanics → cards and rules code → fuzzing catches a bug → automatic repair → passes |
| 1:10–1:40 | Play it with illustrated cards, then drag a slider and watch first-player win rate change |
| 1:40–2:10 | Map game: Muse Spark opponents propose and turn down trades |
| 2:10–2:35 | Art: map geometry → painting → SAM check → misaligned hexes repaired |
| 2:35–3:00 | Metrics table, the game families, close |

## Metrics

| Metric | How it is measured | Code |
| --- | --- | --- |
| Retrieval quality | nDCG@10, Recall@10, MRR on 40–60 queries, three systems compared | `eval/retrieval`, `ir_measures` |
| Fuzz-repair success | Round-0 pass rate, cumulative pass rate by round k, mean repair rounds, failure-type breakdown on the benchmark prompts | `designGame().attempts` |
| Art alignment | Mean per-cell IoU and share of cells with IoU ≥ 0.8, before vs after repair | `apps/server/src/art/alignment.ts` |
| Balance | Absolute first-player edge and draw rate, before vs after tuning | `packages/engine/src/sim.ts` |
| Strategic depth | Win rate of a planning bot against random players, over every seat, vs the fair share | `apps/server/src/agent/playtest.ts` |

## API budget ($150 Meta credits)

Judges score how creatively Meta models are used, not how many calls are made. Keep the models at the core of the product and the call count low.

| Stage | Models | Estimate |
| --- | --- | --- |
| Smoke tests (done Oct 27) | Spark, Image, SAM | ~$0.01 |
| Retrieval expansion / rerank, qrel drafts | Spark | ~$5 |
| Generation pipeline + repair benchmark | Spark (Wonder optional) | ~$40 |
| AI opponents | Spark | ~$15 |
| Art | Image + SAM | ~$10 |
| Final metrics | Spark, Image, SAM | ~$15 |
| Deploy, judges, video | all | ~$15 |
| Buffer | | ~$50 |

Prices: Spark 1.3 $1.25 / $4.25 per 1M input/output tokens; Wonder $4 / $20; Image $0.01 per image; SAM $2.50 per 1,000 images. Reasoning tokens count as completion tokens: even a one-line reply used ~350.

Cost controls:
- Fuzzing, simulation, balance stats, BM25, IR metrics and IoU all run locally for free.
- Iterate on `muse-spark-1.3-contributor` (12–20× cheaper; prompts may be used for training, 150 RPM); run final metrics and the demo on the model actually shown.
- Cache responses; pre-generate demo games.
- Lower reasoning effort for simple steps (spec, chat); verify the parameter first.
- Cap repairs at 3 rounds. Never put LLM opponents inside simulations.

## Risks

| Risk | Mitigation |
| --- | --- |
| Credits run out | See cost controls above |
| Generated code quality varies | Mechanic library, reference implementations and fuzz-repair as three layers; cap complexity at 1–3 if needed |
| Muse Image cannot hold geometry precisely | Crop-and-repaint repair; worst case, art covers only background and piece textures, with SVG geometry on top |
| Generated code safety | `vm` is not a security boundary; use a worker with a timeout or a remote sandbox before any public deploy |
| Bluff opponents underwhelm | Layered fallback above; decision on Oct 31 |
| Not enough time | Every day ends demoable; all P2 can be cut |

## Rules checklist

- [x] Repository is public
- [ ] README states what was built during the hackathon
- [ ] Only public-domain or traditional games and assets we have rights to; no trademarked names
- [ ] Video shows only features built during the hackathon
- [ ] Present the project as retrieval → composed executable code → fuzz verification, not as a basic RAG app

## Status (Oct 28)

**Working:**
- `packages/engine`: `GameModule` interface, seeded RNG, `playMatch` (strict mode freezes state and checks JSON, termination, legal moves, outcomes and presentation functions), `fuzz` (groups failures by type with replay seeds; checks determinism), `simulate` / `sweepParam`, a generic heuristic bot with optional playouts
- `packages/library`: 25 mechanic modules (grid, hex, flanking, connection, dice, track, shortcuts, bidding, deck, drafting, deckbuilding, sets, roles, voting, turns, scoring, resources, market, effects, hexmap, production, trade, workers, majority, tiles); four original reference games (Glasshouse, Lantern Isles, Highsail, Wildmere) and seven small fixture games; dedicated bots for the four reference games and Liar's Dice; a 49-entry retrievable catalog
- `packages/retrieval`: BM25 with an S-stemmer and trec_eval tie-breaking, P@k, Recall@k, nDCG@k (linear gain, matching trec_eval), MRR, MAP, TREC I/O
- `apps/server`: Hono API, Model API client, reply cache, `vm` sandbox (allowlisted `require`, no `Math.random`), the `designGame` pipeline (spec, Muse Spark expansion + rerank retrieval, rules code, fuzz in a worker with a watchdog, repair, playtest with the strategic-depth check), Muse Spark opponents, card and board art with SAM 3.1 alignment
- `eval/`: retrieval (63 queries, 207 graded judgments, three systems), generation (24 hobby-game ideas, 24 pass after one repair, planner win rate reported) and opponents (Muse Spark 1.3 and Muse Spark Open) benchmarks, with cached replies
- `apps/web`: 3D tabletop (three.js) for every game, including edge-matched tiles; create panel, parameter sliders, live balance stats from a web worker; 2D table as a fallback
- 140 tests pass; `npm run typecheck` and `npm run build -w @boarddream/web` pass

**Not done or unverified:**
- Eleven drafted retrieval judgments (Highsail, Wildmere, deck building) await author review
- Deployment, demo video and submission (Nov 3–4)
- The 3D table has been checked with scripted headless-Chrome screenshots and clicks (GPU on), not yet on a laptop GPU or at 4K
