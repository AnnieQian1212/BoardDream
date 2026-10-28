import { Brush, Palette } from "lucide-react";

interface Props {
  /** Distinct cards the game shows. */
  cards: number;
  painted: number;
  painting: { done: number; total: number } | null;
  /** The server has a model API key. */
  available: boolean;
  onPaint(): void;
}

/** Muse Image card art: how much is painted and a button to paint the rest. */
export function ArtPanel({ cards, painted, painting, available, onPaint }: Props) {
  const missing = Math.max(0, cards - painted);
  return (
    <section className="panel">
      <h2>
        <Palette size={17} /> Card art
      </h2>
      <p className="hint">Muse Image paints every card in one shared style, using the first card as the style reference.</p>
      {painting ? (
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
