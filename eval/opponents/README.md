# Opponents benchmark

Muse Spark plays the social moves (offers, answers to offers, bids, calls). The game's own bot plays everything else and suggests a move as advice, which Muse Spark may overrule. Does that play at least as well as the bot alone?

## Results (Oct 27, 2026)

| Game | Setup | Muse Spark seat wins | Fair share |
| --- | --- | --- | --- |
| Liar's Dice | 2 players, 20 games, against the probability bot | 70% | 50% |
| Lantern Isles | 3 players, 9 games, against two heuristic bots | 33% | 33% |

- Muse Spark overruled the bot's advice on 5% of 500 Liar's Dice decisions and 9% of 82 Lantern Isles decisions. No decision fell back to the bot.
- It talks while it plays: "Spare stone for some wood, friend?", "Sorry mate, that stone's spoken for!", "Let's bump it to two sixes."
- Small samples: treat these as a sanity check, not a ranking. The run cost $5.51 (582 Muse Spark 1.3 calls).

## Muse Spark Open on Baseten (Oct 28, 2026)

The same setup with `meta-models/muse-spark-open-1026`, the open-weight model, hosted on Baseten. It is cheap enough for bigger samples. Game i is dealt from the same seed in both runs, so the first 20 Liar's Dice games replay the deals above.

| Game | Setup | Muse Spark Open seat wins | Fair share |
| --- | --- | --- | --- |
| Liar's Dice | 2 players, 50 games, against the probability bot | 46% (60% on the first 20 deals, where Muse Spark 1.3 won 70%) | 50% |
| Lantern Isles | 3 players, 15 games, against two heuristic bots | 20% | 33% |

- It runs at low reasoning effort. At its default effort it spent up to 3,000 reasoning tokens before a one-line JSON move, and sometimes ran out of tokens before answering.
- It overruled the bot's advice more often than Muse Spark 1.3: on 7% of 1,183 Liar's Dice decisions and 14% of 145 Lantern Isles decisions. Every reply was valid JSON; 42 decisions (3%) fell back to the bot because the API call still failed after retries, with eight games running at once.
- Reading: about even with the probability bot in Liar's Dice (50 games leave roughly ±14 points at 95%), a little behind Muse Spark 1.3 on the shared deals, and behind the bots in Lantern Isles on a small sample. It still talks in character: "Need stone, got spare grain anyone?", "Holding my wood for now, sorry!"
- 1,286 calls in 12.5 minutes (0.92M prompt and 0.50M completion tokens), about $3.30 at Baseten's listed $1.25 / $4.25 per million tokens, paid from Baseten credits.

When `OPEN_MODEL_*` is set in `.env`, the app seats Muse Spark Open as the AI opponents; it answers in a few seconds, so a table of three opponents stays responsive. Without it, Muse Spark 1.3 plays them.

## Run it

```sh
npm run eval:opponents              # Muse Spark 1.3
npm run eval:opponents -- open      # Muse Spark Open on Baseten, 50 and 15 games
```

Replies are cached in `cache/` (not committed), so a rerun is free.
