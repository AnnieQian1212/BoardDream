import { containsCell, type Geometry, type GeometryBattle, type GeometryCell, type GeometryPiece } from "@boarddream/engine";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { easing } from "maath";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  BufferGeometry,
  Color,
  ExtrudeGeometry,
  Float32BufferAttribute,
  LatheGeometry,
  Shape,
  ShapeGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  Vector3,
  Vector4,
  type Group,
  type Mesh,
  type MeshPhysicalMaterial,
  type MeshStandardMaterial,
  type PointLight,
  type Texture,
} from "three";
import { playerColor, TILE_COLORS } from "../colors";
import { groundOf, kindColor, ownColor, RIM, RIM_INK, SHORE, TILE_SHARE, tileColor, zoneColors } from "./ground";
import { HIGHLIGHT } from "./Card3D";
import { setCursor, setHover } from "./hover";
import type { BoardItem } from "./layout";
import { reducedMotion, step } from "./motion";
import { hash, INK, mix } from "./paint";
import { Ink } from "./Ink";
import { Battle3D, BATTLE_SECONDS, KNOCK_AT } from "./Battle3D";
import { BOARD, blobTexture, boardPrint, groundTexture, pieceLabel } from "./textures";
import { Chips, useChips } from "./Chips";
import { glitterCompiler, GRASS_HEIGHT, GrassPatch, useGrassField, type GrassField } from "./Grass";
import { cellSize, clearing, grassSpacing, growthField, growthsOf, HEIGHT, inside, plant, printUnit, sow, type PrintBox } from "./growth";
import { DOME, jellyGeometry, Wobble } from "./jelly";
import { isWaterCell, isWaterKind, STEP_RATE, WaterGrid, waterPolygons } from "./water";
import { waterCompiler, waterUniforms, type WaterUniforms } from "./waterMaterial";

const SLAB = 0.6;
const TILE = 0.32;
const BEVEL = 0.07;
export const TILE_TOP = SLAB + TILE + 2 * BEVEL;
/** Building spots (kind "vertex") and roads (kind "edge") stand above the tiles they sit between. */
const SPOT = 0.55;
export const SPOT_TOP = SLAB + SPOT + 2 * BEVEL;
const SPOTS = new Set(["vertex", "edge"]);
/** A building spot or road that can be clicked. */
const TARGET_SPOT = "#3cc6d6";
const noRaycast = () => null;
/** Water fills a little less of its cell than a tile, leaving a rim of shore. */
const WATER_SHARE = 0.86;
/** Edge-matched tiles show their terrain as wedges inset this far, so a rim of the tile shows. */
const WEDGE_SHARE = TILE_SHARE * 0.84;
/** Where a cell's water pools, as a share of the cell: inside the rim when it has one. */
const poolShare = (rimmed: boolean) => (rimmed ? TILE_SHARE * 0.8 : WATER_SHARE);

const centroid = (polygon: [number, number][]): [number, number] => [
  polygon.reduce((sum, [x]) => sum + x, 0) / polygon.length,
  polygon.reduce((sum, [, y]) => sum + y, 0) / polygon.length,
];

/** A painted board (Muse Image, checked by SAM 3.1): the image, and per tile kind the centers of painted tiles. */
export interface BoardPaint {
  url: string;
  width: number;
  height: number;
  sources: Record<string, [number, number][]>;
}

interface Props {
  board: BoardItem;
  targets: Set<string>;
  paint?: BoardPaint;
  /** How many glowing cells cast light (Quality.glowLights); 0 leaves them glowing on their own. */
  glowLights: number;
  /** How thickly grass grows (Quality.grass). */
  grass: number;
  onPick(id: string, x: number, y: number): void;
}

/**
 * Share of a painted tile a tile's top shows: the painter draws thick inked gaps between tiles,
 * which the board's own gaps and outlines already draw, so a tile shows its painting without them.
 */
const ART_CROP = 0.84;

/** Maps a tile's top onto its source tile in the painting (board units, flipped for the texture). */
function paintUvs(g: BufferGeometry, painted: { paint: BoardPaint; source: [number, number] }, k: number) {
  const [sx, sy] = painted.source;
  const { width: w, height: h } = painted.paint;
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const unit = (k * TILE_SHARE) / ART_CROP;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (sx + pos.getX(i) / unit) / w, 1 - (sy + pos.getZ(i) / unit) / h);
  uv.needsUpdate = true;
}

/** The board's water: one rippling grid under every water tile, and how the pointer stirs it. */
interface Water {
  uniforms: WaterUniforms;
  /**
   * Changes whenever the surface is rebuilt (the water moved or changed shape). A compiled shader
   * keeps the uniforms it was compiled with, so each pool's material is rebuilt with it.
   */
  id: number;
  /** The pointer passing over the water at a world point: a trail of small dips. */
  wake(x: number, z: number): void;
  /** A click on the water: one deeper dip. */
  splash(x: number, z: number): void;
}

/** Counts water surfaces built, to tell a rebuilt one from the last (Water.id). */
let surfaces = 0;

