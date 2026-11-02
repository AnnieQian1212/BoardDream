import type { GameModule } from "@boarddream/engine";
import { BarChart3, BookOpen, Check, LayoutGrid, MoreHorizontal, Printer, RotateCcw, ScrollText, SlidersHorizontal, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useEscape } from "../escape";
import { splitVersion } from "../names";
import { BrandMark } from "./BrandMark";

interface Props {
  game: GameModule;
  /** A game is being made: the table belongs to it, so the game's own buttons step back. */
  making: boolean;
  designerOpen: boolean;
  /** The opponents' model, when the server has one. */
  opponentModel?: string;
  muse: boolean;
  onHome(): void;
  onLibrary(): void;
  onRules(): void;
  onDesigner(): void;
  onRestart(): void;
  onMuse(on: boolean): void;
  onPrint(): void;
  onLog(): void;
  onResults(): void;
}

/**
 * The table's bar: the brand (back home), the game's name, and few buttons. One is the main
 * action (New game, to dream up another); the rest are quiet, and the occasional ones sit in a
 * menu.
 */
export function TopBar(props: Props) {
  const { game, making, designerOpen } = props;
  return (
    <header className="topbar">
      <button type="button" className="brand brand-home" onClick={props.onHome} title="Home: dream up a new game">
        <BrandMark />
        <span>BoardDream</span>
      </button>
      {!making && (
        <h1 className="table-title" title={game.meta.summary}>
          {splitVersion(game.meta.name).name}
          {splitVersion(game.meta.name).version && <small>{splitVersion(game.meta.name).version}</small>}
        </h1>
      )}
      <span className="topbar-gap" />
      {!making && (
        <>
          <button type="button" className="quiet" onClick={props.onLibrary} title="Every game: the demo games and the ones made here" aria-label="Games">
            <LayoutGrid size={16} /> <span className="btn-label">Games</span>
          </button>
          <button type="button" className="quiet" onClick={props.onRules} title="How to play this game" aria-label="Rules">
            <BookOpen size={16} /> <span className="btn-label">Rules</span>
          </button>
          <button
            type="button"
            className={["quiet", designerOpen && "on"].filter(Boolean).join(" ")}
            onClick={props.onDesigner}
            aria-pressed={designerOpen}
            aria-label="Designer"
            title="Tune the rules, see the balance and the art (F)"
          >
            <SlidersHorizontal size={16} /> <span className="btn-label">Designer</span>
          </button>
          <MoreMenu {...props} />
        </>
      )}
      <button type="button" className="action topbar-new" onClick={props.onHome} disabled={making} title="Dream up a new game" aria-label="New game">
        <Wand2 size={16} /> <span className="btn-label">New game</span>
      </button>
    </header>
  );
}

function MoreMenu({ opponentModel, muse, onRestart, onMuse, onPrint, onLog, onResults }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEscape(() => setOpen(false), open);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", away);
    return () => window.removeEventListener("pointerdown", away);
  }, [open]);
  const item = (icon: ReactNode, label: string, run: () => void, extra?: { title?: string; disabled?: boolean; checked?: boolean }) => (
    <button
      type="button"
      role={extra?.checked === undefined ? "menuitem" : "menuitemcheckbox"}
      aria-checked={extra?.checked}
      disabled={extra?.disabled}
      title={extra?.title}
      onClick={() => {
        run();
        setOpen(false);
      }}
    >
      {icon}
      <span>{label}</span>
      {extra?.checked && <Check size={15} className="menu-check" />}
    </button>
  );
  return (
    <div className="more" ref={root}>
      <button type="button" className={["quiet", "icon-only", open && "on"].filter(Boolean).join(" ")} onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} aria-label="More">
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="menu" role="menu">
          {item(<RotateCcw size={15} />, "Restart this game", onRestart)}
          {item(<Sparkles size={15} />, "Muse Spark opponents", () => onMuse(!muse), {
            checked: muse,
            disabled: !opponentModel,
            title: opponentModel ? `${opponentModel} plays the rivals' trades, bids and bluffs, and talks at the table` : "Needs a model API key on the server",
          })}
          {item(<ScrollText size={15} />, "Game log", onLog)}
          {item(<Printer size={15} />, "Print and play", onPrint, { title: "Rules, board and cards on A4, to play on a real table" })}
          <hr />
          {item(<BarChart3 size={15} />, "Behind the scenes", onResults, { title: "How every game is tested, and the benchmarks" })}
        </div>
      )}
    </div>
  );
}
