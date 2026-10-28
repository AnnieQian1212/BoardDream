import { chooseMove, type OpponentRequest } from "../../../server/src/agent/opponent";
import { clientAddress, LIMITS, opponentRequestProblem, RateLimiter } from "../../../server/src/guard";
import { ModelClient, OPEN_MODEL_ID, OPEN_MODEL_OPTIONS } from "../../../server/src/meta/client";
import { json, opponentsOn, type Env } from "../../edge/respond";

// One limiter per edge instance: guard.ts explains what in-memory limits can and cannot stop.
const limiter = new RateLimiter(LIMITS.opponent);

/** One decision for an AI opponent, as on the Node server: a legal move index and a line of table talk. */
export async function onRequestPost({ request, env }: { request: Request; env: Env }): Promise<Response> {
  if (!opponentsOn(env)) return json({ error: "AI opponents are off in this demo" }, 503);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "expected a JSON body" }, 400);
  }
  const problem = opponentRequestProblem(body);
  if (problem) return json({ error: problem }, 400);
  const verdict = limiter.take(clientAddress(request.headers));
  if (!verdict.ok) return json({ error: verdict.reason }, 429, { "Retry-After": String(verdict.retryAfterS) });
  const llm = new ModelClient({
    baseUrl: env.OPEN_MODEL_BASE_URL!,
    apiKey: env.OPEN_MODEL_API_KEY!,
    model: env.OPEN_MODEL ?? OPEN_MODEL_ID,
    defaults: OPEN_MODEL_OPTIONS,
  });
  try {
    return json(await chooseMove(llm, body as OpponentRequest));
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 502);
  }
}
