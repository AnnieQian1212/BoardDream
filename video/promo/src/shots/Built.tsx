// Shot 10 (bars 42-55, 25.85 s): what was built during the hackathon. Three parts, each cut on a beat:
// (a) beats 0-20, the calm breakdown: the ten days and their commits, a slow travel, then all ten at
//     once, held 3.7 s (shotcraft timeline-travel);
// (b) beats 20-44: three windows of our own code in space (shotcraft terminal-3d), the second slammed
//     in on drop two (beat 28, 12.92 s; shotcraft crash-zoom-punch, the impact kind);
// (c) beats 44-56: four Meta models, four jobs, the full row held 3.7 s.
// Each part runs in its own Sequence, so its clock (and its captions') starts at 0.
import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { BEAT, sf, useSec } from "../lib/time";
import { Timeline } from "./built/Timeline";
import { CodeSpace } from "./built/CodeSpace";
import { Models } from "./built/Models";

export const BUILT_A_END = 20 * BEAT;
export const BUILT_B_END = 44 * BEAT;

const Part: React.FC<{ C: React.FC<{ t: number }> }> = ({ C }) => <C t={useSec()} />;

export const Built: React.FC = () => (
  <AbsoluteFill>
    <Sequence durationInFrames={sf(BUILT_A_END)} name="built: days">
      <Part C={Timeline} />
    </Sequence>
    <Sequence from={sf(BUILT_A_END)} durationInFrames={sf(BUILT_B_END) - sf(BUILT_A_END)} name="built: code">
      <Part C={CodeSpace} />
    </Sequence>
    <Sequence from={sf(BUILT_B_END)} name="built: models">
      <Part C={Models} />
    </Sequence>
  </AbsoluteFill>
);
