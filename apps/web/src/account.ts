import { useEffect, useSyncExternalStore } from "react";
import type { User } from "../../server/src/room-view";

/**
 * Who is signed in, for the whole page: the account button, the invite button and a shared table
 * read the same answer. The session itself is an http-only cookie the server sets, so the page
 * never holds a token; it only asks the server who it is.
 */

export type { User } from "../../server/src/room-view";

export interface Account {
  /** False until the server has answered. */
  ready: boolean;
  user: User | null;
  /** A new account needs a code mailed to its email (the server has SMTP, or prints codes locally). */
  codes?: boolean;
}

let account: Account = { ready: false, user: null };
let asked = false;
const listeners = new Set<() => void>();

function set(next: Account) {
  account = next;
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** POSTs JSON to the server and returns its JSON reply, or throws the error it gave. */
export async function postJson<T>(url: string, body: unknown = {}): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const reply = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw Object.assign(new Error(reply.error ?? res.statusText), { status: res.status });
  return reply;
}

/** The signed-in player, asked of the server the first time any part of the page wants to know. */
export function useAccount(): Account {
  useEffect(() => {
    if (asked) return;
    asked = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? (res.json() as Promise<{ user: User | null; codes?: boolean }>) : { user: null, codes: false }))
      .then(({ user, codes }) => set({ ready: true, user, codes: Boolean(codes) }))
      .catch(() => set({ ready: true, user: null }));
  }, []);
  return useSyncExternalStore(subscribe, () => account);
}

/**
 * Signs in with an email (or an older account's name), or makes an account with an email and the
 * name the table shows, and signs in; throws what the server objected to.
 */
export async function signIn(mode: "login" | "signup", fields: { email: string; password: string; name?: string; code?: string }): Promise<User> {
  const body =
    mode === "signup"
      ? { email: fields.email.trim(), password: fields.password, name: fields.name?.trim(), code: fields.code?.trim() }
      : { email: fields.email.trim(), password: fields.password };
  const { user } = await postJson<{ user: User }>(`/api/auth/${mode}`, body);
  set({ ...account, ready: true, user });
  return user;
}

/** Mails a six-digit code to the email a new account will sign in with. */
export async function sendCode(email: string): Promise<void> {
  await postJson("/api/auth/code", { email: email.trim() });
}

export async function signOut(): Promise<void> {
  await postJson("/api/auth/logout").catch(() => undefined);
  set({ ...account, ready: true, user: null });
}
