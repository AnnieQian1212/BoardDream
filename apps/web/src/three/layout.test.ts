import { createRng, resolveParams, type GameModule } from "@boarddream/engine";
import { fixtureGames, referenceGames } from "@boarddream/library";
import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, test } from "vitest";
import { fitCamera, FOV } from "./camera";
import { layoutTable, type TableLayout } from "./layout";

const resourcesOf = (game: GameModule) => new Map((game.meta.resources ?? []).map((r) => [r.id, r]));

/** Layouts of a random playout from seat 0's point of view, with seat 0's legal moves as targets. */
function* playout(game: GameModule, seed: number, steps: number, arrangement: "sides" | "right" = "sides"): Generator<{ layout: TableLayout; targets: Set<string> }> {
  const rng = createRng(seed);
  const numPlayers = Math.min(game.meta.maxPlayers, Math.max(game.meta.minPlayers, 3));
  let state = game.setup({ numPlayers, params: resolveParams(game.params), rng });
  for (let step = 0; step < steps && !game.isTerminal(state); step++) {
    const [active] = game.activePlayers(state);
    const targets = new Set<string>();
    if (active === 0) for (const move of game.legalMoves(state, 0)) targets.add(game.moveTarget?.(state, move) ?? "");
    targets.delete("");
    const layout = layoutTable({
      panels: game.panels?.(state, 0) ?? [],
      geometry: game.geometry?.(state, 0),
      human: 0,
      active,
      targets,
      resources: resourcesOf(game),
      arrangement,
    });
    yield { layout, targets };
    const moves = game.legalMoves(state, active);
    state = game.applyMove(state, active, moves[rng.int(moves.length)], rng);
  }
}

describe.each([...referenceGames, ...fixtureGames].map((g) => [g.meta.id, g] as const))("%s on the 3D table", (_id, game) => {
  test("places every card once and gives every target something to click", () => {
    for (const { layout, targets } of playout(game, 7, 80)) {
      const ids = layout.cards.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
      const clickable = new Set([
        ...ids,
        ...layout.piles.map((p) => p.id),
        ...layout.decks.map((d) => d.id),
        ...layout.badges.flatMap((b) => b.counters.map((c) => c.id)),
        ...(layout.board?.geometry.cells.filter((c) => c.kind !== "label").map((c) => c.id) ?? []),
      ]);
      for (const target of targets) expect(clickable.has(target), target).toBe(true);
      for (const p of layout.outline) expect(p.every(Number.isFinite)).toBe(true);
    }
  });

  test("seats rivals beside the middle and lets no mat overlap another or the board", () => {
    for (const { layout } of playout(game, 5, 20)) {
      const rects = [
        ...layout.mats.map((m) => ({ id: m.id, x: m.position[0], z: m.position[2], w: m.width, d: m.depth })),
        ...(layout.board ? [{ id: "board", x: layout.board.position[0], z: layout.board.position[2], w: layout.board.width, d: layout.board.depth }] : []),
      ];
      for (const [i, a] of rects.entries()) {
        for (const b of rects.slice(i + 1)) {
          const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 - 0.01 || Math.abs(a.z - b.z) >= (a.d + b.d) / 2 - 0.01;
          expect(apart, `${a.id} overlaps ${b.id}`).toBe(true);
        }
      }
      // Rival mats stand wholly to the left or right of the board and the shared supply.
      const middle = layout.mats.filter((m) => m.shared);
      const xs = [...middle.map((m) => [m.position[0] - m.width / 2, m.position[0] + m.width / 2]), ...(layout.board ? [[layout.board.position[0] - layout.board.width / 2, layout.board.position[0] + layout.board.width / 2]] : [])].flat();
      if (xs.length === 0) continue;
      const [lo, hi] = [Math.min(...xs), Math.max(...xs)];
      for (const m of layout.mats.filter((m) => !m.shared && m.title !== "You")) {
        expect(m.position[0] + m.width / 2 <= lo + 0.01 || m.position[0] - m.width / 2 >= hi - 0.01, `${m.title} sits beside the middle`).toBe(true);
      }
    }
  });

  test("with everything standing to the right of the board, lets no mat overlap another or the board", () => {
    for (const { layout } of playout(game, 5, 20, "right")) {
      const rects = [
        ...layout.mats.map((m) => ({ id: m.id, x: m.position[0], z: m.position[2], w: m.width, d: m.depth })),
        ...(layout.board ? [{ id: "board", x: layout.board.position[0], z: layout.board.position[2], w: layout.board.width, d: layout.board.depth }] : []),
      ];
      for (const [i, a] of rects.entries()) {
        for (const b of rects.slice(i + 1)) {
          const apart = Math.abs(a.x - b.x) >= (a.w + b.w) / 2 - 0.01 || Math.abs(a.z - b.z) >= (a.d + b.d) / 2 - 0.01;
          expect(apart, `${a.id} overlaps ${b.id}`).toBe(true);
        }
      }
    }
  });

  test("the camera frames the whole table inside the uncovered part of the screen", () => {
    const [width, height] = [1680, 1050];
    const insets = { left: 326, right: 326, top: 66, bottom: 92 };
    for (const { layout } of playout(game, 3, 12)) {
      const { position, target } = fitCamera(layout, width, height, insets);
      const cam = new PerspectiveCamera(FOV, width / height, 1, 5000);
      cam.setViewOffset(width, height, -(insets.left - insets.right) / 2, -(insets.top - insets.bottom) / 2, width, height);
      cam.position.copy(position);
      cam.lookAt(target);
      cam.updateMatrixWorld();
      for (const p of layout.outline) {
        const v = new Vector3(...p).project(cam);
        const x = ((v.x + 1) / 2) * width;
        const y = ((1 - v.y) / 2) * height;
        expect(x).toBeGreaterThanOrEqual(insets.left - 1);
        expect(x).toBeLessThanOrEqual(width - insets.right + 1);
        expect(y).toBeGreaterThanOrEqual(insets.top - 1);
        expect(y).toBeLessThanOrEqual(height - insets.bottom + 1);
      }
    }
  });
});
