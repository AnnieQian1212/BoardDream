import { isDeck, type CardView, type Counter, type Geometry, type Panel, type ResourceSpec } from "@boarddream/engine";
import { Quaternion, Vector3 } from "three";
import { playerColor } from "../colors";
import { depthBelow, ELEVATION, screenProjector, tableScale, type Insets } from "./camera";
import { FONT_UI } from "./paint";

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
const SEAT_W = 24;
const SIDE_GAP = 3;
/** The board's longer side with panels around it, and alone. */
const BOARD = 54;
const BOARD_ALONE = 52;

/**
 * A mat's title as matTexture paints it: `size` units tall, starting `x` units in, its middle `y`
 * units down; Fraunces at that size runs about `perLetter` units a letter. The layout leaves the
 * header room this measure gives, so chips stop short of the title.
 */
export const MAT_TITLE = { size: 1.6, x: 1.4, y: 1.58, perLetter: 0.9 };
/** A deck's height on its mat, by how many cards are in it. */
export const deckHeight = (count: number) => Math.max(0.05, Math.min(count, 24) * 0.04);
/** Where a mat's header room for chips starts: past its title, with a unit to spare. */
const titleEnd = (title: string) => MAT_TITLE.x + 1 + MAT_TITLE.perLetter * title.length;

export type Vec3 = [number, number, number];
export type Arrangement = "sides" | "stack";
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
  /**
   * Wrapped chips line up on the mat's left instead of its right. A rival mat left of the middle
   * leans away from the camera's centre, its right edge drawing in row by row, so chips held to
   * that edge would run over it a few rows down; its left edge draws away from them.
   */
  start?: boolean;
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
  /**
   * The table depth that `pixels` of chips wrapped under mat `id`'s header take, measured where a
   * first layout put them on the camera fitted to it (fitTable). Without it, pxPerUnit gives the
   * depth, which is the middle's: on the far side of the table, where supplies stand, rows of chips
   * take more and ran into the cards under them.
   */
  chipRoom?: (id: string, pixels: number) => number | undefined;
  /**
   * Where rivals and the shared supply stand. "sides" seats the rivals in columns either side of
   * the middle, as many on the left as on the right (one more on the left when they are odd), and
   * stands the supply beside the board; "stack" stands the rivals in a row under the middle, which
   * suits a tall screen like a phone's. Tabletop lays out each that fits the screen and keeps
   * whichever draws the board larger. Rivals are never all put on one side: the table stays
   * balanced, as players sit round a real one.
   */
  arrangement?: Arrangement;
  /**
   * How tall the supplies' columns beside the board may be, as a share of the board's depth: taller
   * columns make the table narrower and its board larger on a wide screen, deeper on a tall one.
   */
  supplyHeight?: number;
}

const IDENTITY: Quat = [0, 0, 0, 1];
const FLIP = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI);


/** A mat's contents measured before it is placed. */
interface Block {
  width: number;
  depth: number;
  place(x: number, z: number, out: TableLayout): void;
}

function matBlock(
  panel: Panel,
  input: LayoutInput,
  opts: { cardScale: number; pileScale: number; width?: number; title: string; you: boolean; sizes?: ChipSizes },
): Block {
  const { cardScale, pileScale } = opts;
  const counters = panel.counters ?? [];
  const piles = counters.filter((c) => c.resource);
  const decks = panel.zone === "shared" ? counters.filter(isDeck) : [];
  const plain = counters.filter((c) => !c.resource && !decks.includes(c));
  const cards = panel.cards ?? [];

  const cw = CARD_W * cardScale;
  const ch = CARD_H * cardScale;
  // Piles stand a count chip's width apart, in one row when there are few, so their chips never
  // touch a neighbor.
  const pile = Math.max(PILE * pileScale, opts.sizes?.pile ?? 0);
  const pileRows = piles.length === 0 ? 0 : piles.length <= 4 ? 1 : 2;
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
        left: [x - width / 2 + titleEnd(opts.title), MAT_TOP, top + 1.6],
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

/** How far into a mat's body chips that wrap below its header start, so they never sit on it. */
const CHIPS_IN = 0.6;

/** Screen pixels per table unit when none is given: about the scale with both side panels open. */
const PX_PER_UNIT = 7;
/**
 * The HTML chips' measures in screen pixels, as styles.css draws them (a test holds the two
 * together): a chip's height, the gap between chips and rows, and a note's line clamp and height.
 */
export const CHIP = { height: 26, gap: 6, noteLines: 4, noteLine: 13 };

let measurer: CanvasRenderingContext2D | null | undefined;

/**
 * Text's width in screen pixels, in a chip's font, measured as the browser draws it. Estimated by
 * letter count where there is no canvas (tests): the estimate ran short of real notes, so a note
 * that wrapped onto a second line overlapped the cards under it.
 */
function textWidth(text: string, font: string, perLetter: number): number {
  if (measurer === undefined) {
    try {
      measurer = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
    } catch {
      measurer = null;
    }
  }
  if (!measurer) return perLetter * text.length;
  measurer.font = font;
  return measurer.measureText(text).width;
}

/** A note chip's text: 12px semibold (.badge-note), at most 300px across with 26px of padding and border. */
const NOTE_FONT = `600 12px ${FONT_UI}`;
const NOTE_MAX = 300;
const NOTE_PAD = 26;
const noteWidth = (note: string) => textWidth(note, NOTE_FONT, 6.6);

/** How many lines a note takes in a chip `room` pixels wide, wrapping between words as the browser does. */
function noteLineCount(note: string, room: number): number {
  const width = Math.min(NOTE_MAX, room) - NOTE_PAD;
  if (!(width > 0)) return CHIP.noteLines;
  let lines = 1;
  let line = "";
  for (const word of note.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && noteWidth(next) > width) {
      lines++;
      line = word;
    } else line = next;
  }
  return Math.min(CHIP.noteLines, lines);
}

