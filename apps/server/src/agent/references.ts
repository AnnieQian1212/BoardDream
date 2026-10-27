import { readFileSync } from "node:fs";
import { catalog, type CatalogEntry } from "@boarddream/library";

const REPO_ROOT = new URL("../../../../", import.meta.url);

const read = (path: string) => readFileSync(new URL(path, REPO_ROOT), "utf8");

/** The fixed engine interface, shown verbatim to the designer model. */
export const engineInterfaceSource = () => read("packages/engine/src/types.ts");

export interface Reference {
  entry: CatalogEntry;
  code?: string;
}

export function loadReference(id: string): Reference | undefined {
  const entry = catalog.find((e) => e.id === id);
  if (!entry) return undefined;
  return { entry, code: entry.source ? read(`packages/library/src/${entry.source}`) : undefined };
}
