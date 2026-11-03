import { describe, expect, test } from "vitest";
import { ART_STYLES, chooseStyle, HOUSE_STYLE, styleByWords } from "./cards";

describe("a deck's painting style", () => {
  const game = (summary: string, extra: { mode?: string; family?: string } = {}) => ({ game: "Test", summary, cards: [], ...extra });

  test("from words, when the picker cannot be asked: secrets as woodcut, space as a poster, myth in watercolor, trade as an engraving", () => {
    expect(styleByWords(game("Crew an airship and vote off the saboteur.", { mode: "hidden-role" }))).toBe("woodcut");
    expect(styleByWords(game("Smugglers slip crates past the harbor watch."))).toBe("woodcut");
    expect(styleByWords(game("Salvage derelict robots across the asteroid belt."))).toBe("poster");
    expect(styleByWords(game("Raise temples to the sky gods before the dragon wakes."))).toBe("watercolor");
    expect(styleByWords(game("Spice merchants chart voyages for the royal guild."))).toBe("engraving");
    expect(styleByWords(game("Cafe owners on one busy street win over regulars."))).toBe("storybook");
  });

  test("asks Muse Spark, and falls back to the words when its answer is not a style or the call fails", async () => {
    const answering = (style: string) => ({ chatJson: async () => ({ style }) }) as never;
    expect(await chooseStyle(answering("engraving"), game("A cozy village fair."))).toBe("engraving");
    expect(await chooseStyle(answering("cubism"), game("A cozy village fair."))).toBe("storybook");
    const failing = { chatJson: async () => Promise.reject(new Error("down")) } as never;
    expect(await chooseStyle(failing, game("Salvage robots on a moon."))).toBe("poster");
  });

  test("every style keeps one clear subject and no lettering; the house style is the storybook", () => {
    for (const style of Object.values(ART_STYLES)) expect(style.paint).not.toMatch(/\btext\b|letter/i);
    expect(HOUSE_STYLE).toContain(ART_STYLES.storybook.paint);
    expect(HOUSE_STYLE).toMatch(/one clear subject/);
    expect(HOUSE_STYLE).toMatch(/no text, no letters/);
  });
});
