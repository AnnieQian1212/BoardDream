import type { CardView, Counter, Geometry, Panel, ResourceSpec } from "@boarddream/engine";
import { Quaternion, Vector3 } from "three";
import { playerColor } from "../colors";

/**
 * Places a game's panels and board on the 3D table. Everything is in table units (one unit is a
 * centimeter): rival mats along the far edge, the board and shared supply in the middle, the
 * viewer's mat in front and their hand held up toward the camera.
 */

export const CARD_W = 6.3;
export const CARD_H = 8.8;
export const MAT_TOP = 0.3;
const HEADER = 3.2;
const PAD = 1.1;
const ROW_GAP = 2.6;
const PILE = 4.6;
const HAND_TILT = 0.62;
const HAND_SCALE = 1.2;

export type Vec3 = [number, number, number];
export type Quat = [number, number, number, number];

export interface CardItem {
  id: string;
  card: CardView;
  position: Vec3;
  quaternion: Quat;
  scale: number;
  /** Where a card that was not on the table before flies in from. */
  spawn: Vec3;
  target: boolean;
  zone: "hand" | "shared" | "seat";
}

export interface PileItem {
  id: string;
  counter: Counter;
  resource?: ResourceSpec;
  position: Vec3;
  scale: number;
  target: boolean;
}

export interface DeckItem {
  id: string;
  label: string;
  count: number;
  position: Vec3;
  scale: number;
  target: boolean;
}

export interface MatItem {
  id: string;
  title: string;
  color: string;
  position: Vec3;
  width: number;
  depth: number;
  active: boolean;
  /** A shared supply (market) rather than a seat's mat. */
  shared: boolean;
}

/** Live numbers drawn as HTML next to a mat's name: score, hand size, round. */
export interface BadgeItem {
  id: string;
  /** The right end of the badge row; it grows leftward from here. */
  position: Vec3;
  /** How far left the row may reach before it runs into the mat's title. */
  left: Vec3;
  counters: Counter[];
  note?: string;
  active: boolean;
  you: boolean;
  seat?: number;
}

export interface BoardItem {
  geometry: Geometry;
  position: Vec3;
  /** Table units per geometry unit. */
  scale: number;
  width: number;
  depth: number;
}

export interface TableLayout {
  mats: MatItem[];
  cards: CardItem[];
  piles: PileItem[];
  decks: DeckItem[];
  badges: BadgeItem[];
  board?: BoardItem;
  /** Each seat's mat header, where a rival's cards appear from and vanish into. */
  seatAnchors: Map<number, Vec3>;
  bounds: { min: Vec3; max: Vec3 };
  /** Outline points of everything on the table; the camera keeps them all in view. */
  outline: Vec3[];
}

export interface LayoutInput {
  panels: Panel[];
  geometry?: Geometry;
  human: number;
  active?: number;
  targets: Set<string>;
  resources: Map<string, ResourceSpec>;
}

const IDENTITY: Quat = [0, 0, 0, 1];
const FLIP = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI);
const isDeck = (c: Counter) => !c.resource && /deck|draw|pile|stack/i.test(c.label);

/** A mat's contents measured before it is placed. */
interface Block {
  width: number;
  depth: number;
  place(x: number, z: number, out: TableLayout): void;
}

