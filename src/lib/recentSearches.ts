// The traveller's last searches, kept in this browser only (never sent
// anywhere), so the same trip is one tap away next time — the way the big
// travel sites greet a returning visitor.

const KEY = "sfr-recent-searches";
const MAX = 4;

export interface RecentSearch {
  url: string;
  kind: "flight" | "hotel" | "combo" | "discover";
  /** What the chip shows: places and dates, already in the page's language. */
  from?: string;
  to?: string;
  date?: string;
  back?: string;
  at: number;
}

export function readRecent(): RecentSearch[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    return Array.isArray(list) ? list.filter((r) => r && typeof r.url === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

/** Called with the address a search form is about to open. */
export function rememberSearch(url: string): void {
  try {
    const u = new URL(url, window.location.origin);
    const q = u.searchParams;
    const route = u.pathname.split("/").pop() || "";
    const kind: RecentSearch["kind"] =
      route === "hotel-results" ? "hotel" : route === "discover-results" ? "discover" : q.get("combo") === "1" ? "combo" : "flight";
    const today = new Date().toISOString().slice(0, 10);
    const date = q.get("departDate") || q.get("checkIn") || "";
    if (date && date < today) return;
    const entry: RecentSearch = {
      url: u.pathname + u.search,
      kind,
      from: q.get("origin") || undefined,
      to: q.get("destination") || q.get("label") || q.get("city") || q.get("hotel") || undefined,
      date: date || undefined,
      back: q.get("returnDate") || q.get("checkOut") || undefined,
      at: Date.now(),
    };
    // One chip per trip: the same places and dates replace the older one.
    const same = (r: RecentSearch) => r.kind === entry.kind && r.from === entry.from && r.to === entry.to && r.date === entry.date && r.back === entry.back;
    const list = [entry, ...readRecent().filter((r) => !same(r))].slice(0, MAX);
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage blocked: nothing to remember */
  }
}
