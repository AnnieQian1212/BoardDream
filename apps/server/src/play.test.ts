import type { GameModule } from "@boarddream/engine";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { AccountError, Accounts, hashPassword, verifyPassword } from "./accounts";
import { openDb } from "./db";
import { playRoutes, SESSION_COOKIE } from "./play";
import { RoomError, Rooms, type RoomView } from "./rooms";

// Take 1-3 stones; whoever takes the last one wins. Up to three seats, in turn.
type Nim = { pile: number; toMove: number; numPlayers: number; last: number | null };
const nim: GameModule<Nim, number> = {
  meta: { id: "nim", name: "Nim", family: "grid", mode: "competitive", minPlayers: 2, maxPlayers: 3, summary: "" },
  params: [{ key: "pile", label: "Stones", kind: "int", min: 5, max: 30, default: 12 }],
  setup: ({ numPlayers, params }) => ({ pile: params.pile as number, toMove: 0, numPlayers, last: null }),
  activePlayers: (s) => (s.pile === 0 ? [] : [s.toMove]),
  legalMoves: (s) => [1, 2, 3].filter((n) => n <= s.pile),
  applyMove: (s, p, take) => ({ ...s, pile: s.pile - take, toMove: (p + 1) % s.numPlayers, last: p }),
  isTerminal: (s) => s.pile === 0,
  outcome: (s) => ({ winners: s.last === null ? [] : [s.last] }),
  describeMove: (_s, take, viewer) => `takes ${take}${viewer === 0 ? " (seen by seat 0)" : ""}`,
};

const games = (id: string) => (id === "nim" ? nim : undefined);
/** Bots move at once, inside the call that woke them. */
const now = (run: () => void) => {
  run();
  return () => {};
};

async function people() {
  const db = openDb(":memory:");
  const accounts = new Accounts(db);
  const host = await accounts.signUp("Ada", "correct horse");
  const friend = await accounts.signUp("Bao", "battery staple");
  const third = await accounts.signUp("Cyd", "another secret");
  return { db, accounts, host, friend, third };
}

describe("accounts", () => {
  it("keep passwords as salted hashes and check them", async () => {
    const hash = await hashPassword("correct horse");
    expect(hash).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(hash).not.toContain("correct horse");
    expect(await hashPassword("correct horse")).not.toBe(hash);
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("correct hors", hash)).toBe(false);
  });

  it("sign people up with a fair name and password, once per name", async () => {
    const { accounts } = await people();
    await expect(accounts.signUp("x", "long enough")).rejects.toThrow(/2 to 24/);
    await expect(accounts.signUp("has space", "long enough")).rejects.toThrow(/2 to 24/);
    await expect(accounts.signUp("Dee", "short")).rejects.toThrow(/at least 8/);
    await expect(accounts.signUp("ada", "whatever123")).rejects.toMatchObject({ status: 409 });
    expect((await accounts.signUp("小明", "long enough")).name).toBe("小明");
  });

  it("sign in with the right password only, and keep a session until it ends or expires", async () => {
    let clock = 1_000_000;
    const db = openDb(":memory:");
    const accounts = new Accounts(db, () => clock);
    const ada = await accounts.signUp("Ada", "correct horse");
    expect(await accounts.logIn("ADA", "correct horse")).toEqual(ada);
    await expect(accounts.logIn("Ada", "wrong horse")).rejects.toMatchObject({ status: 401, message: "wrong name or password" });
    await expect(accounts.logIn("Nobody", "correct horse")).rejects.toMatchObject({ status: 401, message: "wrong name or password" });
    const token = accounts.startSession(ada.id);
    expect(accounts.userFor(token)).toEqual(ada);
    expect(accounts.userFor(token + "x")).toBeUndefined();
    // The database keeps only the token's hash.
    expect(JSON.stringify(db.prepare("SELECT token FROM sessions").all())).not.toContain(token);
    accounts.endSession(token);
    expect(accounts.userFor(token)).toBeUndefined();
    const later = accounts.startSession(ada.id);
    clock += 31 * 86_400_000;
    expect(accounts.userFor(later)).toBeUndefined();
  });
});

