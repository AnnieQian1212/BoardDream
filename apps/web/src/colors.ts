/** Seat colors: warm coral, sky blue, gold, sage. Tuned to read on the dark felt and on card paper. */
export const PLAYER_COLORS = ["#e2674f", "#4f9fd8", "#e6b64a", "#6dbf86", "#b07ad8", "#e0889f"];

export const playerColor = (seat: number | undefined) => PLAYER_COLORS[(seat ?? 0) % PLAYER_COLORS.length];