function useWater(geometry: BoardItem["geometry"], k: number, position: BoardItem["position"], zones: Map<string, string>): Water | undefined {
  const invalidate = useThree((s) => s.invalidate);
  const [ox, , oz] = position;
  // Rebuilt only when the water itself changes, not on every move.
  const pools = (c: GeometryCell) => waterPolygons(c, poolShare(zones.has(c.id)), WEDGE_SHARE);
  const cells = geometry.cells.filter((c) => c.kind !== "label" && pools(c).length > 0);
  const key = cells.map((c) => `${c.id}:${c.polygon.flat().join(",")}:${c.segments?.join(",") ?? ""}:${zones.has(c.id)}`).join("|");
  const surface = useMemo(() => {
    if (cells.length === 0) return undefined;
    const polygons = cells.flatMap((c) => {
      const [cx, cy] = centroid(c.polygon);
      const [wx, wz] = [(cx - geometry.width / 2) * k, (cy - geometry.height / 2) * k];
      return pools(c).map((p) => p.map(([x, y]): [number, number] => [wx + x * k, wz + y * k]));
    });
    const grid = new WaterGrid(polygons, k / 20);
    return { grid, uniforms: waterUniforms(grid, [ox, oz], k), id: ++surfaces };
  }, [key, geometry.width, geometry.height, k, ox, oz]);
  useEffect(() => () => surface?.uniforms.uWave.value.dispose(), [surface]);

  const last = useRef<{ x: number; z: number; t: number }>(undefined);
  const wake = useCallback(
    (x: number, z: number) => {
      if (!surface || reducedMotion) return;
      const { grid } = surface;
      const [lx, lz] = [x - ox, z - oz];
      const now = performance.now();
      const gap = grid.spacing * 1.5;
      const from = last.current && now - last.current.t < 150 ? last.current : undefined;
      if (!from) grid.disturb(lx, lz, 0.16, 3.5);
      else {
        // Dips evenly spaced along the path, however often the pointer reports.
        const d = Math.hypot(lx - from.x, lz - from.z);
        if (d < gap) return void (from.t = now);
        const n = Math.min(16, Math.floor(d / gap));
        for (let i = 1; i <= n; i++) grid.disturb(from.x + ((lx - from.x) * i) / n, from.z + ((lz - from.z) * i) / n, 0.16, 3.5);
      }
      last.current = { x: lx, z: lz, t: now };
      invalidate();
    },
    [surface, ox, oz, invalidate],
  );
  const splash = useCallback(
    (x: number, z: number) => {
      if (!surface || reducedMotion) return;
      // Jelly answers a press with a broad, soft dent rather than a splash.
      surface.grid.disturb(x - ox, z - oz, 0.45, 6);
      invalidate();
    },
    [surface, ox, oz, invalidate],
  );

  // Fixed steps while the water moves; nothing at all once it is still.
  const clock = useRef(0);
  useFrame((_, delta) => {
    if (!surface || surface.grid.still) return;
    clock.current += Math.min(delta, 0.05);
    let steps = 0;
    for (; clock.current >= 1 / STEP_RATE && steps < 4; steps++) {
      surface.grid.step();
      clock.current -= 1 / STEP_RATE;
    }
    if (steps > 0) {
      surface.grid.encode();
      surface.uniforms.uWave.value.needsUpdate = true;
    }
    if (surface.grid.still) clock.current = 0;
    else invalidate();
  });

  return useMemo(() => surface && { uniforms: surface.uniforms, id: surface.id, wake, splash }, [surface, wake, splash]);
}

/** Where a tile's painting comes from: a painted tile of its kind, picked stably by the tile's id. */
function sourceFor(paint: BoardPaint | undefined, cell: GeometryCell): [number, number] | undefined {
  // Edge-matched tiles show their terrain segments, never painted art.
  if (cell.segments) return undefined;
  const sources = paint?.sources[cell.kind ?? "plain"];
  return sources?.length ? sources[hash(cell.id) % sources.length] : undefined;
}

