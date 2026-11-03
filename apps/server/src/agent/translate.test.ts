import { createHash } from "node:crypto";
import { rmSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cleanRequest, completed, savedTranslation, translateGame, type TranslateRequest } from "./translate";

const request: TranslateRequest = {
  lang: "zh",
  name: "Farlight Reefs",
  summary: "Rival keepers light a wrecking coast.",
  rules: ["Each round every keeper sails up to 2 waters.", "Most stars wins."],
  cards: [{ title: "Deep to Gullrest", text: "Catch 4 · draft 2 · ★3" }],
  terms: ["Lamp Oil", "sail"],
};

describe("a game put into the player's language", () => {
  it("takes only a supported language and cuts what it is sent to size", () => {
    expect(cleanRequest({ ...request, lang: "fr" })).toBe("unsupported language");
    expect(cleanRequest(null)).toBe("expected a JSON body");
    const long = cleanRequest({ ...request, rules: Array.from({ length: 100 }, (_, i) => `rule ${i}`), terms: ["sail", "sail", 3] }) as TranslateRequest;
    expect(long.rules).toHaveLength(40);
    expect(long.terms).toEqual(["sail"]);
  });

  it("keeps the English of anything the answer left out, so no line of the game is lost", () => {
    const t = completed(request, { name: "远灯礁", rules: ["每轮每个灯塔守护人最多航行 2 格水域。"], cards: [], terms: [{ en: "Lamp Oil", zh: "灯油" }] });
    expect(t.name).toBe("远灯礁");
    expect(t.rules).toEqual(["每轮每个灯塔守护人最多航行 2 格水域。", "Most stars wins."]);
    expect(t.cards).toEqual([{ title: "Deep to Gullrest", name: "Deep to Gullrest", effect: "Catch 4 · draft 2 · ★3" }]);
    expect(t.terms).toEqual([
      { en: "Lamp Oil", zh: "灯油" },
      { en: "sail", zh: "sail" },
    ]);
  });

  it("asks Muse Spark once and keeps the answer", async () => {
    const id = "zz-translate-test";
    const file = new URL(`../../../../data/translations/${id}-zh-${createHash("sha1").update(JSON.stringify(request)).digest("hex").slice(0, 16)}.json`, import.meta.url);
    let calls = 0;
    const llm = {
      chatJson: async () => {
        calls++;
        return { name: "远灯礁", summary: "对手灯塔守护人点亮海岸。", rules: ["一", "二"], turn: "先航行，再做两个行动。", choices: "点灯还是送船。", cards: [], terms: [] };
      },
    } as never;
    try {
      const first = await translateGame(llm, id, request);
      const again = await translateGame(llm, id, request);
      expect(calls).toBe(1);
      expect(again).toEqual(first);
      expect(savedTranslation(id, request)?.turn).toBe("先航行，再做两个行动。");
      // Other text (a changed rule) is another translation.
      expect(savedTranslation(id, { ...request, rules: ["Changed."] })).toBeUndefined();
    } finally {
      rmSync(file, { force: true });
    }
  });
});
