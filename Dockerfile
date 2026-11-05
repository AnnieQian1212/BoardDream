# The full BoardDream server: the web app and the API (generation, AI opponents, art) in one
# process. See docs/DEPLOY.md. Needs about 2 CPUs and 2 GB of memory while a game is generated.
FROM node:22-slim
WORKDIR /app
# Run as the image's "node" user (uid 1000, as Hugging Face Spaces requires), owning /app so the
# server can write data/ (accounts, generated games, art).
RUN chown node:node /app
USER node
COPY --chown=node:node . .
RUN npm ci && npm run build -w @boarddream/web
# 7860 is Hugging Face Spaces' port; other hosts set PORT themselves.
ENV SERVE_WEB=1 PORT=7860
EXPOSE 7860
# A persistent volume at /data (a Hugging Face storage bucket) keeps generated games, their art and
# translations across restarts. Accounts and tables stay in the container: SQLite wants a local disk.
CMD ["sh", "-c", "mkdir -p data; if [ -d /data ]; then for d in games art translations; do mkdir -p /data/$d && ln -sfn /data/$d data/$d; done; touch /data/games/.probe && echo '[data] games, art and translations kept in /data' || echo '[data] /data is not writable'; fi; exec npm run start -w @boarddream/server"]
