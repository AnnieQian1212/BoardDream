// Shot 3 · One sentence (bars 10–16, 12.92 s, the build). Real screen recording.
// Card: type-and-filter (its typing grammar: the camera close on the real box while the sentence is
// typed at a person's pace, then a breath). Two takes of the same session, cut on beat 15: the idea
// typed at real speed (type.mp4), then the settings turned to their highest at 2× (settings.mp4),
// Dream it up clicked on the shot's last frame so the making starts on the drop.
import React from "react";
import { Sequence } from "remotion";
import { BEAT, EASE, prog, sf, useSec } from "../lib/time";
import { Caption, SpeedTag, Stage, Window } from "../lib/ui";
import { FootageCam, type Clip } from "./making/Footage";
import { type CamKey } from "../lib/PageCam";

const WIN = { x: 60, y: 88, w: 1800, h: 812 };
const SPLIT = 15 * BEAT; // 6.92 s, the cut between the two takes
const SPLIT_F = sf(SPLIT);

// The idea typed at real speed: typing runs 3.9–9.0 s in the clip (the clip ends at 9.4 s, where
// the picture holds), so the finished sentence stays on screen for over a second.
const TYPE: Clip = { name: "type", from: 3.4, rate: 1, freezeAt: 5.98 };
const TYPE_KEYS: CamKey[] = [
  { t: 0, cx: 960, cy: 430, zoom: 1.9 },
  { t: 0.5, cx: 966, cy: 450, zoom: 2.3 },
  { t: SPLIT, cx: 970, cy: 452, zoom: 2.38 },
];

// The settings turned to their highest at 2×; Dream it up's mouse down (14.2 s in the clip) on the
// shot's last frame, so the next shot, the making, starts on the drop.
const B_SECONDS = 13 * BEAT;
const SETTINGS: Clip = { name: "settings", from: 14.2 - 2 * (B_SECONDS - 1 / 60), rate: 2 };
const SETTINGS_KEYS: CamKey[] = [
  { t: 0, cx: 960, cy: 470, zoom: 1.3 },
  { t: 4.5, cx: 1020, cy: 440, zoom: 1.42 },
  { t: B_SECONDS, cx: 1120, cy: 360, zoom: 1.7 },
];

export const Sentence: React.FC = () => {
  const t = useSec();
  const enter = prog(t, 0, 0.45, EASE.out);
  return (
    <Stage>
      <div style={{ position: "absolute", inset: 0, transform: `translateY(${(1 - enter) * 34}px) scale(${0.985 + 0.015 * enter})`, transformOrigin: "50% 60%" }}>
        <Window x={WIN.x} y={WIN.y} w={WIN.w} h={WIN.h} radius={20}>
          <Sequence durationInFrames={SPLIT_F} layout="none" name="typed">
            <FootageCam clip={TYPE} keys={TYPE_KEYS} viewW={WIN.w} viewH={WIN.h} />
          </Sequence>
          <Sequence from={SPLIT_F} layout="none" name="settings">
            <FootageCam clip={SETTINGS} keys={SETTINGS_KEYS} viewW={WIN.w} viewH={WIN.h} />
          </Sequence>
        </Window>
      </div>

      <Sequence durationInFrames={SPLIT_F} layout="none">
        <SpeedTag text="Real recording · real time" x={1470} y={34} at={0} />
      </Sequence>
      <Sequence from={SPLIT_F} layout="none">
        <SpeedTag text="Real recording · 2× speed" x={1462} y={34} at={0} />
      </Sequence>

      <Sequence durationInFrames={SPLIT_F} layout="none">
        <Caption text="Describe your game in one sentence." at={0.25} y={918} size={64} mark={["one", "sentence"]} out={SPLIT - 0.3} />
      </Sequence>
      <Sequence from={SPLIT_F} layout="none">
        <Caption text="High effort · max complexity · 3+ players · hex map" at={0.3} y={922} size={58} mark={["High", "effort", "max", "complexity"]} />
      </Sequence>
    </Stage>
  );
};
