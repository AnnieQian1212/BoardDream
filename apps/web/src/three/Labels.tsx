import { scoreOf, type ResourceSpec } from "@boarddream/engine";
import { useFrame, useThree } from "@react-three/fiber";
import { Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Vector3 } from "three";
import { iconFor } from "../icons";
import { CARD_H, CARD_W, type TableLayout, type Vec3 } from "./layout";
import type { TargetKind } from "../instructions";
import { SPOT_TOP, TILE_TOP } from "./Board3D";

/**
 * Live numbers on the table (scores, resource counts, deck size) are HTML, pinned to 3D points.
 * They all live in one layer that `LabelTracker` repositions every frame, which keeps the text
 * crisp and avoids a React root per label.
 */


/** Stacks stop growing at 24 cards: taller ones hide the title of their mat in perspective. */
export const deckHeight = (count: number) => Math.max(0.05, Math.min(count, 24) * 0.04);

/** Screen anchor of every label, keyed like the label elements' data-anchor. */
export function labelAnchors(layout: TableLayout): Map<string, Vec3> {
  const anchors = new Map<string, Vec3>();
  for (const b of layout.badges) {
    anchors.set(`badge:${b.id}`, b.position);
    anchors.set(`room:${b.id}`, b.left);
  }
  for (const p of layout.piles) {
    const [x, y, z] = p.position;
    anchors.set(`pile:${p.id}`, [x + 1.55 * p.scale, y + 0.2, z + 1.55 * p.scale]);
  }
  for (const d of layout.decks) {
    const [x, y, z] = d.position;
    anchors.set(`deck:${d.id}`, [x + (CARD_W / 2 - 0.5) * d.scale, y + deckHeight(d.count), z + (CARD_H / 2 - 0.5) * d.scale]);
  }
  return anchors;
}

/** A mark drawn over something that can be clicked: a pulsing ring, or the hint's "Try this". */
export interface TargetMark {
  id: string;
  kind: TargetKind;
  /** The hinted move acts on it. */
  hint: boolean;
  /** Pulses: a board spot, which has no glow of its own that reads at a glance. */
  ring: boolean;
}

/**
 * Where each mark sits: over a board cell's middle (with a second point a cell's radius away, so
 * the ring is as wide as the cell on screen), a card's middle or a pile's top.
 */
export function markAnchors(layout: TableLayout, marks: TargetMark[]): Map<string, Vec3> {
  const anchors = new Map<string, Vec3>();
  const board = layout.board;
  for (const mark of marks) {
    const cell = board?.geometry.cells.find((c) => c.id === mark.id);
    if (board && cell) {
      const k = board.scale;
      const cx = cell.polygon.reduce((sum, [x]) => sum + x, 0) / cell.polygon.length;
      const cy = cell.polygon.reduce((sum, [, y]) => sum + y, 0) / cell.polygon.length;
      const spot = cell.kind === "vertex" || cell.kind === "edge";
      const reach = Math.max(...cell.polygon.map(([x, y]) => Math.hypot(x - cx, y - cy))) * k * (spot ? 1.15 : 0.8);
      const at: Vec3 = [board.position[0] + (cx - board.geometry.width / 2) * k, board.position[1] + (spot ? SPOT_TOP : TILE_TOP), board.position[2] + (cy - board.geometry.height / 2) * k];
      anchors.set(`mark:${mark.id}`, at);
      anchors.set(`markspan:${mark.id}`, [at[0] + reach, at[1], at[2]]);
      continue;
    }
    const card = layout.cards.find((c) => c.id === mark.id);
    if (card) {
      anchors.set(`mark:${mark.id}`, card.position);
      anchors.set(`markspan:${mark.id}`, [card.position[0] + (CARD_W / 2) * card.scale, card.position[1], card.position[2]]);
      continue;
    }
    const pile = layout.piles.find((p) => p.id === mark.id) ?? layout.decks.find((d) => d.id === mark.id);
    if (pile) {
      anchors.set(`mark:${mark.id}`, [pile.position[0], pile.position[1] + 0.6, pile.position[2]]);
      anchors.set(`markspan:${mark.id}`, [pile.position[0] + 2.4 * pile.scale, pile.position[1] + 0.6, pile.position[2]]);
    }
  }
  return anchors;
}

/** A counter that just changed, shown as a number floating up off its chip. */
interface Delta {
  id: string;
  amount: number;
  key: number;
}

