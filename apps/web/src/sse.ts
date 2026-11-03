/** The connection went quiet for longer than the server's heartbeat allows: it is gone. */
export class StreamSilent extends Error {}

/**
 * Reads a server-sent event stream from a fetch response, calling `on` for each event. With
 * `silenceMs`, for a stream whose server sends a heartbeat, a stream that sends nothing for that
 * long is given up with StreamSilent: a server stopped behind the dev proxy never closed the page's
 * connection, and a game being made looked busy for half an hour.
 */
export async function readEvents(res: Response, on: (event: string, data: string) => void, silenceMs?: number): Promise<void> {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const silent = silenceMs
      ? new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new StreamSilent("lost the connection to the server")), silenceMs);
        })
      : undefined;
    let next: ReadableStreamReadResult<string>;
    try {
      next = await (silent ? Promise.race([reader.read(), silent]) : reader.read());
    } catch (err) {
      if (err instanceof StreamSilent) void reader.cancel().catch(() => {});
      throw err;
    } finally {
      clearTimeout(timer);
    }
    const { value, done } = next;
    if (done) break;
    // Events end with a blank line; normalize CRLF first.
    buffer = (buffer + value).replace(/\r\n/g, "\n");
    let end: number;
    while ((end = buffer.indexOf("\n\n")) >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const event = block.match(/^event: (.*)$/m)?.[1] ?? "message";
      const data = [...block.matchAll(/^data: ?(.*)$/gm)].map((m) => m[1]).join("\n");
      on(event, data);
    }
  }
}
