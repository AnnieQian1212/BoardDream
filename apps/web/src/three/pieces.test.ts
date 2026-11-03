import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { describe, expect, test } from "vitest";
import { pieceForm, pieceForms, pieceTurn } from "./pieces";

describe("the wooden pieces", () => {
  test("a piece whose kind names a thing is cut in its shape; others keep their shape's form", () => {
    expect(pieceForm({ kind: "village", shape: "disc" })).toBe("house");
    expect(pieceForm({ kind: "outpost", shape: "square" })).toBe("house");
    expect(pieceForm({ kind: "bot", shape: "pawn" })).toBe("robot");
    expect(pieceForm({ kind: "sky-ship" })).toBe("ship");
    expect(pieceForm({ kind: "Lighthouse", shape: "disc" })).toBe("tower");
    expect(pieceForm({ kind: "grove" })).toBe("tree");
    expect(pieceForm({ kind: "crew", shape: "pawn" })).toBe("figure");
    expect(pieceForm({ kind: "tether", shape: "square" })).toBe("cube");
    expect(pieceForm({ kind: "cairn" })).toBe("token");
    // Words inside other words do not count: a "hutch" is not a hut, a "cityscape" not a city.
    expect(pieceForm({ kind: "hutch", shape: "disc" })).toBe("token");
  });

  test("a labelled piece is not made a tree, which has no flat face to print the label on", () => {
    expect(pieceForm({ kind: "grove", shape: "disc" }, true)).toBe("token");
    expect(pieceForm({ kind: "village", shape: "disc" }, true)).toBe("house");
  });

  test("every form reaches one radius from its middle and stands on the table", () => {
    for (const [name, form] of Object.entries(pieceForms())) {
      form.geometry.computeBoundingBox();
      const b = form.geometry.boundingBox!;
      expect(b.min.y, name).toBeCloseTo(0, 5);
      expect(Math.max(-b.min.x, b.max.x, -b.min.z, b.max.z), name).toBeCloseTo(1, 5);
      expect(form.height, name).toBeGreaterThan(0.4);
    }
  });

  test("a label printed on a piece sits on its face, with no part of the piece over it", () => {
    for (const [name, form] of Object.entries(pieceForms())) {
      const mark = form.mark;
      if (!mark) continue;
      const mesh = new Mesh(form.geometry, new MeshBasicMaterial({ side: DoubleSide }));
      const ray = new Raycaster();
      const half = mark.size / 2;
      let over = -Infinity;
      // Rays onto the face across the label (its round middle, where the text is drawn): the piece's
      // surface must lie under the label everywhere, not only at its corners.
      for (let i = -4; i <= 4; i++) {
        for (let j = -4; j <= 4; j++) {
          const [u, v] = [(i / 4) * half * 0.9, (j / 4) * half * 0.9];
          if (Math.hypot(u, v) > half * 0.9) continue;
          if (mark.facing === "up") ray.set(new Vector3(u, 10, v), new Vector3(0, -1, 0));
          else ray.set(new Vector3(u, mark.y + v, 10), new Vector3(0, 0, -1));
          const [hit] = ray.intersectObject(mesh);
          if (hit) over = Math.max(over, mark.facing === "up" ? hit.point.y - mark.y : hit.point.z - mark.z);
        }
      }
      expect(over, name).toBeLessThanOrEqual(1e-6);
    }
  });

  test("a piece is turned the same each time it is drawn, by a little", () => {
    expect(pieceTurn("bot-a-1")).toBe(pieceTurn("bot-a-1"));
    expect(Math.abs(pieceTurn("bot-a-1"))).toBeLessThanOrEqual(0.2);
  });
});
