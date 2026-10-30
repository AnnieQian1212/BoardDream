/**
 * Frame time for damping. With on-demand rendering the first frame after an idle stretch reports
 * the whole gap; capping it keeps animations from snapping to their end.
 */
export const step = (dt: number) => Math.min(dt, 1 / 30);

/** The player asked their system for less motion: effects that follow the pointer stay still. */
export const reducedMotion = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
