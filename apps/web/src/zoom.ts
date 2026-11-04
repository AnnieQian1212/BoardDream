/**
 * The page's CSS zoom: on a computer screen styles.css draws the whole interface at 75%, as a
 * browser zoomed out to 75% would. Pointer positions and boxes come in screen pixels, while a style
 * set inside the page is in its own, zoomed pixels: divide by this to place something at a pointer.
 */
export const pageZoom = (): number => Number.parseFloat(getComputedStyle(document.documentElement).zoom) || 1;

/** A screen position (a pointer's, a box's) as a length inside the zoomed page. */
export const unzoom = (px: number): number => px / pageZoom();
