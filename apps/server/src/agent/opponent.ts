import type { ChatMessage, JsonSchema, ModelClient } from "../meta/client";

/**
 * Muse Spark as a table opponent for the social moments of a game: making and answering trade
 * offers, bidding, bluffing and calling bluffs. It sees only what its seat may see, picks one of
 * the legal moves, and says one line of table talk.
 */

export interface OpponentRequest {
  game: string;
  rules: string[];
  seat: number;
  numPlayers: number;
  /** What the seat can see: scores, resources, cards, the market. */
  table: string;
  /** Recent moves, oldest first, as the seat saw them. */
  recent: string[];
  /** Legal moves, described from the seat's point of view. */
  moves: string[];
  /** Index of the move a quick calculation (the table bot) recommends. */
  advice?: number;
}

export interface OpponentReply {
  move: number;
  say: string;
}

const replySchema: JsonSchema = {
  name: "OpponentMove",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["move", "say"],
    properties: { move: { type: "integer" }, say: { type: "string" } },
  },
};

const advice = (req: OpponentRequest) =>
  req.advice !== undefined && req.moves[req.advice] !== undefined ? `\n\nAdvisor suggests: ${req.advice}) ${req.moves[req.advice]}` : "";

export function opponentMessages(req: OpponentRequest): ChatMessage[] {
  return [
    {
      role: "system",
      content: `You are Player ${req.seat + 1} in a game of ${req.game} with ${req.numPlayers} players, playing to win.
Rules:
${req.rules.map((r) => `- ${r}`).join("\n")}

Play like a sharp, friendly human at the table:
- Trades: accept only deals that move you closer to winning; refuse anyone close to winning; make offers that
  tempt the other side but help you more.
- Bluffing and bidding: mix honest and bold claims, and call a claim when the odds say it is likely false.
- An advisor that calculates odds and values suggests one move. Follow it unless you have a real reason to
  differ: a deliberate bluff, a read on another player, or a better deal.
- Reply with JSON: "move" is the index of one legal move; "say" is one short line of table talk (under 15
  words, in character, never revealing hidden information you want to keep), or "" to stay quiet.`,
    },
    {
      role: "user",
      content: `## The table (your view)
${req.table}

## Recent moves
${req.recent.length ? req.recent.map((r) => `- ${r}`).join("\n") : "- (none yet)"}

## Your legal moves
${req.moves.map((m, i) => `${i}) ${m}`).join("\n")}${advice(req)}`,
    },
  ];
}

export async function chooseMove(llm: ModelClient, req: OpponentRequest): Promise<OpponentReply> {
  if (req.moves.length === 0) throw new Error("no legal moves");
  const reply = await llm.chatJson<OpponentReply>(opponentMessages(req), replySchema);
  const move = Number.isInteger(reply.move) && reply.move >= 0 && reply.move < req.moves.length ? reply.move : 0;
  return { move, say: String(reply.say ?? "").slice(0, 160) };
}
