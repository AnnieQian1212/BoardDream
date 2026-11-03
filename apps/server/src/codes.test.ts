import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { Accounts } from "./accounts";
import { CODE_TRIES, EmailCodes, RESEND_SECONDS, SENDS_PER_HOUR, type Mailer } from "./codes";
import { openDb } from "./db";
import { playRoutes } from "./play";
import { Rooms } from "./rooms";

/** A mailbox in memory: every mail sent, and the last code in it. */
function mailbox() {
  const mails: { to: string; subject: string; text: string }[] = [];
  const mailer: Mailer = {
    async send(to, subject, text) {
      mails.push({ to, subject, text });
    },
  };
  const lastCode = () => /\b(\d{6})\b/.exec(mails.at(-1)?.text ?? "")?.[1] ?? "";
  return { mails, mailer, lastCode };
}

describe("the code mailed before an email makes an account", () => {
  const setup = () => {
    let clock = 1_000_000;
    const box = mailbox();
    const codes = new EmailCodes(openDb(":memory:"), box.mailer, () => clock);
    return { codes, box, tick: (seconds: number) => (clock += seconds * 1000) };
  };

  it("is mailed, checked once, and used up", async () => {
    const { codes, box } = setup();
    await codes.send("ada@example.com");
    expect(box.mails).toHaveLength(1);
    expect(box.mails[0].to).toBe("ada@example.com");
    expect(box.lastCode()).toMatch(/^\d{6}$/);
    expect(() => codes.check("ada@example.com", box.lastCode())).not.toThrow();
    // Used up.
    expect(() => codes.check("ada@example.com", box.lastCode())).toThrow(/ask for a code first/);
  });

  it("refuses a wrong code, then every code after too many tries", async () => {
    const { codes, box } = setup();
    await codes.send("ada@example.com");
    const right = box.lastCode();
    const wrong = right === "000000" ? "111111" : "000000";
    for (let i = 0; i < CODE_TRIES; i++) expect(() => codes.check("ada@example.com", wrong)).toThrow(/not right/);
    expect(() => codes.check("ada@example.com", right)).toThrow(/too many wrong codes/);
  });

  it("takes spaces in a typed code, but not a code for another address", async () => {
    const { codes, box } = setup();
    await codes.send("ada@example.com");
    expect(() => codes.check("bao@example.com", box.lastCode())).toThrow(/ask for a code first/);
    const code = box.lastCode();
    expect(() => codes.check("ada@example.com", `${code.slice(0, 3)} ${code.slice(3)}`)).not.toThrow();
  });

  it("expires after ten minutes", async () => {
    const { codes, box, tick } = setup();
    await codes.send("ada@example.com");
    tick(10 * 60 + 1);
    expect(() => codes.check("ada@example.com", box.lastCode())).toThrow(/expired/);
  });

  it("waits a minute between codes and sends at most five an hour, and the newest code is the one that works", async () => {
    const { codes, box, tick } = setup();
    await codes.send("ada@example.com");
    const first = box.lastCode();
    await expect(codes.send("ada@example.com")).rejects.toMatchObject({ status: 429 });
    tick(RESEND_SECONDS);
    await codes.send("ada@example.com");
    if (first !== box.lastCode()) expect(() => codes.check("ada@example.com", first)).toThrow(/not right/);
    for (let i = 2; i < SENDS_PER_HOUR; i++) {
      tick(RESEND_SECONDS);
      await codes.send("ada@example.com");
    }
    tick(RESEND_SECONDS);
    await expect(codes.send("ada@example.com")).rejects.toThrow(/this hour/);
    tick(3600);
    await expect(codes.send("ada@example.com")).resolves.toBeUndefined();
    // Never stored as the code itself.
    expect(box.mails).toHaveLength(SENDS_PER_HOUR + 1);
  });

  it("keeps no code when the mail could not be sent", async () => {
    const codes = new EmailCodes(openDb(":memory:"), { send: async () => Promise.reject(new Error("SMTP down")) });
    await expect(codes.send("ada@example.com")).rejects.toThrow(/SMTP down/);
    expect(() => codes.check("ada@example.com", "123456")).toThrow(/ask for a code first/);
  });
});

describe("signing up with a code, over HTTP", () => {
  async function server(withCodes: boolean) {
    const db = openDb(":memory:");
    const box = mailbox();
    const app = new Hono();
    app.route(
      "/api",
      playRoutes({
        accounts: new Accounts(db),
        rooms: new Rooms(db, () => undefined),
        clientOf: () => "test",
        codes: withCodes ? new EmailCodes(db, box.mailer) : undefined,
      }),
    );
    const send = async (path: string, body?: unknown) => {
      const res = await app.request(`http://localhost${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { host: "localhost", ...(body === undefined ? {} : { "content-type": "application/json" }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: res.status, json: (await res.json()) as Record<string, unknown> };
    };
    return { send, box };
  }
  const ada = { email: "Ada@Example.com", name: "Ada", password: "correct horse" };

  it("says whether sign-up takes a code, and takes none without one set", async () => {
    const plain = await server(false);
    expect((await plain.send("/api/auth/me")).json.codes).toBe(false);
    expect((await plain.send("/api/auth/signup", ada)).status).toBe(200);
    expect((await plain.send("/api/auth/code", { email: "bao@example.com" })).status).toBe(400);
  });

  it("makes the account only with the code mailed to its email", async () => {
    const { send, box } = await server(true);
    expect((await send("/api/auth/me")).json.codes).toBe(true);
    expect((await send("/api/auth/signup", ada)).json.error).toBe("ask for a code first");
    expect((await send("/api/auth/code", { email: ada.email })).json).toEqual({ sent: true });
    expect(box.mails[0].to).toBe("ada@example.com");
    expect((await send("/api/auth/signup", { ...ada, code: "12345" })).json.error).toBe("that code is not right");
    const made = await send("/api/auth/signup", { ...ada, code: box.lastCode() });
    expect(made.status).toBe(200);
    expect(made.json.user).toMatchObject({ name: "Ada" });
    // An email with an account gets no more codes.
    expect((await send("/api/auth/code", { email: "ada@example.com" })).status).toBe(409);
  });

  it("checks the name and password before a code is spent", async () => {
    const { send, box } = await server(true);
    await send("/api/auth/code", { email: ada.email });
    expect((await send("/api/auth/signup", { ...ada, password: "short", code: box.lastCode() })).json.error).toMatch(/at least 8/);
    // The code still works once the password is fixed.
    expect((await send("/api/auth/signup", { ...ada, code: box.lastCode() })).status).toBe(200);
  });
});
