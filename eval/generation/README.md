# Generation benchmark

Can BoardDream turn a one-sentence idea into rules that work and are worth playing?

`prompts.jsonl` has 24 ideas: 8 engine builders, 8 map games and 8 others (abstracts, races, bluffing, co-op, auctions). Each one goes through the full pipeline: design, retrieval, rules code, then 1,000 strict random games. Failures go back to Muse Spark for repair (up to 4 rounds). Rules that pass get a 100-game playtest, and design problems (games over too fast, mostly draws, a seat that never wins, no real choices) get one improvement round.

## Results (Oct 27, 2026)

| | |
| --- | --- |
| Pass 1,000-game fuzzing on the first draft | 23 / 24 |
| Pass after one repair | 24 / 24 |
| Design problems found by the playtest | 2, both fixed in one round |
| Cost of the run | $3.08 (Muse Spark 1.3) |

- The one failed draft (g07) pointed a move at a card the table did not show; the repair fixed it.
- The playtest caught a kids' race where no turn had a real choice (g18), and an auction where seat 3 never won (g24).
- Every game uses the shared engine, so all 24 play on the 3D table with bots and balance sliders.

## Run it

```sh
npm run eval:generation              # all prompts
npm run eval:generation -- g01,g09   # a subset
```

Model replies are cached in `cache/` (not committed), so a rerun is free. Generated rules and their records land in `out/`.
