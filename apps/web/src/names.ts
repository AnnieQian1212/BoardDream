/**
 * A revised game's name without its version: "Grove (revised 2)" is "Grove", version "Version 3".
 * The server names revisions that way (revisedTitle in apps/server/src/store.ts).
 */
export function splitVersion(title: string): { name: string; version?: string } {
  const match = title.match(/^(.*) \(revised(?: (\d+))?\)$/);
  if (!match) return { name: title };
  return { name: match[1], version: `Version ${Number(match[2] ?? 1) + 1}` };
}
