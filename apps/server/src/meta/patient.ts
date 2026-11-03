import { Agent } from "undici";

/**
 * How long a model call may go without a byte. Node's fetch gives up after five minutes of silence,
 * before the headers or between two pieces of a stream; at high effort Muse Spark thinks longer than
 * that before the first piece of a game's rules, so the call failed and the generation with it.
 */
export const MODEL_SILENCE_MS = 20 * 60_000;

/** A dispatcher for model calls on the Node server (ClientOptions.dispatcher): it waits as long as a model thinks. */
export const patientDispatcher = new Agent({ headersTimeout: MODEL_SILENCE_MS, bodyTimeout: MODEL_SILENCE_MS });
