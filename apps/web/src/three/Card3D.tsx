import type { ResourceSpec } from "@boarddream/engine";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { easing } from "maath";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
  Color,
  ExtrudeGeometry,
  Group,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  Shape,
  ShapeGeometry,
  Vector3,
  type BufferGeometry,
} from "three";
import { setCursor, setHover } from "./hover";
import { deckHeight } from "./Labels";
import { CARD_H, CARD_W, type CardItem, type DeckItem } from "./layout";
import { cardBack, cardFace, glowTexture } from "./textures";

const THICK = 0.05;
const RADIUS = 0.42;
export const GOLD = "#ffc75a";
/** Glow color above 1.0 so bloom picks it up. */
export const GLOW = new Color(GOLD).multiplyScalar(2.4);

function cardShape(w: number, h: number, r: number): Shape {
  const s = new Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

/** Card geometry lies flat in the XZ plane, face up, with the card's top edge toward -Z. */
function flat(geometry: BufferGeometry, up: boolean): BufferGeometry {
  return geometry.rotateX(up ? -Math.PI / 2 : Math.PI / 2);
}

function faceGeometry(): BufferGeometry {
  const g = new ShapeGeometry(cardShape(CARD_W, CARD_H, RADIUS), 6);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / CARD_W + 0.5, pos.getY(i) / CARD_H + 0.5);
  return g;
}

const SHARED = (() => {
  const body = new ExtrudeGeometry(cardShape(CARD_W, CARD_H, RADIUS), { depth: THICK, bevelEnabled: false, curveSegments: 6 });
  body.translate(0, 0, -THICK / 2);
  const glow = { w: CARD_W, h: CARD_H, blur: 1.6 };
  return {
    body: flat(body, true),
    face: flat(faceGeometry(), true).translate(0, THICK / 2 + 0.003, 0),
    back: flat(faceGeometry(), false).translate(0, -THICK / 2 - 0.003, 0),
    glow: flat(new PlaneGeometry(glow.w + 2 * glow.blur, glow.h + 2 * glow.blur), true).translate(0, -THICK / 2 - 0.04, 0),
    glowMap: glowTexture(glow.w, glow.h, glow.blur, RADIUS),
  };
})();

const noRaycast = () => null;

interface CardProps {
  item: CardItem;
  resources: Map<string, ResourceSpec>;
  onPick(id: string, x: number, y: number): void;
}

/** One card: flies from where it was to its slot, lifts when hovered, glows when it is a legal move. */
export function Card3D({ item, resources, onPick }: CardProps) {
  const group = useRef<Group>(null!);
  const glow = useRef<MeshBasicMaterial>(null!);
  const [hovered, setHovered] = useState(false);
  const face = useMemo(() => (item.card.faceDown ? cardBack() : cardFace(item.card, resources)), [item.card, resources]);
  const goal = useMemo(() => new Vector3(), []);
  const goalQ = useMemo(() => new Quaternion(), []);
  const lift = useMemo(() => new Vector3(), []);

  // Start where the card comes from; useFrame flies it to its slot. Later layouts only move the goal.
  useLayoutEffect(() => {
    group.current.position.fromArray(item.spawn);
    group.current.quaternion.fromArray(item.quaternion);
    group.current.scale.setScalar(item.scale * 0.85);
  }, []);

  useFrame((state, dt) => {
    const g = group.current;
    goalQ.fromArray(item.quaternion);
    goal.fromArray(item.position);
    const raise = hovered && (item.target || item.zone === "hand");
    if (raise) {
      // Up out of the hand toward the viewer, or up off the table.
      lift.set(0, item.zone === "hand" ? 0.8 : 1.2, item.zone === "hand" ? -2.2 : 0).applyQuaternion(goalQ);
      goal.add(lift);
    }
    // Arc over whatever lies between the card and its slot.
    const distance = g.position.distanceTo(goal);
    goal.y += Math.min(6, distance * 0.35);
    easing.damp3(g.position, goal, 0.16, dt);
    easing.dampQ(g.quaternion, goalQ, 0.16, dt);
    const s = item.scale * (raise ? 1.08 : 1);
    easing.damp3(g.scale, [s, s, s], 0.14, dt);
    const pulse = item.target ? 0.55 + 0.3 * Math.sin(state.clock.elapsedTime * 3.2) + (hovered ? 0.3 : 0) : 0;
    easing.damp(glow.current, "opacity", pulse, 0.12, dt);
  });

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    setCursor(item.target);
    if (!item.card.faceDown) setHover({ card: item.card, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
  };
  const out = () => {
    setHovered(false);
    setCursor(false);
    setHover(null);
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (item.target) onPick(item.id, e.nativeEvent.clientX, e.nativeEvent.clientY);
  };

  return (
    <group ref={group} onPointerOver={over} onPointerOut={out} onClick={click}>
      <mesh geometry={SHARED.body} castShadow receiveShadow>
        <meshStandardMaterial color="#efe6d2" roughness={0.8} />
      </mesh>
      <mesh geometry={SHARED.face} receiveShadow>
        <meshStandardMaterial map={face} roughness={0.74} envMapIntensity={0.55} />
      </mesh>
      <mesh geometry={SHARED.back}>
        <meshPhysicalMaterial map={cardBack()} roughness={0.55} clearcoat={0.3} clearcoatRoughness={0.4} envMapIntensity={0.6} />
      </mesh>
      <mesh geometry={SHARED.glow} raycast={noRaycast} renderOrder={-1}>
        <meshBasicMaterial
          ref={glow}
          map={SHARED.glowMap}
          color={GLOW}
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

const deckBody = new Map<number, BufferGeometry>();

function deckGeometry(height: number): BufferGeometry {
  const key = Math.round(height * 100);
  let g = deckBody.get(key);
  if (!g) {
    g = flat(new ExtrudeGeometry(cardShape(CARD_W, CARD_H, RADIUS), { depth: height, bevelEnabled: false, curveSegments: 6 }), true);
    deckBody.set(key, g);
  }
  return g;
}

/** A face-down draw pile whose height follows its size. */
export function Deck3D({ item, onPick }: { item: DeckItem; onPick(id: string, x: number, y: number): void }) {
  const glow = useRef<MeshBasicMaterial>(null!);
  const height = deckHeight(item.count);
  useFrame((state, dt) => {
    const pulse = item.target ? 0.6 + 0.3 * Math.sin(state.clock.elapsedTime * 3.2) : 0;
    easing.damp(glow.current, "opacity", pulse, 0.12, dt);
  });
  const [x, y, z] = item.position;
  return (
    <group
      position={[x, y, z]}
      scale={[item.scale, 1, item.scale]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setCursor(item.target);
        setHover({ text: `${item.label}: ${item.count} card${item.count === 1 ? "" : "s"}`, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
      }}
      onPointerOut={() => {
        setCursor(false);
        setHover(null);
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (item.target) onPick(item.id, e.nativeEvent.clientX, e.nativeEvent.clientY);
      }}
    >
      {item.count > 0 && (
        <>
          <mesh geometry={deckGeometry(height)} castShadow receiveShadow>
            <meshStandardMaterial color="#e2d6bd" roughness={0.85} />
          </mesh>
          <mesh geometry={SHARED.face} position={[0, height - THICK / 2, 0]}>
            <meshPhysicalMaterial map={cardBack()} roughness={0.5} clearcoat={0.35} />
          </mesh>
        </>
      )}
      <mesh geometry={SHARED.glow} position={[0, 0.06, 0]} raycast={noRaycast}>
        <meshBasicMaterial ref={glow} map={SHARED.glowMap} color={GLOW} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
