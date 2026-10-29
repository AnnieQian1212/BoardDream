import { createRng, type GameModule } from "@boarddream/engine";
import { tableBot } from "@boarddream/library";
import { Lightbulb } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Asks the game's own bot (or, for generated games, the planner) what it would play in the
 * human's seat, and offers to play it. The bot sees only what the human may see.
 */
export function Hint({ game, state, human, onMove }: { game: GameModule; state: unknown; human: number; onMove(move: unknown): void }) {
  const [hint, setHint] = useState<{ move: unknown; text: string } | "thinking">();
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
    <button type="button" className="ghost hint-button" onClick={ask} disabled={hint === "thinking"}>
      <Lightbulb size={15} /> {hint === "thinking" ? "Thinking…" : "Hint"}
    </button>
  );
}
