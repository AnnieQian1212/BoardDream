import { serve } from "@hono/node-server";
import { catalog, catalogText } from "@boarddream/library";
import { Bm25Index } from "@boarddream/retrieval";
import { Hono } from "hono";
import { designGame } from "./agent/designer";
import type { GameRequest } from "./agent/spec";
import { config } from "./config";
import { ModelClient } from "./meta/client";

const designer = new ModelClient({ ...config.meta, model: config.models.designer });
// Only entries with code are offered to the designer; planned ones exist for retrieval evaluation.
const index = new Bm25Index(catalog.filter((e) => e.status === "ready").map((e) => ({ id: e.id, text: catalogText(e) })));

const app = new Hono();

app.get("/api/health", (c) => c.json({ ok: true, hasApiKey: Boolean(config.meta.apiKey), models: config.models }));

app.get("/api/catalog", (c) => c.json(catalog));

app.post("/api/generate", async (c) => {
  if (!config.meta.apiKey) return c.json({ error: "MODEL_API_KEY is not set; copy .env.example to .env" }, 503);
  const request = await c.req.json<GameRequest>();
  try {
    const result = await designGame(request, { llm: designer, index, onProgress: (e) => console.log(`[generate] ${e}`) });
    return c.json(result);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`BoardDream server on http://localhost:${info.port}`);
});
