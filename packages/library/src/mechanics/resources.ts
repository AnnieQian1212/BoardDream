/** Resource pools as plain objects, e.g. { water: 2, light: 1 }. Missing keys count as zero. */

export type Amounts = Record<string, number>;

export const amountOf = (pool: Amounts, id: string) => pool[id] ?? 0;

/** pool + delta, or pool - delta with sign = -1. */
export function add(pool: Amounts, delta: Amounts, sign: 1 | -1 = 1): Amounts {
  const out = { ...pool };
  for (const [id, n] of Object.entries(delta)) out[id] = amountOf(out, id) + sign * n;
  return out;
}

export const canAfford = (pool: Amounts, cost: Amounts) => Object.entries(cost).every(([id, n]) => amountOf(pool, id) >= n);

export function pay(pool: Amounts, cost: Amounts): Amounts {
  if (!canAfford(pool, cost)) throw new Error(`cannot afford ${formatAmounts(cost)}`);
  return add(pool, cost, -1);
}

export const total = (pool: Amounts) => Object.values(pool).reduce((sum, n) => sum + n, 0);

/** How much more of each resource `cost` needs beyond `pool`. */
export function shortfall(pool: Amounts, cost: Amounts): Amounts {
  const missing: Amounts = {};
  for (const [id, n] of Object.entries(cost)) if (amountOf(pool, id) < n) missing[id] = n - amountOf(pool, id);
  return missing;
}

/** "2 water and 1 light", using display names when given. */
export function formatAmounts(amounts: Amounts, names: Record<string, string> = {}): string {
  const parts = Object.entries(amounts)
    .filter(([, n]) => n !== 0)
    .map(([id, n]) => `${n} ${names[id] ?? id}`);
  if (parts.length <= 1) return parts[0] ?? "nothing";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}
