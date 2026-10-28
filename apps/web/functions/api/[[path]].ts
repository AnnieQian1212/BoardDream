import { json } from "../../edge/respond";

// Any other API route (saved games, art, generation) lives only on the Node server. Without this,
// the static host would answer with the app's page and the client would try to parse HTML as JSON.
export const onRequest = () => json({ error: "not available in the static demo" }, 404);
