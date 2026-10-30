import type { GeometryCell, GeometryPiece } from "@boarddream/engine";
import { RoundedBox } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { easing } from "maath";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
  type Group,
  CanvasTexture,
  type Mesh,
  type MeshBasicMaterial,
  type MeshStandardMaterial,
  type PointLight,
  type Texture,
} from "three";
import { playerColor, TILE_COLORS } from "../colors";
import { HIGHLIGHT } from "./Card3D";
import { setCursor } from "./hover";
import type { BoardItem } from "./layout";
import { reducedMotion, step } from "./motion";
import { hash, mix } from "./paint";
import { blobTexture, boardPrint, NAVY, pieceLabel } from "./textures";
import { GRASS_HEIGHT, GrassPatch, useGrassField, type GrassField } from "./Grass";
import { cellSize, clearing, grassSpacing, growthField, plant, printUnit, sow } from "./growth";
import { isWaterKind, STEP_RATE, WaterGrid } from "./water";
import { waterCompiler, waterUniforms, type WaterUniforms } from "./waterMaterial";

const SLAB = 0.6;
const TILE = 0.32;
const BEVEL = 0.07;
const TILE_TOP = SLAB + TILE + 2 * BEVEL;
/** Building spots (kind "vertex") and roads (kind "edge") stand above the tiles they sit between. */
const SPOT = 0.55;
const SPOT_TOP = SLAB + SPOT + 2 * BEVEL;
const SPOTS = new Set(["vertex", "edge"]);
const noRaycast = () => null;
/** Tiles shrink to this share of their cell; water fills a little less, leaving a rim of shore. */
const TILE_SHARE = 0.9;
const WATER_SHARE = 0.86;

const CREAM = "#f3ead8";

function tileColor(cell: GeometryCell): string {
  // Roads and buildings spots take the full seat color; owned tiles get a tint.
  if (cell.owner !== undefined) return SPOTS.has(cell.kind ?? "") ? playerColor(cell.owner) : mix(playerColor(cell.owner), CREAM, 0.5);
  return cell.segments ? CREAM : kindColor(cell.kind ?? "");
}

/** A kind's own color; kinds a generated game invents (obsidian, caldera, ...) get a stable soft one. */
function kindColor(kind: string): string {
  if (TILE_COLORS[kind]) return TILE_COLORS[kind];
  return kind ? mix(UNKNOWN[hash(kind) % UNKNOWN.length], CREAM, 0.35) : CREAM;
}

const UNKNOWN = ["#c98b6b", "#8fb0c9", "#b5a3cf", "#d9b86c", "#93b98a", "#c99aa8", "#8fc1b8", "#b8a58f"];

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

/** Maps a tile's top onto its source tile in the painting (board units, flipped for the texture). */
function paintUvs(g: BufferGeometry, painted: { paint: BoardPaint; source: [number, number] }, k: number) {
  const [sx, sy] = painted.source;
  const { width: w, height: h } = painted.paint;
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  const unit = k * TILE_SHARE;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (sx + pos.getX(i) / unit) / w, 1 - (sy + pos.getZ(i) / unit) / h);
  uv.needsUpdate = true;
}

/** The board's water: one rippling grid under every water tile, and how the pointer stirs it. */
interface Water {
  uniforms: WaterUniforms;
  /** The pointer passing over the water at a world point: a trail of small dips. */
  wake(x: number, z: number): void;
  /** A click on the water: one deeper dip. */
  splash(x: number, z: number): void;
}

