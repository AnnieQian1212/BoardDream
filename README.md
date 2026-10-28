# BoardDream

Describe a board game in a sentence. BoardDream designs a strategy game for teen and adult players around it, writes the rules as code, playtests them with 1,000 random games, fixes what breaks, and deals you in on a 3D table.

Built for the [Meta Global AI Developer Hackathon](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details) (Oct 26 – Nov 4, 2026).

## How it works

1. **Design.** Muse Spark turns your idea and settings (players, length, complexity, luck) into a game plan.
2. **Find building blocks.** It picks tested mechanics from the library: card markets, worker placement, area majorities, tile placement, hex maps, trading and more ([retrieval eval](eval/retrieval/README.md)).
3. **Write the rules.** Muse Spark writes the game as code on top of those blocks.
4. **Playtest and fix.** 1,000 random games check that every game ends and nothing breaks. More games check that it is worth playing, including whether a player who plans ahead beats random play. Problems go back to the model until the rules pass ([generation benchmark](eval/generation/README.md): 24 of 24 ideas pass).
5. **Play and tune.** Play on a 3D table. Muse Spark opponents trade, bluff and talk ([opponents benchmark](eval/opponents/README.md)). Sliders change the rules and show balance as you drag.
6. **Paint.** Muse Image paints every card and the board in one style, and SAM 3.1 checks that each painted tile lines up with the real board.

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
| `packages/library` | Mechanics, the original reference games Glasshouse, Lantern Isles, Highsail and Wildmere, catalog, small classic games used only as engine test fixtures |
| `packages/retrieval` | BM25 search and IR metrics |
| `apps/server` | Muse Spark pipeline and rules sandbox |
| `apps/web` | React + three.js app |
| `eval/` | Retrieval and generation benchmarks |

## Built during the hackathon

All code was written after kickoff on Oct 26, 2026. The day-by-day plan and progress are in [docs/PLAN.md](docs/PLAN.md).

- **Oct 26:** engine, fuzzer, first reference game, search, app shell.
- **Oct 27:** 21 mechanic modules, three original reference games (Glasshouse, Lantern Isles, Highsail) and seven small test games, retrieval eval, 3D table, end-to-end game generation, playtesting with a strategic-depth check, Muse Spark opponents, card and board art.
- **Oct 28:** tile placement with edge matching, and Wildmere, a fourth original reference game built on it.
