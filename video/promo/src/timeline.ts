// The film in shots, each starting on a bar of the music (time.ts). This table is the one source of
// truth: Promo.tsx lays the shots from it, the sounds are pinned relative to it.
//
// Music map (the music starts at film 0; film bar = music bar up to bar 41, then the music skips
// its bars 42-46, five bars of the same breakdown loop, so film bar f >= 42 plays music bar f + 5):
// 1-8 quiet intro, 9-16 build, 17 drop one, 17-23 full, 24-25 a dip, 26-31 full, 32 falls, 33-41
// a calm breakdown, then (music bars) 47 the breakdown's end, 48 build, 49 drop two (film bar 44),
// 49-55 full, 56-57 a dip, 58-60 full (the end mark, film bar 53), 61 falls, 62-63 the tail.
import { barS, sf } from "./lib/time";

export type ShotId =
  | "open"
  | "twoWays"
  | "sentence"
  | "making"
  | "ready"
  | "table"
  | "houseRule"
  | "paint"
  | "quad"
  | "built"
  | "outro";

/** [first bar, number of bars] */
const BARS: Record<ShotId, [number, number]> = {
  open: [1, 4], // BoardDream pressed in ink; what existed before the event and what was built during it
  twoWays: [5, 5], // the README's flow: the old way loops for weeks, BoardDream goes straight through
  sentence: [10, 7], // one sentence typed in the real idea box, the settings at their highest, Dream it up on the drop
  making: [17, 7], // DROP ONE: Muse Spark designs it, writes the rules as code, bots play the games
  ready: [24, 2], // the dip: ready to play, the real clock; Start playing on bar 26
  table: [26, 3], // the 3D table, Muse Spark Open in the empty seats
  houseRule: [29, 3], // a house rule in plain words: version two, tested again
  paint: [32, 4], // Muse Image paints the board, SAM 3.1 checks every tile
  quad: [36, 6], // friends by a link, print and play, the mochi game, Behind the scenes
  built: [42, 9], // built at the hackathon: our code (DROP TWO on film bar 44), the four Meta models
  outro: [51, 6.5], // every feature around the mark on the dip, the stamp on film bar 53, the address held, the tail
};

export const SHOTS = Object.fromEntries(
  Object.entries(BARS).map(([id, [bar, bars]]) => [id, { from: sf(barS(bar)), dur: sf(barS(bar + bars)) - sf(barS(bar)), bar, bars }]),
) as Record<ShotId, { from: number; dur: number; bar: number; bars: number }>;

export const ORDER: ShotId[] = ["open", "twoWays", "sentence", "making", "ready", "table", "houseRule", "paint", "quad", "built", "outro"];

/** 1:44 in all. */
export const TOTAL = SHOTS.outro.from + SHOTS.outro.dur;

/** The music starts with the film. */
export const MUSIC_START = 0;

/** Film bar where the music skips ahead, and how many bars it skips. */
export const MUSIC_SPLICE = { atBar: 42, skipBars: 5 };

/**
 * The Built shot was made 9.23 s longer (the commits travel first); the film starts it at its code,
 * so it is played from this many seconds in.
 */
export const BUILT_SKIP_S = barS(47) - barS(42);
