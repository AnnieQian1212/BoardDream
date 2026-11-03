# Deploying BoardDream

Two setups, depending on what the public demo should do.

| | Static demo (free) | Full server |
| --- | --- | --- |
| The demo games BoardDream made (`apps/web/src/demo-games`) and the hand-made games, bots, balance, game profiles, results page | yes | yes |
| AI opponents (Muse Spark Open) | yes, through an edge function | yes |
| Generating new games, painting art | no | yes |
| Accounts, and tables shared with friends | no | yes |
| Host | Cloudflare Pages (free plan) | any container host |

## Static demo: Cloudflare Pages

The web app is static, and two small Pages Functions in `apps/web/functions` answer `/api/health` and `/api/opponent`. They share the opponent prompt and the request guards with the Node server.

Run these from the repository's folder (`npm ci` needs its `package-lock.json`; skip it if the packages are already installed):

```sh
npm ci
npm run build -w @boarddream/web
cd apps/web                        # Pages finds functions/ next to the deployed folder
npx wrangler login
npx wrangler pages project create boarddream --production-branch main
npx wrangler pages secret put OPEN_MODEL_API_KEY --project-name boarddream
npx wrangler pages secret put OPEN_MODEL_BASE_URL --project-name boarddream   # https://inference.baseten.co/v1
npx wrangler pages deploy dist --project-name boarddream
```

- Secrets reach the deployments made after they are set, so they go in before the first deploy; after changing one, deploy again.

### Deploying on every push

`.github/workflows/deploy-demo.yml` typechecks, tests, builds and deploys the demo on every push to `main`. It needs two repository secrets (GitHub: Settings, Secrets and variables, Actions); until they are there it skips the deploy.

- `CLOUDFLARE_API_TOKEN`: a Cloudflare API token (My Profile, API Tokens, Create Token, Custom token) with the one permission Account, Cloudflare Pages, Edit.
- `CLOUDFLARE_ACCOUNT_ID`: the account's id, which `npx wrangler whoami` prints.

- `OPEN_MODEL` picks another model (default `meta-models/muse-spark-open-1026`); `OPPONENTS_ENABLED=0` turns the AI opponents off without a redeploy, and the bots play instead.
- Requests are size-checked and rate-limited (`apps/server/src/guard.ts`: 120 opponent moves per client per 10 minutes, 5,000 a day). The limits live in memory, per edge instance, so they stop casual abuse rather than a determined attacker; a rate-limiting rule on the Cloudflare dashboard adds a hard per-address cap.
- To choose the demo games: `npm run demo:games -- data/games/<id>.js ...` (or a benchmark record, `eval/generation/out/g05.js`), best first; take one out by deleting its file and its line in `apps/web/src/demo-games/index.json`. Each is fuzzed again first. A saved game keeps its id, so a server that has it too lists it once, with its art; `npm run covers` then ships its cover in `apps/web/public/covers`, to be scaled to 960 px wide like the others.

## Full server: a container

The `Dockerfile` builds the web app and runs the Node server, which serves it next to the API.

```sh
docker build -t boarddream .
docker run -p 7860:7860 -e MODEL_API_KEY=... -e OPEN_MODEL_API_KEY=... -e OPEN_MODEL_BASE_URL=https://inference.baseten.co/v1 -e PUBLIC_DEMO=1 boarddream
```

- `PUBLIC_DEMO=1` turns on the rate limits: per client 3 generations an hour, 2 paintings an hour and 120 opponent moves per 10 minutes; in all, 40 generations, 20 paintings and 5,000 moves a day.
- Generation runs fuzzing in worker threads capped at 512 MB each: give it about 2 CPUs and 2 GB.
- Generated games are saved under `data/`, which most hosts wipe on restart; the demo games are part of the image.
- Accounts, sessions and shared tables live in `data/boarddream.db` (SQLite through Node's built-in driver, nothing to install). Mount a persistent volume at `/app/data` to keep them, and generated games, across restarts. Passwords are stored as scrypt hashes; the session cookie is http-only and SameSite=Lax, and is marked Secure behind HTTPS (the server reads `X-Forwarded-Proto`).
- A new account confirms its email with a six-digit code, mailed over SMTP: add `-e MAIL_SMTP_HOST=smtp.gmail.com -e MAIL_SMTP_PORT=465 -e MAIL_SMTP_USER=you@gmail.com -e MAIL_SMTP_PASS=<app password> -e MAIL_FROM="BoardDream <you@gmail.com>"` (for Gmail, turn on 2-step verification and make an app password). Without `MAIL_SMTP_HOST`, a server with `PUBLIC_DEMO=1` makes accounts without a code, and any other prints the code to its console.
- Without a container host: `npm run build -w @boarddream/web`, then `SERVE_WEB=1 npm run start -w @boarddream/server`.
