import { LogIn, LogOut } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { signIn, signOut, useAccount, type User } from "../account";
import { useEscape } from "../escape";

/**
 * Signing in: a name and a password, nothing else. One form both signs in and makes an account,
 * so a friend who followed an invite link is a few keystrokes from their seat.
 */
export function SignInDialog({ reason, onDone, onClose }: { reason?: string; onDone(user: User): void; onClose(): void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  useEscape(onClose);
  useEffect(() => first.current?.focus(), []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setProblem(undefined);
    try {
      onDone(await signIn(mode, name, password));
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
        <h2 id="account-title">{signingUp ? "Make an account" : "Sign in"}</h2>
        <p className="account-why">{reason ?? "Sign in to invite friends to play your games."}</p>
        <label className="account-field">
          <span>Name</span>
          <input ref={first} value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" maxLength={24} required />
        </label>
        <label className="account-field">
          <span>Password</span>
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
        {signingUp && <p className="account-note">Just a name and a password of at least 8 characters: no email.</p>}
        {problem && (
          <p className="account-problem" role="alert">
            {problem.charAt(0).toUpperCase() + problem.slice(1)}.
          </p>
        )}
        <button type="submit" className="action account-go" disabled={busy}>
          {busy ? "One moment…" : signingUp ? "Make my account" : "Sign in"}
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
