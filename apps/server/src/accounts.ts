import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import type { Db } from "./db";
import type { User } from "./room-view";

export type { User } from "./room-view";

/**
 * Accounts so friends can share a table: a name and a password, nothing else (no email, nothing to
 * configure). Passwords are kept as scrypt hashes with their own salt; a session is a random token
 * in an http-only cookie, kept here only as its SHA-256, so a copy of the database signs nobody in.
 */

/** Why a sign-up or sign-in was refused, in words for the player. */
export class AccountError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 409 = 400,
  ) {
    super(message);
  }
}

export const SESSION_DAYS = 30;
const SESSION_MS = SESSION_DAYS * 86_400_000;

/** Letters of any script, digits, and _ . - : a name that reads well and is easy to type. */
const NAME = /^[\p{L}\p{N}_.-]{2,24}$/u;

export function nameProblem(name: unknown): string | undefined {
  if (typeof name !== "string" || !NAME.test(name)) return "a name is 2 to 24 letters, digits, dots, dashes or underscores";
  return undefined;
}

export function passwordProblem(password: unknown): string | undefined {
  if (typeof password !== "string" || password.length < 8) return "a password needs at least 8 characters";
  if (password.length > 200) return "a password can be at most 200 characters";
  return undefined;
}

// scrypt at N = 2^15 takes about 50-100 ms and 32 MB, which slows guessing without slowing sign-in.
const COST = { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } satisfies ScryptOptions;
const KEY_BYTES = 32;

const derive = (password: string, salt: Buffer, options: ScryptOptions) =>
  new Promise<Buffer>((resolve, reject) => scrypt(password.normalize("NFKC"), salt, KEY_BYTES, options, (err, key) => (err ? reject(err) : resolve(key))));

/** "scrypt$N$r$p$salt$key", with salt and key in base64url. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, COST);
  return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, n, r, p, salt, key] = stored.split("$");
  if (kind !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64url");
  const actual = await derive(password, Buffer.from(salt, "base64url"), { N: Number(n), r: Number(r), p: Number(p), maxmem: COST.maxmem });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const digest = (token: string) => createHash("sha256").update(token).digest("hex");

/** Hashed against when a name is unknown, so a wrong name takes as long as a wrong password. */
let decoy: Promise<string> | undefined;

export class Accounts {
  constructor(
    private readonly db: Db,
    private readonly now: () => number = Date.now,
  ) {}

  async signUp(name: unknown, password: unknown): Promise<User> {
    const problem = nameProblem(name) ?? passwordProblem(password);
    if (problem) throw new AccountError(problem);
    const user = { id: randomUUID(), name: name as string };
    const hash = await hashPassword(password as string);
    try {
      this.db.prepare("INSERT INTO users (id, name, password, created_at) VALUES (?, ?, ?, ?)").run(user.id, user.name, hash, this.now());
    } catch (err) {
      if (String(err).includes("UNIQUE")) throw new AccountError("that name is taken", 409);
      throw err;
    }
    return user;
  }

  async logIn(name: unknown, password: unknown): Promise<User> {
    const row =
      typeof name === "string" && name.length <= 24
        ? (this.db.prepare("SELECT id, name, password FROM users WHERE name = ?").get(name) as { id: string; name: string; password: string } | undefined)
        : undefined;
    const given = typeof password === "string" ? password.slice(0, 200) : "";
    if (!row) {
      decoy ??= hashPassword("not anyone's password");
      await verifyPassword(given, await decoy);
      throw new AccountError("wrong name or password", 401);
    }
    if (!(await verifyPassword(given, row.password))) throw new AccountError("wrong name or password", 401);
    return { id: row.id, name: row.name };
  }

  /** A new session for the user: the token for their cookie. */
  startSession(userId: string): string {
    const token = randomBytes(32).toString("base64url");
    this.db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(digest(token), userId, this.now() + SESSION_MS);
    // Sweep expired sessions now and then, so the table stays small.
    if (Math.random() < 0.02) this.db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(this.now());
    return token;
  }

  /** Who a session token belongs to, while it lasts. */
  userFor(token: string | undefined): User | undefined {
    if (!token || token.length > 100) return undefined;
    const row = this.db
      .prepare("SELECT users.id AS id, users.name AS name FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token = ? AND sessions.expires_at > ?")
      .get(digest(token), this.now()) as User | undefined;
    return row && { id: row.id, name: row.name };
  }

  endSession(token: string | undefined): void {
    if (token) this.db.prepare("DELETE FROM sessions WHERE token = ?").run(digest(token));
  }

  byId(id: string): User | undefined {
    const row = this.db.prepare("SELECT id, name FROM users WHERE id = ?").get(id) as User | undefined;
    return row && { id: row.id, name: row.name };
  }
}
