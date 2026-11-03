import { describe, expect, test } from "vitest";
import { prefs, setPref } from "./prefs";

describe("table preferences", () => {
  test("hints and battles start on, and each switches on its own", () => {
    expect(prefs()).toEqual({ hints: true, battles: true });
    setPref("hints", false);
    expect(prefs()).toEqual({ hints: false, battles: true });
    setPref("battles", false);
    setPref("hints", true);
    expect(prefs()).toEqual({ hints: true, battles: false });
  });
});
