import type { GeometryCell, GeometryPiece } from "@boarddream/engine";
import { RoundedBox } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { easing } from "maath";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Color, ExtrudeGeometry, LatheGeometry, Shape, Vector2, type Group, type Mesh, type MeshStandardMaterial } from "three";
import { playerColor } from "../colors";
import { HIGHLIGHT } from "./Card3D";
import { setCursor } from "./hover";
import type { BoardItem } from "./layout";
import { step } from "./motion";
import { mix } from "./paint";
import { blobTexture, boardPrint, NAVY, pieceLabel } from "./textures";

const SLAB = 0.6;
const TILE = 0.32;
const BEVEL = 0.07;
const TILE_TOP = SLAB + TILE + 2 * BEVEL;
const noRaycast = () => null;

const TILE_COLORS: Record<string, string> = {
  ladder: "#bcd9b0",
  snake: "#f0c0b2",
};
const CREAM = "#f3ead8";

function tileColor(cell: GeometryCell): string {
  if (cell.owner !== undefined) return mix(playerColor(cell.owner), CREAM, 0.5);
  return TILE_COLORS[cell.kind ?? ""] ?? CREAM;
}

const centroid = (polygon: [number, number][]): [number, number] => [
  polygon.reduce((sum, [x]) => sum + x, 0) / polygon.length,
  polygon.reduce((sum, [, y]) => sum + y, 0) / polygon.length,
];

interface Props {
  board: BoardItem;
  targets: Set<string>;
  onPick(id: string, x: number, y: number): void;
}

/** The engine's board geometry as raised tiles on a slab, with pieces that slide between cells. */
export function Board3D({ board, targets, onPick }: Props) {
  const { geometry, scale: k, width, depth, position } = board;
  // Rebuild the printed labels only when their text changes, not on every move.
  const labelKey = geometry.cells.map((c) => (c.label ? `${c.id}:${c.label}` : "")).join("|");
  const margin = (width - geometry.width * k) / 2 / k;
  const labels = useMemo(() => boardPrint(geometry, margin), [labelKey, geometry.width, geometry.height, margin]);
  useEffect(() => () => labels?.dispose(), [labels]);
  const toWorld = (x: number, y: number): [number, number] => [(x - geometry.width / 2) * k, (y - geometry.height / 2) * k];
  return (
    <group position={position}>
      <RoundedBox args={[width, SLAB, depth]} radius={0.3} smoothness={3} position={[0, SLAB / 2, 0]} castShadow receiveShadow raycast={noRaycast}>
        <meshStandardMaterial color={NAVY} roughness={0.7} />
      </RoundedBox>
      {geometry.cells
        .filter((cell) => cell.kind !== "label")
        .map((cell) => (
          <Tile key={cell.id} cell={cell} k={k} at={toWorld(...centroid(cell.polygon))} target={targets.has(cell.id)} onPick={onPick} />
        ))}
      <mesh rotation-x={-Math.PI / 2} position={[0, TILE_TOP + 0.02, 0]} raycast={noRaycast}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial map={labels} transparent roughness={0.8} depthWrite={false} />
      </mesh>
      {geometry.pieces.map((piece) => (
        <Piece key={piece.id} piece={piece} k={k} at={toWorld(piece.x, piece.y)} />
      ))}
    </group>
  );
}

function Tile({ cell, k, at, target, onPick }: { cell: GeometryCell; k: number; at: [number, number]; target: boolean; onPick: Props["onPick"] }) {
  const mesh = useRef<Mesh>(null!);
  const material = useRef<MeshStandardMaterial>(null!);
  const [hovered, setHovered] = useState(false);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [target, hovered, invalidate]);
  const geometry = useMemo(() => {
    const [cx, cy] = centroid(cell.polygon);
    // Shrink toward the center so tiles have a gap, leaving room for the bevel.
    const shrink = (p: number, c: number) => (p - c) * k * 0.9;
    const shape = new Shape(cell.polygon.map(([x, y]) => new Vector2(shrink(x, cx), -shrink(y, cy))));
    const g = new ExtrudeGeometry(shape, { depth: TILE, bevelEnabled: true, bevelThickness: BEVEL, bevelSize: BEVEL, bevelSegments: 2, curveSegments: 1 });
    return g.rotateX(-Math.PI / 2).translate(0, BEVEL, 0);
  }, [cell.polygon, k]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const base = useMemo(() => new Color(tileColor(cell)), [cell]);
  const highlight = useMemo(() => new Color(HIGHLIGHT), []);

  useFrame((state, delta) => {
    const dt = step(delta);
    const glow = target ? (hovered ? 0.75 : 0.22) : 0;
    let moving = easing.damp(material.current, "emissiveIntensity", glow, 0.1, dt);
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
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (target) onPick(cell.id, e.nativeEvent.clientX, e.nativeEvent.clientY);
      }}
    >
      <meshStandardMaterial ref={material} color={base} emissive={highlight} emissiveIntensity={0} roughness={0.68} />
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

function Piece({ piece, k, at }: { piece: GeometryPiece; k: number; at: [number, number] }) {
  const ref = useRef<Group>(null!);
  const r = piece.r * k;
  const square = piece.shape === "square";
  const height = square ? 2 * r : 0.55 * r;
  const color = playerColor(piece.owner);
  const invalidate = useThree((s) => s.invalidate);
  useLayoutEffect(() => {
    ref.current.position.set(at[0], TILE_TOP + 6, at[1]);
    // Only on mount: later moves slide the piece from where it stands.
  }, []);
  useEffect(() => invalidate(), [at[0], at[1], invalidate]);
  useFrame((state, dt) => {
    if (easing.damp3(ref.current.position, [at[0], TILE_TOP, at[1]], 0.14, step(dt))) state.invalidate();
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
        <mesh geometry={DISC} scale={[r, height, r]} castShadow receiveShadow raycast={noRaycast}>
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
