import type { GeometryPiece } from "@boarddream/engine";
import { BoxGeometry, BufferGeometry, CanvasTexture, ExtrudeGeometry, LatheGeometry, RepeatWrapping, Shape, SRGBColorSpace, Vector2 } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/**
 * The wooden pieces on the board, as the box of a printed game would hold them: workers as figures
 * with arms and legs, round tokens with a raised rim, cubes, and for pieces whose kind names what
 * they are, a house, a tower, a ship, a tree or a robot cut in that shape. Each form is one shared
 * geometry, one radius across from its middle, standing on y = 0 and facing +z, toward the camera.
 */

export type PieceForm = "figure" | "token" | "cube" | "house" | "tower" | "ship" | "tree" | "robot";

/** Words in a piece's kind that ask for a form of their own, checked in this order. */
const FORMS_BY_KIND: [PieceForm, RegExp][] = [
  ["robot", /\b(bot|robot|automaton|golem|drone|android|mech)s?\b/],
  ["ship", /\b(ship|boat|barge|skiff|ferry|raft|galleon|airship|canoe|junk|sloop|schooner|vessel|caravel|frigate)s?\b/],
  ["tower", /\b(tower|castle|keep|fort|fortress|citadel|city|cities|lighthouse|beacon|spire|temple|shrine|church|abbey|cathedral|palace|watchtower)s?\b/],
  ["house", /\b(house|village|home|hut|cottage|settlement|outpost|camp|homestead|farm|inn|shop|stall|cafe|tavern|depot|hall|workshop|market|manor|station|lodge|cabin)s?\b/],
  ["tree", /\b(tree|grove|sapling|orchard|forest|garden|sprout|seedling|plant|bush|shrub)s?\b/],
];

/**
 * The form a piece is drawn in: the one its kind names, else its shape's. `marked` pieces carry a
 * label or motif, which a tree has no flat face to take.
 */
export function pieceForm(piece: Pick<GeometryPiece, "shape" | "kind">, marked = false): PieceForm {
  const words = (piece.kind ?? "").toLowerCase().replace(/[-_]/g, " ");
  const named = FORMS_BY_KIND.find(([, pattern]) => pattern.test(words))?.[0];
  if (named && !(named === "tree" && marked)) return named;
  return piece.shape === "pawn" ? "figure" : piece.shape === "square" ? "cube" : "token";
}

export interface FormShape {
  geometry: BufferGeometry;
  /** Height in radii. */
  height: number;
  /**
   * Where a label or motif is printed: on a flat top, or on the front face (z is that face's
   * distance in front of the middle); y and size in radii.
   */
  mark?: { y: number; z: number; size: number; facing: "up" | "front" };
  /** Turned a little, as a hand sets it down; a round piece is not. */
  turns: boolean;
}

/** A flat outline cut from a board `depth` thick, edges softened by `bevel`. */
function cutout(shape: Shape, depth: number, bevel: number): BufferGeometry {
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 7 });
}

/** An outline drawn as its right half from the top of the middle line down; the left is its mirror. */
function symmetric(right: [number, number][]): Shape {
  const s = new Shape();
  const left = right.map(([x, y]): [number, number] => [-x, y]).reverse();
  [...right, ...left].forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  return s;
}

const lathe = (points: number[][], segments = 32) => new LatheGeometry(points.map(([x, y]) => new Vector2(x, y)), segments);

/**
 * Centres a geometry over the origin, stands it on y = 0 and scales it to reach one unit from its
 * middle across the table, so a piece of radius r drawn at scale r covers its spot. `mark` is given
 * as shares of the height (y) and of the radius (size).
 */
function form(g: BufferGeometry, turns: boolean, mark?: { at: number; size: number; facing: "up" | "front" }): FormShape {
  g.computeBoundingBox();
  let b = g.boundingBox!;
  g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  g.computeBoundingBox();
  b = g.boundingBox!;
  const reach = Math.max(b.max.x, b.max.z);
  g.scale(1 / reach, 1 / reach, 1 / reach);
  g.computeBoundingBox();
  b = g.boundingBox!;
  const height = b.max.y;
  return {
    geometry: g,
    height,
    turns,
    mark: mark && { y: mark.at * height, z: mark.facing === "front" ? b.max.z : 0, size: mark.size, facing: mark.facing },
  };
}