function matBlock(panel: Panel, input: LayoutInput, opts: { cardScale: number; pileScale: number; width?: number; title: string; you: boolean }): Block {
  const { cardScale, pileScale } = opts;
  const counters = panel.counters ?? [];
  const piles = counters.filter((c) => c.resource);
  const decks = panel.zone === "shared" ? counters.filter(isDeck) : [];
  const plain = counters.filter((c) => !c.resource && !decks.includes(c));
  const cards = panel.cards ?? [];

  const cw = CARD_W * cardScale;
  const ch = CARD_H * cardScale;
  const pile = PILE * pileScale;
  const pileRows = piles.length === 0 ? 0 : Math.min(2, piles.length);
  const pileCols = Math.ceil(piles.length / Math.max(1, pileRows));
  const deckW = decks.length > 0 ? cw + 1.2 : 0;
  const pilesW = pileCols * pile;
  // Seats keep a card row once the game deals them cards at all, so mats do not resize mid-game.
  const showCards = cards.length > 0 || (panel.zone === "players" && panel.cards !== undefined);
  const cardGap = 0.6 * cardScale;
  const natural = 2 * PAD + pilesW + (pilesW > 0 ? 0.8 : 0) + deckW + (showCards ? Math.max(cards.length, 1) * (cw + cardGap) - cardGap : 0);
  // Room for the title and the note badge in the header. Seat mats stay narrow: a row of rivals
  // widened for their notes pushes the camera back, and their notes wrap or step aside instead.
  const width = Math.max(opts.width ?? natural, panel.note && panel.zone === "shared" ? 28 : 18);
  const bodyDepth = Math.max(showCards ? ch : 0, pileRows * pile, decks.length > 0 ? ch : 0, 2);
  const depth = HEADER + bodyDepth + PAD;

  return {
    width,
    depth,
    place(x, z, out) {
      const seat = panel.zone === "players" ? (panel.owner ?? 0) : undefined;
      const color = seat !== undefined ? playerColor(seat) : "#e6b64a";
      const active = seat !== undefined && seat === input.active;
      out.mats.push({ id: panel.id, title: opts.title, color, position: [x, 0, z], width, depth, active, shared: panel.zone === "shared" });
      const left = x - width / 2 + PAD;
      const top = z - depth / 2;
      const bodyZ = top + HEADER + bodyDepth / 2 - 0.3;
      const anchor: Vec3 = [x - width / 2 + 5, 3, top + 1.6];
      if (seat !== undefined) out.seatAnchors.set(seat, anchor);
      out.badges.push({
        id: panel.id,
        position: [x + width / 2 - 1, MAT_TOP, top + 1.6],
        // The title is painted 1.25 units tall from 1.4 in (matTexture), about 0.7 units per letter.
        left: [x - width / 2 + 2.4 + 0.7 * opts.title.length, MAT_TOP, top + 1.6],
        counters: plain,
        note: panel.note,
        active,
        you: opts.you,
        seat,
      });

      piles.forEach((counter, i) => {
        const col = Math.floor(i / pileRows);
        const row = i % pileRows;
        out.piles.push({
          id: counter.id,
          counter,
          resource: input.resources.get(counter.resource!),
          position: [left + (col + 0.5) * pile, MAT_TOP, bodyZ + (row - (pileRows - 1) / 2) * pile],
          scale: pileScale,
          target: input.targets.has(counter.id),
        });
      });
      let cursor = left + pilesW + (pilesW > 0 ? 0.8 : 0);

      decks.forEach((counter) => {
        out.decks.push({
          id: counter.id,
          label: counter.label,
          count: counter.value,
          position: [cursor + cw / 2, MAT_TOP, bodyZ],
          scale: cardScale,
          target: input.targets.has(counter.id),
        });
      });
      cursor += deckW;

      // Cards in a row; they overlap once the row is full.
      const room = x + width / 2 - PAD - cursor;
      const step = cards.length > 1 ? Math.min(cw + cardGap, (room - cw) / (cards.length - 1)) : 0;
      const deck = out.decks.at(-1);
      cards.forEach((card, i) => {
        // Lifted a hair off the mat so the glow underneath stays above the cloth.
        const position: Vec3 = [cursor + cw / 2 + i * step, MAT_TOP + 0.1 + i * 0.012, bodyZ];
        const spawn: Vec3 =
          panel.zone === "shared" && deck ? [deck.position[0], MAT_TOP + 1, deck.position[2]] : seat !== undefined ? anchor : [position[0], 8, position[2]];
        out.cards.push({
          id: card.id,
          card,
          position,
          quaternion: card.faceDown ? (FLIP.toArray() as Quat) : IDENTITY,
          scale: cardScale,
          spawn,
          target: input.targets.has(card.id),
          zone: panel.zone === "shared" ? "shared" : "seat",
        });
      });
    },
  };
}

function boardBlock(geometry: Geometry, size: number): Block {
  const scale = size / Math.max(geometry.width, geometry.height);
  const width = geometry.width * scale + 2.4;
  const depth = geometry.height * scale + 2.4;
  return {
    width,
    depth,
    place(x, z, out) {
      out.board = { geometry, position: [x, 0, z], scale, width, depth };
    },
  };
}

/** Places blocks side by side, centered on x = 0, vertically centered in a row starting at `top`. */
function row(blocks: Block[], top: number, gap: number, out: TableLayout): number {
  if (blocks.length === 0) return top;
  const total = blocks.reduce((sum, b) => sum + b.width, 0) + gap * (blocks.length - 1);
  const depth = Math.max(...blocks.map((b) => b.depth));
  let x = -total / 2;
  for (const block of blocks) {
    block.place(x + block.width / 2, top + depth / 2, out);
    x += block.width + gap;
  }
  return top + depth + ROW_GAP;
}

