import { describe, expect, it } from "vitest";
import { resultHeadline } from "./outcome";
import { tidyPanels } from "./panels";

describe("resultHeadline", () => {
  it("names the winner of a competitive game", () => {
    expect(resultHeadline("competitive", { winners: [0] }, 0)).toBe("You win!");
    expect(resultHeadline("competitive", { winners: [2] }, 0)).toBe("Player 3 wins");
    expect(resultHeadline("competitive", { winners: [0, 1] }, 0)).toBe("Shared victory");
    expect(resultHeadline("competitive", { winners: [1, 3] }, 0)).toBe("Players 2 and 4 share the win");
    expect(resultHeadline("competitive", { winners: [] }, 0)).toBe("It's a draw");
  });

  it("speaks of the whole table in a cooperative game", () => {
    expect(resultHeadline("cooperative", { winners: [0, 1, 2] }, 0)).toBe("The table wins!");
    expect(resultHeadline("cooperative", { winners: [] }, 0)).toBe("The table lost");
  });

  it("speaks of sides in a hidden-role game", () => {
    expect(resultHeadline("hidden-role", { winners: [0, 4] }, 0)).toBe("Your side wins!");
    expect(resultHeadline("hidden-role", { winners: [1, 2, 3, 5] }, 0)).toBe("Your side lost");
  });
});

describe("counters", () => {
  it("show at most one decimal, leaving whole numbers and their panels alone", () => {
    const whole = { id: "p1", title: "Player 1", zone: "players" as const, counters: [{ id: "s", label: "Score", value: 7 }] };
    const estimated = { ...whole, id: "p2", counters: [{ id: "s", label: "Score", value: 4.046666666666667 }, { id: "w", label: "Water", value: 3.8966 }] };
    const [a, b] = tidyPanels([whole, estimated]);
    expect(a).toBe(whole);
    expect(b.counters!.map((c) => c.value)).toEqual([4, 3.9]);
  });
});