/** The engine's board geometry as raised tiles on a slab, with pieces that slide between cells. */
export function Board3D({ board, targets, paint, glowLights, grass, onPick }: Props) {
  const { geometry, scale: k, width, depth, position } = board;
  const invalidate = useThree((s) => s.invalidate);
  // Plain tiles until the painting has loaded, so a large image never shows as black tiles.
  const [texture, setTexture] = useState<Texture>();
  useEffect(() => {
    setTexture(undefined);
    if (!paint) return;
    let alive = true;
    const t = new TextureLoader().load(paint.url, () => {
      if (!alive) return;
      setTexture(t);
      invalidate();
    });
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 16;
    return () => {
      alive = false;
      t.dispose();
    };
  }, [paint, invalidate]);
  // Rebuild the printed names only when their text changes, or a piece moves on a named cell they
  // keep clear of; not on every move.
  const named = new Set(geometry.cells.filter((c) => c.label && c.kind !== "label").map((c) => c.id));
  const labelKey = [
    ...geometry.cells.map((c) => (c.label ? `${c.id}:${c.label}` : "")),
    ...geometry.pieces.filter((p) => p.cellId && named.has(p.cellId)).map((p) => `${p.cellId}@${p.x.toFixed(2)},${p.y.toFixed(2)}:${p.shape ?? ""}`),
  ].join("|");
  const margin = (width - geometry.width * k) / 2 / k;
  const print = useMemo(() => boardPrint(geometry, margin), [labelKey, geometry.width, geometry.height, margin]);
  const labels = print.texture;
  useEffect(() => () => labels.dispose(), [labels]);
  const toWorld = (x: number, y: number): [number, number] => [(x - geometry.width / 2) * k, (y - geometry.height / 2) * k];
  const spotCells = useMemo(() => new Set(geometry.cells.filter((c) => SPOTS.has(c.kind ?? "")).map((c) => c.id)), [geometry]);
  // Scenery that places lie inside (a sea around its harbors) is drawn low, as ground, so the places
  // stand on it instead of flickering through it.
  const sceneryKey = geometry.cells.map((c) => (c.kind === "label" || SPOTS.has(c.kind ?? "") ? "" : `${c.id}:${c.polygon.flat().join(",")}`)).join("|");
  const scenery = useMemo(() => {
    const tiles = geometry.cells.filter((c) => c.kind !== "label" && !SPOTS.has(c.kind ?? ""));
    return new Set(tiles.filter((outer) => tiles.some((inner) => inner !== outer && containsCell(outer.polygon, inner.polygon))).map((c) => c.id));
  }, [sceneryKey]);
  // Grass: sized from a typical cell, thinned on boards with a lot of green.
  const greenKey = geometry.cells.map((c) => `${c.kind}${c.terrain ?? ""}${c.segments?.join("") ?? ""}`).join("|");
  const zones = useMemo(() => zoneColors(geometry.cells), [greenKey]);
  const water = useWater(geometry, k, position, zones);
  const exits = useExits(geometry, toWorld);
  const size = useMemo(() => cellSize(geometry.cells), [greenKey]);
  const unit = useMemo(() => printUnit(geometry.cells), [geometry.cells.length, geometry.width, geometry.height]);
  const spacing = useMemo(() => grassSpacing(geometry.cells, size, grass), [greenKey, size, grass]);
  const growing = useMemo(() => geometry.cells.some((c) => growthField(c, TILE_SHARE)), [greenKey]);
  const rocky = useMemo(() => geometry.cells.some((c) => c.kind !== "label" && growthsOf(c).includes("rock")), [greenKey]);
  // Where tiles lie, in the board group's world units: stone chips land on them and drop between them.
  const tileKey = geometry.cells.map((c) => (c.kind === "label" || SPOTS.has(c.kind ?? "") ? "" : c.polygon.flat().join(","))).join("|");
  const ground = useMemo(() => {
    const tiles = geometry.cells
      .filter((c) => c.kind !== "label" && !SPOTS.has(c.kind ?? ""))
      .map((c) => {
        const [cx, cy] = centroid(c.polygon);
        return c.polygon.map(([x, y]): [number, number] => toWorld(cx + (x - cx) * TILE_SHARE, cy + (y - cy) * TILE_SHARE));
      });
    return (x: number, z: number) => tiles.some((t) => inside(t, x, z));
  }, [tileKey, geometry.width, geometry.height, k]);
  const chips = useChips(TILE_TOP, SLAB, size * k, position, ground);
  // A gust after each move: what is on the board changed, not merely the object describing it.
  const stir = geometry.pieces.map((p) => `${p.id}@${p.x},${p.y}`).join("|") + geometry.cells.map((c) => `${c.owner ?? ""}${c.label ?? ""}`).join("|");
  const field = useGrassField(k, size, stir, growing);
  useEffect(() => {
    if (water && paint) water.uniforms.uMapScale.value.set(ART_CROP / (k * TILE_SHARE * paint.width), -ART_CROP / (k * TILE_SHARE * paint.height));
  }, [water, paint, k]);
  useEffect(() => {
    if (!water) return;
    water.uniforms.uPrint.value = labels;
    water.uniforms.uPrintMap.value.set(position[0], position[2], 1 / width, 1 / depth);
  }, [water, labels, position[0], position[2], width, depth]);
  // Pieces on a pool stand on its jelly.
  const poolCells = useMemo(() => new Set(geometry.cells.filter((c) => !c.segments && isWaterCell(c)).map((c) => c.id)), [geometry]);
  const slab = useMemo(() => new RoundedBoxGeometry(width, SLAB, depth, 3, 0.3), [width, depth]);
  useEffect(() => () => slab.dispose(), [slab]);
  const glowing = useMemo(
    () => geometry.cells.filter((c) => c.glow && c.kind !== "label").map((c) => ({ at: toWorld(...centroid(c.polygon)), color: c.glow! })),
    [geometry, k],
  );
  return (
    <group position={position}>
      <mesh geometry={slab} position={[0, SLAB / 2, 0]} castShadow receiveShadow raycast={noRaycast}>
        <meshStandardMaterial color={BOARD} roughness={0.9} />
        <Ink geometry={slab} width={2.5} grounded />
      </mesh>
      {geometry.cells
        .filter((cell) => cell.kind !== "label")
        .map((cell) => (
          <Tile
            key={cell.id}
            cell={cell}
            k={k}
            at={toWorld(...centroid(cell.polygon))}
            target={targets.has(cell.id)}
            low={scenery.has(cell.id)}
            painted={texture && paint && sourceFor(paint, cell) ? { texture, paint, source: sourceFor(paint, cell)! } : undefined}
            water={water}
            zone={zones.get(cell.id)}
            box={print.boxes.get(cell.id)}
            groundScale={1 / (2 * unit * k)}
            grass={growing ? { field, spacing, size, unit } : undefined}
            chip={rocky && growthsOf(cell).includes("rock") ? chips.burst : undefined}
            print={{ texture: labels, width, depth }}
            onPick={onPick}
          />
        ))}
      {glowLights > 0 && <GlowLights spots={glowing} size={glowLights} k={k} />}
      {rocky && <Chips pool={chips.pool} />}
      <mesh rotation-x={-Math.PI / 2} position={[0, TILE_TOP + 0.02, 0]} raycast={noRaycast}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial map={labels} transparent roughness={0.8} depthWrite={false} />
      </mesh>
      {[...geometry.pieces.map((piece) => ({ piece, exit: undefined })), ...exits.list].map(({ piece, exit }) => (
        <Piece
          key={piece.id}
          piece={piece}
          k={k}
          at={toWorld(piece.x, piece.y)}
          base={spotCells.has(piece.cellId ?? "") ? SPOT_TOP : TILE_TOP + (poolCells.has(piece.cellId ?? "") ? DOME * k : 0)}
          exit={exit}
        />
      ))}
      {exits.fight && (
        <Battle3D
          key={exits.fight.battle.id}
          battle={exits.fight.battle}
          at={exits.fight.at}
          cell={unit * k}
          top={TILE_TOP}
          started={exits.fight.started}
        />
      )}
    </group>
  );
}

