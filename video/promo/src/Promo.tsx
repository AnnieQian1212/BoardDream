// BoardDream's one-minute demo (video-shotcraft, autonomous free creation; spec in ../SPEC.md).
// Every shot starts on a bar of the music (timeline.ts); the hackathon tag stays on from the first
// look at the app to the end card.
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import "./lib/theme";
import { BUILT_SKIP_S, ORDER, SHOTS, type ShotId } from "./timeline";
import { sf } from "./lib/time";
import { Open } from "./shots/Open";
import { TwoWays } from "./shots/TwoWays";
import { Sentence } from "./shots/Sentence";
import { Making } from "./shots/Making";
import { Ready } from "./shots/Ready";
import { Table } from "./shots/Table";
import { HouseRule } from "./shots/HouseRule";
import { Paint } from "./shots/Paint";
import { Quad } from "./shots/Quad";
import { Built } from "./shots/Built";
import { Outro } from "./shots/Outro";
import { BuiltTag } from "./lib/BuiltTag";
import { Soundtrack } from "./sound";

const COMPONENTS: Record<ShotId, React.FC> = {
  open: Open,
  twoWays: TwoWays,
  sentence: Sentence,
  making: Making,
  ready: Ready,
  table: Table,
  houseRule: HouseRule,
  paint: Paint,
  quad: Quad,
  built: Built,
  outro: Outro,
};

export const Promo: React.FC<{ bgm: boolean }> = ({ bgm }) => (
  <AbsoluteFill style={{ background: "#eadcc0" }}>
    {ORDER.map((id) => {
      const S = COMPONENTS[id];
      return (
        <Sequence key={id} from={SHOTS[id].from} durationInFrames={SHOTS[id].dur} name={id}>
          {id === "built" ? (
            // Built starts at its code: its first 9.23 s (the commits travel) is left out of the film.
            <Sequence from={-sf(BUILT_SKIP_S)} name="built from its code">
              <S />
            </Sequence>
          ) : (
            <S />
          )}
        </Sequence>
      );
    })}
    <Sequence from={SHOTS.sentence.from} durationInFrames={SHOTS.outro.from - SHOTS.sentence.from} name="hackathon tag">
      <BuiltTag />
    </Sequence>
    <Soundtrack bgm={bgm} />
  </AbsoluteFill>
);
