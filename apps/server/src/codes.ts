import { createHash, randomInt } from "node:crypto";
import nodemailer from "nodemailer";
import { AccountError } from "./accounts";
import type { Db } from "./db";

/**
 * A code mailed to an address before an account can sign in with it, so nobody makes an account
 * with someone else's email. Six digits, good for ten minutes and five tries; another can be asked
 * for after a minute, five an hour per address. Kept only as a hash of the address and the code.
 * The mail goes out over SMTP (smtpMailer: Gmail with an app password, or any provider's SMTP);
 * without SMTP a local server prints the code to its console (logMailer), and a public demo asks
 * for none.
 */

export const CODE_MINUTES = 10;
export const CODE_TRIES = 5;
export const RESEND_SECONDS = 60;
export const SENDS_PER_HOUR = 5;

export interface Mailer {
  send(to: string, subject: string, text: string): Promise<void>;
}

export interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  /** The sender, as "BoardDream <someone@example.com>"; the SMTP user when not set. */
  from?: string;
}

/** Mail over SMTP: port 465 speaks TLS from the start, others upgrade with STARTTLS. */
export function smtpMailer(settings: SmtpSettings): Mailer {
  const transport = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.port === 465,
    auth: { user: settings.user, pass: settings.pass },
  });
  return {
    async send(to, subject, text) {
      await transport.sendMail({ from: settings.from || settings.user, to, subject, text });
    },
  };
}

/** For a local server with no SMTP: the mail is printed to its console. */
export const logMailer: Mailer = {
  async send(to, subject, text) {
    console.log(`[mail] to ${to}: ${subject}\n${text}`);
  },
};

const hash = (email: string, code: string) => createHash("sha256").update(`${email}\n${code}`).digest("hex");

interface Row {
  hash: string;
  expires_at: number;
  tries: number;
  sends: string;
}

export class EmailCodes {
  constructor(
    private readonly db: Db,
    private readonly mailer: Mailer,
    private readonly now: () => number = Date.now,
    private readonly draw: () => string = () => String(randomInt(0, 1_000_000)).padStart(6, "0"),
  ) {}

  /** Mails a new code to `email` (already checked and lowercased), replacing any before it. */
  async send(email: string): Promise<void> {
    const row = this.db.prepare("SELECT hash, expires_at, tries, sends FROM email_codes WHERE email = ?").get(email) as Row | undefined;
    const now = this.now();
    const sends = (row ? (JSON.parse(row.sends) as number[]) : []).filter((t) => now - t < 3_600_000);
    const last = sends.at(-1);
    if (last !== undefined && now - last < RESEND_SECONDS * 1000) {
      throw new AccountError(`a code was just sent: ask again in ${Math.ceil((RESEND_SECONDS * 1000 - (now - last)) / 1000)} seconds`, 429);
    }
    if (sends.length >= SENDS_PER_HOUR) throw new AccountError("too many codes for that email this hour: try again later", 429);
    const code = this.draw();
    await this.mailer.send(
      email,
      `Your BoardDream code: ${code}`,
      `Your code to make a BoardDream account is ${code}.\n\nIt works for ${CODE_MINUTES} minutes. If you did not ask for it, you can ignore this mail.`,
    );
    this.db
      .prepare("INSERT OR REPLACE INTO email_codes (email, hash, expires_at, tries, sends) VALUES (?, ?, ?, 0, ?)")
      .run(email, hash(email, code), now + CODE_MINUTES * 60_000, JSON.stringify([...sends, now]));
  }

  /** Checks a code for `email`; a right one is used up. Throws what is wrong, in words for the player. */
  check(email: string, code: unknown): void {
    const row = this.db.prepare("SELECT hash, expires_at, tries, sends FROM email_codes WHERE email = ?").get(email) as Row | undefined;
    if (!row || row.hash === "") throw new AccountError("ask for a code first");
    if (this.now() > row.expires_at) throw new AccountError("that code has expired: ask for a new one");
    if (row.tries >= CODE_TRIES) throw new AccountError("too many wrong codes: ask for a new one");
    const typed = typeof code === "string" ? code.replace(/\s/g, "") : "";
    if (!/^\d{6}$/.test(typed) || hash(email, typed) !== row.hash) {
      this.db.prepare("UPDATE email_codes SET tries = tries + 1 WHERE email = ?").run(email);
      throw new AccountError("that code is not right");
    }
    // Used up, but the record of sends stays for the hourly limit.
    this.db.prepare("UPDATE email_codes SET hash = '', expires_at = 0 WHERE email = ?").run(email);
  }
}
