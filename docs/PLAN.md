# BoardDream Build Plan

- **Submission deadline: Wed Nov 4, 9:00 PM ET.** Target submitting by noon Nov 4 to leave a buffer.
- Get the main loop working first (describe → generate → fuzz → repair → play), then add balance sliders, AI opponents and art. Every day should end with a version good enough to record.
- Commit daily and add a line to the "Built during the hackathon" table in the README. The rules require a clear record of what was built during the event.
- `TODO(day N)` comments in the code map to the schedule below.

## Direction (updated Oct 27)

BoardDream targets the games people actually want to make: medium-complexity, Catan- and Wingspan-style designs, built on resource production, trading and building on a map, or on an engine-building tableau of cards. Reference games are original designs in that genre, never recreations of existing titles. The simple games built on Oct 27 stay in the library as low-complexity references and engine fixtures.

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
| light games | Line Up, Reversi, Hex, Race Home, Snakes and Ladders, Liar's Dice, I Doubt It | Low-complexity dial settings, engine fixtures, bluffing opponents |

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
- [ ] **Author:** review `eval/retrieval/qrels.txt` (see "For judgment review" in the eval README).

### Tue Oct 27 (evening): new direction, engine-building family
- Engine: player panels (resources, tableau, hand, market) next to the board, resource icons, card views; moves can target cards as well as board cells.
- Mechanics: resources, market, and the card effect language (gain, pay, draw, points, per-tag bonuses; on play, income and end-game triggers) with auto-generated rules text.
- Glasshouse, an original engine-building reference game with ~30 plant cards and a greedy bot.
- Web app redesign: tabletop look, card components, player areas; verified with screenshots.
- **Status: done.** `panels(state, viewer)` with counters and card views, resource icons in `meta.resources`, moves that target cards and counters (several moves on one target open a choice menu); strict fuzzing validates panels and targets. Resources, market and card-effect modules with auto-generated rules text and `validateCards`. Glasshouse: 32 plants, 38 cards, 1,000-run fuzz clean, greedy bot beats random play over 80% of the time. The web app now has a felt table, illustrated cards, player mats, a fanned hand, bots that move one at a time, a result screen, and `?game=<id>&watch` for self-playing tables (video b-roll).
- Not yet in the catalog: the resources, market and effects modules and Glasshouse; they go in with the map modules on Oct 28, followed by an eval rerun.

### Tue Oct 27 (night): 3D tabletop
- The flat felt table read as cheap on video, so the play area is now a three.js scene (react-three-fiber): a lit walnut table, cloth player mats, card stock with printed faces and backs, resource tokens, raised board tiles and lacquered pieces, with ambient occlusion, bloom and soft shadows.
- **Status: done.** A generic layout places any game's panels and board: rival mats along the far edge, the board and shared supply in the middle, the viewer's mat in front and the hand held up toward the camera. Cards keep their ids across zones, so they fly from the deck to the market, from the market into a hand and from a hand onto a mat. Card faces are painted on canvas (cost pills, points medallion, illustration window, rules text) and magnified on hover. Legal moves glow gold. The camera frames the table inside whatever the side panels leave free; `F` (or the Focus button) hides the panels for recording. Scores and counts are HTML pinned to 3D points. `?lowfx` turns off post-processing, `?flat` keeps the 2D table, which is also the fallback without WebGL. A layout test walks every reference game and checks that each card is placed once, every legal move has something to click, and the camera keeps the table in frame.

### Wed Oct 28: map, trade and build family
- Mechanics: hex map vertices and edges (settlement spots, road adjacency), production, bank and player-to-player trades.
- An original hex-map settlement reference game with a heuristic bot, and the map UI to match.
- Add genre queries (engine building, trading, worker placement, drafting) to the retrieval eval; resume the qrels review.

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

## Status (Oct 27)

**Working:**
- `packages/engine`: `GameModule` interface, seeded RNG, `playMatch` (strict mode freezes state and checks JSON, termination, legal moves, outcomes and presentation functions), `fuzz` (groups failures by type with replay seeds; checks determinism), `simulate` / `sweepParam`
- `packages/library`: 13 mechanic modules (grid, hex, flanking, connection, dice, track, shortcuts, bidding, deck, roles, voting, turns, scoring); 7 reference games (Line Up, Reversi, Hex, Race Home, Snakes and Ladders, Liar's Dice, I Doubt It); Liar's Dice probability bot; 39-entry retrievable catalog
- `packages/retrieval`: BM25 with an S-stemmer and trec_eval tie-breaking, P@k, Recall@k, nDCG@k (linear gain, matching trec_eval), MRR, MAP, TREC I/O
- `apps/server`: Hono API (`/api/health`, `/api/catalog`, `/api/generate`), Model API client (chat, structured output, token usage), reply cache, `vm` sandbox (allowlisted `require`, no `Math.random`), `designGame` pipeline with Muse Spark expansion + rerank retrieval, IoU utilities
- `eval/retrieval`: 50 queries, graded qrels, three systems, cached Muse Spark replies
- `apps/web`: 3D tabletop (three.js) for every game: cards, mats, tokens, board tiles and pieces, playable against each game's default bot; create panel, parameter sliders, live balance stats; 2D table as a fallback
- 90 tests pass; `npm run typecheck` and `npm run build -w @boarddream/web` pass

**Not done or unverified:**
- `/api/generate` has not run end to end against the real API; the prompts are first drafts
- Parsing `editImage` responses and decoding SAM masks (day 6)
- Fuzzing and simulation still run on the main thread (days 3–4)
- Opponents other than Liar's Dice play randomly (Monte Carlo bots on day 4); with random play, I Doubt It usually runs to its play limit
- The 3D table has been checked with scripted headless-Chrome screenshots and clicks (GPU on), not yet on a laptop GPU or at 4K
