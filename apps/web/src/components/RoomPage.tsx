import type { GameModule } from "@boarddream/engine";
import { Check, Copy, LogOut } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useAccount } from "../account";
import { useArt } from "../art";
import { playerColor } from "../colors";
import { useCovers } from "../covers";
import { gameById } from "../generated";
import { tableLink, useRoom, type RoomView } from "../room";
import { Tabletop } from "../three/Tabletop";
import { hasWebGL } from "../webgl";
import { AccountButton, SignInDialog } from "./Account";
import { BrandMark } from "./BrandMark";
import { Table } from "./Table";
import { TableGuard } from "./TableGuard";

const FLAT = new URLSearchParams(window.location.search).has("flat") || !hasWebGL();
/** The room's bar and the move bar, which the camera frames the table between. */
const INSETS = { left: 0, right: 0, top: 66, bottom: 92 };

const sentence = (text: string) => `${text.charAt(0).toUpperCase()}${text.slice(1)}${/[.!?]$/.test(text) ? "" : "."}`;

/**
 * A table shared with friends (?room=<code>): the lobby while seats fill, then the game itself,
 * as the server referees it. Friends who follow the link sign in and are seated at once.
 */
export function RoomPage({ code }: { code: string }) {
  const { ready, user } = useAccount();
  const { room, problem, note, move, join, leave, start, again } = useRoom(code, user?.id);
  const [game, setGame] = useState<GameModule | null>();
  const gameId = room?.gameId;
  useEffect(() => {
    if (!gameId) return;
    let alive = true;
    void gameById(gameId).then((found) => alive && setGame(found ?? null));
    return () => {
      alive = false;
    };
  }, [gameId]);
  useEffect(() => {
    if (room) document.title = `${room.title} · BoardDream`;
  }, [room?.title]);

  // Signed in, seatless, and the table still filling: take a seat, once.
  const joined = useRef(false);
  useEffect(() => {
    if (!room || !user || joined.current) return;
    if (room.status === "lobby" && room.you < 0 && room.seats.some((s) => s.kind === "open")) {
      joined.current = true;
      void join();
    }
  }, [room, user, join]);

  if (problem) return <RoomNote title="This table is not here" text={`${sentence(problem)} Ask whoever sent the link for a new one.`} />;
  if (!room || game === undefined) return <RoomNote title="Setting up the table…" />;
  if (game === null) return <RoomNote title="This game is not here any more" text="The game this table was opened for was deleted or did not load." />;
  if (room.status === "lobby" || room.you < 0) {
    return <Lobby room={room} game={game} ready={ready} signedIn={Boolean(user)} note={note} onStart={start} onLeave={leave} />;
  }
  return <SharedTable room={room} game={game} note={note} onMove={(m) => void move(room.turn, m)} onAgain={again} />;
}

/** The page around the lobby and its messages: the brand back home, and the account corner. */
function RoomShell({ children }: { children: ReactNode }) {
  return (
    <div className="app home-screen">
      <div className="home">
        <header className="home-bar">
          <a className="brand" href={import.meta.env.BASE_URL}>
            <BrandMark />
            BoardDream
          </a>
          <nav>
            <AccountButton />
          </nav>
        </header>
        <main className="room-main">{children}</main>
      </div>
    </div>
  );
}

function RoomNote({ title, text }: { title: string; text?: string }) {
  return (
    <RoomShell>
      <section className="room-card room-card-note">
        <div className="room-body">
          <h1>{title}</h1>
          {text && <p className="room-summary">{text}</p>}
          {text && (
            <a className="action room-home" href={import.meta.env.BASE_URL}>
              Back to BoardDream
            </a>
          )}
        </div>
      </section>
    </RoomShell>
  );
}

