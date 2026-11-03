import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";

/**
 * Compiles the table's shaders before its first frame. Drawn at once, the first frame waited while
 * every program linked: 1.9 s of a frozen page opening Tidehearth, 2.1 s Saffron Wake. Compiled
 * with compileAsync, the programs link in parallel off the main thread (KHR_parallel_shader_compile)
 * while the page stays responsive, and the table fades in once they are ready. Where the extension
 * is missing, three waits a moment and the first frame links what is left, as before.
 */
export function WarmUp({ onReady }: { onReady(): void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    let alive = true;
    // A frame for the scene's children to mount their materials first.
    const frame = requestAnimationFrame(() => {
      gl.compileAsync(scene, camera)
        .catch(() => undefined)
        .then(() => alive && onReady());
    });
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, [gl, scene, camera, onReady]);
  return null;
}

/**
 * Asks for a frame once the table is warm (frames asked for while it was held were dropped), and
 * says when that frame has been drawn: the table shows only then. Its first frame also builds the
 * room's lighting (the environment map and its blurred levels), which links a few programs more
 * while the table is still unseen.
 */
export function FirstFrame({ warm, onDrawn }: { warm: boolean; onDrawn(): void }) {
  const invalidate = useThree((s) => s.invalidate);
  const drawn = useRef(false);
  useEffect(() => {
    if (warm) invalidate();
  }, [warm, invalidate]);
  useFrame(() => {
    if (!warm || drawn.current) return;
    drawn.current = true;
    // This runs before the frame is drawn; the next animation frame comes after it.
    requestAnimationFrame(onDrawn);
  });
  return null;
}
