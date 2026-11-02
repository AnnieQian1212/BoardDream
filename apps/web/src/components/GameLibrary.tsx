import type { GameModule } from "@boarddream/engine";
import { Info, Play, Star, Trash2, X } from "lucide-react";
import { useId, useState } from "react";
import { useEscape } from "../escape";
import { toggleFavorite, useFavorites } from "../favorites";
import { gameOrigin, generatedSource } from "../generated";
import { splitVersion } from "../names";
import { GameCover } from "./GameCover";

const MODES: Record<string, string> = { competitive: "Versus", cooperative: "Co-op", "hidden-role": "Hidden role" };
const FAMILIES: Record<string, string> = { engine: "Engine building", map: "Map and trade", grid: "Tiles and areas", bluff: "Bluffing", race: "Race" };

interface Props {
  games: GameModule[];
  /** Painted box covers by game id. */
  covers: Map<string, string>;
  /** The game on the table, if the table is open. */
  current?: GameModule;
  /** No other game can be opened while one is being made. */
  busy: boolean;
  /**
   * Whether games can be made here. Without a server that makes them (the static demo), the
   * generated games are ones BoardDream made earlier and shipped with the page, not the visitor's.
   */
  canMake: boolean;
  onPlay(game: GameModule): void;
  onDelete(game: GameModule): void;
  onClose(): void;
}

/**
 * Every game on offer on one page: the original demo games, then the games generated here, newest
 * first, each with its box cover, a button to play it and, for a generated game, one to delete it.
 */
export function GameLibrary({ games, covers, current, busy, canMake, onPlay, onDelete, onClose }: Props) {
  useEscape(onClose);
  const favorites = useFavorites();
  const demos = games.filter((g) => !generatedSource(g));
  const made = games
    .filter((g) => generatedSource(g))
    .map((g, i) => ({ g, i, at: gameOrigin(g)?.createdAt ?? "" }))
    .sort((a, b) => b.at.localeCompare(a.at) || b.i - a.i)
    .map(({ g }) => g);
  const card = (g: GameModule) => (
    <GameCard
      key={g.meta.id}
      game={g}
      cover={covers.get(g.meta.id)}
      playing={g === current}
      busy={busy}
      onPlay={() => onPlay(g)}
      onDelete={canMake && generatedSource(g) ? () => onDelete(g) : undefined}
      favorite={generatedSource(g) ? favorites.has(g.meta.id) : undefined}
    />
  );
  // Starred games get their own group at the top of the generated ones.
  const starred = made.filter((g) => favorites.has(g.meta.id));
  const rest = made.filter((g) => !favorites.has(g.meta.id));
  return (
    <div className="library" role="dialog" aria-label="Games">
      <div className="library-sheet">
        <header className="results-head">
          <h1>Games</h1>
          <button type="button" className="ghost" onClick={onClose} aria-label="Close the game list">
            <X size={16} /> Close
          </button>
        </header>
        <section>
          <GroupHeading title="Demo games" tip="Original games we designed by hand." />
          <div className="library-grid">{demos.map(card)}</div>
        </section>
        {starred.length > 0 && (
          <section>
            <GroupHeading title="Favorites" count={starred.length} tip="Generated games you starred, kept in this browser." />
            <div className="library-grid">{starred.map(card)}</div>
          </section>
        )}
        <section>
          <GroupHeading
            title={canMake ? "Your generated games" : "Made by BoardDream"}
            count={rest.length}
            tip={
              canMake
                ? "Games you dreamed up here."
                : "Games BoardDream made from a one-line idea."
            }
          />
          {rest.length > 0 ? (
            <div className="library-grid">{rest.map(card)}</div>
          ) : made.length > 0 ? (
            <p className="hint">Every game here is in your favorites.</p>
          ) : (
            <p className="hint">{canMake ? "Games you dream up on the home page appear here." : "Games made with the full server appear here."}</p>
          )}
        </section>
      </div>
    </div>
  );
}

/** A group's name, which explains the group in a tip on hover or focus. */
function GroupHeading({ title, count, tip }: { title: string; count?: number; tip: string }) {
  const id = useId();
  return (
    <h2 className="library-group">
      <span className="library-group-name" tabIndex={0} aria-describedby={id}>
        {title}
        <Info size={15} aria-hidden />
        <span className="library-tip" role="tooltip" id={id}>
          {tip}
        </span>
      </span>
      {count !== undefined && <span className="library-count">{count}</span>}
    </h2>
  );
}

function GameCard(props: { game: GameModule; cover?: string; playing: boolean; busy: boolean; onPlay(): void; onDelete?(): void; favorite?: boolean }) {
  const { game, cover, playing, busy, onPlay, onDelete, favorite } = props;
  const [asking, setAsking] = useState(false);
  const { meta } = game;
  const { name, version } = splitVersion(meta.name);
  const origin = gameOrigin(game);
  const players = meta.minPlayers === meta.maxPlayers ? `${meta.minPlayers} players` : `${meta.minPlayers}–${meta.maxPlayers} players`;
  const made = origin?.createdAt ? new Date(origin.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : undefined;
  return (
    <article className={["game-card", playing && "playing"].filter(Boolean).join(" ")}>
      <GameCover game={game} cover={cover} />
      <div className="game-card-body">
        <h3>{name}</h3>
        <div className="game-chips">
          <span>{players}</span>
          <span>{MODES[meta.mode] ?? meta.mode}</span>
          <span>{FAMILIES[meta.family] ?? meta.family}</span>
          {version && <span className="game-chip-version">{version}</span>}
        </div>
        <p className="game-card-summary">{meta.summary}</p>
        {origin?.idea && (
          <p className="game-card-idea" title={origin.idea}>
            {made ? `${made}: ` : ""}“{origin.idea}”
          </p>
        )}
      </div>
      <footer className="game-card-foot">
        {playing ? (
          <span className="game-card-playing">On the table</span>
        ) : (
          <button type="button" className="action" onClick={onPlay} disabled={busy} title={busy ? "Wait until the game being made is ready" : undefined}>
            <Play size={15} /> Play
          </button>
        )}
        {favorite !== undefined && <FavoriteButton id={meta.id} name={meta.name} on={favorite} />}
        {onDelete && (
          <button type="button" className="ghost icon-only" onClick={() => setAsking(true)} title="Delete this game" aria-label={`Delete ${meta.name}`} disabled={busy}>
            <Trash2 size={15} />
          </button>
        )}
      </footer>
      {asking && onDelete && (
        <div className="game-card-ask" role="alertdialog" aria-label={`Delete ${meta.name}?`}>
          <p>
            Delete <strong>{meta.name}</strong>?
          </p>
          <div>
            <button type="button" className="ghost danger" onClick={onDelete}>
              Delete
            </button>
            <button type="button" className="ghost" onClick={() => setAsking(false)}>
              Keep
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

/** A star that keeps a generated game in Favorites (this browser). */
export function FavoriteButton({ id, name, on }: { id: string; name: string; on: boolean }) {
  return (
    <button
      type="button"
      className={["ghost icon-only favorite", on && "on"].filter(Boolean).join(" ")}
      onClick={() => toggleFavorite(id)}
      aria-pressed={on}
      aria-label={on ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
      title={on ? "In your favorites" : "Add to favorites"}
    >
      <Star size={15} fill={on ? "currentColor" : "none"} />
    </button>
  );
}
