import { randomInt } from "node:crypto";
import { createRng, resolveParams, type GameModule, type Params } from "@boarddream/engine";
import { defaultBot } from "@boarddream/library";
import type { Db } from "./db";
import type { RoomStatus, RoomView, SeatKind, User } from "./room-view";

export type { RoomStatus, RoomView, SeatKind } from "./room-view";

/**
 * Tables friends share. A player opens one for a game, sends the link, and friends sign in and sit
 * down; seats nobody takes are played by bots. The server is the referee: it holds the game,
 * checks every move against the rules (only the seat to act, only a legal move, only on the turn
 * the player saw), plays the bots, and keeps each table in the database, so a restart loses
 * nothing.
 *
 * Every seated player receives the whole game state, as on a table at home: what the table shows
 * each seat is already hidden by the game's panels and geometry, but someone who opens the
 * browser's developer tools could read a rival's hidden cards. It is a table for friends.
 */

export interface Seat {
  kind: SeatKind;
  userId?: string;
  name?: string;
}

/** A move as each seat reads it. */
interface LogEntry {
  seat: number;
  text: string[];
}

interface Room {
  code: string;
  gameId: string;
  title: string;
  hostId: string;
  numPlayers: number;
  params: Params;
  seats: Seat[];
  status: RoomStatus;
  version: number;
  deal: number;
  seed: number;
  /** Moves made so far. A move names the turn its player saw, so a stale or repeated click is refused. */
  turn: number;
  state?: unknown;
  log: LogEntry[];
  createdAt: number;
  updatedAt: number;
}

export class RoomError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409 | 410 | 500 = 400,
  ) {
    super(message);
  }
}

const LOG_LIMIT = 60;
/** Tables untouched for this long are forgotten. */
const KEEP_MS = 14 * 86_400_000;
/** Easy to read aloud: no 0/o, 1/l/i. */
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CODE = /^[a-z2-9]{8}$/;

export interface RoomOptions {
  /** How long a bot waits before moving, so people can follow the play. */
  botDelayMs?: number;
  /** Runs a bot's move later; returns a cancel. Tests pass one that runs at once. */
  schedule?: (run: () => void, ms: number) => () => void;
  now?: () => number;
}

const later = (run: () => void, ms: number) => {
  const timer = setTimeout(run, ms);
  return () => clearTimeout(timer);
};

export class Rooms {
  private readonly cache = new Map<string, Room>();
  private readonly listeners = new Map<string, Set<() => void>>();
  private readonly pending = new Map<string, () => void>();
  private readonly botDelayMs: number;
  private readonly schedule: NonNullable<RoomOptions["schedule"]>;
  private readonly now: () => number;

  constructor(
    private readonly db: Db,
    /** The game a table plays, by id: a library game or a saved one. */
    private readonly games: (id: string) => GameModule | undefined,
    opts: RoomOptions = {},
  ) {
    this.botDelayMs = opts.botDelayMs ?? 900;
    this.schedule = opts.schedule ?? later;
    this.now = opts.now ?? Date.now;
  }

  /** Opens a table for a game with the host in the first seat. */
  create(host: User, request: { gameId: unknown; numPlayers?: unknown; params?: unknown }): RoomView {
    const gameId = typeof request.gameId === "string" ? request.gameId : "";
    const game = gameId ? this.games(gameId) : undefined;
    if (!game) throw new RoomError("no such game", 404);
    const { minPlayers, maxPlayers } = game.meta;
    const asked = typeof request.numPlayers === "number" && Number.isFinite(request.numPlayers) ? Math.round(request.numPlayers) : Math.min(maxPlayers, Math.max(minPlayers, 3));
    const numPlayers = Math.min(maxPlayers, Math.max(minPlayers, asked));
    const params = resolveParams(game.params, request.params && typeof request.params === "object" ? (request.params as Params) : {});
    const seats: Seat[] = Array.from({ length: numPlayers }, (_, i) => (i === 0 ? { kind: "player", userId: host.id, name: host.name } : { kind: "open" }));
    const room: Room = {
      code: this.freshCode(),
      gameId,
      title: game.meta.name,
      hostId: host.id,
      numPlayers,
      params,
      seats,
      status: "lobby",
      version: 0,
      deal: 0,
      seed: randomInt(2 ** 31),
      turn: 0,
      log: [],
      createdAt: this.now(),
      updatedAt: this.now(),
    };
    this.db.prepare("DELETE FROM rooms WHERE updated_at < ?").run(this.now() - KEEP_MS);
    this.save(room);
    return this.viewOf(room, host);
  }

