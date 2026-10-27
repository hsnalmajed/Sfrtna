/**
 * Several rooms (owner, 27 Oct: "some people want more than one room or
 * apartment"). Hotel price searches price one room for a party, so a stay in
 * R rooms is searched as one room for the party's share — the adults and
 * children spread as evenly as they go, the first rooms taking the extra —
 * and every total is that room's price × R, said so on the page.
 */
export const MAX_ROOMS = 8;

export function cleanRooms(v: unknown, adults: number): number {
  const n = Math.round(Number(v) || 1);
  return Math.min(MAX_ROOMS, Math.max(1, adults), Math.max(1, n));
}

/** One room's share of the party: what the price search asks for. */
export function roomShare(adults: number, childrenAges: number[], rooms: number): { adults: number; childrenAges: number[] } {
  const r = Math.max(1, rooms);
  return { adults: Math.max(1, Math.ceil(adults / r)), childrenAges: childrenAges.slice(0, Math.ceil(childrenAges.length / r)) };
}
