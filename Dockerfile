# The full BoardDream server: the web app and the API (generation, AI opponents, art) in one
# process. See docs/DEPLOY.md. Needs about 2 CPUs and 2 GB of memory while a game is generated.
FROM node:22-slim
WORKDIR /app
COPY . .
RUN npm ci && npm run build -w @boarddream/web
# 7860 is Hugging Face Spaces' port; other hosts set PORT themselves.
ENV SERVE_WEB=1 PORT=7860
EXPOSE 7860
CMD ["npm", "run", "start", "-w", "@boarddream/server"]
