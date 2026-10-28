/** Reads a server-sent event stream from a fetch response, calling `on` for each event. */
export async function readEvents(res: Response, on: (event: string, data: string) => void): Promise<void> {
  const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
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
