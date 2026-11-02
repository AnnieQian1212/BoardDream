import type { CardView, Counter, Geometry, Panel, ResourceSpec } from "@boarddream/engine";
import { Quaternion, Vector3 } from "three";
import { playerColor } from "../colors";

/**
 * Places a game's panels and board on the 3D table. Everything is in table units (one unit is a
 * centimeter): the board in the middle with the shared supply standing upright beside it, rival
 * mats in columns on either side, the viewer's mat in front and their hand held up toward the
 * camera. The table is wide, like the screen, so everything on it can be drawn large.
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
/** Rival mats stand upright in the columns either side of the middle, this wide. */
const SEAT_W = 18;
const SIDE_GAP = 3;
/** The board's longer side with panels around it, and alone. */
const BOARD = 54;
const BOARD_ALONE = 52;

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
  /** Too many chips for the header: they wrap in rows from `position` down across the mat. */
  wrap?: boolean;
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
  /**
   * Screen pixels per table unit where the table will be drawn, which sizes the room left for HTML
   * chips. A first layout's camera fit gives it (tableScale); about 7 if left out.
   */
  pxPerUnit?: number;
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

/** Screen pixels per table unit when none is given: about the scale with both side panels open. */
const PX_PER_UNIT = 7;

/**
 * The HTML chips drawn over mats (counters, notes, the turn pill) in table units. They are a fixed
 * size on screen, so their size on the table depends on how large the table is drawn: `px` screen
 * pixels per table unit.
 */
function chipSizes(px: number) {
  const gap = 6 / px;
  return {
    gap,
    /** A wrapped row of chips: 26 px tall with 6 px between rows. */
    row: 32 / px,
    counter: (c: Counter) => (24 + 7.2 * c.label.length + 8 * String(c.value).length) / px,
    note: (note: string) => (24 + 6.6 * Math.min(note.length, 44)) / px,
    /** A resource pile's count chip: piles stand at least this far apart, so their chips never touch. */
    pile: 52 / px,
    /** The "Thinking…" pill at the head of a rival's chips. */
    turnPill: (24 + 7 * 10) / px,
    /** How many rows `widths` wrap into across `room`, filling each row before starting the next. */
    rows(widths: number[], room: number): number {
      let rows = 1;
      let used = 0;
      for (const w of widths) {
        if (used > 0 && used + gap + w > room) {
          rows++;
          used = w;
        } else used += (used > 0 ? gap : 0) + w;
      }
      return rows;
    },
  };
}

type ChipSizes = ReturnType<typeof chipSizes>;

/**
 * A shared supply standing upright beside the board: its piles in rows under the header, then its
 * deck and cards in a grid one to three cards wide, so a market runs down the table instead of
 * across it.
 */
