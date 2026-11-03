import { Brush, Map as MapIcon, Palette, ScanSearch } from "lucide-react";
import { useEffect, useState } from "react";
import type { BoardReport } from "../art";

interface Props {
  /** Distinct cards the game shows. */
  cards: number;
  painted: number;
  painting: { done: number; total: number } | null;
  /** The server has a model API key. */
  available: boolean;
  onPaint(): void;
  /** Board art: present when the game has a board. */
  board?: { report?: BoardReport; step: string | null; onPaint(): void };
}

/** Muse Image art in two parts: the board (painted over its layout, checked by SAM 3.1) and the cards. */
export function ArtPanel({ cards, painted, painting, available, onPaint, board }: Props) {
  const missing = Math.max(0, cards - painted);
  return (
    <section className="panel">
      <h2>
        <Palette size={17} /> Art
      </h2>
      {board && (
        <>
          <h3 className="art-part">
            <MapIcon size={15} /> Board
          </h3>
          <BoardArt {...board} available={available} />
        </>
      )}
      {cards > 0 && (
        <h3 className="art-part">
          <Brush size={15} /> Cards
        </h3>
      )}
      {cards === 0 ? null : painting ? (
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={painting.total} aria-valuenow={painting.done}>
          <div className="progress-bar" style={{ width: `${(100 * painting.done) / Math.max(1, painting.total)}%` }} />
          <span>
            Painting {painting.done} of {painting.total}…
          </span>
        </div>
      ) : (
        <>
          <p className="hint status-line">
            {painted === 0 ? `${cards} cards to paint` : missing === 0 ? `All ${cards} cards painted` : `${painted} of ${cards} cards painted`}
          </p>
          {missing > 0 && (
            <button type="button" className="action wide" disabled={!available} onClick={onPaint} title={available ? undefined : "Set MODEL_API_KEY on the server"}>
              <Brush size={16} /> {painted === 0 ? "Paint the cards" : "Paint the rest"}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function BoardArt({ report, step, onPaint, available }: { report?: BoardReport; step: string | null; onPaint(): void; available: boolean }) {
  return (
    <>
      <p className="hint">Muse Image paints the board over its tile layout; SAM 3.1 then checks every tile against where it should be.</p>
      {step ? (
        <BoardProgress key={stageOf(step).from} step={step} />
      ) : (
        <>
          {report && (
            <p className="hint status-line align-report">
              <ScanSearch size={14} />
              {Math.round(report.alignedShare * report.tiles)} of {report.tiles} tiles aligned · mean IoU {report.meanIoU.toFixed(2)}
              {report.repainted ? ` (was ${report.firstMeanIoU.toFixed(2)} before a repaint)` : ""}
            </p>
          )}
          <button type="button" className="action wide secondary" disabled={!available} onClick={onPaint}>
            <MapIcon size={16} /> {report ? "Repaint the board" : "Paint the board"}
          </button>
        </>
      )}
    </>
  );
}

/**
 * The board's painting in stages, each with its share of the bar and about how long it takes
 * (measured on Waxbloom Valley: painting 20 s, checking 5 s, repainting 15 s). Within a stage the bar
 * runs toward the stage's end over that time, easing off, and the next stage takes it on from there.
 */
const STAGES: { match: RegExp; from: number; to: number; seconds: number }[] = [
  { match: /^Starting/, from: 0, to: 4, seconds: 2 },
  // A painting with most tiles off is painted afresh, in the repaint's place.
  { match: /^Painting the board again/, from: 64, to: 86, seconds: 24 },
  { match: /^Painting the board/, from: 4, to: 52, seconds: 24 },
  { match: /^Checking every tile/, from: 52, to: 64, seconds: 6 },
  { match: /^Repainting/, from: 64, to: 86, seconds: 16 },
  { match: /^Checking the (repaint|new painting)/, from: 86, to: 93, seconds: 6 },
  { match: /^Checking what every tile shows/, from: 93, to: 99, seconds: 5 },
];

export const stageOf = (step: string) => STAGES.find((s) => s.match.test(step)) ?? { match: /./, from: 0, to: 95, seconds: 40 };

function BoardProgress({ step }: { step: string }) {
  const stage = stageOf(step);
  const [running, setRunning] = useState(false);
  // Drawn at the stage's start first, then widened on the next frame, so the transition runs.
  useEffect(() => {
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setRunning(true)));
    return () => cancelAnimationFrame(frame);
  }, []);
  const width = running ? stage.to : stage.from;
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(width)} aria-label="Painting the board">
      <div className="progress-bar" style={{ width: `${width}%`, transition: running ? `width ${stage.seconds}s cubic-bezier(0.25, 0.6, 0.35, 1)` : "none" }} />
      <span>{step}</span>
    </div>
  );
}
