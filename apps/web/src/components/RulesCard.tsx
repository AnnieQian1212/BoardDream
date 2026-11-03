import type { GameModule, Params } from "@boarddream/engine";
import { BookOpen, LoaderCircle } from "lucide-react";
import { useEscape } from "../escape";
import { setPref, usePrefs } from "../prefs";
import { rulesFor } from "../rules";
import { useTranslation, type Translation } from "../translation";

/**
 * How to play: the game's rules and how the table works. Opens the first time a game is played here.
 * A switch shows the game in Chinese (translation.ts) for a player who reads little English: the
 * rules, how a turn goes and where its choices are, each card, and the table's English words.
 */
export function RulesCard({ game, params, onClose }: { game: GameModule; params: Params; onClose(): void }) {
  useEscape(onClose);
  const { language } = usePrefs();
  const translated = useTranslation(game, params, language);
  const chinese = language === "zh";
  return (
    <div className="overlay rules-overlay" onClick={onClose}>
      <div className="rules-card" role="dialog" aria-label={`How to play ${game.meta.name}`} lang={chinese ? "zh-Hans" : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="rules-head">
          <span className="rules-kicker">
            <BookOpen size={15} /> {chinese ? "怎么玩" : "How to play"}
          </span>
          <div className="segmented" role="group" aria-label="Language">
            <button type="button" className={chinese ? "" : "on"} aria-pressed={!chinese} onClick={() => setPref("language", "en")}>
              English
            </button>
            <button type="button" className={chinese ? "on" : ""} aria-pressed={chinese} lang="zh-Hans" onClick={() => setPref("language", "zh")}>
              中文
            </button>
          </div>
        </div>
        {!chinese ? (
          <English game={game} params={params} />
        ) : translated.status === "ready" ? (
          <Chinese game={game} t={translated.translation} />
        ) : (
          <>
            <h3>{game.meta.name}</h3>
            {translated.status === "error" ? (
              <p className="rules-waiting">
                翻译失败：{translated.message}
                <button type="button" className="action secondary" onClick={translated.retry}>
                  重试
                </button>
              </p>
            ) : (
              <p className="rules-waiting" role="status">
                <LoaderCircle size={16} className="spin" /> Muse Spark 正在把这个游戏翻译成中文，第一次大约需要半分钟…
              </p>
            )}
          </>
        )}
        <button type="button" className="action" onClick={onClose}>
          {chinese ? "开始玩" : "Start playing"}
        </button>
      </div>
    </div>
  );
}

function English({ game, params }: { game: GameModule; params: Params }) {
  const rules = rulesFor(game, params);
  return (
    <>
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
    </>
  );
}

function Chinese({ game, t }: { game: GameModule; t: Translation }) {
  return (
    <>
      <h3>
        {t.name}
        {t.name !== game.meta.name && <span className="rules-english">{game.meta.name}</span>}
      </h3>
      <p className="rules-summary">{t.summary}</p>
      <ol className="rules-list">
        {t.rules.map((rule, i) => (
          <li key={i}>{rule}</li>
        ))}
      </ol>
      {t.turn && (
        <>
          <h4>一回合怎么玩</h4>
          <p className="rules-explain">{t.turn}</p>
        </>
      )}
      {t.choices && (
        <>
          <h4>关键的选择</h4>
          <p className="rules-explain">{t.choices}</p>
        </>
      )}
      {t.cards.length > 0 && (
        <>
          <h4>牌（{t.cards.length} 种）</h4>
          <ul className="rules-glossary">
            {t.cards.map((card) => (
              <li key={card.title}>
                <strong>{card.name}</strong> <span className="en">{card.title}</span>：{card.effect}
              </li>
            ))}
          </ul>
        </>
      )}
      {t.terms.length > 0 && (
        <>
          <h4>桌上的英文</h4>
          <dl className="rules-terms">
            {t.terms.map((term) => (
              <div key={term.en}>
                <dt>{term.en}</dt>
                <dd>{term.zh}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
      <h4>桌上操作</h4>
      <ul className="rules-controls">
        <li>能做的事都会发光：点发光的牌、格子或计数器。一个目标对应好几种走法时，会弹出菜单让你选。</li>
        <li>不在桌上的走法（比如跳过）是底部的按钮。</li>
        <li>不知道走哪步？点 Hint，游戏自带的机器人会告诉你它会怎么走。</li>
        <li>按 F 收起两侧面板，点 Rules 可以再打开这张说明。</li>
      </ul>
    </>
  );
}
