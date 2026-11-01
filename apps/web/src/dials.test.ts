import { catalog } from "@boarddream/library";
import { describe, expect, it } from "vitest";
import { MECHANICS } from "./dials";

describe("create panel mechanics", () => {
  it("are tested mechanics in the library, each offered in some mode", () => {
    const ready = new Set(catalog.filter((e) => e.kind === "mechanic" && e.status === "ready").map((e) => e.id));
    for (const m of MECHANICS) {
      expect(ready, m.id).toContain(m.id);
      expect(m.modes.length).toBeGreaterThan(0);
    }
    expect(new Set(MECHANICS.map((m) => m.id)).size).toBe(MECHANICS.length);
  });
});
