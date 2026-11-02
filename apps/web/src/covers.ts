import { useEffect, useRef, useState } from "react";

/**
 * Painted box covers (Muse Image), by game id: the ones shipped with the web app
 * (public/covers, so a static deploy has them) and those the server painted, when one runs. A game
 * with neither wears a printed cover in its own colors (GameCover).
 */

let loading: Promise<Map<string, string>> | undefined;

/** Adds a list's covers; a game already covered keeps its first one (the shipped copies are smaller). */
async function readList(url: string, base: string, into: Map<string, string>) {
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const list = (await res.json()) as Record<string, string>;
    for (const [id, file] of Object.entries(list)) {
      if (typeof file === "string" && !into.has(id)) into.set(id, file.startsWith("/") ? file : `${base}${file}`);
    }
  } catch {
    // No list there (the static demo has no server; a dev server may have no covers yet).
  }
}

export function loadCovers(fresh = false): Promise<Map<string, string>> {
  if (fresh || !loading) {
    loading = (async () => {
      const covers = new Map<string, string>();
      const shipped = `${import.meta.env.BASE_URL}covers/`;
      await readList(`${shipped}index.json`, shipped, covers);
      await readList("/api/covers", "", covers);
      return covers;
    })();
  }
  return loading;
}

/**
 * The covers known so far. Each time `key` changes the list is asked for again: a game just made
 * has its cover painted in the background, so it turns up on a later look at the shelf.
 */
export function useCovers(key: string): Map<string, string> {
  const [covers, setCovers] = useState<Map<string, string>>(new Map());
  const asked = useRef(false);
  useEffect(() => {
    let alive = true;
    void loadCovers(asked.current).then((found) => alive && setCovers(found));
    asked.current = true;
    return () => {
      alive = false;
    };
  }, [key]);
  return covers;
}