  view(code: string, viewer: User | undefined): RoomView {
    return this.viewOf(this.load(code), viewer);
  }

  /** Takes the first open seat, before the game starts. Joining again changes nothing. */
  join(code: string, user: User): RoomView {
    const room = this.load(code);
    if (room.seats.some((s) => s.userId === user.id)) return this.viewOf(room, user);
    if (room.status !== "lobby") throw new RoomError("this game has already started", 409);
    const open = room.seats.findIndex((s) => s.kind === "open");
    if (open < 0) throw new RoomError("every seat is taken", 409);
    room.seats[open] = { kind: "player", userId: user.id, name: user.name };
    this.changed(room);
    return this.viewOf(room, user);
  }

  /** Gives a seat back before the game starts. The host stays with their table. */
  leave(code: string, user: User): RoomView {
    const room = this.load(code);
    if (room.status !== "lobby") throw new RoomError("the game has started", 409);
    if (room.hostId === user.id) throw new RoomError("the host keeps their seat", 403);
    const seat = room.seats.findIndex((s) => s.userId === user.id);
    if (seat >= 0) {
      room.seats[seat] = { kind: "open" };
      this.changed(room);
    }
    return this.viewOf(room, user);
  }

  /** The host deals: open seats go to bots and the first turn begins. */
  start(code: string, user: User): RoomView {
    const room = this.load(code);
    if (room.hostId !== user.id) throw new RoomError("only the host can start the game", 403);
    if (room.status !== "lobby") throw new RoomError("the game has already started", 409);
    room.seats = room.seats.map((s) => (s.kind === "open" ? { kind: "bot", name: "Bot" } : s));
    this.deal(room);
    return this.viewOf(room, user);
  }

  /** The host deals a new game at the same table, with the same players. */
  again(code: string, user: User): RoomView {
    const room = this.load(code);
    if (room.hostId !== user.id) throw new RoomError("only the host can deal again", 403);
    if (room.status !== "over") throw new RoomError("the game is still going", 409);
    room.seed = randomInt(2 ** 31);
    this.deal(room);
    return this.viewOf(room, user);
  }

  /** A seated player's move, on the turn they saw. */
  move(code: string, user: User, request: { turn: unknown; move: unknown }): RoomView {
    const room = this.load(code);
    if (room.status !== "playing") throw new RoomError("the game is not being played", 409);
    const seat = room.seats.findIndex((s) => s.userId === user.id);
    if (seat < 0) throw new RoomError("you have no seat at this table", 403);
    if (request.turn !== room.turn) throw new RoomError("the table has moved on; your view was out of date", 409);
    const game = this.gameOf(room);
    const [active] = game.activePlayers(room.state);
    if (active !== seat) throw new RoomError("it is not your turn", 409);
    const key = JSON.stringify(request.move);
    const legal = game.legalMoves(room.state, seat).find((m) => JSON.stringify(m) === key);
    if (legal === undefined) throw new RoomError("that move is not possible now", 409);
    this.apply(room, game, seat, legal);
    return this.viewOf(room, user);
  }

  /** Calls `listener` whenever the table changes. Returns the unsubscribe. */
  subscribe(code: string, listener: () => void): () => void {
    const set = this.listeners.get(code) ?? new Set();
    set.add(listener);
    this.listeners.set(code, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(code);
    };
  }

  private deal(room: Room) {
    const game = this.gameOf(room);
    room.state = game.setup({ numPlayers: room.numPlayers, params: room.params, rng: createRng(room.seed) });
    room.deal++;
    room.turn = 0;
    room.log = [];
    room.status = game.isTerminal(room.state) ? "over" : "playing";
    this.changed(room);
  }

