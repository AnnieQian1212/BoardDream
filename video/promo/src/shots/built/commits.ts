// Commits a day in this repository's public log, in Eastern time, counted on Nov 4, 2026 at 3:43 PM:
//   git log --date=format-local:%Y-%m-%d --format=%ad | sort | uniq -c
// Each day's label is one thing that landed that day, from docs/BUILT.md and the log; short enough
// that all ten read at once in the timeline's full view (two staggered rows under the dates).
export type Day = { d: string; n: number; label: string };

export const DAYS: Day[] = [
  { d: "Oct 26", n: 1, label: "Kickoff" },
  { d: "Oct 27", n: 22, label: "One-sentence games" },
  { d: "Oct 28", n: 17, label: "Rivals, house rules" },
  { d: "Oct 29", n: 6, label: "Rippling water" },
  { d: "Oct 30", n: 9, label: "Real physics" },
  { d: "Oct 31", n: 9, label: "4× faster" },
  { d: "Nov 1", n: 49, label: "Storybook look" },
  { d: "Nov 2", n: 91, label: "Friends, mochi, live" },
  { d: "Nov 3", n: 43, label: "SAM 3.1 art check" },
  { d: "Nov 4", n: 5, label: "Submitted" },
];

export const TOTAL_COMMITS = DAYS.reduce((s, d) => s + d.n, 0); // 252
export const PEAK = Math.max(...DAYS.map((d) => d.n));