/** Seats, the invite link, and what this person can do: sign in, start, wait or leave. */
function Lobby(props: { room: RoomView; game: GameModule; ready: boolean; signedIn: boolean; note?: string; onStart(): void; onLeave(): void }) {
  const { room, game, ready, signedIn, note } = props;
  const covers = useCovers(room.gameId);
  const cover = covers.get(room.gameId);
  const [signing, setSigning] = useState(false);
  const [copied, setCopied] = useState(false);
  const link = tableLink(room.code);
  const started = room.status !== "lobby";
  const seated = room.you >= 0;
  const open = room.seats.filter((s) => s.kind === "open").length;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // No clipboard (an insecure page): the link is selected in its box to copy by hand.
    }
  }

  let actions: ReactNode = null;
  if (!ready) actions = null;
  else if (started && !seated) actions = <p className="room-wait">This game started without you.</p>;
  else if (!signedIn)
    actions = (
      <button type="button" className="action" onClick={() => setSigning(true)}>
        Sign in to take a seat
      </button>
    );
  else if (room.isHost)
    actions = (
      <>
        <button type="button" className="action" onClick={props.onStart}>
          Start the game
        </button>
        <p className="room-wait">{open ? `${open === 1 ? "The open seat is" : `The ${open} open seats are`} played by bots.` : "Every seat is taken."}</p>
      </>
    );
  else if (seated)
    actions = (
      <>
        <p className="room-wait">Waiting for {room.host} to deal…</p>
        <button type="button" className="link" onClick={props.onLeave}>
          Leave this table
        </button>
      </>
    );
  else if (open === 0) actions = <p className="room-wait">Every seat is taken.</p>;
  else actions = <p className="room-wait">Taking a seat…</p>;

  return (
    <RoomShell>
      <section className="room-card">
        {cover && <img className="room-cover" src={cover} alt="" />}
        <div className="room-body">
          <p className="room-kicker">{room.host}&rsquo;s table</p>
          <h1>{room.title}</h1>
          {game.meta.summary && <p className="room-summary">{game.meta.summary}</p>}
          <ol className="room-seats" aria-label="Seats">
            {room.seats.map((seat, i) => (
              <li key={i} className={seat.kind === "open" ? "open" : undefined} style={{ "--seat": playerColor(i) } as CSSProperties}>
                <span className="seat-dot" />
                <span className="room-seat-name">{seat.kind === "open" ? "Open seat" : seat.kind === "bot" ? "Bot" : seat.name}</span>
                {i === 0 && <span className="room-tag">host</span>}
                {i === room.you && <span className="room-tag you">you</span>}
              </li>
            ))}
          </ol>
          {!started && (
            <div className="room-invite">
              <span>Invite friends with this link</span>
              <div className="room-link">
                <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Invite link" />
                <button type="button" className="quiet" onClick={() => void copy()}>
                  {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}
          <div className="room-actions">{actions}</div>
          {note && (
            <p className="room-problem" role="alert">
              {sentence(note)}
            </p>
          )}
        </div>
      </section>
      {signing && <SignInDialog reason={`Sign in to sit at ${room.host}’s table. Your friends will see your name.`} onDone={() => setSigning(false)} onClose={() => setSigning(false)} />}
    </RoomShell>
  );
}

/** The game at a shared table: the same table as alone, with friends' names and the server's state. */
function SharedTable({ room, game, note, onMove, onAgain }: { room: RoomView; game: GameModule; note?: string; onMove(move: unknown): void; onAgain(): void }) {
  // The paintings the player chose to show for this game (the Art panel), as at their own table.
  const { onTable } = useArt(game);
  const names = useMemo(() => room.seats.map((s, i) => (i === room.you ? undefined : s.kind === "bot" ? `Bot ${i + 1}` : s.name)), [room.seats, room.you]);
  const active = room.status === "playing" ? safely(() => game.activePlayers(room.state)[0]) : undefined;
  const props = {
    game,
    state: room.state,
    numPlayers: room.numPlayers,
    human: room.you,
    onMove,
    onRestart: room.isHost ? onAgain : undefined,
    names,
  };
  return (
    <div className="app room-app">
      <TableGuard resetKey={`${room.code}:${room.deal}`} onError={() => {}} fallback>
        {FLAT ? (
          <div className="flat-stage">
            <Table key={room.deal} {...props} />
          </div>
        ) : (
          <Tabletop key={room.deal} {...props} insets={INSETS} art={onTable.art} boardPaint={onTable.boardPaint} />
        )}
      </TableGuard>
      <header className="topbar room-bar">
        <a className="brand brand-home" href={import.meta.env.BASE_URL} title="Leave the table for BoardDream's home">
          <BrandMark />
          <span>BoardDream</span>
        </a>
        <h1 className="table-title">{room.title}</h1>
        <span className="topbar-gap" />
        <ol className="room-players" aria-label="Players">
          {room.seats.map((seat, i) => (
            <li key={i} className={i === active ? "active" : undefined} style={{ "--seat": playerColor(i) } as CSSProperties} title={i === active ? "Their turn" : undefined}>
              <span className="seat-dot" />
              {i === room.you ? "You" : (names[i] ?? `Player ${i + 1}`)}
            </li>
          ))}
        </ol>
        <a className="quiet room-leave" href={import.meta.env.BASE_URL} aria-label="Leave the table">
          <LogOut size={16} /> <span className="btn-label">Leave</span>
        </a>
      </header>
      {note && (
        <div className="room-toast" role="alert">
          {sentence(note)}
        </div>
      )}
    </div>
  );
}

function safely<T>(run: () => T): T | undefined {
  try {
    return run();
  } catch {
    return undefined;
  }
}
