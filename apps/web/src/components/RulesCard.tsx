import type { GameModule } from "@boarddream/engine";
import { BookOpen } from "lucide-react";

/** How to play: the game's rules and how the table works. Opens the first time a game is played here. */
export function RulesCard({ game, onClose }: { game: GameModule; onClose(): void }) {
  const rules = game.meta.rules?.length ? game.meta.rules : [game.meta.summary];
  return (
    <div className="overlay rules-overlay" onClick={onClose}>
      <div className="rules-card" role="dialog" aria-label={`How to play ${game.meta.name}`} onClick={(e) => e.stopPropagation()}>
        <span className="rules-kicker">
          <BookOpen size={15} /> How to play
        </span>
        <h3>{game.meta.name}</h3>
        <p className="rules-summary">{game.meta.summary}</p>
        <ol className="rules-list">
          {rules.map((rule, i) => (
            <li key={i}>{rule}</li>
          ))}
        </ol>
        <h4>At the table</h4>
        <ul className="rules-controls">
          <li>Everything you can do glows: click a glowing card, space or counter. When it allows several moves, a menu opens.</li>
          <li>Moves that are not on the table, such as passing, are buttons at the bottom.</li>
          <li>Stuck? Hint asks the game's own bot what it would play.</li>
          <li>F hides the side panels, and Rules brings this card back.</li>
        </ul>
        <button type="button" className="action" onClick={onClose}>
          Start playing
        </button>
      </div>
    </div>
  );
}
