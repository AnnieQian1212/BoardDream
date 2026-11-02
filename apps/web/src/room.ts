import type { Params } from "@boarddream/engine";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RoomView } from "../../server/src/room-view";
import { postJson } from "./account";

export type { RoomView };

/**
 * A table shared with friends, as the page sees it. The server referees (apps/server/src/rooms.ts);
 * the page shows the table as the server last described it and sends the player's moves.
 */

/** Opens a table for a game, with this player as host; returns its code. */
export async function openTable(gameId: string, numPlayers: number, params: Params): Promise<string> {
  return (await postJson<RoomView>("/api/rooms", { gameId, numPlayers, params })).code;
}

/** The link friends follow to a table. */
export const tableLink = (code: string) => `${window.location.origin}${window.location.pathname}?room=${code}`;

type Action = "join" | "leave" | "start" | "again";

/**
 * A table, live: the server sends it as this player sees it now and after every change, over an
 * event stream that reconnects by itself. Replies and events can cross; the newest version wins.
 * `problem` means the table cannot be shown at all; `note` is a passing word about the last try.
 */
export function useRoom(code: string, userId: string | undefined) {
  const [room, setRoom] = useState<RoomView>();
  const [problem, setProblem] = useState<string>();
  const [note, setNote] = useState<string>();
  const take = useCallback((next: RoomView) => setRoom((current) => (current && current.version > next.version ? current : next)), []);

  // Signing in or out changes what the table shows this player, so the stream starts again.
  useEffect(() => {
    let alive = true;
    let source: EventSource | undefined;
    const path = `/api/rooms/${encodeURIComponent(code)}`;
    // Asked once first: a missing table is an answer, where a stream would only keep retrying.
    fetch(path)
      .then(async (res) => {
        const reply = (await res.json()) as RoomView & { error?: string };
        if (!alive) return;
        if (!res.ok) return setProblem(reply.error ?? res.statusText);
        setRoom(reply);
        source = new EventSource(`${path}/events`);
        source.addEventListener("room", (e) => take(JSON.parse((e as MessageEvent<string>).data) as RoomView));
      })
      .catch((err: unknown) => alive && setProblem(err instanceof Error ? err.message : String(err)));
    return () => {
      alive = false;
      source?.close();
    };
  }, [code, userId, take]);

  const act = useCallback(
    async (action: Action) => {
      setNote(undefined);
      try {
        take(await postJson<RoomView>(`/api/rooms/${encodeURIComponent(code)}/${action}`));
      } catch (err) {
        setNote(err instanceof Error ? err.message : String(err));
      }
    },
    [code, take],
  );

  const move = useCallback(
    async (turn: number, chosen: unknown) => {
      setNote(undefined);
      try {
        take(await postJson<RoomView>(`/api/rooms/${encodeURIComponent(code)}/move`, { turn, move: chosen }));
      } catch (err) {
        // A double click, or a click as a bot moved: the table has already moved on, nothing to say.
        if ((err as { status?: number }).status !== 409) setNote(err instanceof Error ? err.message : String(err));
      }
    },
    [code, take],
  );

  const actions = useMemo(() => ({ join: () => act("join"), leave: () => act("leave"), start: () => act("start"), again: () => act("again") }), [act]);
  return { room, problem, note, move, ...actions };
}
