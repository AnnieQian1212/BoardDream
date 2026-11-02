import type { GeometryBattle } from "@boarddream/engine";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { CanvasTexture, Color, MeshStandardMaterial, Object3D, Quaternion, SRGBColorSpace, Vector3, type Group, type Mesh, type Sprite } from "three";
import { playerColor } from "../colors";
import { leanToward } from "./focus";
import { Ink } from "./Ink";
import { reducedMotion } from "./motion";
import { INK, mix, seeded } from "./paint";

/**
 * A battle played out beside the cell it was fought over (Geometry.battle): an inked clash pops over
 * the cell, both sides' dice tumble down in a row each and settle on the faces rolled, the hits jump
 * and glow, and the lost pieces are knocked off (Board3D times them by KNOCK_AT). It takes
 * BATTLE_SECONDS; bots wait for it.
 */

export const BATTLE_SECONDS = 3.2;
/** When the lost pieces are knocked off, in seconds from the start. */
export const KNOCK_AT = 1.35;

const LAND = 0.85;
const HITS_AT = 1.15;
const FADE_AT = 2.65;

/** Face values by BoxGeometry face (+x, -x, +y, -y, +z, -z): opposite faces add up to seven. */
const FACE_VALUES = [3, 4, 1, 6, 2, 5];
const FACE_NORMALS = [
  new Vector3(1, 0, 0),
  new Vector3(-1, 0, 0),
  new Vector3(0, 1, 0),
  new Vector3(0, -1, 0),
  new Vector3(0, 0, 1),
  new Vector3(0, 0, -1),
];
const UP = new Vector3(0, 1, 0);
const DIE = new RoundedBoxGeometry(1, 1, 1, 3, 0.17);

const PIPS: Record<number, [number, number][]> = {
  1: [[0, 0]],
  2: [[-1, -1], [1, 1]],
  3: [[-1, -1], [0, 0], [1, 1]],
  4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
  6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};

const faces = new Map<string, CanvasTexture>();

