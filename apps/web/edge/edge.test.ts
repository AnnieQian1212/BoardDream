import { describe, expect, it } from "vitest";
import { onRequestGet } from "../functions/api/health";
import { onRequestPost } from "../functions/api/opponent";

const keys = { OPEN_MODEL_API_KEY: "test-key", OPEN_MODEL_BASE_URL: "https://models.invalid/v1" };

describe("edge functions", () => {
  it("tell the app what the static demo can do", async () => {
    expect(await onRequestGet({ env: {} }).json()).toEqual({ ok: true, hasApiKey: false, canGenerate: false });
    expect(await onRequestGet({ env: keys }).json()).toMatchObject({ opponentModel: "meta-models/muse-spark-open-1026" });
    expect(await onRequestGet({ env: { ...keys, OPPONENTS_ENABLED: "0" } }).json()).not.toHaveProperty("opponentModel");
  });

  it("refuse opponent calls that are switched off or malformed before calling any model", async () => {
    const post = (body: string, env: Record<string, string>) =>
      onRequestPost({ request: new Request("https://demo.invalid/api/opponent", { method: "POST", body }), env });
    expect((await post("{}", {})).status).toBe(503);
    expect((await post("not json", keys)).status).toBe(400);
    expect(await (await post(JSON.stringify({ game: "Fenlight" }), keys)).json()).toMatchObject({ error: expect.stringMatching(/rules/) });
  });
});
