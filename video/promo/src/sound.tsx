// The soundtrack: Cat Walk under everything (bgm: false renders the same film without it, sounds
// kept), and every sound pinned to a moment in a shot. Sounds are Freesound CC0 previews
// (public/audio/sfx: audio-manifest.json, FREESOUND-CREDITS.md). Each cue names the moment its
// peak should land (shot + seconds); the start is pulled earlier by the file's own peak time and by
// the AAC encoder's priming delay, so the loudest instant meets the picture (shotcraft S5).
import React from "react";
import { Audio, Sequence, interpolate, staticFile } from "remotion";
import { MUSIC_OFFSET, FPS, barS, sf } from "./lib/time";
import { MUSIC_SPLICE, MUSIC_START, SHOTS, TOTAL, type ShotId } from "./timeline";

/** The seam where the music skips five bars of its breakdown, and a 3-frame crossfade either side. */
const SEAM = sf(barS(MUSIC_SPLICE.atBar));
const XF = 3;

/** The sounds, with the time of each file's loudest 10 ms (from the manifest's analysis). */
const SFX = {
  swoosh: { file: "fs-786514.mp3", peak: 0.185 },
  whooshLight: { file: "fs-701104.mp3", peak: 0.505 },
  flashback: { file: "fs-582411.mp3", peak: 1.615 },
  impact: { file: "fs-755057.mp3", peak: 0.205 },
  // Its swell turns loud at 0.32 s and stays so to 0.6 s: the attack is what meets the picture.
  impactBig: { file: "fs-754564.mp3", peak: 0.33 },
  keys: { file: "fs-348238.mp3", peak: 0.015 },
  click: { file: "fs-678248.mp3", peak: 0.485 },
  paper: { file: "fs-464302.mp3", peak: 1.135 },
  pencil: { file: "fs-761665.mp3", peak: 0.095 },
  riser: { file: "fs-685256.mp3", peak: 2.745 },
  riserHit: { file: "fs-511858.mp3", peak: 1.535 },
  sparkle: { file: "fs-844398.mp3", peak: 0.665 },
  tick: { file: "fs-668355.mp3", peak: 0.025 },
  card: { file: "fs-571577.mp3", peak: 0.23 },
  // A smooth sub drop: it starts at 0.05 s and blooms to 0.5 s; its first weight meets the cut.
  subDrop: { file: "fs-428073.mp3", peak: 0.2 }, // its snap starts about 0.1 s before the loudest 10 ms
} as const;
export type Sound = keyof typeof SFX;

/** AAC priming in the rendered file, about 2,048 samples at 48 kHz. */
const OUTPUT_DELAY = 0.043;

export type Cue = { shot: ShotId; at: number; sound: Sound; volume: number; /** cut the sound after this many seconds */ len?: number; note: string };

export { CUES } from "./cues";
import { CUES } from "./cues";

const cueFrom = (c: Cue) => SHOTS[c.shot].from + sf(c.at - SFX[c.sound].peak - OUTPUT_DELAY);

export const Soundtrack: React.FC<{ bgm: boolean }> = ({ bgm }) => (
  <>
    {bgm ? (
      <>
        <Sequence name="music, bars 1-41" from={MUSIC_START} durationInFrames={SEAM + XF}>
          <Audio
            src={staticFile("audio/bgm/cat-walk.mp3")}
            startFrom={sf(MUSIC_OFFSET)}
            volume={(f) => interpolate(f, [0, 6, SEAM - XF, SEAM + XF], [0, 0.5, 0.5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
          />
        </Sequence>
        <Sequence name="music, bars 47 on" from={SEAM - XF}>
          <Audio
            src={staticFile("audio/bgm/cat-walk.mp3")}
            startFrom={sf(MUSIC_OFFSET + barS(MUSIC_SPLICE.atBar + MUSIC_SPLICE.skipBars)) - XF}
            volume={(f) => interpolate(f, [0, 2 * XF, TOTAL - (SEAM - XF) - sf(1.3), TOTAL - (SEAM - XF)], [0, 0.5, 0.5, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
          />
        </Sequence>
      </>
    ) : null}
    {CUES.map((c, i) => {
      const from = cueFrom(c);
      const trim = Math.max(0, -from);
      return (
        <Sequence key={i} from={Math.max(0, from)} durationInFrames={c.len ? sf(c.len) : undefined} name={`sfx ${c.note}`}>
          <Audio src={staticFile(`audio/sfx/${SFX[c.sound].file}`)} startFrom={trim} volume={c.volume} />
        </Sequence>
      );
    })}
  </>
);

export const _fps = FPS;