/** One face of a die in a seat's color: an inked rim and inked pips. */
function dieFace(color: string, value: number): CanvasTexture {
  const key = `${color}:${value}`;
  let texture = faces.get(key);
  if (texture) return texture;
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = mix(color, "#fff8e6", 0.08);
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 7;
  ctx.strokeRect(4, 4, size - 8, size - 8);
  ctx.fillStyle = "#fffaf0";
  for (const [px, py] of PIPS[value]) {
    ctx.beginPath();
    ctx.arc(size / 2 + px * 32, size / 2 + py * 32, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.stroke();
  }
  texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  faces.set(key, texture);
  return texture;
}

let clashTexture: CanvasTexture | undefined;

/** An inked twelve-point burst, cream with a gold heart. */
function clash(): CanvasTexture {
  if (clashTexture) return clashTexture;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const random = seeded(17);
  const star = (outer: number, inner: number) => {
    ctx.beginPath();
    for (let i = 0; i < 24; i++) {
      const r = (i % 2 === 0 ? outer : inner) * (0.88 + random() * 0.18);
      const a = (i / 24) * Math.PI * 2 - Math.PI / 2;
      const [x, y] = [size / 2 + Math.cos(a) * r, size / 2 + Math.sin(a) * r];
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  };
  ctx.lineJoin = "round";
  star(120, 62);
  ctx.fillStyle = "#fbf3e1";
  ctx.fill();
  ctx.lineWidth = 9;
  ctx.strokeStyle = INK;
  ctx.stroke();
  star(70, 36);
  ctx.fillStyle = "#f2c45a";
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.stroke();
  clashTexture = new CanvasTexture(canvas);
  clashTexture.colorSpace = SRGBColorSpace;
  return clashTexture;
}

interface Props {
  battle: GeometryBattle;
  /** The cell's center on the board, in the board group's world units. */
  at: [number, number];
  /** World units across a typical cell, which sizes the dice and the burst. */
  cell: number;
  /** Height of the tiles' tops, where the dice land. */
  top: number;
  /** When the battle started, as performance.now() read it. */
  started: number;
}

interface Die {
  value: number;
  hit: boolean;
  color: string;
  from: Vector3;
  to: Vector3;
  rest: Quaternion;
  spin: Vector3;
  turns: number;
  delay: number;
}

export function Battle3D({ battle, at, cell, top, started }: Props) {
  const invalidate = useThree((s) => s.invalidate);
  const size = cell * 0.28;
  const dice = useMemo<Die[]>(() => {
    const random = seeded(battle.id.length * 31 + battle.attackerDice.length * 7 + battle.defenderDice.length);
    const row = (values: number[], hitOn: number, seat: number, side: -1 | 1, offset: number): Die[] =>
      values.map((value, i) => {
        const face = FACE_VALUES.indexOf(value);
        const yaw = new Quaternion().setFromAxisAngle(UP, (random() - 0.5) * 0.7);
        const rest = yaw.multiply(new Quaternion().setFromUnitVectors(FACE_NORMALS[face], UP));
        // Each side's row sits in front of the cell (toward the camera), attacker left, defender right.
        // They stand a little above the tiles so grass does not hide them.
        const to = new Vector3(at[0] + side * (cell * 0.3 + i * size * 1.2), top + size * 0.62, at[1] + cell * 0.55);
        const from = new Vector3(at[0] + side * cell * 0.1, top + size * 9, at[1] - cell * 0.1);
        return {
          value,
          hit: value >= hitOn,
          color: playerColor(seat),
          from,
          to,
          rest,
          spin: new Vector3(random() - 0.5, random() - 0.2, random() - 0.5).normalize(),
          turns: 2.5 + random() * 2,
          delay: offset + i * 0.08,
        };
      });
    return [
      ...row(battle.attackerDice, battle.attackerHitOn, battle.attacker, -1, 0.15),
      ...row(battle.defenderDice, battle.defenderHitOn, battle.defender, 1, 0.2),
    ];
  }, [battle, at[0], at[1], cell, top, size]);
  const materials = useMemo(
    () =>
      dice.map((d) =>
        FACE_VALUES.map((v) => new MeshStandardMaterial({ map: dieFace(d.color, v), roughness: 0.5, emissive: new Color("#ffd76a"), emissiveIntensity: 0 })),
      ),
    [dice],
  );
  useEffect(() => () => materials.flat().forEach((m) => m.dispose()), [materials]);
  const meshes = useRef<(Mesh | null)[]>([]);
  // The camera leans toward the fight while it plays.
  const center = useRef<Object3D>(null);
  useLayoutEffect(() => {
    if (center.current) leanToward(center.current.getWorldPosition(new Vector3()), BATTLE_SECONDS - 0.4);
  }, [battle]);
  const burst = useRef<Sprite>(null);
  const group = useRef<Group>(null);
  const q = useMemo(() => new Quaternion(), []);

  useFrame(() => {
    const t = (performance.now() - started) / 1000;
    if (t > BATTLE_SECONDS || !group.current) return;
    invalidate();
    // The clash: pops up over the cell, then fades.
    if (burst.current) {
      const pop = reducedMotion ? 1 : t < 0.18 ? (t / 0.18) * 1.25 : t < 0.32 ? 1.25 - ((t - 0.18) / 0.14) * 0.25 : 1;
      const fade = t < 0.6 ? 1 : Math.max(0, 1 - (t - 0.6) / 0.35);
      burst.current.scale.setScalar(cell * 0.75 * pop);
      burst.current.material.opacity = fade;
      burst.current.visible = fade > 0;
    }
    dice.forEach((d, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      const local = (t - d.delay) / LAND;
      const away = t > FADE_AT ? Math.max(0, 1 - (t - FADE_AT) / 0.45) : 1;
      if (local <= 0 && !reducedMotion) {
        mesh.visible = false;
        return;
      }
      mesh.visible = away > 0;
      const s = Math.min(1, local);
      if (reducedMotion || s >= 1) {
        // Settled; a hit jumps once and glows.
        const since = t - HITS_AT - i * 0.05;
        const jump = d.hit && since > 0 && since < 0.35 ? Math.sin((since / 0.35) * Math.PI) * size * 0.8 : 0;
        mesh.position.set(d.to.x, d.to.y + jump, d.to.z);
        mesh.quaternion.copy(d.rest);
        // Hits glow; misses grey out, so the dice read at a glance.
        const glow = d.hit && since > 0 ? 0.55 : 0;
        const dim = !d.hit && since > 0 ? 0.55 : 1;
        for (const m of materials[i]) {
          m.emissiveIntensity = glow;
          m.color.setScalar(dim);
        }
      } else {
        // Falling: along an arc to its spot, with a bounce at the end, spinning down to its face.
        const fall = s < 0.75 ? (s / 0.75) ** 2 : 1;
        const bounce = s >= 0.75 ? Math.sin(((s - 0.75) / 0.25) * Math.PI) * size * 0.9 : 0;
        mesh.position.lerpVectors(d.from, d.to, Math.min(1, s * 1.15));
        mesh.position.y = d.from.y + (d.to.y - d.from.y) * fall + bounce;
        q.setFromAxisAngle(d.spin, (1 - s) ** 2 * d.turns * Math.PI * 2);
        mesh.quaternion.copy(d.rest).premultiply(q);
      }
      mesh.scale.setScalar(size * away);
    });
  });

  return (
    <group ref={group}>
      <object3D ref={center} position={[at[0], top, at[1]]} />
      <sprite ref={burst} position={[at[0], top + cell * 0.45, at[1]]} renderOrder={5}>
        <spriteMaterial map={clash()} transparent depthTest={false} />
      </sprite>
      {dice.map((d, i) => (
        <mesh key={i} ref={(m) => void (meshes.current[i] = m)} geometry={DIE} material={materials[i]} castShadow visible={false}>
          <Ink geometry={DIE} width={1.5} grounded />
        </mesh>
      ))}
    </group>
  );
}
