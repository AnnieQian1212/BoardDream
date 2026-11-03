import { describe, expect, test } from "vitest";
import { prefs, setPref } from "./prefs";

describe("table preferences", () => {
  test("hints and battles start on, the rules in English, and each switches on its own", () => {
    expect(prefs()).toEqual({ hints: true, battles: true, language: "en" });
    setPref("hints", false);
    expect(prefs()).toEqual({ hints: false, battles: true, language: "en" });
    setPref("battles", false);
    setPref("hints", true);
    setPref("language", "zh");
    expect(prefs()).toEqual({ hints: true, battles: false, language: "zh" });
  });
});
