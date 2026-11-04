// Every sound in the film, pinned to a moment in a shot (seconds from the shot's start): the time
// its loudest instant should meet the picture. sound.tsx pulls each start earlier by the file's own
// peak time and the encoder's delay. Times follow the shots' own reports of when things happen.
import type { Cue } from "./sound";

export const CUES: Cue[] = [
  // Open (quiet intro): the mark, the promise, what existed before the event and what was built during it
  { shot: "open", at: 0.1, sound: "pencil", volume: 0.9, note: "crosshair drawn" },
  { shot: "open", at: 0.42, sound: "pencil", volume: 0.7, note: "crosshair drawn" },
  { shot: "open", at: 0.72, sound: "impact", volume: 0.28, note: "mark lands" },
  { shot: "open", at: 1.17, sound: "keys", volume: 0.24, len: 0.98, note: "promise typed" },
  { shot: "open", at: 2.45, sound: "swoosh", volume: 0.24, note: "lockup glides up" },
  { shot: "open", at: 2.78, sound: "pencil", volume: 0.8, note: "gold rule, row 1" },
  { shot: "open", at: 2.98, sound: "keys", volume: 0.18, len: 0.62, note: "first commit typed" },
  { shot: "open", at: 3.231, sound: "tick", volume: 0.34, note: "row 2" },
  { shot: "open", at: 7.25, sound: "swoosh", volume: 0.3, note: "lift away" },

  // Two ways (the README's diagram)
  { shot: "twoWays", at: 0.12, sound: "pencil", volume: 0.7, note: "old way: write the rules" },
  { shot: "twoWays", at: 0.46, sound: "pencil", volume: 0.65, note: "old way: paper prototype" },
  { shot: "twoWays", at: 0.92, sound: "pencil", volume: 0.6, note: "old way: playtest night" },
  { shot: "twoWays", at: 1.2, sound: "pencil", volume: 0.55, note: "old way: loop back" },
  { shot: "twoWays", at: 1.385, sound: "tick", volume: 0.3, note: "FINALLY, PLAY" },
  { shot: "twoWays", at: 2.308, sound: "tick", volume: 0.36, note: "BoardDream lane: one sentence" },
  { shot: "twoWays", at: 2.769, sound: "tick", volume: 0.33, note: "BoardDream lane node" },
  { shot: "twoWays", at: 3.231, sound: "tick", volume: 0.3, note: "BoardDream lane node" },
  { shot: "twoWays", at: 3.692, sound: "tick", volume: 0.27, note: "BoardDream lane node" },
  { shot: "twoWays", at: 4.154, sound: "tick", volume: 0.24, note: "BoardDream lane node" },
  { shot: "twoWays", at: 4.615, sound: "impact", volume: 0.3, note: "PLAY TONIGHT" },
  { shot: "twoWays", at: 4.64, sound: "sparkle", volume: 0.6, note: "PLAY TONIGHT" },
  { shot: "twoWays", at: 9.1, sound: "swoosh", volume: 0.38, note: "push into ONE SENTENCE" },

  // One sentence (screen recording: the idea typed in real time, then the settings at 2x)
  { shot: "sentence", at: 0.05, sound: "swoosh", volume: 0.24, note: "window settles on the idea box" },
  { shot: "sentence", at: 0.55, sound: "keys", volume: 0.3, len: 1.25, note: "typing the idea" },
  { shot: "sentence", at: 1.8, sound: "keys", volume: 0.28, len: 1.25, note: "typing the idea" },
  { shot: "sentence", at: 3.05, sound: "keys", volume: 0.26, len: 1.25, note: "typing the idea" },
  { shot: "sentence", at: 4.3, sound: "keys", volume: 0.24, len: 1.25, note: "typing the idea" },
  { shot: "sentence", at: 6.95, sound: "swoosh", volume: 0.22, note: "cut to the settings" },
  { shot: "sentence", at: 7.8, sound: "tick", volume: 0.3, note: "High effort" },
  { shot: "sentence", at: 9.3, sound: "tick", volume: 0.24, note: "sliders to the top" },
  { shot: "sentence", at: 11.0, sound: "tick", volume: 0.24, note: "Map and trade" },
  { shot: "sentence", at: 11.8, sound: "tick", volume: 0.22, note: "Hex map" },
  { shot: "sentence", at: 12.9, sound: "click", volume: 0.6, note: "Dream it up, on drop one" },

  // The making (drop one; screen recording, sped up and labelled)
  { shot: "making", at: 0.0, sound: "subDrop", volume: 0.42, note: "drop one: a smooth sub drop as the making window lands" },
  { shot: "making", at: 3.72, sound: "swoosh", volume: 0.24, note: "on to writing the rules" },
  { shot: "making", at: 4.62, sound: "swoosh", volume: 0.36, note: "code card lifts" },
  { shot: "making", at: 5.1, sound: "keys", volume: 0.2, len: 1.25, note: "the code streams in" },
  { shot: "making", at: 6.5, sound: "keys", volume: 0.17, len: 1.25, note: "the code streams in" },
  { shot: "making", at: 7.9, sound: "keys", volume: 0.14, len: 1.2, note: "the code streams in" },
  { shot: "making", at: 9.26, sound: "whooshLight", volume: 0.24, note: "the draft table appears" },
  { shot: "making", at: 9.71, sound: "card", volume: 0.36, note: "playtest card lifts" },
  { shot: "making", at: 11.08, sound: "tick", volume: 0.2, note: "games played" },

  // Ready (the dip), into bar 26
  { shot: "ready", at: 0.05, sound: "swoosh", volume: 0.22, note: "ready screen" },
  { shot: "ready", at: 0.62, sound: "pencil", volume: 0.9, note: "gold ring round the clock" },
  { shot: "ready", at: 3.23, sound: "click", volume: 0.6, note: "Start playing" },
  { shot: "ready", at: 3.36, sound: "swoosh", volume: 0.4, note: "crash zoom" },

  // The table (bar 26, the music full again), live
  { shot: "table", at: 0.0, sound: "riser", volume: 0.3, note: "riser up to the table" },
  { shot: "table", at: 0.02, sound: "impact", volume: 0.34, note: "the table rises with the music" },
  { shot: "table", at: 0.5, sound: "whooshLight", volume: 0.22, note: "table tilts level" },
  { shot: "table", at: 1.15, sound: "paper", volume: 0.28, note: "lower-third comes up" },
  { shot: "table", at: 1.9, sound: "pencil", volume: 0.7, note: "ring round Muse Spark Open's status" },
  { shot: "table", at: 3.23, sound: "tick", volume: 0.36, note: "Muse Spark Open speaks" },
  { shot: "table", at: 3.69, sound: "card", volume: 0.32, note: "its line lifted" },

  // House rules
  { shot: "houseRule", at: 0.35, sound: "swoosh", volume: 0.3, note: "loupe lifts out of the drawer" },
  { shot: "houseRule", at: 1.846, sound: "click", volume: 0.55, note: "Apply the change" },
  { shot: "houseRule", at: 2.0, sound: "keys", volume: 0.14, len: 0.7, note: "Muse Spark rewriting, sped up" },
  { shot: "houseRule", at: 2.77, sound: "impact", volume: 0.26, note: "version two" },

  // Painted and checked (screen recording; the music falls away into the breakdown)
  { shot: "paint", at: 0.03, sound: "swoosh", volume: 0.26, note: "cut into the painting run" },
  { shot: "paint", at: 2.308, sound: "sparkle", volume: 0.6, note: "painted" },
  { shot: "paint", at: 2.79, sound: "card", volume: 0.36, note: "SAM 3.1 result card lifts" },
  { shot: "paint", at: 4.64, sound: "swoosh", volume: 0.24, note: "cut to before and after" },
  { shot: "paint", at: 5.3, sound: "swoosh", volume: 0.34, note: "divider flings" },
  { shot: "paint", at: 5.538, sound: "tick", volume: 0.3, note: "divider lands" },

  // Everything else (calm breakdown): each panel in turn, then all four
  { shot: "quad", at: 0.05, sound: "impact", volume: 0.24, note: "the four panels" },
  { shot: "quad", at: 0.46, sound: "click", volume: 0.38, note: "Copy the link" },
  { shot: "quad", at: 0.74, sound: "swoosh", volume: 0.22, note: "invite link flies" },
  { shot: "quad", at: 0.92, sound: "card", volume: 0.34, note: "Mira's screen" },
  { shot: "quad", at: 1.2, sound: "card", volume: 0.3, note: "Aichen's screen" },
  { shot: "quad", at: 1.9, sound: "swoosh", volume: 0.24, note: "print and play takes focus" },
  { shot: "quad", at: 2.769, sound: "paper", volume: 0.28, note: "print kit scrolls" },
  { shot: "quad", at: 3.95, sound: "swoosh", volume: 0.24, note: "mochi takes focus" },
  { shot: "quad", at: 5.75, sound: "sparkle", volume: 0.5, note: "two mochi merge" },
  { shot: "quad", at: 6.05, sound: "swoosh", volume: 0.24, note: "Behind the scenes takes focus" },
  { shot: "quad", at: 6.692, sound: "tick", volume: 0.26, note: "stat tile" },
  { shot: "quad", at: 6.923, sound: "tick", volume: 0.23, note: "stat tile" },
  { shot: "quad", at: 7.154, sound: "tick", volume: 0.2, note: "stat tile" },
  { shot: "quad", at: 7.385, sound: "tick", volume: 0.17, note: "stat tile" },
  { shot: "quad", at: 8.308, sound: "impact", volume: 0.22, note: "all four together" },

  // Built at the hackathon: the code (drop two at 3.69 s), the four Meta models
  { shot: "built", at: 0.029, sound: "swoosh", volume: 0.3, note: "into the code" },
  { shot: "built", at: 0.069, sound: "keys", volume: 0.2, len: 0.5, note: "window 1 prints" },
  { shot: "built", at: 2.769, sound: "swoosh", volume: 0.26, note: "flight out to all three windows" },
  { shot: "built", at: 3.69, sound: "subDrop", volume: 0.42, note: "drop two: window 2 slams in" },
  { shot: "built", at: 3.769, sound: "keys", volume: 0.18, len: 0.5, note: "window 2 prints" },
  { shot: "built", at: 7.069, sound: "swoosh", volume: 0.28, note: "flight to window 3" },
  { shot: "built", at: 7.389, sound: "keys", volume: 0.16, len: 0.5, note: "window 3 prints" },
  { shot: "built", at: 11.099, sound: "whooshLight", volume: 0.24, note: "out to the paper" },
  { shot: "built", at: 11.539, sound: "card", volume: 0.42, note: "Muse Spark card lands" },
  { shot: "built", at: 11.999, sound: "card", volume: 0.36, note: "Muse Spark Open card lands" },
  { shot: "built", at: 12.459, sound: "card", volume: 0.31, note: "Muse Image card lands" },
  { shot: "built", at: 12.919, sound: "card", volume: 0.27, note: "SAM 3.1 card lands" },

  // The end: pieces fly in on the dip, the mark stamps on bar 58, the address held
  { shot: "outro", at: 3.692, sound: "riser", volume: 0.42, note: "riser under the fly-in, peaks on the stamp" },
  { shot: "outro", at: 0.2, sound: "whooshLight", volume: 0.26, note: "light sweep" },
  { shot: "outro", at: 1.2, sound: "swoosh", volume: 0.24, note: "pieces fly in" },
  { shot: "outro", at: 2.3, sound: "swoosh", volume: 0.2, note: "pieces fly in" },
  { shot: "outro", at: 3.692, sound: "impactBig", volume: 0.45, note: "the mark stamps in, bar 58" },
  { shot: "outro", at: 4.154, sound: "sparkle", volume: 0.65, note: "gold rule" },
];
