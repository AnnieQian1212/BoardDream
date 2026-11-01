import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

/** How long the table goes without a frame before it is drawn sharp. */
const SETTLE_MS = 300;

/** The screen's own pixel ratio, up to 2x. */
const screenRatio = () => Math.min(window.devicePixelRatio || 1, 2);

/**
 * Draws the table at the quality tier's pixel ratio (`dpr`) while anything moves and, once it has
 * been still for a moment, draws it once more at the screen's own pixel ratio, so the text on cards,
 * boards and mats reads sharply without making animation dearer on a weak GPU. The table renders on
 * demand, so the sharp frame is the one left on screen, and its cost falls where nothing moves.
 * Each change of ratio and the frame drawn at it happen in the same task, so the canvas never shows
 * cleared in between.
 */
export function SharpWhenStill({ dpr }: { dpr: number }) {
  const get = useThree((s) => s.get);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useFrame(() => {
    const sharp = screenRatio();
    if (sharp <= dpr) return;
    const { gl } = get();
    // Every animated frame is drawn at the tier's ratio, starting with this one.
    if (gl.getPixelRatio() !== dpr) gl.setPixelRatio(dpr);
    window.clearTimeout(timer.current);
    const settle = () => {
      const due = performance.now() + SETTLE_MS;
      timer.current = window.setTimeout(() => {
        // A late timer means the page was busy (a bot working out its move), so more motion is
        // likely on its way: wait for a quiet spell rather than spend a sharp frame now.
        if (performance.now() - due > 50) return settle();
        const { gl, scene, camera } = get();
        if (gl.getPixelRatio() === sharp) return;
        gl.setPixelRatio(sharp);
        gl.render(scene, camera);
      }, SETTLE_MS);
    };
    settle();
  });
  return null;
}
