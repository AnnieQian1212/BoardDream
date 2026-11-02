import type { Params } from "@boarddream/engine";

/**
 * What the server and the web app say to each other about accounts and shared tables (play.ts).
 * Types only, with nothing from Node, so the web app reads this file itself.
 */

export interface User {
  id: string;
  name: string;
}

export type SeatKind = "open" | "player" | "bot";

export type RoomStatus = "lobby" | "playing" | "over";

/** What one person sees of a shared table. */
export interface RoomView {
  code: string;
  gameId: string;
  title: string;
  /** The host's name. */
  host: string;
  isHost: boolean;
  /** Your seat, or -1 when you have none. */
  you: number;
  numPlayers: number;
  params: Params;
  seats: { kind: SeatKind; name?: string }[];
  status: RoomStatus;
  /** Rises with every change, so a page can tell a late reply from a newer one. */
  version: number;
  /** Games dealt at this table so far; a new deal starts a new table on the page. */
  deal: number;
  /** Moves made so far; a move names the turn its player saw. */
  turn: number;
  /** The game, once it has started and you have a seat. */
  state?: unknown;
  /** The latest moves as your seat reads them, oldest first. */
  log: string[];
}
