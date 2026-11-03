import { mkdirSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

/**
 * The server's own records: accounts, sessions and the tables friends share. One SQLite file under
 * data/ (Node's built-in driver, so nothing to install), or ":memory:" for tests. Generated games
 * stay as files in data/games; this holds only what changes as people play.
 */
export type Db = DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  email TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_by_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS email_codes (
  email TEXT PRIMARY KEY,
  hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  tries INTEGER NOT NULL,
  sends TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rooms (
  code TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

const DEFAULT_FILE = new URL("../../../data/boarddream.db", import.meta.url);

export function openDb(where: URL | ":memory:" = DEFAULT_FILE): Db {
  if (where !== ":memory:") mkdirSync(new URL(".", where), { recursive: true });
  const db = new DatabaseSync(where === ":memory:" ? ":memory:" : fileURLToPath(where));
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 2000;");
  db.exec(SCHEMA);
  // Accounts made before sign-in took an email have none: the column is added to older files.
  const columns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
  if (!columns.some((c) => c.name === "email")) db.exec("ALTER TABLE users ADD COLUMN email TEXT");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS users_by_email ON users(email COLLATE NOCASE)");
  return db;
}
