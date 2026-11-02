import { useEffect, useState } from "react";

/**
 * Painted box covers (Muse Image), by game id: the ones shipped with the web app
 * (public/covers, so a static deploy has them) and those the server painted, when one runs. A game
 * with neither wears a printed cover in its own colors (GameCover).
 */

let loading: Promise<Map<string, string>> | undefined;

async function readList(url: string, base: string, into: Map<string, string>) {
  try {
    const res = await fetch(url);
    if (!res.ok) return;
    const list = (await res.json()) as Record<string, string>;
    for (const [id, file] of Object.entries(list)) if (typeof file === "string") into.set(id, file.startsWith("/") ? file : `${base}${file}`);
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

/** The covers known so far; `fresh` changes ask again (a game just made may have one by now). */
export function useCovers(fresh = 0): Map<string, string> {
  const [covers, setCovers] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    let alive = true;
    void loadCovers(fresh > 0).then((found) => alive && setCovers(found));
    return () => {
      alive = false;
    };
  }, [fresh]);
  return covers;
}
