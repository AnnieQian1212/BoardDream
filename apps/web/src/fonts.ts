import { useEffect, useState } from "react";
import { FONT_DISPLAY, FONT_UI } from "./three/paint";

/**
 * True once the web fonts the table prints with have loaded. Text measured before then is measured
 * in a fallback face of other proportions, so anything that fits text to a space waits for this.
 */
export function useFontsReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const faces = [`600 40px ${FONT_DISPLAY}`, `500 20px ${FONT_UI}`, `700 20px ${FONT_UI}`];
    Promise.all(faces.map((font) => document.fonts.load(font))).finally(() => setReady(true));
  }, []);
  return ready;
}
