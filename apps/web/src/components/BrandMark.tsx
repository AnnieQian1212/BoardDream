import { useId } from "react";

/**
 * BoardDream's mark: a teal tile, inked like the table's pieces, with a cream crescent moon (the
 * dream) cradling a gold die (the board game) and a star. It reads at favicon size; index.html
 * carries the same drawing as the favicon.
 */
export function BrandMark() {
  const moon = useId();
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <mask id={moon}>
          <rect width="32" height="32" fill="white" />
          <circle cx="18.6" cy="11.6" r="7.4" fill="black" />
        </mask>
      </defs>
      <rect x="1.5" y="1.5" width="29" height="29" rx="8" fill="#178e9c" stroke="#2a2520" strokeWidth="2" />
      <circle cx="13.6" cy="15.6" r="9.2" fill="#fbf1dc" mask={`url(#${moon})`} />
      <path d="M24.2 5.6l.75 1.75 1.75.75-1.75.75-.75 1.75-.75-1.75-1.75-.75 1.75-.75Z" fill="#fbf1dc" />
      <g transform="rotate(-13 21.2 20.6)">
        <rect x="16.4" y="15.8" width="9.6" height="9.6" rx="2.4" fill="#f2b632" stroke="#2a2520" strokeWidth="1.7" />
        <circle cx="19" cy="18.4" r="1.05" fill="#2a2520" />
        <circle cx="21.2" cy="20.6" r="1.05" fill="#2a2520" />
        <circle cx="23.4" cy="22.8" r="1.05" fill="#2a2520" />
      </g>
    </svg>
  );
}