/** How long a change floats above its chip, in milliseconds (the chip-delta animation in styles.css). */
const DELTA_MS = 1600;

/**
 * The counters that changed with the last move, by how much: income paid, a cost spent, points
 * scored. They are compared with the counters the table showed before, so the first layout shows
 * none, and a new game starts a new table (App keys it by match).
 */
function useDeltas(layout: TableLayout): Map<string, Delta[]> {
  const values = useMemo(() => {
    const out = new Map<string, number>();
    for (const badge of layout.badges) for (const counter of badge.counters) out.set(counter.id, counter.value);
    for (const pile of layout.piles) out.set(pile.id, pile.counter.value);
    return out;
  }, [layout]);
  const before = useRef<Map<string, number>>(undefined);
  const next = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [deltas, setDeltas] = useState<Delta[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    const old = before.current;
    before.current = values;
    if (!old) return;
    const fresh: Delta[] = [];
    for (const [id, value] of values) {
      const was = old.get(id);
      if (was !== undefined && was !== value) fresh.push({ id, amount: value - was, key: ++next.current });
    }
    if (fresh.length === 0) return;
    setDeltas((current) => [...current, ...fresh]);
    timers.current.push(setTimeout(() => setDeltas((current) => current.filter((d) => !fresh.includes(d))), DELTA_MS));
  }, [values]);
  return useMemo(() => {
    const byId = new Map<string, Delta[]>();
    for (const d of deltas) byId.set(d.id, [...(byId.get(d.id) ?? []), d]);
    return byId;
  }, [deltas]);
}

function Floats({ deltas }: { deltas?: Delta[] }) {
  return deltas?.map((d) => (
    <span key={d.key} className={d.amount > 0 ? "chip-delta up" : "chip-delta down"} aria-hidden>
      {d.amount > 0 ? `+${d.amount}` : `−${-d.amount}`}
    </span>
  ));
}

interface LabelsProps {
  layout: TableLayout;
  /** Rings over glowing board cells, and the hinted target. */
  marks?: TargetMark[];
  resources: Map<string, ResourceSpec>;
  layer: RefObject<HTMLDivElement | null>;
  /** Ids legal moves act on; a targeted counter chip becomes a button. */
  targets: Set<string>;
  /** Table talk to show at a seat's mat. */
  speech?: { id: number; seat: number; text: string };
  /** Under 1 when the table is drawn smaller than the chips were sized for (a phone). */
  chipScale?: number;
  onPick(id: string, x: number, y: number): void;
}