  private apply(room: Room, game: GameModule, seat: number, move: unknown) {
    // Each move draws from its own seeded stream, so a table reloaded from the database plays on
    // exactly as it would have.
    const rng = createRng((room.seed + Math.imul(room.turn + 1, 0x9e3779b1)) >>> 0);
    let next: unknown;
    let text: string[];
    try {
      text = room.seats.map((_, viewer) => game.describeMove?.(room.state, move, viewer) ?? JSON.stringify(move));
      next = game.applyMove(room.state, seat, move, rng);
    } catch (err) {
      throw new RoomError(`the rules failed on that move: ${err instanceof Error ? err.message : String(err)}`, 500);
    }
    room.state = next;
    room.turn++;
    room.log = [...room.log, { seat, text }].slice(-LOG_LIMIT);
    if (game.isTerminal(next)) room.status = "over";
    this.changed(room);
  }

  /** Saves the table, tells everyone watching, and lets a bot move if it is a bot's turn. */
  private changed(room: Room) {
    room.version++;
    room.updatedAt = this.now();
    this.save(room);
    for (const listener of this.listeners.get(room.code) ?? []) listener();
    this.wakeBots(room);
  }

  private wakeBots(room: Room) {
    this.pending.get(room.code)?.();
    this.pending.delete(room.code);
    if (room.status !== "playing") return;
    const game = this.gameOf(room);
    const [active] = game.activePlayers(room.state);
    if (active === undefined || room.seats[active]?.kind !== "bot") return;
    const turn = room.turn;
    const cancel = this.schedule(() => {
      this.pending.delete(room.code);
      // Someone else may have moved meanwhile (a restart, a repeated wake-up).
      if (room.turn !== turn || room.status !== "playing") return;
      const moves = game.legalMoves(room.state, active);
      const rng = createRng((room.seed ^ Math.imul(turn + 7, 0x85ebca6b)) >>> 0);
      let move: unknown;
      try {
        move = defaultBot(game)({ game, state: room.state, player: active, moves, rng });
      } catch {
        move = moves[0];
      }
      try {
        this.apply(room, game, active, move);
      } catch (err) {
        console.warn(`[rooms] ${room.code}: a bot's move failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }, this.botDelayMs);
    this.pending.set(room.code, cancel);
  }

  private viewOf(room: Room, viewer: User | undefined): RoomView {
    const you = viewer ? room.seats.findIndex((s) => s.userId === viewer.id) : -1;
    const host = room.seats.find((s) => s.userId === room.hostId)?.name ?? "the host";
    return {
      code: room.code,
      gameId: room.gameId,
      title: room.title,
      host,
      isHost: viewer?.id === room.hostId,
      you,
      numPlayers: room.numPlayers,
      params: room.params,
      seats: room.seats.map((s) => ({ kind: s.kind, name: s.name })),
      status: room.status,
      version: room.version,
      deal: room.deal,
      turn: room.turn,
      state: you >= 0 && room.status !== "lobby" ? room.state : undefined,
      log: you >= 0 ? room.log.map((entry) => entry.text[you] ?? "") : [],
    };
  }

  private gameOf(room: Room): GameModule {
    const game = this.games(room.gameId);
    if (!game) throw new RoomError("this table's game is no longer here", 410);
    return game;
  }

  private load(code: string): Room {
    const key = typeof code === "string" ? code.toLowerCase() : "";
    if (!CODE.test(key)) throw new RoomError("no such table", 404);
    const cached = this.cache.get(key);
    if (cached) return cached;
    const row = this.db.prepare("SELECT data FROM rooms WHERE code = ?").get(key) as { data: string } | undefined;
    if (!row) throw new RoomError("no such table", 404);
    const room = JSON.parse(row.data) as Room;
    this.cache.set(key, room);
    // A bot whose turn it was when the server stopped plays on.
    if (room.status === "playing" && this.games(room.gameId)) this.wakeBots(room);
    return room;
  }

  private save(room: Room) {
    this.cache.set(room.code, room);
    this.db.prepare("INSERT OR REPLACE INTO rooms (code, data, updated_at) VALUES (?, ?, ?)").run(room.code, JSON.stringify(room), room.updatedAt);
  }

  private freshCode(): string {
    for (;;) {
      const code = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
      if (!this.db.prepare("SELECT 1 FROM rooms WHERE code = ?").get(code)) return code;
    }
  }
}
