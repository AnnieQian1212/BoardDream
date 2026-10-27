# BoardDream

Describe the board game you want, set a few dials, and get a playable, balanced game in the browser within minutes.

Built for the [Meta Global AI Developer Hackathon](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details) (Oct 26 – Nov 4, 2026).

## How it works

1. **Spec.** Muse Spark turns the prompt and dials (players, play time, complexity, luck vs strategy, competitive / cooperative / hidden role) into a structured game spec.
2. **Retrieve.** The spec's mechanics are matched against an indexed library of verified mechanic modules and public-domain reference games. Retrieval quality is measured with standard IR metrics (nDCG, Recall, MRR).
3. **Compose.** Muse Spark writes rules code against one fixed engine interface, reusing the retrieved modules instead of writing from scratch.
4. **Fuzz and repair.** Thousands of random playouts run in strict mode: states are frozen and must be plain JSON, games must terminate, every turn needs a legal move, outcomes must be valid, and the same seed must replay the same game. Failures go back to the model with replay seeds until the rules pass.
5. **Tune.** Every tunable value becomes a slider; simulation bots report first-player win rate, draw rate and game length as you drag.
6. **Play.** Bots fill empty seats; in bluffing games Muse Spark opponents negotiate and bluff. *(planned)*
7. **Art.** Muse Image paints over the engine's board geometry with a fixed style anchor, then SAM 3.1 checks every cell against the intended grid by IoU and sends misaligned regions back for targeted edits. *(planned)*

## Repository layout

| Path | What it is |
| --- | --- |
| `packages/engine` | The fixed `GameModule` interface, seeded RNG, match runner, fuzzer and balance simulator |
| `packages/library` | Verified mechanic modules, reference games and the retrievable catalog |
| `packages/retrieval` | BM25 index, IR metrics, TREC qrels/run I/O |
| `apps/server` | Model API client, designer agent (spec → retrieve → compose → fuzz/repair), rules sandbox, art alignment |
| `apps/web` | React app: create panel, playable board, tuning sliders and balance stats |
| `eval/` | Retrieval evaluation set and runner |
| `docs/PLAN.md` | Day-by-day build plan |

## Getting started

Requires Node 22+.

```sh
npm install
cp .env.example .env      # add MODEL_API_KEY
npm run dev               # server on :8787, web on http://localhost:5173
```

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
