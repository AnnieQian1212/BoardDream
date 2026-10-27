# BoardDream Build Plan

- **Submission deadline: Wed Nov 4, 9:00 PM ET.** Target submitting by noon Nov 4 to leave a buffer.
- Get the main loop working first (describe → generate → fuzz → repair → play), then add balance sliders, AI opponents and art. Every day should end with a version good enough to record.
- Commit daily and add a line to the "Built during the hackathon" table in the README. The rules require a clear record of what was built during the event.
- `TODO(day N)` comments in the code map to the schedule below.

## Priorities

| Level | Scope | If cut |
| --- | --- | --- |
| **P0** | Engine interface, reference games for all three families, mechanic library, retrieval, generate → fuzz → repair loop, playable web app | No project |
| **P1** | Live balance sliders, AI opponents (Monte Carlo + Muse Spark bluffing), art alignment with metrics | Big hit to the Demo and Use of Meta AI Tooling scores |
| **P2** | Auto-balance (search params to drive first-player edge to 0), cooperative mode, LLM rerank comparison, Muse Spark Open opponents, werewolf-style voting game | Safe to drop |

## Game families

All public-domain or traditional games. No trademarked names (e.g. Connect Four, Othello).

| Family | Reference games | Shows off |
| --- | --- | --- |
| `grid` placement and abstract | Line Up (m,n,k, done), plus a Reversi-like or Hex-like game | Art alignment (grids suit per-cell IoU checks); board-size sliders vs first-player win rate |
| `race` track and dice | Pachisi-like race: roll, move along a track, landing on a rival sends it home | Luck vs strategy dial, non-grid geometry, captures |
| `bluff` hidden information | Liar's-dice-style bidding first; werewolf-style voting only if time allows | Muse Spark opponents that negotiate and bluff; hidden information through `view()` |

### Bluff opponents: layered so the game never depends on the LLM

| Layer | What it does | On failure |
| --- | --- | --- |
| Probability bot (local, free) | Computes the chance a bid is true from its own dice; calls "liar" below a threshold, bluffs occasionally | This is the floor; written together with the reference game |
| Muse Spark move choice | Picks only from the legal move list; local code supplies the probabilities, the model makes the decision | Illegal move or timeout falls back to the probability bot |
| Table talk | Taunts, probing, bluffing in chat | Turn it off; moves are unaffected |

Evaluate on Oct 31: Muse Spark vs the probability bot over 50 games (under $1 on the contributor tier, about $7 on standard). If it loses, or the chat reads as fake, drop the chat and give that video time to generation and art.

## Daily plan

### Mon Oct 26: setup
- [x] Project skeleton (see "Skeleton status" below)
- [x] Apply for the $150 Meta API credits
- [ ] Confirm the credits arrived on the Billing page and set a Spend Limit
- [ ] Apply for Baseten ($100) and Modal ($100) credits
- [x] Add `MODEL_API_KEY` to `.env`; smoke test passed for chat, image generation and SAM (Oct 27)
- [ ] Confirm the track (Indie Developer) on the Cerebral Valley registration
- [ ] Introduce yourself in Discord #intros

### Tue Oct 27: lock the engine, finish the reference games
- Hand-write the race and bluff reference games, plus the bluff probability bot. Use them to check that the interface handles dice, hidden information and simultaneous moves.
- Change the interface today if needed, then freeze it; all generated code depends on it.
- Make both new games playable in the web app (non-board moves use the move button list).
- 12:00 PM: Agents 101 livestream.
- **Done when:** all three reference games pass `fuzz`.

### Wed Oct 28: mechanic library, retrieval and eval set
- 10–15 mechanic modules, each with unit tests (the "verified" in the proposal): dice, track, capture-by-landing, deck/hand, bidding, hidden roles, voting, flanking capture, connection, round limit, scoring.
- Two reference games per family.
- Retrieval eval set: 40–60 game-description queries with graded qrels. Muse Spark can draft labels for human review.
- Compare BM25, BM25 + LLM query expansion, and + Muse Spark rerank; cross-check with `ir_measures`.
- 12:00 PM: Agents 102 (verifiable agents), directly relevant to the fuzz-repair loop.
- **Done when:** `npm run eval:retrieval` compares all three systems.

