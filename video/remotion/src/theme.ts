import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/inter";
import { continueRender, delayRender } from "remotion";

/** The app's storybook palette (apps/web/src/styles.css) and its two typefaces. */
export const C = {
  paper: "#fbf5e8",
  paper2: "#efe3c9",
  ink: "#2d2016",
  inkMuted: "#5f5547",
  teal: "#138f9f",
  gold: "#d99a2b",
  rust: "#c8613f",
  moss: "#7f9a48",
  sky: "#a9ccd6",
  blush: "#e8ad9c",
  wood: "#e3c18f",
};
export const DISPLAY = '"Fraunces Variable", Georgia, serif';
export const UI = '"Inter Variable", system-ui, sans-serif';

export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** The fonts are in before a frame is drawn. */
const fonts = delayRender("Loading the app's fonts");
Promise.all([document.fonts.load('600 64px "Fraunces Variable"'), document.fonts.load('500 40px "Inter Variable"')])
  .catch(() => undefined)
  .then(() => continueRender(fonts));
