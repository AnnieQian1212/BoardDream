/** Whether this browser can draw the 3D table; without WebGL 2 the flat table stands in. */
export function hasWebGL(): boolean {
  try {
    return document.createElement("canvas").getContext("webgl2") !== null;
  } catch {
    return false;
  }
}