describe("a shared table", () => {
  it("seats the host, then friends, then no one once it is full", async () => {
    const { db, host, friend, third } = await people();
    const rooms = new Rooms(db, games, { schedule: now });
    const opened = rooms.create(host, { gameId: "nim", numPlayers: 2 });
    expect(opened).toMatchObject({ you: 0, isHost: true, status: "lobby", seats: [{ kind: "player", name: "Ada" }, { kind: "open" }] });
    expect(opened.code).toMatch(/^[a-z2-9]{8}$/);
    expect(rooms.join(opened.code, friend).you).toBe(1);
    expect(rooms.join(opened.code, friend).you).toBe(1);
    expect(() => rooms.join(opened.code, third)).toThrow(/every seat is taken/);
    expect(rooms.view(opened.code, third)).toMatchObject({ you: -1, isHost: false, host: "Ada" });
    expect(() => rooms.view("nope", host)).toThrow(RoomError);
    expect(() => rooms.create(host, { gameId: "chess" })).toThrow(/no such game/);
    // Player counts are held to what the game allows.
    expect(rooms.create(host, { gameId: "nim", numPlayers: 9 }).numPlayers).toBe(3);
  });

  it("lets only the host deal, and fills open seats with bots", async () => {
    const { db, host, friend, third } = await people();
    const rooms = new Rooms(db, games, { schedule: now });
    const { code } = rooms.create(host, { gameId: "nim", numPlayers: 3 });
    rooms.join(code, friend);
    expect(() => rooms.start(code, friend)).toThrow(/only the host/);
    const started = rooms.start(code, host);
    expect(started.status).toBe("playing");
    expect(started.seats.map((s) => s.kind)).toEqual(["player", "player", "bot"]);
    expect(started.state).toMatchObject({ pile: 12, toMove: 0 });
    // Once dealt, the seated keep their seats and nobody new sits down.
    expect(rooms.join(code, friend).you).toBe(1);
    expect(() => rooms.join(code, third)).toThrow(/already started/);
  });

  it("referees every move: whose turn, which turn, which moves", async () => {
    const { db, host, friend, third } = await people();
    const rooms = new Rooms(db, games, { schedule: now });
    const { code } = rooms.create(host, { gameId: "nim", numPlayers: 3 });
    rooms.join(code, friend);
    rooms.start(code, host);
    expect(() => rooms.move(code, friend, { turn: 0, move: 1 })).toThrow(/not your turn/);
    expect(() => rooms.move(code, third, { turn: 0, move: 1 })).toThrow(/no seat/);
    expect(() => rooms.move(code, host, { turn: 0, move: 4 })).toThrow(/not possible/);
    expect(() => rooms.move(code, host, { turn: 1, move: 1 })).toThrow(/out of date/);
    const after = rooms.move(code, host, { turn: 0, move: 2 });
    expect(after).toMatchObject({ turn: 1, state: { pile: 10, toMove: 1 } });
    expect(() => rooms.move(code, host, { turn: 0, move: 2 })).toThrow(/out of date/);
    // The friend moves; the bot in seat 2 answers at once, and it is the host's turn again.
    const round = rooms.move(code, friend, { turn: 1, move: 1 });
    expect(round.turn).toBe(3);
    expect((round.state as Nim).toMove).toBe(0);
    // Each seat reads the log its own way.
    expect(rooms.view(code, host).log[0]).toBe("takes 2 (seen by seat 0)");
    expect(rooms.view(code, friend).log[0]).toBe("takes 2");
    expect(rooms.view(code, third)).toMatchObject({ log: [], state: undefined });
  });

  it("plays to the end, deals again for the same players, and survives a restart", async () => {
    const { db, host, friend } = await people();
    const rooms = new Rooms(db, games, { schedule: now });
    const { code } = rooms.create(host, { gameId: "nim", numPlayers: 2, params: { pile: 5 } });
    rooms.join(code, friend);
    let view: RoomView = rooms.start(code, host);
    const seatOf = [host, friend];
    while (view.status === "playing") {
      const s = view.state as Nim;
      view = rooms.move(code, seatOf[s.toMove], { turn: view.turn, move: Math.min(3, s.pile) });
    }
    expect(view.status).toBe("over");
    expect(() => rooms.again(code, friend)).toThrow(/only the host/);
    const again = rooms.again(code, host);
    expect(again).toMatchObject({ status: "playing", turn: 0, log: [] });
    rooms.move(code, host, { turn: 0, move: 1 });

    // Another server on the same database picks the table up where it was.
    const reopened = new Rooms(db, games, { schedule: now }).view(code, host);
    expect(reopened).toMatchObject({ status: "playing", turn: 1, state: rooms.view(code, host).state });
  });

  it("tells whoever is watching about every change", async () => {
    const { db, host, friend } = await people();
    const rooms = new Rooms(db, games, { schedule: now });
    const { code } = rooms.create(host, { gameId: "nim", numPlayers: 2 });
    let heard = 0;
    const stop = rooms.subscribe(code, () => heard++);
    rooms.join(code, friend);
    rooms.start(code, host);
    stop();
    rooms.move(code, host, { turn: 0, move: 1 });
    expect(heard).toBe(2);
  });
});