/** A worker: legs apart, arms out, a round head, cut from a thick board. */
function figure(): BufferGeometry {
  const s = new Shape();
  s.moveTo(-0.92, 0);
  s.lineTo(-0.2, 0);
  s.quadraticCurveTo(0, 0.6, 0.2, 0);
  s.lineTo(0.92, 0);
  s.quadraticCurveTo(0.86, 0.48, 0.5, 0.95);
  s.lineTo(0.44, 1.12);
  s.quadraticCurveTo(0.72, 1.16, 0.98, 1.28);
  s.quadraticCurveTo(1.14, 1.44, 0.96, 1.6);
  s.quadraticCurveTo(0.62, 1.6, 0.21, 1.66);
  // The head, over the top from the right of the neck to the left.
  const [r, neck] = [0.37, 0.21];
  const a = Math.asin(neck / r);
  s.absarc(0, 1.66 + Math.sqrt(r * r - neck * neck), r, -Math.PI / 2 + a, (3 * Math.PI) / 2 - a, false);
  s.quadraticCurveTo(-0.62, 1.6, -0.96, 1.6);
  s.quadraticCurveTo(-1.14, 1.44, -0.98, 1.28);
  s.quadraticCurveTo(-0.72, 1.16, -0.44, 1.12);
  s.lineTo(-0.5, 0.95);
  s.quadraticCurveTo(-0.86, 0.48, -0.92, 0);
  return cutout(s, 0.62, 0.13);
}

/** A robot: a square head with an aerial, a boxy body, arms out, two legs. */
function robot(): BufferGeometry {
  const body = cutout(
    symmetric([
      [0, 2.22],
      [0.06, 2.22],
      [0.06, 1.96],
      [0.5, 1.96],
      [0.5, 1.48],
      [0.4, 1.48],
      [0.4, 1.42],
      [0.7, 1.42],
      [0.7, 1.32],
      [1.0, 1.32],
      [1.0, 1.0],
      [0.7, 1.0],
      [0.7, 0.42],
      [0.62, 0.42],
      [0.62, 0],
      [0.14, 0],
      [0.14, 0.3],
      [0, 0.3],
    ]),
    0.66,
    0.1,
  ).toNonIndexed();
  const knob = new BoxGeometry(0.28, 0.2, 0.28).toNonIndexed();
  knob.translate(0, 2.36, 0.33);
  return mergeGeometries([body, knob]);
}

/** A round wooden token with a raised rim round a sunken top. */
const token = () =>
  lathe([
    [0, 0],
    [0.9, 0],
    [0.98, 0.05],
    [1, 0.14],
    [1, 0.46],
    [0.97, 0.54],
    [0.88, 0.58],
    [0.8, 0.56],
    [0.74, 0.49],
    [0, 0.47],
  ]);

/** A house: walls and a pitched roof, its gable to the front. */
const house = () =>
  cutout(
    symmetric([
      [0, 1.68],
      [0.82, 0.98],
      [0.82, 0],
      [0, 0],
    ]),
    1.0,
    0.1,
  );

/** A tower: a round keep on a footing, battlements round its sunken top. */
function tower(): BufferGeometry {
  const keep = lathe([
    [0, 0],
    [0.86, 0],
    [0.9, 0.08],
    [0.84, 0.2],
    [0.6, 0.3],
    [0.56, 1.28],
    [0.74, 1.4],
    [0.76, 1.56],
    [0.56, 1.56],
    [0, 1.48],
  ]).toNonIndexed();
  const merlons = Array.from({ length: 6 }, (_, i) => {
    const angle = (i / 6) * Math.PI * 2;
    const m = new BoxGeometry(0.26, 0.24, 0.2).toNonIndexed();
    m.rotateY(angle);
    m.translate(Math.sin(angle) * 0.66, 1.68, Math.cos(angle) * 0.66);
    return m;
  });
  return mergeGeometries([keep, ...merlons]);
}