/**
 * The HTML chips drawn over mats (counters, notes, the turn pill) in table units. They are a fixed
 * size on screen, so their size on the table depends on how large the table is drawn: `px` screen
 * pixels per table unit.
 */
function chipSizes(px: number) {
  const gap = CHIP.gap / px;
  // Chips are a fixed height on screen, but the table's depth is foreshortened under the tilted
  // camera: a pixel of height covers more of the table, front to back, than a pixel of width.
  const deep = px * Math.sin(ELEVATION);
  return {
    gap,
    /** Screen pixels that `rows` rows of wrapped chips take, with the extra lines of a note too long for one across `room`. */
    wrappedPx(rows: number, note: string | undefined, room: number): number {
      return rows * (CHIP.height + CHIP.gap) + (note && room > 0 ? (noteLineCount(note, room * px) - 1) * CHIP.noteLine : 0);
    },
    /** The table depth `pixels` of chips take where the table is drawn at its middle's scale. */
    depth: (pixels: number) => pixels / deep,
    counter: (c: Counter) => (24 + textWidth(c.label, `700 13px ${FONT_UI}`, 7.2) + textWidth(String(c.value), `700 13px ${FONT_UI}`, 8)) / px,
    // A little over the measure, so a note that only just fits is not wrapped by rounding.
    note: (note: string) => Math.min(NOTE_MAX, NOTE_PAD + noteWidth(note) * 1.04) / px,
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
 * deck and cards two to a row, so a market runs down the table instead of across it.
 */
function supplyBlock(panel: Panel, input: LayoutInput, sizes: ChipSizes, minWidth = 0, minDepth = 0): Block {
  const title = panel.title;
  const counters = panel.counters ?? [];
  const piles = counters.filter((c) => c.resource);
  const decks = counters.filter(isDeck);
  const plain = counters.filter((c) => !c.resource && !decks.includes(c));
  const cards = panel.cards ?? [];
  const gap = 0.6;
  const slots = decks.length + cards.length;
  // Two cards to a row, then the next row.
  const cols = slots > 1 ? 2 : 1;
  const rows = Math.ceil(slots / cols);
  // The header holds the title and, when they fit beside it, the counters' chips and the note.
  // Too many for that, and they wrap in rows across the top of the mat's body instead.
  const titleW = titleEnd(title);
  const chips = [...plain.map(sizes.counter), ...(panel.note ? [sizes.note(panel.note)] : [])];
  const chipsW = chips.reduce((sum, w) => sum + w + sizes.gap, 0);
  // The mat hugs its cards (or its title and piles, with no cards); chips that do not fit beside the
  // title wrap into the body rather than widen it.
  const cardsW = slots > 0 ? 2 * PAD + cols * CARD_W + (cols - 1) * gap : 0;
  const pilesW = 2 * PAD + Math.min(piles.length, 3) * Math.max(PILE, sizes.pile);
  // A supply of counters alone is wide enough for two chips to a row.
  const chipsOnly = slots === 0 && piles.length === 0 && chips.length > 1 ? Math.min(26, 2 * Math.max(...chips) + sizes.gap + 2) : 0;
  // A long title does not widen a mat with cards or piles: it is printed smaller to fit (matTexture).
  const titleRoom = slots > 0 || piles.length > 0 ? 0 : titleW + 2;
  // A counter's chip cannot wrap, so the mat is at least as wide as the widest (a note wraps instead).
  const counterRoom = plain.length > 0 ? Math.max(...plain.map(sizes.counter)) + 2.6 : 0;
  const width = Math.max(cardsW, piles.length > 0 ? pilesW : 0, chipsOnly, titleRoom, counterRoom, 14, minWidth);
  const wrap = chips.length > 0 && titleW + 1 + chipsW > width;
  const chipRows = wrap ? sizes.rows(chips, width - 2) : 0;
  // Wrapped chips start a little way into the body, clear of the header.
  // A deck stands up from the mat, toward the camera, so the chips over it need room for its height too.
  const deckRise = wrap && decks.length > 0 ? Math.max(...decks.map((d) => deckHeight(d.value))) / Math.tan(ELEVATION) : 0;
  const chipsPx = wrap ? sizes.wrappedPx(chipRows, panel.note, width - 2) : 0;
  const chipsDepth = wrap ? (input.chipRoom?.(panel.id, chipsPx) ?? sizes.depth(chipsPx)) + CHIPS_IN + 0.4 + deckRise : 0;
  const pile = Math.max(PILE, sizes.pile);
  const perRow = Math.max(1, Math.floor((width - 2 * PAD) / pile));
  const pileRows = Math.ceil(piles.length / perRow);
  const pilesDepth = pileRows * pile + (pileRows > 0 && slots > 0 ? 0.6 : 0);
  const bodyDepth = Math.max(chipsDepth + pilesDepth + (rows > 0 ? rows * CARD_H + (rows - 1) * gap : 0), 2);
  // Stretched to line up with its neighbours, it keeps its content at the top.
  const depth = Math.max(HEADER + bodyDepth + PAD, minDepth);
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
              position: [x + width / 2 - 1, MAT_TOP, top + HEADER + CHIPS_IN],
              left: [x - width / 2 + 1, MAT_TOP, top + HEADER + CHIPS_IN],
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
  // Room for the turn pill whether or not it shows, so a mat keeps its size between turns.
  const chips = [sizes.turnPill, ...plain.map(sizes.counter), ...(panel.note ? [sizes.note(panel.note)] : [])];
  // Resources stand in one column, so the mat is only as wide as its title, a pile and its widest
  // counter need (a note wraps instead).
  const counterW = Math.max(sizes.turnPill, ...plain.map(sizes.counter));
  const width = Math.max(titleEnd(title) + 1, pile + 2 * PAD, counterW * 1.08 + 3.5, 10);
  const inner = width - 2 * PAD;
  const chipsPx = sizes.wrappedPx(sizes.rows(chips, width - 2), panel.note, width - 2);
  const chipsDepth = (input.chipRoom?.(panel.id, chipsPx) ?? sizes.depth(chipsPx)) + CHIPS_IN + 0.4;
  const perRow = 1;
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
        position: [x + width / 2 - 1, MAT_TOP, top + HEADER + CHIPS_IN],
        left: [x - width / 2 + 1, MAT_TOP, top + HEADER + CHIPS_IN],
        counters: plain,
        note: panel.note,
        active,
        you: false,
        seat,
        wrap: true,
        start: x < 0,
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

/**
 * Upright mats in as few columns as keep each no taller than `height`, unless one alone is. A
 * height or depth that is not a number starts a column per mat rather than failing.
 */
/**
 * The shared supplies beside the board, grouped into columns no taller than `height`: of every way to
 * group them (there are a handful of supplies, so a few dozen ways), the one that leaves the table
 * narrowest, so the board can be drawn largest. A tall market can stand alone while two short
 * supplies share a column, one over the other. Within a column the supplies keep their order.
 */
function columns(makers: ((minWidth: number, minDepth: number) => Block)[], height: number): Block | undefined {
  if (makers.length === 0) return undefined;
  const blocks = makers.map((make) => make(0, 0));
  const COLUMN_GAP = 2.5;
  const ROW_GAP = 2;
  const options: { width: number; depth: number; waste: number; groups: number[][] }[] = [];
  // Each grouping in turn: block i joins one of the groups so far, or starts a new one.
  const visit = (i: number, groups: number[][]) => {
    if (i === blocks.length) {
      const depths = groups.map((g) => g.reduce((sum, b) => sum + blocks[b].depth, 0) + ROW_GAP * (g.length - 1));
      // A single supply taller than the limit stands alone; groups may not exceed it.
      if (groups.some((g, k) => g.length > 1 && depths[k] > height)) return;
      const widths = groups.map((g) => Math.max(...g.map((b) => blocks[b].width)));
      const width = widths.reduce((sum, w) => sum + w, 0) + COLUMN_GAP * (groups.length - 1);
      const depth = Math.max(...depths);
      // Empty mat left by stretching every supply to fill the rectangle.
      const filled = groups.reduce((sum, g) => sum + g.reduce((s2, b) => s2 + blocks[b].width * blocks[b].depth, 0), 0);
      const waste = widths.reduce((sum, w) => sum + w * depth, 0) - filled;
      options.push({ width, depth, waste, groups: groups.map((g) => [...g]) });
      return;
    }
    for (const g of groups) {
      g.push(i);
      visit(i + 1, groups);
      g.pop();
    }
    groups.push([i]);
    visit(i + 1, groups);
    groups.pop();
  };
  visit(0, []);
  // The narrowest groupings (within a twentieth of the narrowest), and of those the one that leaves
  // the least empty mat once stretched into a rectangle.
  const narrowest = Math.min(...options.map((o) => o.width));
  const best = options.filter((o) => o.width <= narrowest * 1.05 + 1e-6).sort((a, b) => a.waste - b.waste || a.width - b.width)[0];
  // Columns in the order of their first supply, so the market (usually first) stays nearest the board.
  const groups = best.groups.sort((a, b) => a[0] - b[0]);
  // The supplies together make a rectangle: each one as wide as its column's widest, and each column
  // as deep as the deepest, its extra depth shared among its supplies.
  const full = best.depth;
  return across(
    groups.map((g) => {
      const wide = Math.max(...g.map((b) => blocks[b].width));
      const used = g.reduce((sum, b) => sum + blocks[b].depth, 0) + ROW_GAP * (g.length - 1);
      const extra = (full - used) / g.length;
      return down(
        g.map((b) => makers[b](wide, blocks[b].depth + extra)),
        ROW_GAP,
      );
    }),
    COLUMN_GAP,
  );
}

function boardBlock(geometry: Geometry, size: number): Block {
  // A board with no extent (no cells yet, or all at one point) is drawn at the size of one unit.
  const span = Math.max(geometry.width, geometry.height);
  const scale = span > 0 && Number.isFinite(span) ? size / span : 1;
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

/** The fewest screen pixels per table unit chips' room is laid out for; a table drawn smaller shrinks its chips. */
export const MIN_PX = 5;

/** A table fitted to a screen: the arrangement chosen, the layout, and how much its HTML chips shrink. */
export interface FittedTable {
  arrangement: Arrangement;
  layout: TableLayout;
  /** Under 1 when the table is drawn smaller than chips were sized for (a phone). */
  chipScale: number;
}

/**
 * Lays the table out for a screen. The room mats leave for HTML chips depends on how large the
 * table is drawn, which depends on the layout: lay it out once, fit the camera to it, then lay it
 * out again at the scale that gives. The arrangements that suit the screen are tried (stacking the
 * rivals under the board on a tall one) and the one that draws the table larger kept; another must
 * win by 8% to replace `previous`, so the table does not jump between moves.
 */
export function fitTable(
  input: Omit<LayoutInput, "arrangement" | "pxPerUnit">,
  screen: { width: number; height: number; insets: Insets },
  previous: Arrangement = "sides",
): FittedTable {
  const { width, height, insets } = screen;
  // The supplies' column height that draws the table, and so its board, largest on this screen. The
  // board is a fixed size on the table, so the larger the table's scale, the larger the board.
  let supplyHeight = 1;
  let best = -1;
  for (const option of [1, 1.35, 1.75]) {
    const s = tableScale(layoutTable({ ...input, arrangement: previous === "stack" ? "stack" : "sides", supplyHeight: option }), width, height, insets);
    if (Number.isFinite(s) && s > best * 1.03) [best, supplyHeight] = [s, option];
  }
  input = { ...input, supplyHeight };
  const scaleOf = (arrangement: Arrangement) => tableScale(layoutTable({ ...input, arrangement }), width, height, insets);
  const tall = height > width * 1.15;
  const offered: Arrangement[] = ["sides", ...(tall ? (["stack"] as const) : [])];
  let arrangement = offered.includes(previous) ? previous : offered[0];
  let scale = scaleOf(arrangement);
  for (const other of offered) {
    if (other === arrangement) continue;
    const otherScale = scaleOf(other);
    if (otherScale > scale * 1.08) [arrangement, scale] = [other, otherScale];
  }
  // Laid out for its chips the table may grow and be drawn smaller: check once more and size the
  // chips' room for whichever scale is smaller. A screen with no size yet gives no scale: about 7.
  const clamp = (px: number) => (Number.isFinite(px) ? Math.min(24, Math.max(MIN_PX, px)) : 7);
  const first = layoutTable({ ...input, arrangement, pxPerUnit: clamp(scale) });
  const drawn = tableScale(first, width, height, insets);
  // Rows of chips wrapped under a header take the depth they cover where they stand, measured on
  // the camera that frames the first layout (chips drawn smaller take fewer pixels).
  const wrapped = new Map(first.badges.filter((b) => b.wrap).map((b) => [b.id, b.position]));
  const shrink = Number.isFinite(drawn) ? Math.min(1, Math.max(0.4, drawn / MIN_PX)) : 1;
  const project = wrapped.size > 0 && Number.isFinite(drawn) ? screenProjector(first, width, height, insets) : undefined;
  const chipRoom = project
    ? (id: string, pixels: number) => {
        const start = wrapped.get(id);
        return start && depthBelow(project, start, pixels * shrink);
      }
    : undefined;
  const layout =
    drawn < scale * 0.97 || chipRoom ? layoutTable({ ...input, arrangement, pxPerUnit: clamp(drawn < scale * 0.97 ? drawn * 0.97 : scale), chipRoom }) : first;
  const final = layout === first ? drawn : tableScale(layout, width, height, insets);
  return { arrangement, layout, chipScale: Number.isFinite(final) ? Math.min(1, Math.max(0.4, final / MIN_PX)) : 1 };
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
  const px = input.pxPerUnit;
  const sizes = chipSizes(px !== undefined && Number.isFinite(px) && px > 0 ? px : PX_PER_UNIT);
  const rivalMat = (p: Panel) => seatColumnBlock(p, input, sizes);
  const half = Math.ceil(rivals.length / 2);
  const leftSide = rivals.slice(0, half).reverse().map(rivalMat);
  const rightSide = rivals.slice(half).map(rivalMat);

  // The middle: the board with the shared supply upright beside it or, with no board, the shared
  // mats in a row.
  let middle: Block | undefined;
  let center: Block;
  let table: Block;
  if (geometry) {
    const board = boardBlock(geometry, panels.length > 0 ? BOARD : BOARD_ALONE);
    const supply = columns(
      shared.map((p) => (minWidth: number, minDepth: number) => supplyBlock(p, input, sizes, minWidth, minDepth)),
      Math.max(board.depth, 40) * (input.supplyHeight ?? 1),
    );
    middle = supply ? across([board, supply], 3) : board;
  } else if (shared.length > 0) {
    middle = across(
      shared.map((p) => matBlock(p, input, { cardScale: 1, pileScale: 1, title: p.title, you: false, sizes })),
      3,
    );
  }
  const you = mine ? matBlock(mine, input, { cardScale: 0.82, pileScale: 1, width: Math.max(56, middle?.width ?? 0), title: "You", you: true, sizes }) : undefined;
  if (input.arrangement === "stack") {
    // Rivals in a row under the middle, the viewer's mat below them.
    const row = rivals.length > 0 ? across([...leftSide.reverse(), ...rightSide], SIDE_GAP) : undefined;
    center = down(
      [middle, row, you].filter((b): b is Block => b !== undefined),
      ROW_GAP,
    );
    table = center;
    table.place(0, table.depth / 2, out);
    return finish(out, hand, table.depth / 2 + center.depth / 2 + ROW_GAP, input.targets);
  }
  center = down(
    [middle, you].filter((b): b is Block => b !== undefined),
    ROW_GAP,
  );
  table = across(
    [leftSide.length > 0 ? down(leftSide, 2) : undefined, center, rightSide.length > 0 ? down(rightSide, 2) : undefined].filter(
      (b): b is Block => b !== undefined,
    ),
    SIDE_GAP,
  );
  table.place(0, table.depth / 2, out);
  // The viewer's hand is held up in front of the middle.
  return finish(out, hand, table.depth / 2 + center.depth / 2 + ROW_GAP, input.targets);
}

/** Holds the viewer's hand up in front of the table from depth `z`, then outlines everything placed. */
function finish(out: TableLayout, hand: Panel | undefined, z: number, targets: Set<string>): TableLayout {
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
        target: targets.has(card.id),
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
