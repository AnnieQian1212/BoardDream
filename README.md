# BoardDream

Describe a board game in a sentence. BoardDream designs it, writes the rules as code, playtests them with 1,000 random games, fixes what breaks, and deals you in on a 3D table.

Built for the [Meta Global AI Developer Hackathon](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details) (Oct 26 – Nov 4, 2026).

## How it works

1. **Design.** Muse Spark turns your idea and settings (players, length, complexity, luck) into a game plan.
2. **Find building blocks.** It picks tested mechanics from the library: dice, card markets, hex maps, trading and more ([retrieval eval](eval/retrieval/README.md)).
3. **Write the rules.** Muse Spark writes the game as code on top of those blocks.
4. **Playtest and fix.** 1,000 random games check that every game ends and nothing breaks. Failures go back to the model until the rules pass.
5. **Play and tune.** Play against bots on a 3D table. Sliders change the rules and show balance as you drag.

Coming next: card and board art from Muse Image checked with SAM 3.1, and Muse Spark opponents that negotiate and bluff.

## Try it

Requires Node 22+.

```sh
npm install
cp .env.example .env      # add MODEL_API_KEY
npm run dev               # http://localhost:5173
```

- `?game=lantern-isles&watch` lets bots play a whole game.
- `F` hides the side panels.
- `?quality=low` helps slow GPUs; `?flat` switches to a 2D table.

```sh
npm test
npm run eval:retrieval
npm run eval:generation
```

## Code

| Folder | Contents |
| --- | --- |
| `packages/engine` | Game interface, fuzzer, balance simulator |
| `packages/library` | Mechanics, reference games (including the original Glasshouse and Lantern Isles), catalog |
| `packages/retrieval` | BM25 search and IR metrics |
| `apps/server` | Muse Spark pipeline and rules sandbox |
| `apps/web` | React + three.js app |
| `eval/` | Retrieval and generation benchmarks |

## Built during the hackathon

All code was written after kickoff on Oct 26, 2026. The day-by-day plan and progress are in [docs/PLAN.md](docs/PLAN.md).

- **Oct 26:** engine, fuzzer, first reference game, search, app shell.
- **Oct 27:** 19 mechanic modules, 9 reference games, retrieval eval, 3D table, end-to-end game generation.