describe("the play routes", () => {
  async function server() {
    const db = openDb(":memory:");
    const accounts = new Accounts(db);
    const app = new Hono();
    app.route("/api", playRoutes({ accounts, rooms: new Rooms(db, games, { schedule: now }), clientOf: () => "test" }));
    const send = async (path: string, init: { body?: unknown; cookie?: string; origin?: string; type?: string } = {}) => {
      const headers: Record<string, string> = { host: "localhost" };
      if (init.cookie) headers.cookie = init.cookie;
      if (init.origin) headers.origin = init.origin;
      if (init.body !== undefined) headers["content-type"] = init.type ?? "application/json";
      const res = await app.request(`http://localhost${path}`, { method: init.body === undefined ? "GET" : "POST", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
      return { res, json: (await res.json()) as Record<string, unknown> };
    };
    const signUp = async (name: string) => {
      const { res } = await send("/api/auth/signup", { body: { name, password: "long enough" } });
      return res.headers.get("set-cookie")!.split(";")[0];
    };
    return { send, signUp };
  }

  it("sign in with an http-only cookie and say who is signed in", async () => {
    const { send } = await server();
    const { res, json } = await send("/api/auth/signup", { body: { name: "Ada", password: "correct horse" } });
    expect(json.user).toMatchObject({ name: "Ada" });
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE}=`));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    const session = cookie.split(";")[0];
    expect((await send("/api/auth/me", { cookie: session })).json.user).toMatchObject({ name: "Ada" });
    expect((await send("/api/auth/me")).json.user).toBeNull();
    expect((await send("/api/auth/login", { body: { name: "Ada", password: "nope nope" } })).res.status).toBe(401);
    await send("/api/auth/logout", { body: {}, cookie: session });
    expect((await send("/api/auth/me", { cookie: session })).json.user).toBeNull();
  });

  it("refuse changes from other sites, and anything but JSON", async () => {
    const { send, signUp } = await server();
    const cookie = await signUp("Ada");
    expect((await send("/api/rooms", { body: { gameId: "nim" }, cookie, origin: "https://elsewhere.example" })).res.status).toBe(403);
    expect((await send("/api/rooms", { body: { gameId: "nim" }, cookie, type: "text/plain" })).res.status).toBe(415);
    expect((await send("/api/rooms", { body: { gameId: "nim" } })).res.status).toBe(401);
    expect((await send("/api/rooms", { body: { gameId: "nim" }, cookie, origin: "http://localhost" })).res.status).toBe(200);
    // The dev server's port is still this site.
    expect((await send("/api/rooms", { body: { gameId: "nim" }, cookie, origin: "http://localhost:5173" })).res.status).toBe(200);
    expect((await send("/api/rooms", { body: { gameId: "nim" }, cookie, origin: "http://localhost.evil.example" })).res.status).toBe(403);
  });

  it("run a table from the invite to the first moves", async () => {
    const { send, signUp } = await server();
    const host = await signUp("Ada");
    const friend = await signUp("Bao");
    const { json: opened } = await send("/api/rooms", { body: { gameId: "nim", numPlayers: 2 }, cookie: host });
    const code = opened.code as string;
    expect((await send(`/api/rooms/${code}`)).json).toMatchObject({ title: "Nim", host: "Ada", you: -1, status: "lobby" });
    expect((await send(`/api/rooms/${code}/join`, { body: {}, cookie: friend })).json.you).toBe(1);
    expect((await send(`/api/rooms/${code}/start`, { body: {}, cookie: friend })).res.status).toBe(403);
    expect((await send(`/api/rooms/${code}/start`, { body: {}, cookie: host })).json.status).toBe("playing");
    expect((await send(`/api/rooms/${code}/move`, { body: { turn: 0, move: 3 }, cookie: friend })).res.status).toBe(409);
    const { json: moved } = await send(`/api/rooms/${code}/move`, { body: { turn: 0, move: 3 }, cookie: host });
    expect(moved).toMatchObject({ turn: 1, state: { pile: 9 } });
    expect((await send("/api/rooms/zzzzzzzz")).res.status).toBe(404);
  });
});

it("account errors carry their HTTP status", () => {
  expect(new AccountError("x", 409).status).toBe(409);
});
