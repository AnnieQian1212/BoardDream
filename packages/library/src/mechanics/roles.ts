import type { Rng } from "@boarddream/engine";

/** Hidden roles: deal secret roles, then show each player only what their role lets them know. */

/** Random roles: `counts[role]` seats get each role and every other seat gets `fallback`. */
export function dealRoles(rng: Rng, numPlayers: number, counts: Record<string, number>, fallback: string): string[] {
  const roles: string[] = [];
  for (const [role, count] of Object.entries(counts)) for (let i = 0; i < count; i++) roles.push(role);
  while (roles.length < numPlayers) roles.push(fallback);
  return rng.shuffle(roles.slice(0, numPlayers));
}

/**
 * Roles as `viewer` sees them: their own, plus fellow team members' when their role knows its team
 * (e.g. werewolves know each other). Unknown roles are null.
 */
export function visibleRoles(
  roles: readonly string[],
  viewer: number,
  knowsTeam: (role: string) => boolean = () => false,
): (string | null)[] {
  const mine = roles[viewer];
  return roles.map((role, seat) => (seat === viewer || (knowsTeam(mine) && role === mine) ? role : null));
}