/** A ship seen from the side: hull, mast and a sail swelling forward, cut from a thin board. */
function ship(): BufferGeometry {
  const s = new Shape();
  s.moveTo(-1.08, 0.66);
  s.quadraticCurveTo(-0.92, 0.08, -0.5, 0);
  s.lineTo(0.55, 0);
  s.quadraticCurveTo(0.98, 0.1, 1.12, 0.72);
  s.lineTo(0.78, 0.56);
  s.lineTo(0.12, 0.56);
  s.lineTo(0.12, 0.7);
  s.quadraticCurveTo(1.08, 1.2, 0.12, 2.0);
  s.lineTo(0.12, 2.16);
  s.lineTo(-0.04, 2.16);
  s.lineTo(-0.04, 0.56);
  s.lineTo(-0.78, 0.56);
  s.lineTo(-1.08, 0.66);
  return cutout(s, 0.5, 0.1);
}

/** A pine: a trunk under three tiers of branches. */
const tree = () =>
  lathe(
    [
      [0, 0],
      [0.22, 0],
      [0.22, 0.3],
      [0.96, 0.3],
      [0.92, 0.38],
      [0.34, 0.92],
      [0.78, 0.82],
      [0.74, 0.9],
      [0.24, 1.42],
      [0.58, 1.32],
      [0.54, 1.4],
      [0, 2.0],
    ],
    24,
  );

let forms: Record<PieceForm, FormShape> | undefined;

/** Every form's shape, made on first use and shared by every piece drawn in it. */
export function pieceForms(): Record<PieceForm, FormShape> {
  forms ??= {
    figure: form(figure(), true, { at: 0.42, size: 0.62, facing: "front" }),
    robot: form(robot(), true, { at: 0.34, size: 0.6, facing: "front" }),
    token: form(token(), false, { at: 0.47 / 0.58 + 0.01, size: 1.3, facing: "up" }),
    cube: form(new RoundedBoxGeometry(1.8, 1.8, 1.8, 3, 0.16), true, { at: 1.004, size: 1.4, facing: "up" }),
    house: form(house(), true, { at: 0.3, size: 0.8, facing: "front" }),
    tower: form(tower(), false, { at: 1.49 / 1.8, size: 0.9, facing: "up" }),
    ship: form(ship(), true, { at: 0.56, size: 0.5, facing: "front" }),
    tree: form(tree(), true),
  };
  return forms;
}

/** A small turn, the same for a piece each time it is drawn, as if set down by hand. */
export function pieceTurn(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (((h >>> 0) % 1000) / 1000 - 0.5) * 0.4;
}

let grain: CanvasTexture | null | undefined;

/**
 * Faint wood grain, multiplied into a piece's paint: near white, so the seat's color stays true,
 * with the darker wavy lines of the wood showing through.
 */
export function woodGrain(): CanvasTexture | undefined {
  if (grain !== undefined) return grain ?? undefined;
  const ctx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
  if (!ctx) {
    grain = null;
    return undefined;
  }
  ctx.canvas.width = ctx.canvas.height = 128;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 128, 128);
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 26; i++) {
    const [x0, wave, phase] = [rand() * 128, 2 + rand() * 4, rand() * Math.PI * 2];
    ctx.strokeStyle = `rgba(90, 60, 30, ${0.05 + rand() * 0.07})`;
    ctx.lineWidth = 0.6 + rand() * 1.4;
    ctx.beginPath();
    for (let y = -4; y <= 132; y += 4) {
      const x = x0 + Math.sin(y / 18 + phase) * wave;
      if (y === -4) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  grain = new CanvasTexture(ctx.canvas);
  grain.wrapS = grain.wrapT = RepeatWrapping;
  grain.colorSpace = SRGBColorSpace;
  return grain;
}
