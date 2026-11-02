import { createRng, type GameModule } from "@boarddream/engine";
import { tableBot } from "@boarddream/library";
import { Lightbulb } from "lucide-react";
import { useEffect, useState } from "react";

export type HintState = { move: unknown; text: string } | "thinking" | undefined;

/**
 * Asks the game's own bot (or, for generated games, the planner) what it would play in the
 * human's seat. The bot sees only what the human may see. The answer lasts until the state changes.
 */
export function useHint(game: GameModule, state: unknown, human: number) {
  const [hint, setHint] = useState<HintState>();
  useEffect(() => setHint(undefined), [state]);
  const ask = () => {
    setHint("thinking");
    // Let the button repaint before the planner's playouts take the thread.
    setTimeout(() => {
      const moves = game.legalMoves(state, human);
      const view = game.view ? game.view(state, human) : state;
      const move = tableBot(game)({ game, state: view, player: human, moves, rng: createRng(Date.now() >>> 0) });
      setHint({ move, text: game.describeMove?.(state, move, human) ?? JSON.stringify(move) });
    }, 20);
  };
  return { hint, ask };
}

/** The Hint button, then the hint and a button to play it; the table marks where it acts. */
export function Hint({ hint, onAsk, onMove }: { hint: HintState; onAsk(): void; onMove(move: unknown): void }) {
  if (hint && hint !== "thinking") {
    return (
      <>
        <span className="hint-text">
          <Lightbulb size={14} /> Try: {hint.text}
        </span>
        <button type="button" className="action" onClick={() => onMove(hint.move)}>
          Play it
        </button>
      </>
    );
  }
  return (
    <button type="button" className="quiet hint-button" onClick={onAsk} disabled={hint === "thinking"}>
      <Lightbulb size={15} /> {hint === "thinking" ? "Thinking…" : "Hint"}
    </button>
  );
}
