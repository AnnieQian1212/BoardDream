import { describe, expect, it } from "vitest";
import { workerMessage } from "./check";

describe("messages from the check's workers", () => {
  it("reads the worker's own messages", () => {
    expect(workerMessage({ type: "run", seed: 1, numPlayers: 2, params: {} })?.type).toBe("run");
    expect(workerMessage({ type: "done", result: { ok: true, failures: [] } })?.type).toBe("done");
  });

  it("ignores what else arrives on the port, such as Node's watch-mode module reports", () => {
    expect(workerMessage({ "watch:import": ["file:///x.ts"] })).toBeUndefined();
    expect(workerMessage({ "watch:require": [undefined] })).toBeUndefined();
    expect(workerMessage("hello")).toBeUndefined();
    expect(workerMessage(null)).toBeUndefined();
  });
});
