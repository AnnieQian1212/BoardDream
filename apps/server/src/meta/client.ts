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

  constructor(protected readonly opts: { baseUrl: string; apiKey: string; model: string }) {}

  get model() {
    return this.opts.model;
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const body = {
      model: options.model ?? this.opts.model,
      messages,
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.schema && { response_format: { type: "json_schema", json_schema: options.schema } }),
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

  async chatJson<T>(messages: ChatMessage[], schema: JsonSchema, options: Omit<ChatOptions, "schema"> = {}): Promise<T> {
    return JSON.parse(await this.chat(messages, { ...options, schema })) as T;
  }

  async post(path: string, body: unknown): Promise<unknown> {
    const res = await fetch(`${this.opts.baseUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.opts.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
    return res.json();
  }
}
