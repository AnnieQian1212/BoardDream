# BoardDream

Describe the board game you want, set a few dials, and get a playable, balanced game in the browser within minutes: engine builders, trading-and-building map games, bluffing games and classic abstracts.

Built for the [Meta Global AI Developer Hackathon](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details) (Oct 26 – Nov 4, 2026).

## How it works

1. **Spec.** Muse Spark turns the prompt and dials (players, play time, complexity, luck vs strategy, competitive / cooperative / hidden role) into a structured game spec.
2. **Retrieve.** Muse Spark rewrites the idea into mechanic vocabulary, BM25 pulls candidates from an indexed library of verified mechanic modules and public-domain reference games, and Muse Spark reranks them by how directly the game needs each one. On a 50-query graded eval set this lifts nDCG@10 from 0.845 (BM25) to 0.969 ([details](eval/retrieval/README.md)).
3. **Compose.** Muse Spark writes rules code against one fixed engine interface, reusing the retrieved modules instead of writing from scratch. Cards are data in a small effect language (gain, draw, points, conversions, per-tag bonuses; on play, income and end-game triggers) that the engine executes and turns into rules text.
4. **Fuzz and repair.** Thousands of random playouts run in strict mode: states are frozen and must be plain JSON, games must terminate, every turn needs a legal move, outcomes must be valid, and the same seed must replay the same game. Failures go back to the model with replay seeds until the rules pass.
5. **Tune.** Every tunable value becomes a slider; simulation bots report first-player win rate, draw rate and game length as you drag.
6. **Play.** The game is dealt onto a 3D table (three.js): printed cards that fly between deck, market, hand and mat, resource tokens, raised board tiles. Bots fill empty seats; in bluffing games Muse Spark opponents negotiate and bluff. *(opponents planned)*
7. **Art.** Muse Image paints over the engine's board geometry with a fixed style anchor, then SAM 3.1 checks every cell against the intended grid by IoU and sends misaligned regions back for targeted edits. *(planned)*

## Repository layout

| Path | What it is |
| --- | --- |
| `packages/engine` | The fixed `GameModule` interface, seeded RNG, match runner, fuzzer and balance simulator |
| `packages/library` | Verified mechanic modules, reference games and the retrievable catalog |
| `packages/retrieval` | BM25 index, IR metrics, TREC qrels/run I/O |
| `apps/server` | Model API client, designer agent (spec → retrieve → compose → fuzz/repair), rules sandbox, art alignment |
| `apps/web` | React + react-three-fiber app: 3D tabletop for any game, create panel, tuning sliders and balance stats |
| `eval/` | Retrieval evaluation set and runner |
| `docs/PLAN.md` | Day-by-day build plan |

## Getting started

Requires Node 22+.

```sh
npm install
cp .env.example .env      # add MODEL_API_KEY
npm run dev               # server on :8787, web on http://localhost:5173
```

Open `http://localhost:5173/?game=glasshouse&watch` to watch bots play a full game. Press `F` to hide the side panels. The table renders only while something moves and picks a quality tier from the GPU (integrated GPUs get no shadow maps or post-processing, and it steps down further if animation drops below 30 fps); force one with `?quality=lowest|low|medium|high`, or use `?flat` for the 2D table.

```sh
npm test                  # engine, library, retrieval, sandbox
npm run typecheck
npm run eval:retrieval    # writes a TREC run to eval/retrieval/out/
```

## Built during the hackathon

All code in this repository was written during the hackathon, starting after kickoff on Oct 26, 2026.

| Date | Added |
| --- | --- |
| Oct 26 | Project skeleton: engine interface, fuzzer, simulator, Line Up reference game, BM25 + IR metrics, designer pipeline draft, web app shell |
| Oct 27 | Race Home and Liar's Dice reference games; dice, track and bidding mechanic modules; Liar's Dice probability bot; viewer-aware geometry for hidden information; fuzzing of geometry, move targets and move labels |
| Oct 27 | Mechanic library grown to 13 modules and 7 reference games (Reversi, Hex, Snakes and Ladders, I Doubt It); 50-query retrieval eval set; Muse Spark query expansion and rerank (nDCG@10 0.845 → 0.969 over BM25), now used by the designer |
| Oct 27 | New focus on Catan- and Wingspan-style games: player panels in the engine, a card effect language, resources and market modules, Glasshouse (original engine-building game) with a greedy bot, and a redesigned tabletop UI |
| Oct 27 | 3D tabletop in three.js: lit table, painted card faces, animated cards and tokens, raised board tiles, highlights for legal moves, camera framing around the side panels, focus mode for recording |
| Oct 27 | Light daylight theme (oak table, navy market and boards, pastel seat mats, teal highlights); on-demand rendering and GPU quality tiers so the table runs smoothly on integrated graphics |
