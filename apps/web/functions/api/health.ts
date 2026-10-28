import { OPEN_MODEL_ID } from "../../../server/src/meta/client";
import { json, opponentsOn, type Env } from "../../edge/respond";

// The static demo cannot generate or paint (that needs the Node server); it can seat AI opponents.
export const onRequestGet = ({ env }: { env: Env }) =>
  json({ ok: true, hasApiKey: false, canGenerate: false, opponentModel: opponentsOn(env) ? (env.OPEN_MODEL ?? OPEN_MODEL_ID) : undefined });
