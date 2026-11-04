// BoardDream's own design tokens (apps/web/src/styles.css, light theme): the film is dressed in the
// app's paper, ink, gold and teal, its Fraunces display serif and Inter UI sans.
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/inter";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/600.css";
import { continueRender, delayRender } from "remotion";

export const C = {
  page: "#eadcc0",
  pageLight: "#f5ead2",
  panel: "#fbf3e1",
  card: "#fffaef",
  paper: "#fbf5e8",
  ink: "#2d2016",
  inkSoft: "#5f5547",
  muted: "#5a4935",
  faint: "#7c6851",
  line: "rgba(45, 32, 22, 0.14)",
  gold: "#d9a233",
  goldLight: "#f2cf7c",
  goldDeep: "#b9831f",
  accent: "#138f9f",
  accentStrong: "#0e7482",
  cover: "#4d6b4a",
  mochi: "#c9553f",
  code: "#fbf8f1",
  night: "#1d1712",
  nightPanel: "#241d17",
};

export const F = {
  display: '"Fraunces Variable", Georgia, serif',
  ui: '"Inter Variable", system-ui, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", Consolas, monospace',
};

/** Fraunces with the app's soft, wonky display axes. */
export const displaySoft = { fontVariationSettings: '"SOFT" 100, "WONK" 1' } as const;

/** The app's lifted panel: an ink edge, a hard ink drop and a soft warm shadow. */
export const lift = (depth = 3) => ({
  border: `1.5px solid ${C.ink}`,
  boxShadow: `0 ${depth}px 0 ${C.ink}, 0 ${depth * 5}px ${depth * 10}px rgba(70, 48, 25, 0.18)`,
});

const fonts = delayRender("Loading the app's fonts");
Promise.all([
  document.fonts.load('600 64px "Fraunces Variable"'),
  document.fonts.load('italic 500 64px "Fraunces Variable"'),
  document.fonts.load('500 40px "Inter Variable"'),
  document.fonts.load('700 40px "Inter Variable"'),
  document.fonts.load('400 30px "JetBrains Mono"'),
  document.fonts.load('600 30px "JetBrains Mono"'),
])
  .then(() => continueRender(fonts))
  .catch(() => continueRender(fonts));
