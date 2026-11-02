import { json } from "../../edge/respond";

// Lists the page reads as it opens, answered as the static demo has them: no saved games, no
// painted covers beyond those shipped with the app, nobody signed in. Answering them keeps the
// browser's console free of errors a visitor could take for a broken site.
const EMPTY: Record<string, unknown> = { "/api/games": [], "/api/covers": {}, "/api/auth/me": { user: null } };

// Any other API route (saved games, art, generation, accounts) lives only on the Node server. Without
// this, the static host would answer with the app's page and the client would try to parse HTML as JSON.
export function onRequest({ request }: { request: Request }): Response {
  const { pathname } = new URL(request.url);
  if (request.method === "GET" && Object.hasOwn(EMPTY, pathname)) return json(EMPTY[pathname]);
  return json({ error: "not available in the static demo" }, 404);
}
