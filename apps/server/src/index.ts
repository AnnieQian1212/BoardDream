import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { serveStatic } from "@hono/node-server/serve-static";
import { fileURLToPath } from "node:url";
import { catalog, catalogText } from "@boarddream/library";
import { Bm25Index } from "@boarddream/retrieval";
import { Hono, type Context } from "hono";
import { streamSSE, type SSEStreamingApi } from "hono/streaming";
import { designGame, reviseGame, type DesignEvent } from "./agent/designer";
import { cleanDials, cleanEffort } from "./agent/dials";
import { inventIdea } from "./agent/idea";
import { chooseMove, type OpponentRequest } from "./agent/opponent";
import { boardReport, paintBoard, type BoardRequest } from "./art/board";
import { artFile, deckRequest, paintDeck, paintDeckLater, plannerFrom, readManifest, type ArtRequest } from "./art/cards";
import { copyCover, listCovers, paintCover, paintCoverLater, type CoverRequest } from "./art/cover";
import type { Effort } from "./agent/protocol";
import { cleanRequest, savedTranslation, translateGame } from "./agent/translate";
import type { GameRequest } from "./agent/spec";
import { config, hasOpenModel } from "./config";
import { clientAddress, LIMITS, opponentRequestProblem, RateLimiter, type Limit } from "./guard";
import { ModelClient } from "./meta/client";
import { patientDispatcher } from "./meta/patient";
import { deleteGame, gameSource, listGames, recentDesigns, saveGame, saveRevision } from "./store";
import { Accounts } from "./accounts";
import { openDb } from "./db";
import { gameById } from "./games";
import { playRoutes } from "./play";
import { Rooms } from "./rooms";
import { loadGameFromSource } from "./sandbox";

const designer = new ModelClient({
  ...config.meta,
  dispatcher: patientDispatcher,
  model: config.models.designer,
  ...(config.designerEffort !== "default" && { defaults: { reasoningEffort: config.designerEffort } }),
});
const painter = new ModelClient({ ...config.meta, dispatcher: patientDispatcher, model: config.models.image });
/** Muse Spark at the reasoning effort a player picked for a game, one client per effort. */
const designers = new Map<Effort, ModelClient>();
const designerAt = (effort: Effort | undefined) => {
  if (!effort) return designer;
  let client = designers.get(effort);
  if (!client) designers.set(effort, (client = new ModelClient({ ...config.meta, dispatcher: patientDispatcher, model: config.models.designer, defaults: { reasoningEffort: effort } })));
  return client;
};
// Opponents play on Muse Spark Open when a host for it is configured: fast and cheap enough for a
// whole table of them. Otherwise Muse Spark plays them.
const opponent = hasOpenModel() ? new ModelClient({ ...config.openModel, dispatcher: patientDispatcher }) : config.meta.apiKey ? designer : undefined;
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
  c.json({
    ok: true,
    hasApiKey: Boolean(config.meta.apiKey),
    canGenerate: Boolean(config.meta.apiKey),
    // Accounts and tables shared with friends (play.ts) need this server; the static demo has neither.
    tables: true,
    models: config.models,
    opponentModel: opponent?.model,
  }),
);

// Accounts, and tables friends share: invite links, seats, moves refereed here, bots in empty seats.
const db = openDb();
app.route("/api", playRoutes({ accounts: new Accounts(db), rooms: new Rooms(db, gameById), clientOf: (c) => clientAddress(c.req.raw.headers, getConnInfo(c).remote.address) }));

app.get("/api/catalog", (c) => c.json(catalog));

app.get("/api/games", (c) => c.json(listGames()));

// Card art: the manifest (card title -> file), the image files, and painting a deck with progress
// streamed as server-sent events ("card" per finished illustration, then "done").
app.get("/api/art/:game", (c) => c.json(readManifest(c.req.param("game"))));

// Box covers: every game's that has one (as URLs), and painting one.
app.get("/api/covers", (c) => c.json(listCovers()));

