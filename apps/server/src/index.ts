import { serve } from "@hono/node-server";
import { catalog, catalogText } from "@boarddream/library";
import { Bm25Index } from "@boarddream/retrieval";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { designGame } from "./agent/designer";
import type { GameRequest } from "./agent/spec";
import { config } from "./config";
import { ModelClient } from "./meta/client";
import { gameSource, listGames, saveGame } from "./store";

const designer = new ModelClient({ ...config.meta, model: config.models.designer });
// Only entries with code are offered to the designer; planned ones exist for retrieval evaluation.
const index = new Bm25Index(catalog.filter((e) => e.status === "ready").map((e) => ({ id: e.id, text: catalogText(e) })));

const app = new Hono();

app.get("/api/health", (c) => c.json({ ok: true, hasApiKey: Boolean(config.meta.apiKey), models: config.models }));

app.get("/api/catalog", (c) => c.json(catalog));

app.get("/api/games", (c) => c.json(listGames()));

app.get("/api/games/:id", (c) => {
  const source = gameSource(c.req.param("id"));
  return source ? c.text(source, 200, { "Content-Type": "text/javascript" }) : c.json({ error: "no such game" }, 404);
});

// Generation takes minutes, so progress streams as server-sent events: "progress" lines, then one
// "result" (the DesignResult as JSON) or "error".
app.post("/api/generate", async (c) => {
  if (!config.meta.apiKey) return c.json({ error: "MODEL_API_KEY is not set; copy .env.example to .env" }, 503);
  const request = await c.req.json<GameRequest>();
  return streamSSE(c, async (stream) => {
    const onProgress = (event: string) => {
      console.log(`[generate] ${event}`);
      void stream.writeSSE({ event: "progress", data: event });
    };
    try {
      const result = await designGame(request, { llm: designer, index, onProgress });
      const saved = result.ok ? saveGame(result) : undefined;
      await stream.writeSSE({ event: "result", data: JSON.stringify({ ...result, id: saved?.id }) });
    } catch (err) {
      await stream.writeSSE({ event: "error", data: err instanceof Error ? err.message : String(err) });
    }
  });
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`BoardDream server on http://localhost:${info.port}`);
});