export function Labels({ layout, marks = [], resources, layer, targets, speech, chipScale = 1, onPick }: LabelsProps) {
  const speaker = speech && layout.badges.find((b) => b.seat === speech.seat);
  const hinted = marks.find((m) => m.hint);
  const deltas = useDeltas(layout);
  return (
    <div className="labels" ref={layer} style={{ "--chip-scale": chipScale } as CSSProperties}>
      {marks
        .filter((mark) => mark.ring || mark.hint)
        .map((mark) => (
          <div key={`mark:${mark.id}`} className="label mark" data-anchor={`mark:${mark.id}`} data-span={`markspan:${mark.id}`}>
            <span className={mark.hint ? "target-ring hint" : "target-ring"} />
          </div>
        ))}
      {speech && speaker && (
        <div key={`speech-${speech.id}`} className="label" data-anchor={`badge:${speaker.id}`}>
          <div className="speech above">{speech.text}</div>
        </div>
      )}
      {layout.badges.map((badge) => {
        const score = scoreOf(badge.counters);
        const rest = badge.counters.filter((c) => c !== score);
        return (
          <div key={badge.id} className="label" data-anchor={`badge:${badge.id}`} data-room={`room:${badge.id}`}>
            <div className={badge.wrap ? "mat-badge wrap" : "mat-badge"}>
              {badge.active && <span className="turn-pill">{badge.you ? "Your turn" : "Thinking…"}</span>}
              {badge.note && (
                <span className="badge-note" title={badge.note}>
                  <span>{badge.note}</span>
                </span>
              )}
              {rest.map((c) =>
                targets.has(c.id) ? (
                  <button key={c.id} type="button" className={hinted?.id === c.id ? "badge-chip target hinted" : "badge-chip target"} onClick={(e) => onPick(c.id, e.clientX, e.clientY)}>
                    <small>{c.label}</small>
                    {c.value}
                    <Floats deltas={deltas.get(c.id)} />
                  </button>
                ) : (
                  <span key={c.id} className="badge-chip">
                    <small>{c.label}</small>
                    {c.value}
                    <Floats deltas={deltas.get(c.id)} />
                  </span>
                ),
              )}
              {score && (
                <span className="badge-chip score" title={score.label}>
                  <Star size={13} strokeWidth={0} fill="currentColor" />
                  {score.value}
                  <Floats deltas={deltas.get(score.id)} />
                </span>
              )}
            </div>
          </div>
        );
      })}
      {layout.piles.map((pile) => {
        const resource = pile.resource ?? resources.get(pile.counter.resource ?? "");
        const Icon = iconFor(resource?.icon);
        return (
          <div key={pile.id} className="label" data-anchor={`pile:${pile.id}`}>
            <button
              type="button"
              className={["pile-count", pile.target && "target"].filter(Boolean).join(" ")}
              style={{ background: resource?.color ?? "#7d8a84" }}
              title={`${pile.counter.label}: ${pile.counter.value}`}
              disabled={!pile.target}
              onClick={(e) => onPick(pile.id, e.clientX, e.clientY)}
            >
              <Icon size={11} strokeWidth={2.6} />
              {pile.counter.value}
              <Floats deltas={deltas.get(pile.id)} />
            </button>
          </div>
        );
      })}
      {hinted && hinted.kind !== "counter" && (
        <div key={`flag:${hinted.id}`} className="label mark" data-anchor={`mark:${hinted.id}`} data-span={`markspan:${hinted.id}`}>
          <span className="hint-flag">Try this</span>
        </div>
      )}
      {layout.decks.map((deck) => (
        <div key={deck.id} className="label" data-anchor={`deck:${deck.id}`}>
          <span className="tag-count" title={deck.label}>
            {deck.count}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Below this many pixels a note would show a letter or two, so it is left out (it stays in the hover title and the flat table). */
const MIN_NOTE = 72;

/** Hides a badge row's note when the chips leave it too little of `room`. */
function fitNote(label: HTMLElement, room: number) {
  const row = label.firstElementChild;
  const note = row?.querySelector<HTMLElement>(".badge-note");
  if (!row || !note) return;
  // A wrapping row gives the note a line of its own.
  if (row.classList.contains("wrap")) return void (note.style.display = "");
  const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
  const used = Array.from(row.children).reduce((sum, child) => (child === note ? sum : sum + (child as HTMLElement).offsetWidth + gap), 0);
  note.style.display = room - used < MIN_NOTE ? "none" : "";
}

/**
 * Inside the canvas: projects each label's anchor and moves its element there. A label with a
 * `data-room` anchor also learns how wide it may get (--room), from its anchor back to that one.
 */
export function LabelTracker({ anchors, layer }: { anchors: Map<string, Vec3>; layer: RefObject<HTMLDivElement | null> }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const v = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const root = layer.current;
    if (!root) return;
    // Chips drawn smaller (--chip-scale) measure their room in their own, unshrunk pixels.
    const zoom = parseFloat(root.style.getPropertyValue("--chip-scale")) || 1;
    for (const el of Array.from(root.children) as HTMLElement[]) {
      const anchor = anchors.get(el.dataset.anchor ?? "");
      if (!anchor) continue;
      v.fromArray(anchor).project(camera);
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.visibility = v.z < 1 ? "visible" : "hidden";
      // A mark is as wide on screen as what it marks: its span anchor is that far off to the side.
      const span = anchors.get(el.dataset.span ?? "");
      if (span) {
        v.fromArray(span).project(camera);
        const px = Math.round(Math.hypot(((v.x + 1) / 2) * size.width - x, ((1 - v.y) / 2) * size.height - y));
        if (el.dataset.spanned !== String(px)) {
          el.dataset.spanned = String(px);
          el.style.setProperty("--span", `${px}px`);
        }
      }
      const room = anchors.get(el.dataset.room ?? "");
      if (room) {
        v.fromArray(room).project(camera);
        const width = Math.round((x - ((v.x + 1) / 2) * size.width) / zoom);
        const key = `${width}|${el.textContent}`;
        if (el.dataset.fitted !== key) {
          el.dataset.fitted = key;
          el.style.setProperty("--room", `${width}px`);
          fitNote(el, width);
        }
      }
    }
  });
  return null;
}
