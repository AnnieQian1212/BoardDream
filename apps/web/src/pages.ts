/**
 * The app's pages as addresses: home is the bare address, the games page `?games`, a game's table
 * `?game=<id>`, its print and play kit `?game=<id>&print`, and Behind the scenes `?results` over
 * either. Other flags in the address (`flat`,
 * `quality`, `bots`, `watch`, ...) are kept as they are.
 */
export interface Page {
  table: boolean;
  game?: string;
  library: boolean;
  results: boolean;
  /** The print and play kit, over a game's table. */
  print?: boolean;
}

/** The page an address's query names. */
export function pageAt(search: string): Page {
  const q = new URLSearchParams(search);
  return { table: q.has("game") || q.has("watch"), game: q.get("game") ?? undefined, library: q.has("games"), results: q.has("results"), print: q.has("print") };
}

/** The address (path and query) of `page`, keeping the other flags of `location`. */
export function pageAddress(location: { pathname: string; search: string }, page: Page): string {
  const q = new URLSearchParams(location.search);
  for (const key of ["game", "games", "results", "print"]) q.delete(key);
  if (page.table && page.game) q.set("game", page.game);
  if (page.table && page.game && page.print) q.set("print", "");
  if (page.library) q.set("games", "");
  if (page.results) q.set("results", "");
  // A flag with no value reads `?games`, not `?games=`.
  const search = q.toString().replace(/=(?=&|$)/g, "");
  return `${location.pathname}${search ? `?${search}` : ""}`;
}