function useWater(geometry: BoardItem["geometry"], k: number, position: BoardItem["position"]): Water | undefined {
  const invalidate = useThree((s) => s.invalidate);
  const [ox, , oz] = position;
  // Rebuilt only when the water itself changes, not on every move.
  const cells = geometry.cells.filter((c) => isWaterKind(c.kind) && !c.segments && c.kind !== "label");
  const key = cells.map((c) => `${c.id}:${c.polygon.flat().join(",")}`).join("|");
  const surface = useMemo(() => {
    if (cells.length === 0) return undefined;
    const polygons = cells.map((c) => {
      const [cx, cy] = centroid(c.polygon);
      const [wx, wz] = [(cx - geometry.width / 2) * k, (cy - geometry.height / 2) * k];
      return c.polygon.map(([x, y]) => [wx + (x - cx) * k * WATER_SHARE, wz + (y - cy) * k * WATER_SHARE] as [number, number]);
    });
    const grid = new WaterGrid(polygons, k / 20);
    return { grid, uniforms: waterUniforms(grid, [ox, oz], k) };
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
      if (!from) grid.disturb(lx, lz, 0.25);
      else {
        // Dips evenly spaced along the path, however often the pointer reports.
        const d = Math.hypot(lx - from.x, lz - from.z);
        if (d < gap) return void (from.t = now);
        const n = Math.min(16, Math.floor(d / gap));
        for (let i = 1; i <= n; i++) grid.disturb(from.x + ((lx - from.x) * i) / n, from.z + ((lz - from.z) * i) / n, 0.25);
      }
      last.current = { x: lx, z: lz, t: now };
      invalidate();
    },
    [surface, ox, oz, invalidate],
  );
  const splash = useCallback(
    (x: number, z: number) => {
      if (!surface || reducedMotion) return;
      surface.grid.disturb(x - ox, z - oz, 0.9, 4);
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

  return useMemo(() => surface && { uniforms: surface.uniforms, wake, splash }, [surface, wake, splash]);
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
    t.anisotropy = 8;
    return () => {
      alive = false;
      t.dispose();
    };
  }, [paint, invalidate]);
  // Rebuild the printed labels only when their text changes, not on every move.
  const labelKey = geometry.cells.map((c) => (c.label ? `${c.id}:${c.label}` : "")).join("|");
  const margin = (width - geometry.width * k) / 2 / k;
  const labels = useMemo(() => boardPrint(geometry, margin), [labelKey, geometry.width, geometry.height, margin]);
  useEffect(() => () => labels?.dispose(), [labels]);
  const toWorld = (x: number, y: number): [number, number] => [(x - geometry.width / 2) * k, (y - geometry.height / 2) * k];
  const spotCells = useMemo(() => new Set(geometry.cells.filter((c) => SPOTS.has(c.kind ?? "")).map((c) => c.id)), [geometry]);
  const night = geometry.mood === "night";
  const water = useWater(geometry, k, position);
  // Grass: sized from a typical cell, thinned on boards with a lot of green.
  const greenKey = geometry.cells.map((c) => `${c.kind}${c.segments?.join("")}`).join("|");
  const size = useMemo(() => cellSize(geometry.cells), [greenKey]);
  const unit = useMemo(() => printUnit(geometry.cells), [geometry.cells.length, geometry.width, geometry.height]);
  const spacing = useMemo(() => grassSpacing(geometry.cells, size, grass), [greenKey, size, grass]);
  const growing = useMemo(() => geometry.cells.some((c) => growthField(c, TILE_SHARE)), [greenKey]);
  // A gust after each move: what is on the board changed, not merely the object describing it.
  const stir = geometry.pieces.map((p) => `${p.id}@${p.x},${p.y}`).join("|") + geometry.cells.map((c) => `${c.owner ?? ""}${c.label ?? ""}`).join("|");
  const field = useGrassField(k, size, stir, growing);
  useEffect(() => {
    if (water && paint) water.uniforms.uMapScale.value.set(1 / (k * TILE_SHARE * paint.width), -1 / (k * TILE_SHARE * paint.height));
  }, [water, paint, k]);
  const glowing = useMemo(
    () => geometry.cells.filter((c) => c.glow && c.kind !== "label").map((c) => ({ at: toWorld(...centroid(c.polygon)), color: c.glow! })),
    [geometry, k],
  );
  return (
    <group position={position}>
      <RoundedBox args={[width, SLAB, depth]} radius={0.3} smoothness={3} position={[0, SLAB / 2, 0]} castShadow receiveShadow raycast={noRaycast}>
        <meshStandardMaterial color={NAVY} roughness={0.7} />
      </RoundedBox>
      {geometry.cells
        .filter((cell) => cell.kind !== "label")
        .map((cell) => (
          <Tile
            key={cell.id}
            cell={cell}
            k={k}
            at={toWorld(...centroid(cell.polygon))}
            target={targets.has(cell.id)}
            night={night}
            painted={texture && paint && sourceFor(paint, cell) ? { texture, paint, source: sourceFor(paint, cell)! } : undefined}
            water={water && isWaterKind(cell.kind) && !cell.segments ? water : undefined}
            grass={growing ? { field, spacing, size, unit } : undefined}
            onPick={onPick}
          />
        ))}
      {glowLights > 0 && <GlowLights spots={glowing} size={glowLights} k={k} night={night} />}
      <Fog width={width} depth={depth} night={night} />
      <mesh rotation-x={-Math.PI / 2} position={[0, TILE_TOP + 0.02, 0]} raycast={noRaycast}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial map={labels} transparent roughness={0.8} depthWrite={false} />
      </mesh>
      {geometry.pieces.map((piece) => (
        <Piece key={piece.id} piece={piece} k={k} at={toWorld(piece.x, piece.y)} base={spotCells.has(piece.cellId ?? "") ? SPOT_TOP : TILE_TOP} />
      ))}
    </group>
  );
}

