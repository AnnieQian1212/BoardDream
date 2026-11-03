import { TransitionSeries, linearTiming, type TransitionPresentation } from "@remotion/transitions";
import React from "react";
import { FPS } from "./theme";

/**
 * A film as scenes, each with how long it is seen and how it hands over to the next: a transition
 * (the two overlap, centred on the cut) or a hard cut with an overlay over it (a light leak). Each
 * scene is drawn from half the incoming transition before its own time to half the outgoing one
 * after, so the scenes' times add up to the film's and stay where they are written; `lead` says how
 * early the scene's drawing begins, for footage to start that much earlier in its take.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPresentation = TransitionPresentation<any>;

export type Handover =
  | { transition: AnyPresentation; frames: number }
  | { overlay: React.ReactNode; frames: number };

export interface Scene {
  name: string;
  seconds: number;
  render(lead: number): React.ReactNode;
  then?: Handover;
}

export const sceneSeconds = (scenes: Scene[]) => scenes.reduce((sum, s) => sum + s.seconds, 0);

export const Timeline: React.FC<{ scenes: Scene[] }> = ({ scenes }) => {
  const half = (h?: Handover) => (h && "transition" in h ? h.frames / 2 : 0);
  // Whole frames for each scene's own time, keeping the running total on the written times.
  let written = 0;
  let placed = 0;
  const own = scenes.map((s) => {
    written += s.seconds * FPS;
    const frames = Math.round(written) - placed;
    placed += frames;
    return frames;
  });
  return (
    <TransitionSeries>
      {scenes.flatMap((scene, i) => {
        const before = half(scenes[i - 1]?.then);
        const after = half(scene.then);
        const items: React.ReactNode[] = [
          <TransitionSeries.Sequence key={scene.name} name={scene.name} durationInFrames={own[i] + before + after}>
            {scene.render(before / FPS)}
          </TransitionSeries.Sequence>,
        ];
        const h = scene.then;
        if (h && i < scenes.length - 1) {
          items.push(
            "transition" in h ? (
              <TransitionSeries.Transition key={`${scene.name}>`} presentation={h.transition} timing={linearTiming({ durationInFrames: h.frames })} />
            ) : (
              <TransitionSeries.Overlay key={`${scene.name}>`} durationInFrames={h.frames}>
                {h.overlay}
              </TransitionSeries.Overlay>
            ),
          );
        }
        return items;
      })}
    </TransitionSeries>
  );
};
