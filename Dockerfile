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
CMD ["npm", "run", "start", "-w", "@boarddream/server"]
