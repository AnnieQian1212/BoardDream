import { createRng, type GameModule } from "@boarddream/engine";
import { botMove } from "@boarddream/library";
import { workerAdvisor } from "../botWorker";
import { Lightbulb } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export type HintState = { move: unknown; text: string } | "thinking" | undefined;

/**
 * Asks the game's own bot (or, for generated games, the planner) what it would play in the
 * human's seat. The bot sees only what the human may see. The answer lasts until the state changes.
 */
export function useHint(game: GameModule, state: unknown, human: number) {
  const [hint, setHint] = useState<HintState>();
  // Each question and each new state counts up, so an answer to an older one is dropped.
  const asked = useRef(0);
  useEffect(() => {
    asked.current++;
    setHint(undefined);
  }, [state]);
  const ask = () => {
    const question = ++asked.current;
    setHint("thinking");
    // The planner's playouts run in the bot worker; here only if it fails.
    const rng = createRng(Date.now() >>> 0);
    const moves = game.legalMoves(state, human);
    void workerAdvisor(game, state, human, rng)(moves)
      .then((index) => moves[index])
      .catch(() => undefined)
      .then((found) => {
        const move = found ?? botMove(game, state, human, rng, moves);
        if (question === asked.current) setHint({ move, text: game.describeMove?.(state, move, human) ?? JSON.stringify(move) });
      });
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
