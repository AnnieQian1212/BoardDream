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

## Run it

```sh
npm run eval:opponents
```

Replies are cached in `cache/` (not committed), so a rerun is free.