function supplyBlock(panel: Panel, input: LayoutInput, sizes: ChipSizes): Block {
  const title = panel.title;
  const counters = panel.counters ?? [];
  const piles = counters.filter((c) => c.resource);
  const decks = counters.filter(isDeck);
  const plain = counters.filter((c) => !c.resource && !decks.includes(c));
  const cards = panel.cards ?? [];
  const gap = 0.6;
  const slots = decks.length + cards.length;
  const cols = slots > 8 ? 3 : slots > 3 ? 2 : 1;
  const rows = Math.ceil(slots / cols);
  // The header holds the title and, when they fit beside it, the counters' chips and the note.
  // Too many for that, and they wrap in rows across the top of the mat's body instead.
  const titleW = 2.4 + 0.7 * title.length;
  const chips = [...plain.map(sizes.counter), ...(panel.note ? [sizes.note(panel.note)] : [])];
  const chipsW = chips.reduce((sum, w) => sum + w + sizes.gap, 0);
  const width = Math.max(slots > 0 ? 2 * PAD + cols * CARD_W + (cols - 1) * gap : 0, Math.min(36, titleW + 1 + chipsW), 16);
  const wrap = chips.length > 0 && titleW + 1 + chipsW > width;
  const chipRows = wrap ? sizes.rows(chips, width - 2) : 0;
  const chipsDepth = chipRows * sizes.row;
  const pile = Math.max(PILE, sizes.pile);
  const perRow = Math.max(1, Math.floor((width - 2 * PAD) / pile));
  const pileRows = Math.ceil(piles.length / perRow);
  const pilesDepth = pileRows * pile + (pileRows > 0 && slots > 0 ? 0.6 : 0);
  const bodyDepth = Math.max(chipsDepth + pilesDepth + (rows > 0 ? rows * CARD_H + (rows - 1) * gap : 0), 2);
  const depth = HEADER + bodyDepth + PAD;
  return {
    width,
    depth,
    place(x, z, out) {
      out.mats.push({ id: panel.id, title, color: "#e6b64a", position: [x, 0, z], width, depth, active: false, shared: true });
      const top = z - depth / 2;
      const body = top + HEADER + chipsDepth;
      out.badges.push(
        wrap
          ? {
              id: panel.id,
              position: [x + width / 2 - 1, MAT_TOP, top + HEADER - 0.4],
              left: [x - width / 2 + 1, MAT_TOP, top + HEADER - 0.4],
              counters: plain,
              note: panel.note,
              active: false,
              you: false,
              wrap: true,
            }
          : {
              id: panel.id,
              position: [x + width / 2 - 1, MAT_TOP, top + 1.6],
              left: [x - width / 2 + titleW, MAT_TOP, top + 1.6],
              counters: plain,
              note: panel.note,
              active: false,
              you: false,
            },
      );
      const pileLeft = x - (Math.min(piles.length, perRow) * pile) / 2;
      piles.forEach((counter, i) => {
        out.piles.push({
          id: counter.id,
          counter,
          resource: input.resources.get(counter.resource!),
          position: [pileLeft + ((i % perRow) + 0.5) * pile, MAT_TOP, body + (Math.floor(i / perRow) + 0.5) * pile],
          scale: 1,
          target: input.targets.has(counter.id),
        });
      });
      const gridLeft = x - (cols * CARD_W + (cols - 1) * gap) / 2;
      const slot = (i: number): Vec3 => [
        gridLeft + (i % cols) * (CARD_W + gap) + CARD_W / 2,
        MAT_TOP + 0.1,
        body + pilesDepth + Math.floor(i / cols) * (CARD_H + gap) + CARD_H / 2,
      ];
      decks.forEach((counter, i) => {
        const [dx, , dz] = slot(i);
        out.decks.push({ id: counter.id, label: counter.label, count: counter.value, position: [dx, MAT_TOP, dz], scale: 1, target: input.targets.has(counter.id) });
      });
      const deck = out.decks.at(-1);
      cards.forEach((card, i) => {
        const position = slot(decks.length + i);
        out.cards.push({
          id: card.id,
          card,
          position,
          quaternion: card.faceDown ? (FLIP.toArray() as Quat) : IDENTITY,
          scale: 1,
          spawn: deck ? [deck.position[0], MAT_TOP + 1, deck.position[2]] : [position[0], 8, position[2]],
          target: input.targets.has(card.id),
          zone: "shared",
        });
      });
    },
  };
}

/**
 * A rival's mat standing upright in a side column: the seat's name in its header, its chips (turn,
 * note, counters, score) in rows under it, then its resource piles and its cards in grids. It is
 * narrow, so the board in the middle gets the room.
 */
function seatColumnBlock(panel: Panel, input: LayoutInput, sizes: ChipSizes): Block {
  const title = panel.title;
  const counters = panel.counters ?? [];
  const piles = counters.filter((c) => c.resource);
  const plain = counters.filter((c) => !c.resource);
  const cards = panel.cards ?? [];
  const showCards = cards.length > 0 || panel.cards !== undefined;
  const [cw, ch, gap] = [CARD_W * 0.66, CARD_H * 0.66, 0.4];
  const pile = Math.max(PILE * 0.8, sizes.pile);
  const width = SEAT_W;
  const inner = width - 2 * PAD;
  // Room for the turn pill whether or not it shows, so a mat keeps its size between turns.
  const chips = [sizes.turnPill, ...plain.map(sizes.counter), ...(panel.note ? [sizes.note(panel.note)] : [])];
  const chipsDepth = sizes.rows(chips, width - 2) * sizes.row + 0.4;
  const perRow = Math.max(1, Math.floor(inner / pile));
  const pileRows = Math.ceil(piles.length / perRow);
  const pilesDepth = pileRows * pile + (pileRows > 0 ? 0.4 : 0);
  const cols = Math.max(1, Math.floor((inner + gap) / (cw + gap)));
  const rows = showCards ? Math.max(1, Math.ceil(cards.length / cols)) : 0;
  const cardsDepth = rows > 0 ? rows * ch + (rows - 1) * gap : 0;
  const depth = HEADER + chipsDepth + pilesDepth + cardsDepth + PAD;
  return {
    width,
    depth,
    place(x, z, out) {
      const seat = panel.owner ?? 0;
      const active = seat === input.active;
      out.mats.push({ id: panel.id, title, color: playerColor(seat), position: [x, 0, z], width, depth, active, shared: false });
      const top = z - depth / 2;
      const anchor: Vec3 = [x - width / 2 + 4, 3, top + 1.6];
      out.seatAnchors.set(seat, anchor);
      out.badges.push({
        id: panel.id,
        position: [x + width / 2 - 1, MAT_TOP, top + HEADER - 0.4],
        left: [x - width / 2 + 1, MAT_TOP, top + HEADER - 0.4],
        counters: plain,
        note: panel.note,
        active,
        you: false,
        seat,
        wrap: true,
      });
      const body = top + HEADER + chipsDepth;
      const pileLeft = x - (Math.min(piles.length, perRow) * pile) / 2;
      piles.forEach((counter, i) => {
        out.piles.push({
          id: counter.id,
          counter,
          resource: input.resources.get(counter.resource!),
          position: [pileLeft + ((i % perRow) + 0.5) * pile, MAT_TOP, body + (Math.floor(i / perRow) + 0.5) * pile],
          scale: 0.8,
          target: input.targets.has(counter.id),
        });
      });
      const gridLeft = x - (cols * cw + (cols - 1) * gap) / 2;
      cards.forEach((card, i) => {
        const position: Vec3 = [
          gridLeft + (i % cols) * (cw + gap) + cw / 2,
          MAT_TOP + 0.1 + i * 0.012,
          body + pilesDepth + Math.floor(i / cols) * (ch + gap) + ch / 2,
        ];
        out.cards.push({
          id: card.id,
          card,
          position,
          quaternion: card.faceDown ? (FLIP.toArray() as Quat) : IDENTITY,
          scale: 0.66,
          spawn: anchor,
          target: input.targets.has(card.id),
          zone: "seat",
        });
      });
    },
  };
}