/** A piece leaving the board: when, and for one lost in a battle, the cell it is knocked out of. */
interface Exit {
  since: number;
  knock?: [number, number];
}

/**
 * Pieces that left the board with the last move, kept a moment to animate their going, and the
 * battle being played out, if the move fought one. The first geometry seen plays nothing: a battle
 * already on the board when the table appears is old news.
 */
function useExits(geometry: Geometry, toWorld: (x: number, y: number) => [number, number]) {
  const memory = useRef<{
    geometry?: Geometry;
    pieces: Map<string, GeometryPiece>;
    battle?: string;
    exits: Map<string, { piece: GeometryPiece; exit: Exit }>;
    fight?: { battle: GeometryBattle; at: [number, number]; started: number };
  }>({ pieces: new Map(), exits: new Map() });
  const [, redraw] = useState(0);
  const m = memory.current;
  if (m.geometry !== geometry) {
    const now = performance.now();
    const first = m.geometry === undefined;
    const battle = geometry.battle;
    const cell = battle && geometry.cells.find((c) => c.id === battle.cellId);
    const fresh = !first && battle && cell && battle.id !== m.battle && !reducedMotion ? battle : undefined;
    m.battle = battle?.id;
    const knockFrom = fresh && cell ? toWorld(...centroid(cell.polygon)) : undefined;
    if (fresh && knockFrom) m.fight = { battle: fresh, at: knockFrom, started: now };
    const current = new Map(geometry.pieces.map((p) => [p.id, p]));
    if (!first) {
      for (const [id, piece] of m.pieces) {
        if (current.has(id) || m.exits.has(id)) continue;
        const lost = fresh && cell && (piece.cellId === fresh.cellId || inside(cell.polygon, piece.x, piece.y));
        m.exits.set(id, { piece, exit: { since: now, knock: lost ? knockFrom : undefined } });
      }
    }
    for (const id of [...m.exits.keys()]) if (current.has(id)) m.exits.delete(id);
    m.pieces = current;
    m.geometry = geometry;
  }
  // Gone pieces and a finished battle are dropped once they have played out.
  useEffect(() => {
    const timer = setTimeout(() => {
      const now = performance.now();
      for (const [id, { exit }] of m.exits) if (now - exit.since > (exit.knock ? KNOCK_AT + EXIT_SECONDS : EXIT_SECONDS) * 1000 + 50) m.exits.delete(id);
      if (m.fight && now - m.fight.started > BATTLE_SECONDS * 1000) m.fight = undefined;
      redraw((n) => n + 1);
    }, (BATTLE_SECONDS + 0.1) * 1000);
    return () => clearTimeout(timer);
  }, [geometry]);
  return { list: [...m.exits.values()], fight: m.fight };
}

/** How long a piece takes to leave the board, or to fly off once knocked. */
const EXIT_SECONDS = 0.8;

interface TileProps {
  cell: GeometryCell;
  k: number;
  at: [number, number];
  target: boolean;
  /** Scenery other cells lie inside: sunk into the slab, so it reads as ground under them. */
  low?: boolean;
  /** The painted board and where this tile's art sits on it. */
  painted?: { texture: Texture; paint: BoardPaint; source: [number, number] };
  /** The board's water; the tile draws a surface where it holds some (waterPolygons). */
  water?: Water;
  /** The color of the group the cell belongs to (zoneColors), drawn as a rim around its ground. */
  zone?: string;
  /** Where the cell's name and token are printed, for the grass to leave clear. */
  box?: PrintBox;
  /** Ground texture repeats per world unit, so one repeat spans about two cells. */
  groundScale: number;
  /** The board's grass, when any cell grows it. */
  grass?: { field: GrassField; spacing: number; size: number; unit: number };
  /** Knocks stone chips loose at a world point, when the cell has stony ground. */
  chip?: (x: number, z: number) => void;
  /** The board's printed names and the size of the plane they cover, centered on the board. */
  print: { texture: Texture; width: number; depth: number };
  onPick: Props["onPick"];
}