interface TileProps {
  cell: GeometryCell;
  k: number;
  at: [number, number];
  target: boolean;
  /** The table's night (Geometry.mood): glowing cells burn brighter. */
  night: boolean;
  /** The painted board and where this tile's art sits on it. */
  painted?: { texture: Texture; paint: BoardPaint; source: [number, number] };
  /** The board's water, when this tile is water. */
  water?: Water;
  /** The board's grass, when any cell grows it. */
  grass?: { field: GrassField; spacing: number; size: number; unit: number };
  onPick: Props["onPick"];
}

function Tile({ cell, k, at, target, night, painted, water, grass, onPick }: TileProps) {
  const mesh = useRef<Mesh>(null!);
  const material = useRef<MeshStandardMaterial>(null!);
  const [hovered, setHovered] = useState(false);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [target, hovered, night, invalidate]);
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
    return g;
    // The painted prop is rebuilt every render; only its content matters here.
  }, [cell.polygon, k, painted?.paint, painted?.source[0], painted?.source[1]]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  // A water tile's top is a moving surface, a little inside the tile so a rim of shore shows.
  const surface = useMemo(() => {
    if (!water) return undefined;
    const [cx, cy] = centroid(cell.polygon);
    const g = new ShapeGeometry(new Shape(cell.polygon.map(([x, y]) => new Vector2((x - cx) * k * WATER_SHARE, -(y - cy) * k * WATER_SHARE))));
    g.rotateX(-Math.PI / 2);
    if (painted) paintUvs(g, painted, k);
    return g;
  }, [water, cell.polygon, k, painted?.paint, painted?.source[0], painted?.source[1]]);
  useEffect(() => () => surface?.dispose(), [surface]);
  const surfaceMaterial = useRef<MeshStandardMaterial>(null);
  // Grass on a green cell (or on an edge-matched tile's green wedges), with a bare patch for its name.
  const segmentsKey = cell.segments?.join(",");
  const growth = useMemo(() => {
    if (!grass) return undefined;
    const field = growthField(cell, cell.segments ? TILE_SHARE * 0.84 : TILE_SHARE * 0.97);
    if (!field) return undefined;
    const bare = clearing(cell, grass.unit, grass.size * GRASS_HEIGHT);
    const sprouts = sow(cell, field, grass.spacing, bare);
    return { sprouts, trees: plant(sprouts, field, bare, grass.spacing, cell.segments ? 0 : 4) };
  }, [grass?.spacing, grass?.unit, cell.id, cell.polygon, cell.kind, cell.label, segmentsKey]);
  const compile = useMemo(() => water && waterCompiler(water.uniforms), [water]);
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
  const segmentKey = cell.segments?.join(",");
  const wedges = useMemo(() => {
    if (!cell.segments) return undefined;
    const [cx, cy] = centroid(cell.polygon);
    const f = k * 0.9 * 0.84;
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
  }, [segmentKey, cell.polygon, k]);
  useEffect(() => () => wedges?.dispose(), [wedges]);
  const wedgeMaterial = useRef<MeshStandardMaterial>(null);
  const base = useMemo(() => new Color(tileColor(cell)), [cell]);
  // On a painted tile the art shows through; ownership tints it.
  const tint = useMemo(() => new Color(cell.owner !== undefined ? mix(playerColor(cell.owner), "#ffffff", 0.45) : "#ffffff"), [cell.owner]);
  const highlight = useMemo(() => new Color(HIGHLIGHT), []);
  const glowColor = useMemo(() => (cell.glow ? new Color(cell.glow) : undefined), [cell.glow]);

  useFrame((state, delta) => {
    const dt = step(delta);
    // Pale tiles under a bright light hide a faint glow, so legal tiles glow clearly; small spots
    // glow a bit more. Only the hovered one lifts: the printed labels lie at the tiles' height.
    // A cell that gives off light (Geometry cell.glow) burns softly by day and brightly at night.
    const burn = glowColor ? (night ? 0.9 : 0.35) : 0;
    const glow = target ? (hovered ? 0.8 : SPOTS.has(cell.kind ?? "") ? 0.55 : 0.42) : burn;
    let moving = easing.damp(material.current, "emissiveIntensity", glow, 0.1, dt);
    if (wedgeMaterial.current) wedgeMaterial.current.emissiveIntensity = material.current.emissiveIntensity;
    if (surfaceMaterial.current) surfaceMaterial.current.emissiveIntensity = material.current.emissiveIntensity;
    moving = easing.damp(mesh.current.position, "y", SLAB + (target && hovered ? 0.5 : 0), 0.1, dt) || moving;
    if (moving) state.invalidate();
  });

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      position={[at[0], SLAB, at[1]]}
      castShadow
      receiveShadow
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
        setCursor(target);
      }}
      onPointerOut={() => {
        setHovered(false);
        setCursor(false);
        if (growth) grass?.field.release();
      }}
      onPointerMove={
        (water || growth) &&
        ((e: ThreeEvent<PointerEvent>) => {
          water?.wake(e.point.x, e.point.z);
          if (growth) grass?.field.push(e.point.x, e.point.z);
        })
      }
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        water?.splash(e.point.x, e.point.z);
        if (target) onPick(cell.id, e.nativeEvent.clientX, e.nativeEvent.clientY);
      }}
    >
      {/* A painted tile wears its art on top; the sides pick up the painting's border color. Keyed so
          three builds a fresh shader when the map arrives. */}
      <meshStandardMaterial
        key={painted ? "painted" : "plain"}
        ref={material}
        map={painted?.texture ?? null}
        color={painted ? tint : base}
        emissive={target || !glowColor ? highlight : glowColor}
        emissiveIntensity={0}
        roughness={painted ? 0.72 : 0.68}
      />
      {halo && (
        <mesh geometry={halo} position={[0, 0.004, 0]} raycast={noRaycast}>
          <meshBasicMaterial color={HIGHLIGHT} transparent opacity={0.85} />
        </mesh>
      )}
      {surface && water && (
        <mesh geometry={surface} position={[0, TILE_TOP - SLAB + 0.006, 0]} raycast={noRaycast} receiveShadow>
          <meshStandardMaterial
            key={painted ? "painted" : "plain"}
            ref={surfaceMaterial}
            map={painted?.texture ?? null}
            color={painted ? tint : base}
            emissive={highlight}
            emissiveIntensity={0}
            roughness={0.1}
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
          <meshStandardMaterial ref={wedgeMaterial} vertexColors emissive={highlight} emissiveIntensity={0} roughness={0.75} />
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

function Piece({ piece, k, at, base }: { piece: GeometryPiece; k: number; at: [number, number]; base: number }) {
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
    if (easing.damp3(ref.current.position, [at[0], base, at[1]], 0.14, step(dt))) state.invalidate();
  });
  return (
    <group ref={ref}>
      <mesh rotation-x={-Math.PI / 2} position={[r * 0.25, 0.015, r * 0.35]} raycast={noRaycast} renderOrder={-1}>
        <planeGeometry args={[r * 3.2, r * 3.2]} />
        <meshBasicMaterial map={blobTexture()} color="#1a1008" transparent opacity={0.45} depthWrite={false} />
      </mesh>
      {square ? (
        <RoundedBox args={[2 * r, 2 * r, 2 * r]} radius={r * 0.22} smoothness={4} position={[0, r, 0]} castShadow receiveShadow raycast={noRaycast}>
          <meshStandardMaterial color={color} roughness={0.35} />
        </RoundedBox>
      ) : (
        <mesh geometry={pawn ? PAWN : DISC} scale={[r, height, r]} castShadow receiveShadow raycast={noRaycast}>
          <meshStandardMaterial color={color} roughness={0.3} />
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
function GlowLights({ spots, size, k, night }: { spots: { at: [number, number]; color: string }[]; size: number; k: number; night: boolean }) {
  const lights = useRef<(PointLight | null)[]>([]);
  const glowed = useRef(false);
  if (spots.length > 0) glowed.current = true;
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [spots, night, invalidate]);
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
      moving = easing.damp(light, "intensity", spot ? (night ? 260 : 40) : 0, 0.35, dt) || moving;
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

let fogTexture: CanvasTexture | undefined;
/** A soft white puff, drawn once and shared. */
function fogPuff(): CanvasTexture {
  if (fogTexture) return fogTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, "rgba(222, 232, 252, 0.8)");
  gradient.addColorStop(0.45, "rgba(222, 232, 252, 0.3)");
  gradient.addColorStop(1, "rgba(222, 232, 252, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 128, 128);
  fogTexture = new CanvasTexture(canvas);
  return fogTexture;
}

/**
 * Where the puffs lie, as fractions of the board (x, z, size): long low banks along the edges and
 * the corners, the same every night, so the middle of the board stays readable.
 */
const PUFFS: [number, number, number][] = [
  [-0.36, -0.4, 0.5],
  [0.3, -0.42, 0.55],
  [-0.46, 0.02, 0.38],
  [0.47, -0.04, 0.4],
  [-0.3, 0.44, 0.5],
  [0.34, 0.45, 0.48],
];

/** Low fog over the board at night. It fades in and out with the light and holds still between. */
function Fog({ width, depth, night }: { width: number; depth: number; night: boolean }) {
  const materials = useRef<(MeshBasicMaterial | null)[]>([]);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [night, invalidate]);
  useFrame((_, delta) => {
    const dt = step(delta);
    let moving = false;
    for (const material of materials.current) if (material) moving = easing.damp(material, "opacity", night ? 0.5 : 0, 0.5, dt) || moving;
    if (moving) invalidate();
  });
  const size = Math.max(width, depth);
  return (
    <group position={[0, TILE_TOP + 0.35, 0]}>
      {PUFFS.map(([fx, fz, scale], i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[fx * width, i * 0.01, fz * depth]} raycast={noRaycast} renderOrder={2}>
          <planeGeometry args={[size * scale, size * scale * 0.45]} />
          <meshBasicMaterial ref={(m) => void (materials.current[i] = m)} map={fogPuff()} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
