import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/inter";
import { continueRender, delayRender } from "remotion";

/**
 * The film's look: the app's storybook palette (apps/web/src/styles.css) for the screen, and for the
 * cards between, a warm near-black with gold, cream and a little teal, in the app's two typefaces.
 */
export const C = {
  night: "#120d0a",
  night2: "#1d1611",
  cream: "#f5ecdc",
  creamMuted: "#bfb19b",
  gold: "#d9a441",
  goldSoft: "#f0cf86",
  teal: "#3fb6c3",
  rust: "#d4704b",
  paper: "#fbf5e8",
  ink: "#2d2016",
};
export const DISPLAY = '"Fraunces Variable", Georgia, serif';
export const UI = '"Inter Variable", system-ui, sans-serif';

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** The house easing: fast out, long settle. */
export const OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** The fonts are in before a frame is drawn. */
const fonts = delayRender("Loading the app's fonts");
Promise.all([
  document.fonts.load('600 64px "Fraunces Variable"'),
  document.fonts.load('italic 400 64px "Fraunces Variable"'),
  document.fonts.load('500 40px "Inter Variable"'),
])
  .catch(() => undefined)
  .then(() => continueRender(fonts));
