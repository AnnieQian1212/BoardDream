import type { ResourceSpec } from "@boarddream/engine";
import { useFrame, useThree } from "@react-three/fiber";
import { Star } from "lucide-react";
import { useMemo, type RefObject } from "react";
import { Vector3 } from "three";
import { iconFor } from "../icons";
import { CARD_H, CARD_W, type TableLayout, type Vec3 } from "./layout";

/**
 * Live numbers on the table (scores, resource counts, deck size) are HTML, pinned to 3D points.
 * They all live in one layer that `LabelTracker` repositions every frame, which keeps the text
 * crisp and avoids a React root per label.
 */

const SCORE = /score|points|vp/i;

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

interface LabelsProps {
  layout: TableLayout;
  resources: Map<string, ResourceSpec>;
  layer: RefObject<HTMLDivElement | null>;
  /** Ids legal moves act on; a targeted counter chip becomes a button. */
  targets: Set<string>;
  /** Table talk to show at a seat's mat. */
  speech?: { id: number; seat: number; text: string };
  onPick(id: string, x: number, y: number): void;
}

export function Labels({ layout, resources, layer, targets, speech, onPick }: LabelsProps) {
  const speaker = speech && layout.badges.find((b) => b.seat === speech.seat);
  return (
    <div className="labels" ref={layer}>
      {speech && speaker && (
        <div key={`speech-${speech.id}`} className="label" data-anchor={`badge:${speaker.id}`}>
          <div className="speech above">{speech.text}</div>
        </div>
      )}
      {layout.badges.map((badge) => {
        const score = badge.counters.find((c) => SCORE.test(c.label));
        const rest = badge.counters.filter((c) => c !== score);
        return (
          <div key={badge.id} className="label" data-anchor={`badge:${badge.id}`} data-room={`room:${badge.id}`}>
            <div className="mat-badge">
              {badge.active && <span className="turn-pill">{badge.you ? "Your turn" : "Thinking…"}</span>}
              {badge.note && (
                <span className="badge-note" title={badge.note}>
                  <span>{badge.note}</span>
                </span>
              )}
              {rest.map((c) =>
                targets.has(c.id) ? (
                  <button key={c.id} type="button" className="badge-chip target" onClick={(e) => onPick(c.id, e.clientX, e.clientY)}>
                    <small>{c.label}</small>
                    {c.value}
                  </button>
                ) : (
                  <span key={c.id} className="badge-chip">
                    <small>{c.label}</small>
                    {c.value}
                  </span>
                ),
              )}
              {score && (
                <span className="badge-chip score" title={score.label}>
                  <Star size={13} strokeWidth={0} fill="currentColor" />
                  {score.value}
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
            </button>
          </div>
        );
      })}
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
    for (const el of Array.from(root.children) as HTMLElement[]) {
      const anchor = anchors.get(el.dataset.anchor ?? "");
      if (!anchor) continue;
      v.fromArray(anchor).project(camera);
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.style.visibility = v.z < 1 ? "visible" : "hidden";
      const room = anchors.get(el.dataset.room ?? "");
      if (room) {
        v.fromArray(room).project(camera);
        const width = Math.round(x - ((v.x + 1) / 2) * size.width);
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
