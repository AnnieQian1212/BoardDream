import { LogIn, LogOut, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { sendCode, signIn, signOut, useAccount, type User } from "../account";
import { useEscape } from "../escape";
import { Tip } from "./Tip";

/**
 * Signing in: an email and a password; a new account also picks the name the table shows. One form
 * both signs in and makes an account, so a friend who followed an invite link is a few keystrokes
 * from their seat. No mail is sent: the email is only how its owner signs in.
 */
export function SignInDialog({ reason, onDone, onClose }: { reason?: string; onDone(user: User): void; onClose(): void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const { codes } = useAccount();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  /** Where the last code went, and when another can be asked for. */
  const [sent, setSent] = useState<{ to: string; again: number }>();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!sent) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [sent]);
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  useEscape(onClose);
  useEffect(() => first.current?.focus(), []);

  /** Mails a code to the email typed, for a new account on a server that asks for one. */
  async function mailCode() {
    setBusy(true);
    setProblem(undefined);
    try {
      await sendCode(email);
      setSent({ to: email.trim(), again: Date.now() + 60_000 });
      setCode("");
    } catch (err) {
      setProblem(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    // A new account on a server that mails codes asks for one first.
    if (mode === "signup" && codes && sent?.to !== email.trim()) return mailCode();
    setBusy(true);
    setProblem(undefined);
    try {
      onDone(await signIn(mode, { email, password, name, code }));
    } catch (err) {
      setProblem(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const signingUp = mode === "signup";
  return (
    <div className="modal" role="presentation" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="account-card" role="dialog" aria-modal="true" aria-labelledby="account-title" onSubmit={submit}>
        <button type="button" className="ghost icon-only account-close" onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        <h2 id="account-title">{signingUp ? "Make an account" : "Sign in"}</h2>
        {reason && <p className="account-why">{reason}</p>}
        <label className="account-field">
          <span className="account-label">
            Email
            {signingUp && (
              <Tip label="What your email is for">
                Friends never see your email.{" "}
                {codes ? "We mail one code to check it is yours; nothing else is sent." : "No mail is sent: it is only how you sign in."}
              </Tip>
            )}
          </span>
          {/* Text, not an email field: an account made before emails signs in with its name here. */}
          <input
            ref={first}
            type={signingUp ? "email" : "text"}
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete={signingUp ? "email" : "username"}
            maxLength={254}
            required
          />
        </label>
        {signingUp && (
          <label className="account-field">
            <span className="account-label">
              Name at the table
              <Tip label="Who sees your name">Friends see this name at your table.</Tip>
            </span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="nickname" maxLength={24} required />
          </label>
        )}
        <label className="account-field">
          <span className="account-label">
            Password
            {signingUp && <Tip label="Password length">At least 8 characters.</Tip>}
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={signingUp ? "new-password" : "current-password"}
            minLength={signingUp ? 8 : undefined}
            maxLength={200}
            required
          />
        </label>
        {signingUp && codes && sent?.to === email.trim() && (
          <label className="account-field">
            <span>Code from your email</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6 digits"
              required
            />
          </label>
        )}
        {signingUp && codes && sent?.to === email.trim() && (
          <p className="account-note">
            We sent a code to {sent.to}. It works for 10 minutes; look in spam if it has not come.{" "}
            {now < sent.again ? (
              <span>Another in {Math.ceil((sent.again - now) / 1000)} s.</span>
            ) : (
              <button type="button" className="link" onClick={() => void mailCode()} disabled={busy}>
                Send another
              </button>
            )}
          </p>
        )}
        {problem && (
          <p className="account-problem" role="alert">
            {problem.charAt(0).toUpperCase() + problem.slice(1)}.
          </p>
        )}
        <button type="submit" className="action account-go" disabled={busy}>
          {busy ? "One moment…" : signingUp ? (codes && sent?.to !== email.trim() ? "Send me a code" : "Make my account") : "Sign in"}
        </button>
        <button
          type="button"
          className="link account-switch"
          onClick={() => {
            setMode(signingUp ? "login" : "signup");
            setProblem(undefined);
          }}
        >
          {signingUp ? "I have an account: sign in" : "New here? Make an account"}
        </button>
      </form>
    </div>
  );
}

/** The top bar's account corner: Sign in, or the player's name with Sign out under it. */
export function AccountButton() {
  const { ready, user } = useAccount();
  const [dialog, setDialog] = useState(false);
  const [menu, setMenu] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEscape(() => setMenu(false), menu);
  useEffect(() => {
    if (!menu) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setMenu(false);
    };
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [menu]);
  if (!ready) return null;
  if (!user) {
    return (
      <>
        <button type="button" className="quiet" onClick={() => setDialog(true)} aria-label="Sign in">
          <LogIn size={16} /> <span className="btn-label">Sign in</span>
        </button>
        {dialog && <SignInDialog onDone={() => setDialog(false)} onClose={() => setDialog(false)} />}
      </>
    );
  }
  return (
    <div className="more" ref={root}>
      <button type="button" className={["quiet", "account-me", menu && "on"].filter(Boolean).join(" ")} onClick={() => setMenu(!menu)} aria-haspopup="menu" aria-expanded={menu} aria-label={`Signed in as ${user.name}`}>
        <Avatar name={user.name} /> <span className="btn-label">{user.name}</span>
      </button>
      {menu && (
        <div className="menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenu(false);
              void signOut();
            }}
          >
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </div>
      )}
    </div>
  );
}

/** A round badge with the name's first letter. */
export function Avatar({ name, color }: { name: string; color?: string }) {
  return (
    <span className="avatar" style={color ? { background: color } : undefined} aria-hidden="true">
      {[...name][0]?.toUpperCase()}
    </span>
  );
}
