/** BoardDream's mark: a gold hexagon with a four-pointed star. */
export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="brand-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f6d98b" />
          <stop offset="100%" stopColor="#d99a2b" />
        </linearGradient>
      </defs>
      <path d="M16 2.5 27.7 9.25v13.5L16 29.5 4.3 22.75V9.25Z" fill="url(#brand-gold)" />
      <path d="M16 9.5l1.9 4.6 4.6 1.9-4.6 1.9L16 22.5l-1.9-4.6-4.6-1.9 4.6-1.9Z" fill="#2a2520" />
    </svg>
  );
}
