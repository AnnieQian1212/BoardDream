import type { GameModule } from "@boarddream/engine";
import { ArrowRight, BarChart3, LayoutGrid, Loader2, Play } from "lucide-react";
import { gameOrigin, generatedSource } from "../generated";
import { splitVersion } from "../names";
import type { Dials } from "../generation";
import { BrandMark } from "./BrandMark";
import { DreamForm } from "./DreamForm";
import { GameCover } from "./GameCover";

const MODES: Record<string, string> = { competitive: "Versus", cooperative: "Co-op", "hidden-role": "Hidden role" };
/** Generated games shown beside the hand-made ones; the rest are a click away in Games. */
const RECENT = 3;

interface Props {
  games: GameModule[];
  covers: Map<string, string>;
  /** A server can make new games (not the static demo). */
  available: boolean;
  /** A game is being made: its title once the designer has named it. */
  making?: { title?: string };
  onGenerate(prompt: string, dials: Dials, invented: boolean): void;
  onPlay(game: GameModule): void;
  /** Back to the game being made. */
  onWatch(): void;
  onLibrary(): void;
  onResults(): void;
}

/**
 * The first page: one question, what to play, with a box to answer it in; below it, ready games to
 * deal into straight away. Everything about how games are tested lives behind the scenes.
 */
export function Home({ games, covers, available, making, onGenerate, onPlay, onWatch, onLibrary, onResults }: Props) {
  const demos = games.filter((g) => !generatedSource(g));
  const recent = games
    .filter((g) => generatedSource(g))
    .map((g, i) => ({ g, i, at: gameOrigin(g)?.createdAt ?? "" }))
    .sort((a, b) => b.at.localeCompare(a.at) || b.i - a.i)
    .slice(0, RECENT)
    .map(({ g }) => g);
  const shelf = [...demos, ...recent];
  return (
    <div className="home">
      <header className="home-bar">
        <div className="brand">
          <BrandMark />
          BoardDream
        </div>
        <nav>
          <button type="button" className="quiet" onClick={onLibrary} aria-label="Games">
            <LayoutGrid size={16} /> <span className="btn-label">Games</span>
          </button>
          <button type="button" className="quiet" onClick={onResults} title="How every game is tested, and the benchmarks behind it" aria-label="Behind the scenes">
            <BarChart3 size={16} /> <span className="btn-label">Behind the scenes</span>
          </button>
        </nav>
      </header>

      <main className="home-main">
        <section className="home-hero">
          <h1>What do you want to play tonight?</h1>
          <p className="home-lede">Describe a board game in a sentence. BoardDream designs it, playtests it a thousand times and deals you in.</p>
          {making ? (
            <div className="home-making" role="status">
              <Loader2 size={18} className="spin" />
              <span>
                Making <strong>{making.title ?? "your game"}</strong>…
              </span>
              <button type="button" className="action" onClick={onWatch}>
                Watch it take shape <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <DreamForm available={available} busy={false} onGenerate={onGenerate} />
          )}
          {!available && <p className="home-note">This online demo plays games BoardDream made earlier. Making new ones needs the full server with a model key.</p>}
        </section>

        <section className="home-shelf" aria-label="Ready to play">
          <div className="home-shelf-head">
            <h2>Or deal yourself in</h2>
            <button type="button" className="quiet" onClick={onLibrary}>
              All {games.length} games <ArrowRight size={15} />
            </button>
          </div>
          <div className="home-games">
            {shelf.map((game) => (
              <button key={game.meta.id} type="button" className="home-game" onClick={() => onPlay(game)} disabled={Boolean(making)}>
                <GameCover game={game} cover={covers.get(game.meta.id)} />
                <span className="home-game-body">
                  <strong>{splitVersion(game.meta.name).name}</strong>
                  <span>
                    {game.meta.minPlayers === game.meta.maxPlayers ? game.meta.minPlayers : `${game.meta.minPlayers}–${game.meta.maxPlayers}`} players ·{" "}
                    {MODES[game.meta.mode] ?? game.meta.mode}
                  </span>
                </span>
                <span className="home-game-play" aria-hidden>
                  <Play size={14} /> Play
                </span>
              </button>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
