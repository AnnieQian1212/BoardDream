import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { streamSSE } from "hono/streaming";
import { AccountError, SESSION_DAYS, type Accounts, type User } from "./accounts";
import { RateLimiter } from "./guard";
import { RoomError, type Rooms } from "./rooms";

/**
 * Accounts and shared tables over HTTP, mounted under /api:
 *
 *   POST /auth/signup, /auth/login {name, password}; POST /auth/logout; GET /auth/me
 *   POST /rooms {gameId, numPlayers, params}; GET /rooms/:code
 *   POST /rooms/:code/join | leave | start | again; POST /rooms/:code/move {turn, move}
 *   GET  /rooms/:code/events: server-sent "room" events, the table as you see it, on every change
 *
 * Anything that changes something takes JSON from this site only: a form on another site cannot
 * send JSON, and a script on one fails the Origin check. The session cookie is http-only and
 * SameSite=Lax.
 */

export const SESSION_COOKIE = "bd_session";

type Env = { Variables: { user?: User } };

export interface PlayDeps {
  accounts: Accounts;
  rooms: Rooms;
  /** Who is asking, for rate limits: the client's address. */
  clientOf(c: Context): string;
}

export function playRoutes({ accounts, rooms, clientOf }: PlayDeps) {
  const app = new Hono<Env>();
  // Guessing passwords: 20 tries per address per 10 minutes. Opening tables: 30 an hour.
  const signIns = new RateLimiter({ perClient: 20, windowMs: 10 * 60_000, perDay: 50_000 });
  const openings = new RateLimiter({ perClient: 30, windowMs: 60 * 60_000, perDay: 20_000 });

  app.use("*", bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.json({ error: "that request is too large" }, 413) }));
  app.use("*", async (c, next) => {
    if (c.req.method !== "GET") {
      if (!(c.req.header("content-type") ?? "").startsWith("application/json")) return c.json({ error: "send JSON" }, 415);
      const origin = c.req.header("origin");
      if (origin && !sameSite(origin, c)) return c.json({ error: "requests from other sites are refused" }, 403);
    }
    c.set("user", accounts.userFor(getCookie(c, SESSION_COOKIE)));
    await next();
  });
  app.onError((err, c) => {
    if (err instanceof AccountError || err instanceof RoomError) return c.json({ error: err.message }, err.status);
    console.warn(`[play] ${c.req.method} ${c.req.path}: ${err instanceof Error ? err.message : String(err)}`);
    return c.json({ error: "something went wrong" }, 500);
  });

  const signedIn = (c: Context<Env>) => {
    const user = c.get("user");
    if (!user) throw new AccountError("sign in first", 401);
    return user;
  };
  const limited = (limiter: RateLimiter, c: Context<Env>) => {
    const verdict = limiter.take(clientOf(c));
    return verdict.ok ? undefined : c.json({ error: verdict.reason }, 429, { "Retry-After": String(verdict.retryAfterS) });
  };
  const body = async (c: Context<Env>) => {
    try {
      const value = (await c.req.json()) as unknown;
      return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
    } catch {
      throw new AccountError("send a JSON object");
    }
  };
  const begin = (c: Context<Env>, user: User) => {
    const secure = new URL(c.req.url).protocol === "https:" || c.req.header("x-forwarded-proto") === "https";
    setCookie(c, SESSION_COOKIE, accounts.startSession(user.id), { httpOnly: true, sameSite: "Lax", secure, path: "/", maxAge: SESSION_DAYS * 86_400 });
    return c.json({ user });
  };

  app.post("/auth/signup", async (c) => {
    const tooMany = limited(signIns, c);
    if (tooMany) return tooMany;
    const { name, password } = await body(c);
    return begin(c, await accounts.signUp(name, password));
  });

  app.post("/auth/login", async (c) => {
    const tooMany = limited(signIns, c);
    if (tooMany) return tooMany;
    const { name, password } = await body(c);
    return begin(c, await accounts.logIn(name, password));
  });

  app.post("/auth/logout", (c) => {
    accounts.endSession(getCookie(c, SESSION_COOKIE));
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ user: null });
  });

  app.get("/auth/me", (c) => c.json({ user: c.get("user") ?? null }));

  app.post("/rooms", async (c) => {
    const user = signedIn(c);
    const tooMany = limited(openings, c);
    if (tooMany) return tooMany;
    const { gameId, numPlayers, params } = await body(c);
    return c.json(rooms.create(user, { gameId, numPlayers, params }));
  });

  app.get("/rooms/:code", (c) => c.json(rooms.view(c.req.param("code"), c.get("user"))));
  app.post("/rooms/:code/join", (c) => c.json(rooms.join(c.req.param("code"), signedIn(c))));
  app.post("/rooms/:code/leave", (c) => c.json(rooms.leave(c.req.param("code"), signedIn(c))));
  app.post("/rooms/:code/start", (c) => c.json(rooms.start(c.req.param("code"), signedIn(c))));
  app.post("/rooms/:code/again", (c) => c.json(rooms.again(c.req.param("code"), signedIn(c))));
  app.post("/rooms/:code/move", async (c) => {
    const user = signedIn(c);
    const { turn, move } = await body(c);
    return c.json(rooms.move(c.req.param("code"), user, { turn, move }));
  });

  // The table as this person sees it, now and after every change, with a ping every 25 s so
  // proxies keep the connection open.
  app.get("/rooms/:code/events", (c) => {
    const code = c.req.param("code");
    const user = c.get("user");
    rooms.view(code, user);
    return streamSSE(c, async (stream) => {
      let open = true;
      const send = () => {
        if (!open) return;
        try {
          void stream.writeSSE({ event: "room", data: JSON.stringify(rooms.view(code, user)) });
        } catch (err) {
          void stream.writeSSE({ event: "problem", data: err instanceof Error ? err.message : String(err) });
        }
      };
      const unsubscribe = rooms.subscribe(code, send);
      stream.onAbort(() => {
        open = false;
        unsubscribe();
      });
      send();
      while (open) {
        await stream.sleep(25_000);
        if (open) await stream.writeSSE({ event: "ping", data: "" });
      }
    });
  });

  return app;
}

/**
 * The Origin is this site: the host name the request came to, directly or through a proxy. Ports
 * are ignored, as they are for cookies' SameSite (the dev server proxies :5173 to :8787).
 */
function sameSite(origin: string, c: Context): boolean {
  const hostname = (value: string | undefined) => {
    try {
      return value ? new URL(value.includes("://") ? value : `http://${value}`).hostname : undefined;
    } catch {
      return undefined;
    }
  };
  const from = hostname(origin);
  return from !== undefined && [new URL(c.req.url).hostname, hostname(c.req.header("x-forwarded-host")), hostname(c.req.header("host"))].includes(from);
}
