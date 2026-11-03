import { describe, expect, test } from "vitest";
import { pageAddress, pageAt } from "./pages";

describe("pages as addresses", () => {
  const at = (search: string) => ({ pathname: "/", search });

  test("home, the games page and a table each have their own address, and read back the same", () => {
    const pages = [
      { table: false, game: "highsail", library: false, results: false },
      { table: false, game: "highsail", library: true, results: false },
      { table: true, game: "waxbloom-valley-mw04jtcp", library: false, results: false },
      { table: true, game: "highsail", library: false, results: true },
    ];
    expect(pages.map((p) => pageAddress(at(""), p))).toEqual(["/", "/?games", "/?game=waxbloom-valley-mw04jtcp", "/?game=highsail&results"]);
    for (const page of pages.slice(1)) {
      const back = pageAt(pageAddress(at(""), page).slice(1));
      expect(back).toMatchObject({ table: page.table, library: page.library, results: page.results });
      if (page.table) expect(back.game).toBe(page.game);
    }
  });

  test("other flags in the address are kept", () => {
    expect(pageAddress(at("?flat&quality=low&game=old"), { table: true, game: "highsail", library: false, results: false })).toBe("/?flat&quality=low&game=highsail");
    expect(pageAddress(at("?bots&game=highsail"), { table: false, library: false, results: false })).toBe("/?bots");
  });
});
