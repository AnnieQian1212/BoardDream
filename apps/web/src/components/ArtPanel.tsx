import { Brush, Map as MapIcon, Palette, ScanSearch } from "lucide-react";
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
        <div className="progress indeterminate">
          <div className="progress-bar" />
          <span>{step}</span>
        </div>
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
