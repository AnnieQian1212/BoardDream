import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";
import React from "react";
import { AbsoluteFill, Easing } from "remotion";
import { HEIGHT, WIDTH } from "./theme";

/**
 * A hand-over carried by BoardDream's own mark: the next scene opens in a hex that grows from the
 * centre past the frame's corners, turning a little as it grows (the reference promo's star wipe,
 * in our shape).
 */
type HexProps = Record<string, never>;

const grow = Easing.bezier(0.7, 0, 0.3, 1);

const HexIrisPresentation: React.FC<TransitionPresentationComponentProps<HexProps>> = ({ children, presentationDirection, presentationProgress }) => {
  if (presentationDirection === "exiting") return <AbsoluteFill>{children}</AbsoluteFill>;
  const p = grow(Math.min(1, Math.max(0, presentationProgress)));
  const r = p * 0.62 * Math.hypot(WIDTH, HEIGHT);
  const turn = (1 - p) * 0.5;
  const points = Array.from({ length: 6 }, (_, i) => {
    const a = turn + (Math.PI / 3) * i - Math.PI / 2;
    return `${WIDTH / 2 + r * Math.cos(a)}px ${HEIGHT / 2 + r * Math.sin(a)}px`;
  }).join(", ");
  return <AbsoluteFill style={{ clipPath: p >= 1 ? undefined : `polygon(${points})` }}>{children}</AbsoluteFill>;
};

export const hexIris = (): TransitionPresentation<HexProps> => ({ component: HexIrisPresentation, props: {} });