function Tile({ cell, k, at, target, low, painted, water: boardWater, zone, box, groundScale, grass, chip, print, onPick }: TileProps) {
  // Where the tile rests: on the slab, or sunk into it as ground when other cells lie inside it.
  const rest = low ? SLAB - TILE + 0.03 : SLAB;
  const segmentsKey = cell.segments?.join(",");
  const pools = useMemo(() => waterPolygons(cell, poolShare(zone !== undefined), WEDGE_SHARE), [cell.polygon, cell.kind, cell.terrain, segmentsKey, zone]);
  // Unpainted ground is painted in its color: grass and flowers, moss and ferns, furrows or pebbles.
  const ground = groundOf(cell);
  const groundMap = !painted && ground && ground !== "water" ? groundTexture(ground, ownColor(cell)) : undefined;
  const water = pools.length > 0 ? boardWater : undefined;
  const mesh = useRef<Mesh>(null!);
  const material = useRef<MeshStandardMaterial>(null!);
  const [hovered, setHovered] = useState(false);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [target, hovered, invalidate]);
  // The cell's value (a yield, a cost), shown beside its name while the pointer is on it: printed,
  // its token was too small to read at the table's size.
  const tip = cell.badge !== undefined && cell.badge !== "" ? `${cell.label ? `${cell.label}: ` : ""}${cell.badge}` : cell.label;
  const geometry = useMemo(() => {
    const [cx, cy] = centroid(cell.polygon);
    // Shrink toward the center so tiles have a gap, leaving room for the bevel. Spots are already small.
    const spot = SPOTS.has(cell.kind ?? "");
    const shrink = (p: number, c: number) => (p - c) * k * (spot ? 0.85 : TILE_SHARE);
    const shape = new Shape(cell.polygon.map(([x, y]) => new Vector2(shrink(x, cx), -shrink(y, cy))));
    const bevel = spot ? BEVEL * 0.5 : BEVEL;
    const g = new ExtrudeGeometry(shape, { depth: spot ? SPOT : TILE, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 1 });
    g.rotateX(-Math.PI / 2).translate(0, BEVEL, 0);
    if (painted) paintUvs(g, painted, k);
    else {
      // The ground's marks at a steady size across the board, shifted per tile so no two match.
      const uv = g.attributes.uv;
      const shift = hash(cell.id);
      const [sx, sy] = [(shift % 97) / 97, ((shift >> 8) % 89) / 89];
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * groundScale + sx, uv.getY(i) * groundScale + sy);
      uv.needsUpdate = true;
    }
    return g;
    // The painted prop is rebuilt every render; only its content matters here.
  }, [cell.polygon, k, groundScale, painted?.paint, painted?.source[0], painted?.source[1]]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  // Where a tile holds water its top is a slab of jelly, a little inside the tile (or over its
  // water wedges) so a rim of shore shows.
  const surface = useMemo(() => {
    if (!water) return undefined;
    const g = jellyGeometry(pools, k);
    if (painted) paintUvs(g, painted, k);
    return g;
  }, [water, pools, k, painted?.paint, painted?.source[0], painted?.source[1]]);
  // How it wobbles when touched, and the dome's height, squash and sway for its shader.
  const wobble = useMemo(() => new Wobble(), []);
  // One set of uniforms for the tile's life: a material keeps the uniforms it was compiled with.
  const jelly = useMemo(() => ({ uJelly: { value: new Vector4(DOME * k, 0, 0, 0) } }), []);
  useEffect(() => void jelly.uJelly.value.setX(DOME * k), [k]);
  const poke = (strength: number, point: { x: number; z: number }) => {
    if (!water || reducedMotion) return;
    const p = mesh.current.worldToLocal(new Vector3(point.x, 0, point.z));
    wobble.poke(strength, p.x / k, p.z / k);
    invalidate();
  };
  // Water wedges keep their own color under the surface; a whole cell its tile's, on a sandy shore
  // when the color is the ground's rather than the kind's own.
  const waterColor = useMemo(
    () => new Color(cell.segments ? kindColor(cell.segments.find((s) => isWaterKind(s)) ?? "") : tileColor(cell)),
    [segmentsKey, cell],
  );
  const shore = ground === "water" && !painted && cell.owner === undefined && !TILE_COLORS[cell.kind ?? ""];
  useEffect(() => () => surface?.dispose(), [surface]);
  const surfaceMaterial = useRef<MeshPhysicalMaterial>(null);
  // What grows on the cell (or on an edge-matched tile's wedges), with a bare patch for its name
  // that is wider where taller things grow.
  const growth = useMemo(() => {
    if (!grass) return undefined;
    const field = growthField(cell, cell.segments ? WEDGE_SHARE : TILE_SHARE * (zone ? RIM * 0.97 : 0.97));
    if (!field) return undefined;
    const tallest = Math.max(...growthsOf(cell).map((g) => HEIGHT[g]));
    const bare = clearing(cell, grass.unit, grass.size * GRASS_HEIGHT * tallest, box);
    const sprouts = sow(cell, field, grass.spacing, bare);
    const [trees, boulders] = cell.segments ? [0, 0] : [5, 3];
    return {
      field,
      sprouts,
      trees: [...plant(sprouts, field, bare, grass.spacing, trees, "forest"), ...plant(sprouts, field, bare, grass.spacing, boulders, "rock")],
    };
  }, [grass?.spacing, grass?.unit, cell.id, cell.polygon, cell.kind, cell.terrain, cell.label, segmentsKey, zone, box]);
  const compile = useMemo(() => water && waterCompiler(water.uniforms, jelly), [water]);
  // The names are printed on one plane at the tiles' height, so a legal tile lifted under the
  // pointer would cover its own. It carries a copy of its part of the print on its top instead.
  const decal = useMemo(() => {
    if (!target || !cell.label || SPOTS.has(cell.kind ?? "")) return undefined;
    const [cx, cy] = centroid(cell.polygon);
    const g = new ShapeGeometry(new Shape(cell.polygon.map(([x, y]) => new Vector2((x - cx) * k * TILE_SHARE, -(y - cy) * k * TILE_SHARE))));
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    // The same mapping as the print's plane: u across its width, v from its far edge.
    for (let i = 0; i < pos.count; i++) uv.setXY(i, 0.5 + (at[0] + pos.getX(i)) / print.width, 0.5 - (at[1] + pos.getZ(i)) / print.depth);
    uv.needsUpdate = true;
    return g;
  }, [target, cell.label, cell.kind, cell.polygon, k, at[0], at[1], print.width, print.depth]);
  useEffect(() => () => decal?.dispose(), [decal]);
  const decalMesh = useRef<Mesh>(null);
  // A stony tile glitters under the pointer, like the rocks on it.
  const stony = !cell.segments && growthsOf(cell).includes("rock");
  const glitter = useMemo(() => (stony && grass ? glitterCompiler(grass.field, grass.size * k * 0.02) : undefined), [stony, grass?.field, grass?.size, k]);
  // A legal tile sits on a halo the full size of its cell: the gap around the tile shows a teal
  // ring whatever the tile's own color, which a glow alone does not on pale tiles.
  const halo = useMemo(() => {
    if (!target) return undefined;
    const [cx, cy] = centroid(cell.polygon);
    const grow = SPOTS.has(cell.kind ?? "") ? 1.15 : 1.0;
    const g = new ShapeGeometry(new Shape(cell.polygon.map(([x, y]) => new Vector2((x - cx) * k * grow, -(y - cy) * k * grow))));
    return g.rotateX(-Math.PI / 2);
  }, [target, cell.polygon, cell.kind, k]);
  useEffect(() => () => halo?.dispose(), [halo]);
  // Edge-matched tiles: a wedge per edge on top, inset so a rim of the tile (its owner's tint) shows.
  const wedges = useMemo(() => {
    if (!cell.segments) return undefined;
    const [cx, cy] = centroid(cell.polygon);
    const f = k * WEDGE_SHARE;
    const n = cell.polygon.length;
    const positions: number[] = [];
    const colors: number[] = [];
    const color = new Color();
    cell.segments.forEach((kind, i) => {
      const [ax, ay] = cell.polygon[i % n];
      const [bx, by] = cell.polygon[(i + 1) % n];
      // Corners run clockwise seen from above, so each wedge lists them backwards to face up.
      positions.push(0, 0, 0, (bx - cx) * f, 0, (by - cy) * f, (ax - cx) * f, 0, (ay - cy) * f);
      color.set(kindColor(kind));
      for (let v = 0; v < 3; v++) colors.push(color.r, color.g, color.b);
    });
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(positions, 3));
    g.setAttribute("color", new Float32BufferAttribute(colors, 3));
    g.setAttribute("normal", new Float32BufferAttribute(positions.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    return g;
  }, [segmentsKey, cell.polygon, k]);
  useEffect(() => () => wedges?.dispose(), [wedges]);
  const wedgeMaterial = useRef<MeshStandardMaterial>(null);
  // A group's rim: a band of its color just inside the tile's edge, with an inked line inside it.
  const rim = useMemo(() => {
    if (!zone) return undefined;
    const [cx, cy] = centroid(cell.polygon);
    const corner = (i: number, f: number) => {
      const [x, y] = cell.polygon[i % cell.polygon.length];
      return [(x - cx) * k * TILE_SHARE * f, 0, (y - cy) * k * TILE_SHARE * f];
    };
    const positions: number[] = [];
    const colors: number[] = [];
    const strip = (outer: number, inner: number, color: Color) => {
      for (let i = 0; i < cell.polygon.length; i++) {
        const [a, b, c, d] = [corner(i, outer), corner(i + 1, outer), corner(i + 1, inner), corner(i, inner)];
        // Corners run clockwise seen from above, so each quad lists them backwards to face up.
        for (const p of [a, c, b, a, d, c]) positions.push(...p), colors.push(color.r, color.g, color.b);
      }
    };
    strip(1, RIM, new Color(zone));
    strip(RIM, RIM_INK, new Color(INK));
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(positions, 3));
    g.setAttribute("color", new Float32BufferAttribute(colors, 3));
    g.setAttribute("normal", new Float32BufferAttribute(positions.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    return g;
  }, [zone, cell.polygon, k]);
  useEffect(() => () => rim?.dispose(), [rim]);
  const rimMaterial = useRef<MeshStandardMaterial>(null);
  // On a painted tile, or painted ground, the art shows through and ownership tints it.
  const tint = useMemo(() => new Color(cell.owner !== undefined ? mix(playerColor(cell.owner), "#ffffff", 0.45) : "#ffffff"), [cell.owner]);
  // A spot that can be built on turns the highlight's color, not just a faint glow: pale spots on a
  // bright board read as all alike otherwise.
  const spotTarget = target && SPOTS.has(cell.kind ?? "");
  const base = useMemo(
    () => (spotTarget ? new Color(TARGET_SPOT) : groundMap ? tint : new Color(shore ? SHORE : tileColor(cell))),
    [cell, shore, groundMap, tint, spotTarget],
  );
  const highlight = useMemo(() => new Color(HIGHLIGHT), []);
  const glowColor = useMemo(() => (cell.glow ? new Color(cell.glow) : undefined), [cell.glow]);

  useFrame((state, delta) => {
    const dt = step(delta);
    // Pale tiles under a bright light hide a faint glow, so legal tiles glow clearly; small spots
    // glow a bit more. Only the hovered one lifts: the printed labels lie at the tiles' height.
    // A cell that gives off light (Geometry cell.glow) burns softly.
    const burn = glowColor ? 0.35 : 0;
    const glow = target ? (hovered ? 0.8 : spotTarget ? 0.3 : 0.42) : burn;
    let moving = easing.damp(material.current, "emissiveIntensity", glow, 0.1, dt);
    if (wedgeMaterial.current) wedgeMaterial.current.emissiveIntensity = material.current.emissiveIntensity;
    if (rimMaterial.current) rimMaterial.current.emissiveIntensity = material.current.emissiveIntensity;
    if (surfaceMaterial.current) surfaceMaterial.current.emissiveIntensity = material.current.emissiveIntensity;
    moving = easing.damp(mesh.current.position, "y", rest + (target && hovered ? 0.5 : 0), 0.1, dt) || moving;
    if (!wobble.still) {
      moving = wobble.step(dt) || moving;
      jelly.uJelly.value.set(DOME * k, wobble.squash, wobble.sway[0] / k, wobble.sway[1] / k);
    }
    if (decalMesh.current) decalMesh.current.visible = mesh.current.position.y > rest + 0.01;
    if (moving) state.invalidate();
  });

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      position={[at[0], rest, at[1]]}
      castShadow
      receiveShadow
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
        setCursor(target);
        poke(0.3, e.point);
        if (tip) setHover({ text: tip, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
      }}
      onPointerOut={() => {
        setHovered(false);
        setCursor(false);
        if (tip) setHover(null);
        if (growth) grass?.field.release();
      }}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        water?.wake(e.point.x, e.point.z);
        if (growth) grass?.field.push(e.point.x, e.point.z);
        if (tip) setHover({ text: tip, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        water?.splash(e.point.x, e.point.z);
        poke(0.9, e.point);
        if (chip && growth) {
          const p = mesh.current.worldToLocal(e.point.clone());
          if (growth.field(p.x / k, p.z / k) === "rock") chip(e.point.x, e.point.z);
        }
        if (target) onPick(cell.id, e.nativeEvent.clientX, e.nativeEvent.clientY);
      }}
    >
      {/* A painted tile wears its art on top; the sides pick up the painting's border color. Keyed so
          three builds a fresh shader when the map arrives or the glitter comes or goes. */}
      <meshStandardMaterial
        key={`${painted ? "painted" : groundMap ? ground : "plain"}${glitter ? "-glitter" : ""}`}
        ref={material}
        map={painted?.texture ?? groundMap ?? null}
        color={painted ? tint : base}
        emissive={target || !glowColor ? highlight : glowColor}
        emissiveIntensity={0}
        roughness={painted ? 0.8 : 0.82}
        {...(glitter && { onBeforeCompile: glitter, defines: { GLITTER: "" } })}
      />
      <Ink geometry={geometry} width={SPOTS.has(cell.kind ?? "") ? 1.5 : 2} grounded />
      {decal && (
        <mesh ref={decalMesh} geometry={decal} position={[0, TILE_TOP - SLAB + 0.02, 0]} visible={false} raycast={noRaycast}>
          <meshStandardMaterial map={print.texture} transparent roughness={0.8} depthWrite={false} />
        </mesh>
      )}
      {halo && (
        <mesh geometry={halo} position={[0, 0.004, 0]} raycast={noRaycast}>
          <meshBasicMaterial color={HIGHLIGHT} transparent opacity={0.85} />
        </mesh>
      )}
      {surface && water && (
        <mesh geometry={surface} position={[0, TILE_TOP - SLAB + 0.006, 0]} raycast={noRaycast} receiveShadow>
          {/* A glossy clear coat over a softer body, like a jelly sweet. */}
          <meshPhysicalMaterial
            key={`${painted ? "painted" : "plain"}-${water.id}`}
            ref={surfaceMaterial}
            map={painted?.texture ?? null}
            color={painted ? tint : waterColor}
            emissive={target || !glowColor ? highlight : glowColor}
            emissiveIntensity={0}
            roughness={0.32}
            clearcoat={1}
            clearcoatRoughness={0.06}
            envMapIntensity={1.4}
            onBeforeCompile={compile}
          />
        </mesh>
      )}
      {growth && grass && (
        <GrassPatch
          sprouts={growth.sprouts}
          trees={growth.trees}
          k={k}
          spacing={grass.spacing}
          cellSize={grass.size}
          top={TILE_TOP - SLAB}
          field={grass.field}
          glow={material}
        />
      )}
      {wedges && (
        <mesh geometry={wedges} position={[0, TILE_TOP - SLAB + 0.004, 0]} raycast={noRaycast} receiveShadow>
          <meshStandardMaterial ref={wedgeMaterial} vertexColors emissive={target || !glowColor ? highlight : glowColor} emissiveIntensity={0} roughness={0.75} />
        </mesh>
      )}
      {rim && (
        <mesh geometry={rim} position={[0, TILE_TOP - SLAB + 0.004, 0]} raycast={noRaycast} receiveShadow>
          <meshStandardMaterial ref={rimMaterial} vertexColors emissive={target || !glowColor ? highlight : glowColor} emissiveIntensity={0} roughness={0.8} />
        </mesh>
      )}
    </mesh>
  );
}

