import { readFileSync } from "node:fs";
import { createRng, fitBounds, resolveParams, squareGridGeometry, type GameModule, type Panel } from "@boarddream/engine";
import { fixtureGames, referenceGames } from "@boarddream/library";
import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, test } from "vitest";
import { depthBelow, fitCamera, FOV, screenProjector } from "./camera";
import { CARD_H, CHIP, fitTable, layoutTable, type Arrangement, type TableLayout } from "./layout";

const resourcesOf = (game: GameModule) => new Map((game.meta.resources ?? []).map((r) => [r.id, r]));

/** Layouts of a random playout from seat 0's point of view, with seat 0's legal moves as targets. */
function* playout(game: GameModule, seed: number, steps: number, arrangement: Arrangement = "sides"): Generator<{ layout: TableLayout; targets: Set<string> }> {
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
      // Rival mats stand wholly to the left or right of the board and the shared supply, or (one, when
      // the rivals are odd) wholly above them, across the table.
      const middle = layout.mats.filter((m) => m.shared);
      const far = Math.min(...middle.map((m) => m.position[2] - m.depth / 2), ...(layout.board ? [layout.board.position[2] - layout.board.depth / 2] : []));
      const xs = [...middle.map((m) => [m.position[0] - m.width / 2, m.position[0] + m.width / 2]), ...(layout.board ? [[layout.board.position[0] - layout.board.width / 2, layout.board.position[0] + layout.board.width / 2]] : [])].flat();
      if (xs.length === 0) continue;
      const [lo, hi] = [Math.min(...xs), Math.max(...xs)];
      const rivals = layout.mats.filter((m) => !m.shared && m.title !== "You");
      const across = rivals.filter((m) => m.position[2] + m.depth / 2 <= far + 0.01);
      expect(across.length, "rivals across the table").toBeLessThanOrEqual(1);
      for (const m of rivals.filter((m) => !across.includes(m))) {
        expect(m.position[0] + m.width / 2 <= lo + 0.01 || m.position[0] - m.width / 2 >= hi - 0.01, `${m.title} sits beside the middle`).toBe(true);
      }
    }
  });

  test.each(["stack"] as const)("with the %s arrangement, lets no mat overlap another or the board", (arrangement) => {
    for (const { layout } of playout(game, 5, 20, arrangement)) {
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

describe("a table laid out before the window has a size", () => {
  // A hidden tab or a reload mid-resize measures no scale, and a draft's board can have no extent
  // yet; either once made columns() push onto a column that did not exist.
  const game = referenceGames.find((g) => g.meta.id === "lantern-isles")!;
  const state = game.setup({ numPlayers: 3, params: resolveParams(game.params), rng: createRng(1) });
  const panels = game.panels?.(state, 0) ?? [];
  const geometry = game.geometry!(state, 0);

  test.each(["sides", "stack"] as const)("still lays out with no scale (%s)", (arrangement) => {
    const layout = layoutTable({ panels, geometry, human: 0, targets: new Set(), resources: resourcesOf(game), pxPerUnit: Number.NaN, arrangement });
    expect(layout.mats.length).toBeGreaterThan(0);
    for (const p of layout.outline) expect(p.every(Number.isFinite)).toBe(true);
  });

  test.each(["sides", "stack"] as const)("still lays out a board with no extent (%s)", (arrangement) => {
    const flat = { ...geometry, width: 0, height: 0, cells: [], pieces: [] };
    const layout = layoutTable({ panels, geometry: flat, human: 0, targets: new Set(), resources: resourcesOf(game), arrangement });
    for (const p of layout.outline) expect(p.every(Number.isFinite)).toBe(true);
  });
});

describe("a table fitted to a screen", () => {
  const game = referenceGames.find((g) => g.meta.id === "lantern-isles")!;
  const inputAt = (state: unknown, active: number) => {
    const raw = game.geometry!(state, 0);
    return { panels: game.panels!(state, 0), geometry: fitBounds(raw), human: 0, active, targets: new Set<string>(), resources: resourcesOf(game) };
  };
  const desktop = { width: 1680, height: 1050, insets: { left: 0, right: 0, top: 66, bottom: 92 } };
  const phone = { width: 390, height: 844, insets: { left: 0, right: 0, top: 66, bottom: 92 } };
  const state = game.setup({ numPlayers: 3, params: resolveParams(game.params), rng: createRng(1) });

  test("a wide screen keeps chips full size; a phone stacks the rivals and shrinks the chips", () => {
    const wide = fitTable(inputAt(state, 0), desktop);
    expect(wide.arrangement).toBe("sides");
    expect(wide.chipScale).toBe(1);
    const tall = fitTable(inputAt(state, 0), phone);
    expect(tall.arrangement).toBe("stack");
    expect(tall.chipScale).toBeLessThan(1);
    expect(tall.chipScale).toBeGreaterThanOrEqual(0.4);
  });

  test("the arrangement holds from move to move", () => {
    const rng = createRng(9);
    let s = game.setup({ numPlayers: 3, params: resolveParams(game.params), rng });
    let arrangement = fitTable(inputAt(s, 0), desktop).arrangement;
    let changes = 0;
    for (let step = 0; step < 40 && !game.isTerminal(s); step++) {
      const [seat] = game.activePlayers(s);
      s = game.applyMove(s, seat, rng.pick(game.legalMoves(s, seat)), rng);
      const next = fitTable(inputAt(s, game.activePlayers(s)[0] ?? 0), desktop, arrangement).arrangement;
      if (next !== arrangement) changes++;
      arrangement = next;
    }
    expect(changes).toBeLessThanOrEqual(1);
  });
});

describe("rows of chips under a supply's header", () => {
  // A supply with more counters than its header holds, so they wrap in rows over its cards.
  const supply: Panel = {
    id: "supply",
    title: "Sector supply",
    zone: "shared",
    counters: [
      ...["Round", "Moss left", "Bramble left", "Canopy left"].map((label, i) => ({ id: `c${i}`, label, value: 12 })),
      { id: "deck", label: "Deck", value: 6 },
    ],
    cards: [1, 2, 3, 4, 5].map((i) => ({ id: `card${i}`, title: `Card ${i}` })),
  };
  const seat = (owner: number, title: string): Panel => ({
    id: `seat${owner}`,
    title,
    zone: "players",
    owner,
    counters: [
      { id: `docked${owner}`, label: "Docked", value: 0 },
      { id: `moss${owner}`, label: "Moss", value: 3, resource: "moss" },
    ],
  });
  const input = {
    panels: [supply, seat(0, "You"), seat(1, "Gardener 2")],
    geometry: squareGridGeometry(5, 8),
    human: 0,
    targets: new Set<string>(),
    resources: new Map(),
  };
  const desktop = { width: 1707, height: 960, insets: { left: 0, right: 0, top: 66, bottom: 92 } };

  test("take more of the table on its far side, where a pixel covers more of it", () => {
    const { layout } = fitTable(input, desktop);
    const project = screenProjector(layout, desktop.width, desktop.height, desktop.insets);
    const far: [number, number, number] = [0, 0.3, layout.bounds.min[2] + 2];
    const near: [number, number, number] = [0, 0.3, layout.bounds.max[2] - 8];
    const room = depthBelow(project, far, 128);
    expect(project([far[0], far[1], far[2] + room])[1] - project(far)[1]).toBeCloseTo(128, 0);
    expect(room).toBeGreaterThan(1.1 * depthBelow(project, near, 128));
  });

  test("keep the mats their size on a wide screen, where the camera stands closer", () => {
    // At 2276 x 1055 a search for the chips' room reached past the camera and stretched every mat
    // with wrapped chips 400 units down the table.
    for (const [width, height] of [[2276, 1055], [2560, 1080], [3440, 1440]]) {
      const { layout } = fitTable(input, { width, height, insets: { left: 0, right: 0, top: 66, bottom: 92 } });
      for (const mat of layout.mats) expect(mat.depth, `${mat.title} at ${width}x${height}`).toBeLessThan(80);
    }
  });

  test("stop short of the cards under them, on the camera that frames the table", () => {
    const { layout } = fitTable(input, desktop);
    const project = screenProjector(layout, desktop.width, desktop.height, desktop.insets);
    const badge = layout.badges.find((b) => b.id === "supply")!;
    expect(badge.wrap).toBe(true);
    // Four counters, one to a row across this narrow supply, each row with the gap under it.
    const chipsBottom = project(badge.position)[1] + 4 * (CHIP.height + CHIP.gap);
    const cardsTop = Math.min(...layout.cards.filter((c) => c.zone === "shared").map((c) => project([badge.position[0], 0.3, c.position[2] - CARD_H / 2])[1]));
    // Measured at the table's middle scale, the room left about a pixel past the last row's gap,
    // and the real table, framed a little differently, put the last chip on the cards.
    expect(cardsTop - chipsBottom).toBeGreaterThan(3);
  });
});

test("the chips' measures match the stylesheet", () => {
  const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const rule = (selector: string) => css.slice(css.indexOf(selector), css.indexOf("}", css.indexOf(selector)));
  expect(rule(".badge-chip,\n.badge-note,\n.turn-pill {")).toContain(`height: ${CHIP.height}px`);
  expect(rule(".badge-note > span {")).toContain(`-webkit-line-clamp: ${CHIP.noteLines}`);
  expect(rule(".badge-note > span {")).toContain(`line-height: ${CHIP.noteLine}px`);
  const chip = rule(".badge-chip,\n.badge-note,\n.turn-pill {");
  expect(chip).toContain(`padding: 0 ${CHIP.padding}px`);
  expect(chip).toContain(`gap: ${CHIP.inner}px`);
  expect(css).toContain(`--edge: ${CHIP.border}px solid`);
  expect(rule(".badge-chip small {")).toContain(`font-size: ${CHIP.label}px`);
  expect(rule(".badge-chip small {")).toContain(`letter-spacing: ${CHIP.tracking}em`);
});

describe("rivals round the table", () => {
  const board = { width: 10, height: 8, cells: [{ id: "c", polygon: [[0, 0], [10, 0], [10, 8], [0, 8]] as [number, number][] }], pieces: [] };
  const seat = (owner: number) => ({ id: `seat${owner}`, title: `Player ${owner + 1}`, zone: "players" as const, owner, counters: [] });
  test.each([
    [2, 1, 1, 0],
    [3, 1, 1, 1],
    [4, 2, 2, 0],
    [5, 2, 2, 1],
  ])("seats %i rivals as %i on the left, %i on the right and %i across", (rivals, left, right, opposite) => {
    const panels = [seat(0), ...Array.from({ length: rivals }, (_, i) => seat(i + 1))];
    const { layout, arrangement } = fitTable(
      { panels, geometry: board, human: 0, active: 0, targets: new Set(), resources: new Map() },
      { width: 1707, height: 960, insets: { top: 60, right: 0, bottom: 80, left: 0 } },
    );
    expect(arrangement).toBe("sides");
    const middle = layout.board!.position[0];
    const rivalMats = layout.mats.filter((m) => !m.shared && m.id !== "seat0");
    const slab = layout.board!;
    const sideways = rivalMats.filter((m) => m.position[2] + m.depth / 2 > slab.position[2] - slab.depth / 2);
    expect(sideways.filter((m) => m.position[0] < middle).length).toBe(left);
    expect(sideways.filter((m) => m.position[0] > middle).length).toBe(right);
    // Across the table: above the board, and the last rival in turn order.
    const across = rivalMats.filter((m) => m.position[2] + m.depth / 2 <= slab.position[2] - slab.depth / 2);
    expect(across.map((m) => m.id)).toEqual(opposite ? [`seat${rivals}`] : []);
  });
});
