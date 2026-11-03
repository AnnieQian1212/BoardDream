import { describe, expect, test } from "vitest";
import { ART_STYLES, cardScenes, chooseStyle, HOUSE_STYLE, styleByWords, subjectFor } from "./cards";

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

describe("each card's picture", () => {
  const deck = {
    game: "Farlight Reefs",
    summary: "Rival keepers light a wrecking coast and guide schooners home.",
    cards: [{ title: "Wreck to Gullrest" }, { title: "Deep to Gullrest" }, { title: "Wreck to Gullrest" }],
  };

  test("is written for the whole deck at once, one per card, unknown titles dropped", async () => {
    let asked: unknown;
    const llm = {
      chatJson: async (messages: { content: string }[]) => {
        asked = JSON.parse(messages[1].content);
        return {
          scenes: [
            { title: "Wreck to Gullrest", picture: "A gull-covered hull on the skerries at noon." },
            { title: "Deep to Gullrest", picture: "Gannets diving into a navy channel at dawn." },
            { title: "Somewhere else", picture: "A picture for no card." },
          ],
        };
      },
    } as never;
    const scenes = await cardScenes(llm, deck, "engraving");
    expect(Object.keys(scenes).sort()).toEqual(["Deep to Gullrest", "Wreck to Gullrest"]);
    // Each card once, however many copies the deck has.
    expect((asked as { cards: unknown[] }).cards).toHaveLength(2);
  });

  test("is left to the card's title when Muse Spark cannot be asked", async () => {
    const failing = { chatJson: async () => Promise.reject(new Error("down")) } as never;
    expect(await cardScenes(failing, deck, "engraving")).toEqual({});
  });

  test("is painted without the game's summary, which made every card the same scene", () => {
    const card = { title: "Wreck to Gullrest" };
    const subject = subjectFor(deck, card, "A gull-covered hull on the skerries at noon.");
    expect(subject).toContain("A gull-covered hull on the skerries at noon");
    expect(subject).not.toContain("Rival keepers");
    expect(subject).toMatch(/no caption, title, name, label or lettering/);
    // With no picture, the title and the summary as before.
    expect(subjectFor(deck, card)).toContain("Wreck to Gullrest");
  });
});