app.post("/api/art/:game/cover", async (c) => {
  if (!config.meta.apiKey) return c.json({ error: "MODEL_API_KEY is not set" }, 503);
  const limited = overLimit(c, "art");
  if (limited) return limited;
  const body = await c.req.json<Partial<CoverRequest>>();
  if (typeof body.game !== "string" || typeof body.summary !== "string" || body.game.length > 200 || body.summary.length > 1000) {
    return c.json({ error: "send the game's name and summary" }, 400);
  }
  try {
    const id = c.req.param("game");
    await paintCover(painter, config.models.image, id, { game: body.game, summary: body.summary });
    return c.json({ url: listCovers()[id] });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
});

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
      await paintDeck(
        painter,
        config.models.image,
        game,
        request,
        (title, file) => void stream.writeSSE({ event: "card", data: JSON.stringify({ title, file }) }),
        plannerFrom(designer),
      );
      await stream.writeSSE({ event: "done", data: "" });
    } catch (err) {
      await stream.writeSSE({ event: "error", data: err instanceof Error ? err.message : String(err) });
    }
  });
});

// A game's rules, cards and table words in another language, for a player who reads little English.
app.post("/api/translate/:game", async (c) => {
  const req = cleanRequest(await c.req.json().catch(() => null));
  if (typeof req === "string") return c.json({ error: req }, 400);
  const game = c.req.param("game");
  if (!/^[a-z0-9-]+$/.test(game)) return c.json({ error: "bad game id" }, 400);
  const saved = savedTranslation(game, req);
  if (saved) return c.json(saved);
  if (!config.meta.apiKey) return c.json({ error: "MODEL_API_KEY is not set" }, 503);
  const limited = overLimit(c, "translate");
  if (limited) return limited;
  try {
    return c.json(await translateGame(designer, game, req));
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
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

// Deletes a saved game. On the public demo the saved games are everyone's, so the server keeps them
// and each browser only hides the ones its player deleted.
app.delete("/api/games/:id", (c) => {
  if (config.publicDemo) return c.json({ error: "saved games are shared on the public demo" }, 403);
  return deleteGame(c.req.param("id")) ? c.json({ ok: true }) : c.json({ error: "no such game" }, 404);
});

/**
 * Server-sent events for a design under way: "design" events (DesignEvent in agent/protocol.ts, as
 * JSON), the one vocabulary the page reads; the log lines stay in the server's console. Pieces of
 * rules are sent in batches and check progress a few times a second, so a fast stream does not
 * flood the page. When the player leaves, the work stops: no more model calls.
 */
function designStream(stream: SSEStreamingApi, label: string) {
  const controller = new AbortController();
  stream.onAbort(() => {
    console.log(`[${label}] cancelled: the page closed`);
    controller.abort();
  });
  let code = "";
  let lastCheck = 0;
  const send = (event: DesignEvent) => void stream.writeSSE({ event: "design", data: JSON.stringify(event) });
  const flush = () => {
    if (code) send({ type: "code", text: code });
    code = "";
  };
  const timer = setInterval(flush, 150);
  return {
    signal: controller.signal,
    onProgress: (line: string) => console.log(`[${label}] ${line}`),
    onEvent: (event: DesignEvent) => {
      if (event.type === "code") return void (code += event.text);
      flush();
      if (event.type === "checking" && event.done < event.total && Date.now() - lastCheck < 200) return;
      if (event.type === "checking") lastCheck = Date.now();
      send(event);
    },
    close: () => {
      clearInterval(timer);
      flush();
    },
  };
}

// "Surprise me": Muse Spark invents an idea that fits the dials, for the player to read, change
// or replace before anything is made.
app.post("/api/idea", async (c) => {
  if (!config.meta.apiKey) return c.json({ error: "MODEL_API_KEY is not set; copy .env.example to .env" }, 503);
  const limited = overLimit(c, "idea");
  if (limited) return limited;
  const { dials } = await c.req.json<{ dials?: unknown }>();
  if (!dials || typeof dials !== "object") return c.json({ error: "send the dials the idea should fit" }, 400);
  const made = [...catalog.filter((e) => e.kind === "game").map((e) => e.title), ...listGames().map((g) => `${g.title}: ${g.pitch}`)];
  return c.json({ idea: await inventIdea(designer, cleanDials(dials), made.slice(0, 40)) });
});

// Generation takes a minute or more, so it streams as server-sent events (designStream), then one
// "result" (the DesignResult as JSON) or "error". `invented` says the idea is Muse Spark's, as
// "Surprise me" wrote it; the saved game records that.
app.post("/api/generate", async (c) => {
  if (!config.meta.apiKey) return c.json({ error: "MODEL_API_KEY is not set; copy .env.example to .env" }, 503);
  const body = await c.req.json<{ prompt?: string; dials?: unknown; invented?: boolean; effort?: unknown }>();
  if (typeof body.prompt !== "string" || !body.prompt.trim() || body.prompt.length > 2000) return c.json({ error: "describe the game in at most 2,000 characters" }, 400);
  const request: GameRequest & { invented?: boolean } = { prompt: body.prompt, dials: cleanDials(body.dials), recent: recentDesigns(), invented: body.invented === true };
  const effort = cleanEffort(body.effort);
  const limited = overLimit(c, "generate");
  if (limited) return limited;
  return streamSSE(c, async (stream) => {
    const { onProgress, onEvent, signal, close } = designStream(stream, "generate");
    try {
      const result = await designGame(request, { llm: designerAt(effort), index, onProgress, onEvent, signal });
      const saved = result.ok ? saveGame(result, { idea: request.prompt, invented: request.invented === true, effort: effort ?? config.designerEffort }) : undefined;
      if (saved) {
        paintCoverLater(painter, config.models.image, saved.id, { game: saved.title, summary: saved.pitch });
        // The cards too, in the background: a game should open with its deck painted.
        paintDeckLater(painter, config.models.image, saved.id, deckRequest(loadGameFromSource(result.source)), plannerFrom(designer));
      }
      close();
      await stream.writeSSE({ event: "result", data: JSON.stringify({ ...result, id: saved?.id }) });
    } catch (err) {
      close();
      if (!signal.aborted) await stream.writeSSE({ event: "error", data: err instanceof Error ? err.message : String(err) });
    }
  });
});

// A designer's change to a game, in their words, streamed like generation. Saved games are read
// from the server's copy; a game the server never saved (a bundled demo game) sends its source.
app.post("/api/revise", async (c) => {
  if (!config.meta.apiKey) return c.json({ error: "MODEL_API_KEY is not set; copy .env.example to .env" }, 503);
  const body = await c.req.json<{ id?: string; source?: string; request?: string }>();
  const source = (body.id && gameSource(body.id)) || body.source;
  const request = body.request?.trim();
  if (typeof source !== "string" || source.length > 300_000) return c.json({ error: "send the game's id or its rules source" }, 400);
  if (!request || request.length > 600) return c.json({ error: "describe the change in at most 600 characters" }, 400);
  const limited = overLimit(c, "generate");
  if (limited) return limited;
  return streamSSE(c, async (stream) => {
    const { onProgress, onEvent, signal, close } = designStream(stream, "revise");
    try {
      const result = await reviseGame(source, request, { llm: designer, index, onProgress, onEvent, signal });
      const saved = result.ok ? saveRevision(body.id, result, request) : undefined;
      // A new version wears the cover of the game it revises.
      if (saved && body.id) copyCover(body.id, saved.id);
      close();
      await stream.writeSSE({ event: "result", data: JSON.stringify({ ...result, id: saved?.id, title: saved?.title }) });
    } catch (err) {
      close();
      if (!signal.aborted) await stream.writeSSE({ event: "error", data: err instanceof Error ? err.message : String(err) });
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
