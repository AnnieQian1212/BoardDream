import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { serveStatic } from "@hono/node-server/serve-static";
import { fileURLToPath } from "node:url";
import { catalog, catalogText } from "@boarddream/library";
import { Bm25Index } from "@boarddream/retrieval";
import { Hono, type Context } from "hono";
import { streamSSE } from "hono/streaming";
import { designGame } from "./agent/designer";
import { chooseMove, type OpponentRequest } from "./agent/opponent";
import { boardReport, paintBoard, type BoardRequest } from "./art/board";
import { artFile, paintDeck, readManifest, type ArtRequest } from "./art/cards";
import type { GameRequest } from "./agent/spec";
import { config, hasOpenModel } from "./config";
import { clientAddress, LIMITS, opponentRequestProblem, RateLimiter, type Limit } from "./guard";
import { ModelClient } from "./meta/client";
import { gameSource, listGames, saveGame } from "./store";

const designer = new ModelClient({ ...config.meta, model: config.models.designer });
const painter = new ModelClient({ ...config.meta, model: config.models.image });
// Opponents play on Muse Spark Open when a host for it is configured: fast and cheap enough for a
// whole table of them. Otherwise Muse Spark plays them.
const opponent = hasOpenModel() ? new ModelClient(config.openModel) : config.meta.apiKey ? designer : undefined;
// Only entries with code are offered to the designer; planned ones exist for retrieval evaluation.
const index = new Bm25Index(catalog.filter((e) => e.status === "ready").map((e) => ({ id: e.id, text: catalogText(e) })));

const app = new Hono();

// Public deployments spend credits on every model call, so those routes are rate-limited there.
const limiters = new Map<string, RateLimiter>();
function overLimit(c: Context, name: keyof typeof LIMITS) {
  if (!config.publicDemo) return undefined;
  const limit: Limit = LIMITS[name];
  if (!limiters.has(name)) limiters.set(name, new RateLimiter(limit));
  const verdict = limiters.get(name)!.take(clientAddress(c.req.raw.headers, getConnInfo(c).remote.address));
  return verdict.ok ? undefined : c.json({ error: verdict.reason }, 429, { "Retry-After": String(verdict.retryAfterS) });
}

app.get("/api/health", (c) =>
  c.json({ ok: true, hasApiKey: Boolean(config.meta.apiKey), canGenerate: Boolean(config.meta.apiKey), models: config.models, opponentModel: opponent?.model }),
);

app.get("/api/catalog", (c) => c.json(catalog));

app.get("/api/games", (c) => c.json(listGames()));

// Card art: the manifest (card title -> file), the image files, and painting a deck with progress
// streamed as server-sent events ("card" per finished illustration, then "done").
app.get("/api/art/:game", (c) => c.json(readManifest(c.req.param("game"))));

// Board art: the alignment report (with painted tile sources per kind), and painting with progress.
app.get("/api/art/:game/board", (c) => {
  const report = boardReport(c.req.param("game"));
  return report ? c.json(report) : c.json({ error: "no board art yet" }, 404);
});

app.post("/api/art/:game/board", async (c) => {
  if (!config.meta.apiKey) return c.json({ error: "MODEL_API_KEY is not set" }, 503);
  const game = c.req.param("game");
  const request = await c.req.json<BoardRequest>();
  return streamSSE(c, async (stream) => {
    try {
      const report = await paintBoard(painter, { image: config.models.image, sam: config.models.sam }, game, request, (step) => {
        void stream.writeSSE({ event: "step", data: step });
      });
      await stream.writeSSE({ event: "done", data: JSON.stringify(report) });
    } catch (err) {
      await stream.writeSSE({ event: "error", data: err instanceof Error ? err.message : String(err) });
    }
  });
});

app.get("/api/art/:game/:file", (c) => {
  const bytes = artFile(c.req.param("game"), c.req.param("file"));
  if (!bytes) return c.json({ error: "no such image" }, 404);
  const type = c.req.param("file").endsWith(".png") ? "image/png" : c.req.param("file").endsWith(".jpeg") ? "image/jpeg" : "image/webp";
  return c.body(new Uint8Array(bytes), 200, { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable" });
});

app.post("/api/art/:game", async (c) => {
  if (!config.meta.apiKey) return c.json({ error: "MODEL_API_KEY is not set" }, 503);
  const limited = overLimit(c, "art");
  if (limited) return limited;
  const game = c.req.param("game");
  const request = await c.req.json<ArtRequest>();
  return streamSSE(c, async (stream) => {
    try {
      await paintDeck(painter, config.models.image, game, request, (title, file) => {
        void stream.writeSSE({ event: "card", data: JSON.stringify({ title, file }) });
      });
      await stream.writeSSE({ event: "done", data: "" });
    } catch (err) {
      await stream.writeSSE({ event: "error", data: err instanceof Error ? err.message : String(err) });
    }
  });
});

// One decision for a Muse Spark opponent: a legal move index and a line of table talk.
app.post("/api/opponent", async (c) => {
  if (!opponent) return c.json({ error: "neither MODEL_API_KEY nor OPEN_MODEL_API_KEY is set" }, 503);
  const request = await c.req.json<OpponentRequest>();
  const problem = opponentRequestProblem(request);
  if (problem) return c.json({ error: problem }, 400);
  const limited = overLimit(c, "opponent");
  if (limited) return limited;
  try {
    return c.json(await chooseMove(opponent, request));
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
});

app.get("/api/games/:id", (c) => {
  const source = gameSource(c.req.param("id"));
  return source ? c.text(source, 200, { "Content-Type": "text/javascript" }) : c.json({ error: "no such game" }, 404);
});

// Generation takes minutes, so progress streams as server-sent events: "progress" lines, then one
// "result" (the DesignResult as JSON) or "error".
app.post("/api/generate", async (c) => {
  if (!config.meta.apiKey) return c.json({ error: "MODEL_API_KEY is not set; copy .env.example to .env" }, 503);
  const limited = overLimit(c, "generate");
  if (limited) return limited;
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

// One process for everything: the built web app after the API routes, any other path its page.
if (config.serveWeb) {
  const root = fileURLToPath(new URL("../../web/dist/", import.meta.url));
  app.get("*", serveStatic({ root }));
  app.get("*", serveStatic({ root, path: "index.html" }));
}

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`BoardDream server on http://localhost:${info.port}`);
});