export function layoutTable(input: LayoutInput): TableLayout {
  const { panels, geometry, human } = input;
  const out: TableLayout = {
    mats: [],
    cards: [],
    piles: [],
    decks: [],
    badges: [],
    seatAnchors: new Map(),
    bounds: { min: [0, 0, 0], max: [0, 0, 0] },
    outline: [],
  };

  const seats = panels.filter((p) => p.zone === "players");
  const mine = seats.find((p) => p.owner === human);
  const rivals = seats
    .filter((p) => p !== mine)
    .sort((a, b) => (((a.owner ?? 0) - human + 99) % 99) - (((b.owner ?? 0) - human + 99) % 99));
  const shared = panels.filter((p) => p.zone === "shared");
  const hand = panels.find((p) => p.zone === "hand");

  let z = 0;
  if (rivals.length > 0) {
    const width = Math.min(36, (74 - 2 * (rivals.length - 1)) / rivals.length);
    const blocks = rivals.map((p) => matBlock(p, input, { cardScale: 0.66, pileScale: 0.8, width, title: p.title, you: false }));
    z = row(blocks, z, 2, out);
  }

  const center: Block[] = [];
  if (geometry) center.push(boardBlock(geometry, panels.length > 0 ? 34 : 46));
  center.push(...shared.map((p) => matBlock(p, input, { cardScale: 1, pileScale: 1, title: p.title, you: false })));
  z = row(center, z, 3, out);

  if (mine) z = row([matBlock(mine, input, { cardScale: 0.82, pileScale: 1, width: 66, title: "You", you: true })], z, 0, out);

  // The hand is held up toward the camera and fanned.
  const held = hand?.cards ?? [];
  if (held.length > 0) {
    const tilt = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), HAND_TILT);
    const half = (CARD_H * HAND_SCALE) / 2;
    const anchor = new Vector3(0, 1.2 + half * Math.sin(HAND_TILT), z - 1 + half * Math.cos(HAND_TILT));
    const spacing = Math.min(CARD_W * HAND_SCALE * 0.86, 52 / held.length);
    const deck = out.decks[0];
    held.forEach((card, i) => {
      const o = i - (held.length - 1) / 2;
      const fan = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -o * 0.07);
      const local = new Vector3(o * spacing, i * 0.05, o * o * 0.16).applyQuaternion(tilt);
      const q = tilt.clone().multiply(fan);
      out.cards.push({
        id: card.id,
        card,
        position: anchor.clone().add(local).toArray() as Vec3,
        quaternion: q.toArray() as Quat,
        scale: HAND_SCALE,
        spawn: deck ? [deck.position[0], MAT_TOP + 1, deck.position[2]] : [0, 8, anchor.z],
        target: input.targets.has(card.id),
        zone: "hand",
      });
    });
    z += CARD_H * HAND_SCALE * Math.cos(HAND_TILT) + 1;
  }

  // Outline and bounds of everything placed, for the camera and the lights.
  const rect = (x: number, y: number, zz: number, hw: number, hd: number) => {
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) out.outline.push([x + dx * hw, y, zz + dz * hd]);
  };
  for (const m of out.mats) rect(m.position[0], MAT_TOP, m.position[2], m.width / 2, m.depth / 2);
  if (out.board) rect(out.board.position[0], 1, out.board.position[2], out.board.width / 2, out.board.depth / 2);
  const corner = new Vector3();
  const q = new Quaternion();
  for (const c of out.cards) {
    if (c.zone !== "hand") continue;
    // A hovered hand card rises about two units; leave room for it.
    for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      corner.set((dx * CARD_W * c.scale) / 2, 0, (dz * CARD_H * c.scale) / 2 + (dz < 0 ? -2.2 : 0)).applyQuaternion(q.fromArray(c.quaternion));
      out.outline.push([c.position[0] + corner.x, c.position[1] + corner.y + 0.8, c.position[2] + corner.z]);
    }
  }
  if (out.outline.length === 0) rect(0, 0, 0, 20, 15);
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of out.outline) {
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], p[i]);
      max[i] = Math.max(max[i], p[i]);
    }
  }
  return { ...out, bounds: { min, max } };
}
