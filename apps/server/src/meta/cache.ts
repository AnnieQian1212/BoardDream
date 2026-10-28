import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { ModelClient, type ChatMessage, type ChatOptions, type ClientOptions } from "./client";

/**
 * ModelClient that stores every reply on disk, keyed by model, messages and options. Reruns cost
 * nothing, and the files are a record of exactly what the model was asked and what it answered.
 */
export class CachedModelClient extends ModelClient {
  hits = 0;
  /** Cache files read or written by this client. */
  private readonly used = new Set<string>();

  constructor(
    opts: ClientOptions,
    private readonly dir: URL,
  ) {
    super(opts);
    mkdirSync(dir, { recursive: true });
  }

  override async chat(messages: ChatMessage[], callOptions: ChatOptions = {}): Promise<string> {
    const options = this.withDefaults(callOptions);
    const model = options.model ?? this.model;
    const key = createHash("sha256").update(JSON.stringify({ model, messages, options })).digest("hex").slice(0, 16);
    const file = new URL(`${key}.json`, this.dir);
    this.used.add(`${key}.json`);
    if (existsSync(file)) {
      this.hits++;
      return (JSON.parse(readFileSync(file, "utf8")) as { reply: string }).reply;
    }
    if (!this.opts.apiKey) throw new Error(`cache miss and no API key is set for ${model}`);
    const reply = await super.chat(messages, options);
    writeFileSync(file, JSON.stringify({ model, messages, options, reply }, null, 2) + "\n");
    return reply;
  }

  /** Deletes cache files this client never touched, so the cache matches the latest run. */
  prune(): number {
    const stale = readdirSync(this.dir).filter((name) => name.endsWith(".json") && !this.used.has(name));
    for (const name of stale) unlinkSync(new URL(name, this.dir));
    return stale.length;
  }
}
