# Deploying BoardDream

Two setups, depending on what the public demo should do.

| | Static demo (free) | Full server |
| --- | --- | --- |
| Five reference games, bots, balance, game profiles, results page | yes | yes |
| Generated games bundled in `apps/web/public/demo-games` | yes | yes |
| AI opponents (Muse Spark Open) | yes, through an edge function | yes |
| Generating new games, painting art | no | yes |
| Host | Cloudflare Pages (free plan) | any container host |

## Static demo: Cloudflare Pages

The web app is static, and two small Pages Functions in `apps/web/functions` answer `/api/health` and `/api/opponent`. They share the opponent prompt and the request guards with the Node server.

```sh
npm ci
npm run build -w @boarddream/web
cd apps/web                        # Pages finds functions/ next to the deployed folder
npx wrangler login
npx wrangler pages deploy dist --project-name boarddream
npx wrangler pages secret put OPEN_MODEL_API_KEY --project-name boarddream
npx wrangler pages secret put OPEN_MODEL_BASE_URL --project-name boarddream   # https://inference.baseten.co/v1
```

- `OPEN_MODEL` picks another model (default `meta-models/muse-spark-open-1026`); `OPPONENTS_ENABLED=0` turns the AI opponents off without a redeploy, and the bots play instead.
- Requests are size-checked and rate-limited (`apps/server/src/guard.ts`: 120 opponent moves per client per 10 minutes, 5,000 a day). The limits live in memory, per edge instance, so they stop casual abuse rather than a determined attacker; a rate-limiting rule on the Cloudflare dashboard adds a hard per-address cap.
- To add or refresh the bundled games: `npm run demo:games -- eval/generation/out/g05.js data/games/<id>.js`. Each is fuzzed again first.

## Full server: a container

The `Dockerfile` builds the web app and runs the Node server, which serves it next to the API.

```sh
docker build -t boarddream .
docker run -p 7860:7860 -e MODEL_API_KEY=... -e OPEN_MODEL_API_KEY=... -e OPEN_MODEL_BASE_URL=https://inference.baseten.co/v1 -e PUBLIC_DEMO=1 boarddream
```

- `PUBLIC_DEMO=1` turns on the rate limits: per client 3 generations an hour, 2 paintings an hour and 120 opponent moves per 10 minutes; in all, 40 generations, 20 paintings and 5,000 moves a day.
- Generation runs fuzzing in worker threads capped at 512 MB each: give it about 2 CPUs and 2 GB.
- Generated games are saved under `data/`, which most hosts wipe on restart; bundled demo games are part of the image.
- Without a container host: `npm run build -w @boarddream/web`, then `SERVE_WEB=1 npm run start -w @boarddream/server`.