/** A checker-like disc: flat top, rounded rim. */
const DISC = (() => {
  const points = [
    [0, 0],
    [0.9, 0],
    [0.98, 0.06],
    [1, 0.2],
    [1, 0.8],
    [0.97, 0.94],
    [0.88, 1],
    [0, 1],
  ].map(([x, y]) => new Vector2(x, y));
  return new LatheGeometry(points, 40);
})();

/** A painted wooden block with softened edges, one unit across. */
const CUBE = new RoundedBoxGeometry(1, 1, 1, 3, 0.11);

/** A standing worker: wide base, waist and a round head, as tall as PAWN_HEIGHT radii. */
const PAWN_HEIGHT = 2.4;
const PAWN = (() => {
  const body = [
    [0, 0],
    [0.95, 0],
    [1, 0.05],
    [0.92, 0.11],
    [0.6, 0.18],
    [0.42, 0.36],
    [0.36, 0.58],
    [0.52, 0.62],
    [0.52, 0.66],
    [0.3, 0.69],
  ];
  // The head is a sphere of radius 0.42 r; heights are in units of the pawn's full height.
  const ry = 0.42 / PAWN_HEIGHT;
  const head = Array.from({ length: 9 }, (_, i) => {
    const angle = -Math.PI / 3 + (i / 8) * (Math.PI / 2 + Math.PI / 3);
    return [0.42 * Math.cos(angle), 1 - ry + ry * Math.sin(angle)];
  });
  return new LatheGeometry([...body, ...head, [0, 1]].map(([x, y]) => new Vector2(x, y)), 32);
})();

