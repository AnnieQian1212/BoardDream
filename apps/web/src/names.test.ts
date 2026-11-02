import { expect, test } from "vitest";
import { splitVersion } from "./names";

test("a revised game shows its name and a version number", () => {
  expect(splitVersion("Abbey of Ink and Vine")).toEqual({ name: "Abbey of Ink and Vine" });
  expect(splitVersion("Abbey of Ink and Vine (revised)")).toEqual({ name: "Abbey of Ink and Vine", version: "Version 2" });
  expect(splitVersion("Abbey of Ink and Vine (revised 2)")).toEqual({ name: "Abbey of Ink and Vine", version: "Version 3" });
  expect(splitVersion("Ruins (revised) of Old")).toEqual({ name: "Ruins (revised) of Old" });
});
