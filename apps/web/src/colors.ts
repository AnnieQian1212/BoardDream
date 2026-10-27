/** Seat colors: coral, steel blue, mustard, sage, plum, rose. Tuned to read on light wood, pastel mats and card paper. */
export const PLAYER_COLORS = ["#dd6448", "#3f7fc2", "#d0961f", "#4f9a6c", "#9467c2", "#d06688"];

export const playerColor = (seat: number | undefined) => PLAYER_COLORS[(seat ?? 0) % PLAYER_COLORS.length];