/** Blocks side by side, each centered on the row's middle line. */
function across(blocks: Block[], gap: number): Block {
  const width = blocks.reduce((sum, b) => sum + b.width, 0) + gap * Math.max(0, blocks.length - 1);
  const depth = Math.max(0, ...blocks.map((b) => b.depth));
  return {
    width,
    depth,
    place(x, z, out) {
      let left = x - width / 2;
      for (const block of blocks) {
        block.place(left + block.width / 2, z, out);
        left += block.width + gap;
      }
    },
  };
}

/** Blocks one under another, each centered on the column's middle line. */
function down(blocks: Block[], gap: number): Block {
  const width = Math.max(0, ...blocks.map((b) => b.width));
  const depth = blocks.reduce((sum, b) => sum + b.depth, 0) + gap * Math.max(0, blocks.length - 1);
  return {
    width,
    depth,
    place(x, z, out) {
      let top = z - depth / 2;
      for (const block of blocks) {
        block.place(x, top + block.depth / 2, out);
        top += block.depth + gap;
      }
    },
  };
}

/** Upright supplies in as few columns as keep each no taller than `height`, unless one alone is. */
function supplyColumns(blocks: Block[], height: number): Block | undefined {
  if (blocks.length === 0) return undefined;
  const columns: Block[][] = [];
  let used = Infinity;
  for (const block of blocks) {
    if (used + 2 + block.depth > height) {
      columns.push([block]);
      used = block.depth;
    } else {
      columns.at(-1)!.push(block);
      used += 2 + block.depth;
    }
  }
  return across(
    columns.map((column) => down(column, 2)),
    2.5,
  );
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
  // Rivals in turn order after the viewer, as if seated round the table: the first half up the
  // left side, the rest down the right.
  const rivals = seats
    .filter((p) => p !== mine)
    .sort((a, b) => (((a.owner ?? 0) - human + 99) % 99) - (((b.owner ?? 0) - human + 99) % 99));
  const shared = panels.filter((p) => p.zone === "shared");
  const hand = panels.find((p) => p.zone === "hand");
  const sizes = chipSizes(input.pxPerUnit ?? PX_PER_UNIT);
  const rivalMat = (p: Panel) => seatColumnBlock(p, input, sizes);
  const half = Math.ceil(rivals.length / 2);
  const leftSide = rivals.slice(0, half).reverse().map(rivalMat);
  const rightSide = rivals.slice(half).map(rivalMat);

  // The middle: the board with the shared supply upright beside it or, with no board, the shared
  // mats in a row.
  let middle: Block | undefined;
  if (geometry) {
    const board = boardBlock(geometry, panels.length > 0 ? BOARD : BOARD_ALONE);
    const supply = supplyColumns(
      shared.map((p) => supplyBlock(p, input, sizes)),
      Math.max(board.depth, 40),
    );
    middle = supply ? across([board, supply], 3) : board;
  } else if (shared.length > 0) {
    middle = across(
      shared.map((p) => matBlock(p, input, { cardScale: 1, pileScale: 1, title: p.title, you: false })),
      3,
    );
  }
  const you = mine ? matBlock(mine, input, { cardScale: 0.82, pileScale: 1, width: Math.max(56, middle?.width ?? 0), title: "You", you: true }) : undefined;
  const center = down(
    [middle, you].filter((b): b is Block => b !== undefined),
    ROW_GAP,
  );
  const table = across(
    [leftSide.length > 0 ? down(leftSide, 2) : undefined, center, rightSide.length > 0 ? down(rightSide, 2) : undefined].filter(
      (b): b is Block => b !== undefined,
    ),
    SIDE_GAP,
  );
  table.place(0, table.depth / 2, out);
  // The viewer's hand is held up in front of the middle.
  let z = table.depth / 2 + center.depth / 2 + ROW_GAP;

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
