import { useId } from "react";

/**
 * BoardDream's mark: a gold hex tile (the board) holding a dark crescent moon and a star (the
 * dream). It keeps the first mark's gold and ink, and reads at favicon size; index.html carries
 * the same drawing as the favicon.
 */
export function BrandMark() {
  const id = useId();
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6d98b" />
          <stop offset="100%" stopColor="#d99a2b" />
        </linearGradient>
        <mask id={`${id}-moon`}>
          <rect width="32" height="32" fill="white" />
          <circle cx="17.6" cy="13.4" r="6.1" fill="black" />
        </mask>
      </defs>
      <path d="M16 2.5 27.7 9.25v13.5L16 29.5 4.3 22.75V9.25Z" fill={`url(#${id}-gold)`} />
      <circle cx="14.2" cy="16.4" r="7.4" fill="#2a2520" mask={`url(#${id}-moon)`} />
      <path d="M21.4 9.2l.85 2 2 .85-2 .85-.85 2-.85-2-2-.85 2-.85Z" fill="#2a2520" />
    </svg>
  );
}
