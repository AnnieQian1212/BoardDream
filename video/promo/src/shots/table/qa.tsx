// QA only: Fork C's two shots on their own, so a still renders while other shots are mid-edit.
// npx remotion still src/shots/table/qa.tsx TableQA out/qa/x.png --frame=N
import React from "react";
import { Composition, registerRoot, Sequence } from "remotion";
import "../../lib/theme";
import { SHOTS } from "../../timeline";
import { BuiltTag } from "../../lib/BuiltTag";
import { Table } from "../Table";
import { HouseRule } from "../HouseRule";

const QA: React.FC = () => (
  <>
    <Sequence durationInFrames={SHOTS.table.dur}>
      <Table />
    </Sequence>
    <Sequence from={SHOTS.table.dur} durationInFrames={SHOTS.houseRule.dur}>
      <HouseRule />
    </Sequence>
    <Sequence from={-600}>
      <BuiltTag />
    </Sequence>
  </>
);

registerRoot(() => <Composition id="TableQA" component={QA} durationInFrames={SHOTS.table.dur + SHOTS.houseRule.dur} fps={60} width={1920} height={1080} />);