function Piece({ piece, k, at, base, exit }: { piece: GeometryPiece; k: number; at: [number, number]; base: number; exit?: Exit }) {
  const ref = useRef<Group>(null!);
  const r = piece.r * k;
  const square = piece.shape === "square";
  const pawn = piece.shape === "pawn";
  const height = square ? 2 * r : pawn ? PAWN_HEIGHT * r : 0.55 * r;
  const color = playerColor(piece.owner);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    ref.current.position.set(at[0], base + 6, at[1]);
    // Only on mount: later moves slide the piece from where it stands.
  }, []);
  useEffect(() => invalidate(), [at[0], at[1], invalidate]);
  useFrame((state, dt) => {
    if (!exit) {
      if (easing.damp3(ref.current.position, [at[0], base, at[1]], 0.14, step(dt))) state.invalidate();
      return;
    }
    // Leaving: a piece lost in a battle waits for its cue, then is knocked over and flies out of the
    // cell; any other shrinks away where it stood.
    const t = (performance.now() - exit.since) / 1000 - (exit.knock ? KNOCK_AT : 0);
    const s = Math.min(1, Math.max(0, t / (exit.knock ? EXIT_SECONDS : 0.3)));
    const g = ref.current;
    if (exit.knock && !reducedMotion) {
      const [dx, dz] = [at[0] - exit.knock[0], at[1] - exit.knock[1]];
      const len = Math.hypot(dx, dz) || 1;
      const [ux, uz] = len > 1e-3 ? [dx / len, dz / len] : [0.7, 0.7];
      const reach = r * 6;
      g.position.set(at[0] + ux * reach * s, base + Math.sin(s * Math.PI) * r * 4, at[1] + uz * reach * s);
      g.rotation.set(uz * s * 1.9, 0, -ux * s * 1.9);
      g.scale.setScalar(1 - Math.max(0, (s - 0.65) / 0.35));
    } else g.scale.setScalar(1 - s);
    if (s < 1) state.invalidate();
  });
  return (
    <group ref={ref}>
      <mesh rotation-x={-Math.PI / 2} position={[r * 0.25, 0.015, r * 0.35]} raycast={noRaycast} renderOrder={-1}>
        <planeGeometry args={[r * 3.2, r * 3.2]} />
        <meshBasicMaterial map={blobTexture()} color="#1a1008" transparent opacity={0.45} depthWrite={false} />
      </mesh>
      {square ? (
        <mesh geometry={CUBE} scale={2 * r} position={[0, r, 0]} castShadow receiveShadow raycast={noRaycast}>
          <meshStandardMaterial color={color} roughness={0.55} />
          <Ink geometry={CUBE} width={2} grounded />
        </mesh>
      ) : (
        <mesh geometry={pawn ? PAWN : DISC} scale={[r, height, r]} castShadow receiveShadow raycast={noRaycast}>
          <meshStandardMaterial color={color} roughness={0.55} />
          <Ink geometry={pawn ? PAWN : DISC} width={2} grounded />
        </mesh>
      )}
      {piece.label && (
        <mesh rotation-x={-Math.PI / 2} position={[0, height + 0.01, 0]} raycast={noRaycast}>
          <planeGeometry args={[1.6 * r, 1.6 * r]} />
          <meshBasicMaterial map={pieceLabel(piece.label)} transparent depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

/**
 * Warm light over the cells that glow, from a pool of `size` lights that stays mounted once the
 * board has glowed: adding or removing a light makes three recompile every lit material, a stutter
 * each time a lantern goes out. Lights with no cell to sit over fade to zero instead.
 */
function GlowLights({ spots, size, k }: { spots: { at: [number, number]; color: string }[]; size: number; k: number }) {
  const lights = useRef<(PointLight | null)[]>([]);
  const glowed = useRef(false);
  if (spots.length > 0) glowed.current = true;
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [spots, invalidate]);
  useFrame((_, delta) => {
    const dt = step(delta);
    let moving = false;
    lights.current.forEach((light, i) => {
      if (!light) return;
      const spot = spots[i];
      if (spot) {
        light.position.set(spot.at[0], SLAB + 2.5, spot.at[1]);
        light.color.set(spot.color);
      }
      moving = easing.damp(light, "intensity", spot ? 40 : 0, 0.35, dt) || moving;
    });
    if (moving) invalidate();
  });
  if (!glowed.current) return null;
  return (
    <>
      {Array.from({ length: size }, (_, i) => (
        <pointLight key={i} ref={(l) => void (lights.current[i] = l)} intensity={0} distance={k * 9} decay={2} />
      ))}
    </>
  );
}
