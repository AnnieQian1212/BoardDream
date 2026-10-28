import { add, amountOf, canAfford, type Amounts } from "./resources";

/**
 * Trading: fixed-rate exchanges with the bank, and offers between players that the other side
 * accepts or declines. A pending offer makes the receiving player active until they answer.
 */

/** Pays `rate` of `give` to the bank for one `get`. */
export function bankTrade(pool: Amounts, give: string, get: string, rate: number): Amounts {
  if (give === get) throw new Error("bankTrade: give and get are the same resource");
  if (amountOf(pool, give) < rate) throw new Error(`bankTrade: needs ${rate} ${give}`);
  return add(pool, { [give]: -rate, [get]: 1 });
}

/** Bank trades a pool can make: one entry per resource it has `rate` of, for each other resource. */
export function bankOptions(pool: Amounts, resources: readonly string[], rate: number): { give: string; get: string }[] {
  return resources.flatMap((give) => (amountOf(pool, give) >= rate ? resources.filter((get) => get !== give).map((get) => ({ give, get })) : []));
}

export interface Offer {
  from: number;
  to: number;
  /** What `from` hands over. */
  give: Amounts;
  /** What `from` asks for in return. */
  get: Amounts;
}

export const canOffer = (pools: readonly Amounts[], offer: Offer) => offer.from !== offer.to && canAfford(pools[offer.from], offer.give);

export const canAccept = (pools: readonly Amounts[], offer: Offer) => canAfford(pools[offer.to], offer.get) && canOffer(pools, offer);

/** Swaps the goods of an accepted offer. */
export function settle(pools: readonly Amounts[], offer: Offer): Amounts[] {
  if (!canAccept(pools, offer)) throw new Error("settle: one side cannot pay");
  return pools.map((pool, seat) => {
    if (seat === offer.from) return add(add(pool, offer.give, -1), offer.get);
    if (seat === offer.to) return add(add(pool, offer.get, -1), offer.give);
    return pool;
  });
}

/** One-for-one offers `from` can make to `to`: give what they have, ask for what the other side has. */
export function swapOptions(pools: readonly Amounts[], from: number, to: number, resources: readonly string[]): Offer[] {
  return resources.flatMap((give) =>
    amountOf(pools[from], give) > 0
      ? resources.filter((get) => get !== give && amountOf(pools[to], get) > 0).map((get) => ({ from, to, give: { [give]: 1 }, get: { [get]: 1 } }))
      : [],
  );
}
