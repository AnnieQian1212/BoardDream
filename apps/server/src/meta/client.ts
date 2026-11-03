export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface JsonSchema {
  name: string;
  schema: Record<string, unknown>;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  /** Constrains the reply to this JSON schema (structured output). */
  schema?: JsonSchema;
  /** How long a reasoning model thinks before it answers. */
  reasoningEffort?: "low" | "medium" | "high";
  /** Cap on completion tokens, reasoning included. */
  maxTokens?: number;
}

/** The hackathon's open-weight model on Baseten. */
export const OPEN_MODEL_ID = "meta-models/muse-spark-open-1026";

/**
 * Muse Spark Open at its default effort can spend 3,000 tokens thinking before a one-line JSON
 * move; at low effort it answers in a few seconds.
 */
export const OPEN_MODEL_OPTIONS: ChatOptions = { reasoningEffort: "low", maxTokens: 4096 };

export interface ClientOptions {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Options sent with every call unless the call overrides them. */
  defaults?: ChatOptions;
  /**
   * An undici dispatcher for the calls, on Node only (the server's waits as long as a model thinks:
   * see patientDispatcher). Left out, fetch's own applies, as on Cloudflare.
   */
  dispatcher?: object;
}

/** Running token totals; reasoning tokens are counted inside completion tokens. */
export interface Usage {
  calls: number;
  promptTokens: number;
  completionTokens: number;
}

/**
 * Minimal client for OpenAI-compatible chat completions: the Meta Model API and hosted Muse Spark Open.
 * See https://dev.meta.ai/docs/protocols/chat-completions and /docs/structured-output.
 */
export class ModelClient {
  readonly usage: Usage = { calls: 0, promptTokens: 0, completionTokens: 0 };

  constructor(protected readonly opts: ClientOptions) {}

  get model() {
    return this.opts.model;
  }

  /** A call's options on top of the client's defaults. */
  protected withDefaults(options: ChatOptions): ChatOptions {
    return this.opts.defaults ? { ...this.opts.defaults, ...options } : options;
  }

  async chat(messages: ChatMessage[], callOptions: ChatOptions = {}): Promise<string> {
    const options = this.withDefaults(callOptions);
    const body = {
      model: options.model ?? this.opts.model,
      messages,
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.schema && { response_format: { type: "json_schema", json_schema: options.schema } }),
      ...(options.reasoningEffort && { reasoning_effort: options.reasoningEffort }),
      ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens }),
    };
    const data = (await this.post("/chat/completions", body)) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    this.usage.calls++;
    this.usage.promptTokens += data.usage?.prompt_tokens ?? 0;
    this.usage.completionTokens += data.usage?.completion_tokens ?? 0;
    return data.choices?.[0]?.message?.content ?? "";
  }

  /**
   * Like chat, but the reply streams in: `onText` gets each piece of the answer as it arrives. A
   * reasoning model sends nothing while it thinks. `signal` stops the call midway, e.g. when the
   * player who asked has left; a dropped connection is retried only before any text arrived.
   */
  async chatStream(messages: ChatMessage[], onText: (piece: string) => void, callOptions: ChatOptions = {}, signal?: AbortSignal): Promise<string> {
    const options = this.withDefaults(callOptions);
    const body = {
      model: options.model ?? this.opts.model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.reasoningEffort && { reasoning_effort: options.reasoningEffort }),
      ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens }),
    };
    const res = await this.send("/chat/completions", body, signal);
    let reply = "";
    let pending = "";
    const decoder = new TextDecoder();
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      pending += decoder.decode(chunk, { stream: true });
      const lines = pending.split("\n");
      pending = lines.pop()!;
      for (const line of lines) {
        const data = line.trim().replace(/^data:\s*/, "");
        if (!line.trim().startsWith("data:") || data === "[DONE]") continue;
        const event = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const piece = event.choices?.[0]?.delta?.content;
        if (piece) {
          reply += piece;
          onText(piece);
        }
        if (event.usage) {
          this.usage.promptTokens += event.usage.prompt_tokens ?? 0;
          this.usage.completionTokens += event.usage.completion_tokens ?? 0;
        }
      }
    }
    this.usage.calls++;
    return reply;
  }

  async chatJson<T>(messages: ChatMessage[], schema: JsonSchema, options: Omit<ChatOptions, "schema"> = {}): Promise<T> {
    return JSON.parse(await this.chat(messages, { ...options, schema })) as T;
  }

  /** POSTs JSON and reads the JSON reply, retrying as `send` does; `signal` stops it midway. */
  async post(path: string, body: unknown, attempts = 4, signal?: AbortSignal): Promise<unknown> {
    return (await this.send(path, body, signal, attempts)).json();
  }

  /** POSTs JSON, retrying network errors, rate limits and server errors with backoff; returns the response once it is OK. */
  protected async send(path: string, body: unknown, signal?: AbortSignal, attempts = 4): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
      let retryable: string;
      try {
        const res = await fetch(`${this.opts.baseUrl}${path}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${this.opts.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal,
          ...(this.opts.dispatcher && { dispatcher: this.opts.dispatcher }),
        } as RequestInit);
        if (res.ok) return res;
        const text = await res.text();
        if (res.status !== 429 && res.status < 500) throw new Error(`${path} failed: ${res.status} ${text}`);
        retryable = `${path} failed: ${res.status} ${text}`;
      } catch (err) {
        // fetch rejects with a TypeError on network failures; anything else is final.
        if (!(err instanceof TypeError)) throw err;
        retryable = `${path} failed: ${err.message}`;
      }
      if (attempt >= attempts) throw new Error(retryable);
      await new Promise((resolve) => setTimeout(resolve, 2000 * 2 ** (attempt - 1)));
    }
  }
}