### Thu Oct 29: end-to-end generation (the critical P0 day)
- Iterate on the spec, compose and repair prompts in `apps/server/src/agent/prompts.ts`.
- Move fuzzing into `worker_threads` with a kill timeout so an infinite loop in generated code cannot hang the server.
- Optional: generate TypeScript and run `tsc` first, feeding compile errors into the repair loop.
- Repair benchmark: 20–30 prompts. Record round-0 pass rate, cumulative pass rate by round k, mean repair rounds, and the failure-type breakdown.
- **Done when:** a one-sentence description becomes a game that loads and plays in the web app.

### Fri Oct 30: balance sliders and stronger bots
- Run simulation in a Web Worker; sliders update first-player win rate, draw rate and game length live.
- Flat Monte Carlo bot for perfect-information games; random-bot balance numbers are too weak.
- Parameter sweep chart with `sweepParam` (e.g. first-player win rate vs board size).
- (P2) Auto-balance.
- 12:00 PM: Fireworks / Muse Open livestream.
- No office hours on weekends; ask any API questions today.

### Sat Oct 31: AI opponents
- Muse Spark opponents choose from the legal move list (constrained output); bluff games add chat for negotiation, bluffing and accusations.
- Opponents see only `view()`, never hidden information.
- Run the 50-game evaluation above and make the keep/drop call on table talk.
- Optional: run opponents on Muse Spark Open via Baseten (`meta-models/muse-spark-open-1026`) for the Best Open Weight prize; `ModelClient` works as is.

### Sun Nov 1: art alignment
- Render geometry to PNG as the control image (resvg or browser canvas).
- Muse Image (`/v1/images/edits`) paints over it with a style anchor image as reference.
- SAM 3.1 with one box prompt per cell (`boxPrompt()` is ready) checks the whole board in one request. Decode the masks and compute IoU against `expectedCellMasks()`.
- Cells below the IoU threshold: crop, repaint locally, composite back. Record `meanIoU` and `alignedShare` before and after repair.
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
| 0:20–1:10 | Live generation: prompt and dials → retrieved mechanics → rules code → fuzzing catches a bug → automatic repair → passes |
| 1:10–1:40 | Play, then drag a slider and watch first-player win rate change |
| 1:40–2:10 | Bluff game: Muse Spark opponents bluff and accuse |
| 2:10–2:35 | Art: geometry → painting → SAM check → misaligned cells repaired |
| 2:35–3:00 | Metrics table, all three families, close |

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

- [ ] Repository is public
- [ ] README states what was built during the hackathon
- [ ] Only public-domain or traditional games and assets we have rights to; no trademarked names
- [ ] Video shows only features built during the hackathon
- [ ] Present the project as retrieval → composed executable code → fuzz verification, not as a basic RAG app

## Skeleton status (Oct 26)

**Working:**
- `packages/engine`: `GameModule` interface, seeded RNG, `playMatch` (strict mode freezes state and checks JSON, termination, legal moves and outcomes), `fuzz` (groups failures by type with replay seeds; checks determinism), `simulate` / `sweepParam`
- `packages/library`: `grid` mechanic module, Line Up reference game (m,n,k with optional gravity), retrievable catalog (including planned entries for retrieval eval)
- `packages/retrieval`: BM25 with an S-stemmer, P@k, Recall@k, nDCG@k (linear gain, matching trec_eval), MRR, MAP, TREC I/O
- `apps/server`: Hono API (`/api/health`, `/api/catalog`, `/api/generate`), Model API client (chat + structured output), `vm` sandbox (allowlisted `require`, no `Math.random`), `designGame` pipeline, IoU utilities
- `apps/web`: create panel (prompt and dials), SVG board playable against random bots, parameter sliders, live balance stats
- 23 tests pass; `npm run typecheck` and `npm run build -w @boarddream/web` pass

**Not done or unverified:**
- `/api/generate` has not run end to end against the real API; the prompts are first drafts
- Parsing `editImage` responses and decoding SAM masks (day 6)
- Fuzzing and simulation still run on the main thread (days 3–4)
- Opponents play randomly
