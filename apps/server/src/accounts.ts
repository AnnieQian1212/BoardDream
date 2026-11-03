import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";
import type { Db } from "./db";
import type { User } from "./room-view";

export type { User } from "./room-view";

/**
 * Accounts so friends can share a table: an email and a password to sign in, and a name the table
 * shows. The email is only how its owner signs in: no mail is sent, and no other player sees it.
 * Accounts made before emails sign in with their name. Passwords are kept as scrypt hashes with
 * their own salt; a session is a random token in an http-only cookie, kept here only as its
 * SHA-256, so a copy of the database signs nobody in.
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

/** Something@somewhere.tld, as typed (spaces round it trimmed). */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailProblem(email: unknown): string | undefined {
  if (typeof email !== "string" || email.trim().length > 254 || !EMAIL.test(email.trim())) return "that does not look like an email address";
  return undefined;
}

/** One spelling per address, so Ada@Example.com and ada@example.com are one account. */
const normalEmail = (email: string) => email.trim().toLowerCase();

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

/** Hashed against when an email is unknown, so a wrong email takes as long as a wrong password. */
let decoy: Promise<string> | undefined;

export class Accounts {
  constructor(
    private readonly db: Db,
    private readonly now: () => number = Date.now,
  ) {}

  /** A new account: the email it signs in with, its password, and the name the table shows. */
  async signUp({ email, password, name }: { email: unknown; password: unknown; name: unknown }): Promise<User> {
    const problem = emailProblem(email) ?? nameProblem(name) ?? passwordProblem(password);
    if (problem) throw new AccountError(problem);
    const user = { id: randomUUID(), name: name as string };
    const hash = await hashPassword(password as string);
    try {
      this.db
        .prepare("INSERT INTO users (id, name, email, password, created_at) VALUES (?, ?, ?, ?, ?)")
        .run(user.id, user.name, normalEmail(email as string), hash, this.now());
    } catch (err) {
      if (String(err).includes("users.email")) throw new AccountError("an account already signs in with that email", 409);
      if (String(err).includes("UNIQUE")) throw new AccountError("that name is taken", 409);
      throw err;
    }
    return user;
  }

  /** Signs in with an email, or with its name an account made before emails. */
  async logIn(login: unknown, password: unknown): Promise<User> {
    const typed = typeof login === "string" ? login.trim() : "";
    type Row = { id: string; name: string; password: string };
    const row = typed.includes("@")
      ? typed.length <= 254
        ? (this.db.prepare("SELECT id, name, password FROM users WHERE email = ?").get(normalEmail(typed)) as Row | undefined)
        : undefined
      : typed && typed.length <= 24
        ? (this.db.prepare("SELECT id, name, password FROM users WHERE name = ? AND email IS NULL").get(typed) as Row | undefined)
        : undefined;
    const given = typeof password === "string" ? password.slice(0, 200) : "";
    if (!row) {
      decoy ??= hashPassword("not anyone's password");
      await verifyPassword(given, await decoy);
      throw new AccountError("wrong email or password", 401);
    }
    if (!(await verifyPassword(given, row.password))) throw new AccountError("wrong email or password", 401);
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
