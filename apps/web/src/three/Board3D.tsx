import type { GeometryCell, GeometryPiece } from "@boarddream/engine";
import { RoundedBox } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { easing } from "maath";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Color, ExtrudeGeometry, LatheGeometry, Shape, Vector2, type Group, type Mesh, type MeshStandardMaterial } from "three";
import { playerColor } from "../colors";
import { GOLD } from "./Card3D";
import { setCursor } from "./hover";
import type { BoardItem } from "./layout";
import { mix } from "./paint";
import { boardPrint, pieceLabel } from "./textures";

const SLAB = 0.6;
const TILE = 0.32;
const BEVEL = 0.07;
const TILE_TOP = SLAB + TILE + 2 * BEVEL;
const noRaycast = () => null;

const TILE_COLORS: Record<string, string> = {
  ladder: "#b9d3a8",
  snake: "#eab9ad",
};
const CREAM = "#ece0c5";

function tileColor(cell: GeometryCell): string {
  if (cell.owner !== undefined) return mix(playerColor(cell.owner), CREAM, 0.42);
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
        <meshStandardMaterial color="#2b2420" roughness={0.75} />
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
  const gold = useMemo(() => new Color(GOLD), []);

  useFrame((state, dt) => {
    const glow = target ? 0.25 + 0.2 * Math.sin(state.clock.elapsedTime * 3.2) + (hovered ? 0.9 : 0) : 0;
    easing.damp(material.current, "emissiveIntensity", glow, 0.12, dt);
    easing.damp(mesh.current.position, "y", SLAB + (target && hovered ? 0.5 : 0), 0.1, dt);
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
      <meshStandardMaterial ref={material} color={base} emissive={gold} emissiveIntensity={0} roughness={0.68} />
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
  useLayoutEffect(() => {
    ref.current.position.set(at[0], TILE_TOP + 6, at[1]);
    // Only on mount: later moves slide the piece from where it stands.
  }, []);
  useFrame((_, dt) => easing.damp3(ref.current.position, [at[0], TILE_TOP, at[1]], 0.14, dt));
  return (
    <group ref={ref}>
      {square ? (
        <RoundedBox args={[2 * r, 2 * r, 2 * r]} radius={r * 0.22} smoothness={4} position={[0, r, 0]} castShadow receiveShadow raycast={noRaycast}>
          <meshPhysicalMaterial color={color} roughness={0.35} clearcoat={0.8} clearcoatRoughness={0.2} />
        </RoundedBox>
      ) : (
        <mesh geometry={DISC} scale={[r, height, r]} castShadow receiveShadow raycast={noRaycast}>
          <meshPhysicalMaterial color={color} roughness={0.32} clearcoat={0.9} clearcoatRoughness={0.15} />
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
