import { describe, expect, it } from "vitest";
import { readEvents, StreamSilent } from "./sse";

/** A stream that sends these chunks, `gap` ms apart, then ends, or stays open when `hang`. */
function stream(chunks: string[], gap: number, hang = false): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const chunk of chunks) {
        await new Promise((r) => setTimeout(r, gap));
        controller.enqueue(encoder.encode(chunk));
      }
      if (!hang) controller.close();
    },
  });
  return new Response(body);
}

describe("reading a server's event stream", () => {
  it("reads every event to the end", async () => {
    const seen: string[] = [];
    await readEvents(stream(["event: design\ndata: {}\n\n", "event: ping\ndata: \n\n", "event: result\ndata: 1\n\n"], 5), (e, d) => seen.push(`${e}:${d}`), 1000);
    expect(seen).toEqual(["design:{}", "ping:", "result:1"]);
  });

  it("gives up a stream that goes silent longer than its heartbeat allows", async () => {
    const seen: string[] = [];
    await expect(readEvents(stream(["event: design\ndata: {}\n\n"], 5, true), (e) => seen.push(e), 80)).rejects.toBeInstanceOf(StreamSilent);
    expect(seen).toEqual(["design"]);
  });

  it("keeps a quiet stream whose heartbeats come in time", async () => {
    const seen: string[] = [];
    const beats = Array.from({ length: 4 }, () => "event: ping\ndata: \n\n");
    await readEvents(stream([...beats, "event: result\ndata: ok\n\n"], 30), (e) => seen.push(e), 120);
    expect(seen.at(-1)).toBe("result");
  });

  it("waits as long as it takes without a limit", async () => {
    const seen: string[] = [];
    await readEvents(stream(["event: step\ndata: x\n\n"], 60), (e) => seen.push(e));
    expect(seen).toEqual(["step"]);
  });
});
