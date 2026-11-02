import type { GeometryBattle, PlayerId, Rng } from "@boarddream/engine";
import { rollMany } from "./dice";

/**
 * Dice battles over a place. Both sides roll at once, one die per unit up to a limit, and every die
 * showing the hit face or higher takes out one enemy unit. A defender can hit more easily (a fort,
 * high ground) through defendOn. battleView turns the result into Geometry.battle, which the table
 * plays out: the dice land beside the cell, the hits light up and the lost pieces are knocked off.
 *
 *   const result = combat.battle(rng, attackers, defenders, { defendOn: 4 });
 *   // remove result.attackerLosses and result.defenderLosses units, then keep for the view:
 *   state.lastBattle = combat.battleView(result, { id: String(state.turn), cellId, attacker, defender });
 *   // geometry(state) returns { ..., battle: state.lastBattle }
 */

export interface BattleOptions {
  /** Most dice a side rolls, however many units it has. Default 3. */
  maxDice?: number;
  /** The lowest face that hits for the attacker. Default 5. */
  hitOn?: number;
  /** The lowest face that hits for the defender. Default 5. */
  defendOn?: number;
}

export interface BattleResult {
  /** Each side's dice, highest first. */
  attackerDice: number[];
  defenderDice: number[];
  attackerHitOn: number;
  defenderHitOn: number;
  /** Units each side loses: the other side's hits, never more than it brought. */
  attackerLosses: number;
  defenderLosses: number;
  attackersLeft: number;
  defendersLeft: number;
  /** The side left holding the place alone, if one is. */
  winner?: "attacker" | "defender";
}

/** Fights one round over a place between `attackers` and `defenders` units. */
export function battle(rng: Rng, attackers: number, defenders: number, options: BattleOptions = {}): BattleResult {
  const { maxDice = 3, hitOn = 5, defendOn = 5 } = options;
  const roll = (units: number) => rollMany(rng, Math.max(0, Math.min(units, maxDice))).sort((a, b) => b - a);
  const attackerDice = roll(attackers);
  const defenderDice = roll(defenders);
  const hits = (dice: number[], face: number) => dice.filter((d) => d >= face).length;
  const defenderLosses = Math.min(defenders, hits(attackerDice, hitOn));
  const attackerLosses = Math.min(attackers, hits(defenderDice, defendOn));
  const attackersLeft = attackers - attackerLosses;
  const defendersLeft = defenders - defenderLosses;
  const winner = attackersLeft > 0 && defendersLeft === 0 ? "attacker" : defendersLeft > 0 && attackersLeft === 0 ? "defender" : undefined;
  return { attackerDice, defenderDice, attackerHitOn: hitOn, defenderHitOn: defendOn, attackerLosses, defenderLosses, attackersLeft, defendersLeft, winner };
}

/**
 * The battle as the table shows it (Geometry.battle). `id` must differ from one battle to the next
 * (the turn number will do), so the table plays each battle once.
 */
export function battleView(result: BattleResult, where: { id: string; cellId: string; attacker: PlayerId; defender: PlayerId }): GeometryBattle {
  return {
    id: where.id,
    cellId: where.cellId,
    attacker: where.attacker,
    defender: where.defender,
    attackerDice: [...result.attackerDice],
    defenderDice: [...result.defenderDice],
    attackerHitOn: result.attackerHitOn,
    defenderHitOn: result.defenderHitOn,
    attackerLosses: result.attackerLosses,
    defenderLosses: result.defenderLosses,
  };
}

/** The chance that an attack with `attackers` units against `defenders` takes the place this round. */
export function winChance(attackers: number, defenders: number, options: BattleOptions = {}): number {
  const { maxDice = 3, hitOn = 5 } = options;
  const dice = Math.min(attackers, maxDice);
  const p = (7 - hitOn) / 6;
  // Taking the place needs a hit per defender; the defender's dice may also cost attackers, which
  // only matters when every attacker falls, so this is close for any attack with units to spare.
  let chance = 0;
  for (let k = defenders; k <= dice; k++) chance += binomial(dice, k) * p ** k * (1 - p) ** (dice - k);
  return chance;
}

function binomial(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}
