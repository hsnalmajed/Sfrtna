"use client";

/**
 * The signed-in traveller's kept items (src/lib/memberItems.ts), loaded once
 * per page and shared by every component: the account page, the hearts on
 * cities and hotels, the search forms (profile), the upcoming-trip card.
 * Signed out, everything here is empty and every write is refused — the
 * caller then offers to sign in (JoinSheet).
 */

import { useEffect, useSyncExternalStore } from "react";
import { currentUserId, useAccount } from "@/lib/useAccount";
import {
  favCityKey,
  favHotelKey,
  searchKey,
  tripKey,
  type Fav,
  type ItemKind,
  type Profile,
  type SavedSearch,
  type Trip,
} from "@/lib/memberItems";

export interface Item<T = unknown> {
  kind: ItemKind;
  key: string;
  created: number;
  data: T;
}

interface MemberState {
  status: "idle" | "loading" | "ready";
  items: Item[];
}

const empty: MemberState = { status: "idle", items: [] };
let state: MemberState = empty;
let loadedFor: string | null = null;
const listeners = new Set<() => void>();
const set = (next: MemberState) => {
  state = next;
  listeners.forEach((l) => l());
};

async function load(userId: string) {
  loadedFor = userId;
  set({ status: "loading", items: state.items });
  try {
    const res = await fetch("/api/me/items", { cache: "no-store" });
    const json = (await res.json()) as { ok: boolean; items?: Item[] };
    set({ status: "ready", items: json.ok && json.items ? json.items : [] });
  } catch {
    set({ status: "ready", items: [] });
  }
}

async function put(kind: ItemKind, key: string, data: unknown): Promise<boolean> {
  const before = state.items;
  const now = Date.now();
  const kept = before.find((i) => i.kind === kind && i.key === key);
  set({
    ...state,
    items: [{ kind, key, data, created: kept && kind !== "search" ? kept.created : now }, ...before.filter((i) => !(i.kind === kind && i.key === key))],
  });
  try {
    const res = await fetch("/api/me/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, key, data }) });
    if (res.ok) return true;
  } catch {
    /* fall through */
  }
  set({ ...state, items: before });
  return false;
}

async function remove(kind: ItemKind, key: string): Promise<boolean> {
  const before = state.items;
  set({ ...state, items: before.filter((i) => !(i.kind === kind && i.key === key)) });
  try {
    const res = await fetch("/api/me/items/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, key }) });
    if (res.ok) return true;
  } catch {
    /* fall through */
  }
  set({ ...state, items: before });
  return false;
}

export function useMember() {
  const account = useAccount();
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => empty
  );
  const userId = account.user?.id ?? null;
  useEffect(() => {
    if (userId && loadedFor !== userId) void load(userId);
    if (!userId && account.status === "ready" && loadedFor) {
      loadedFor = null;
      set(empty);
    }
  }, [userId, account.status]);

  const of = <T,>(kind: ItemKind) => s.items.filter((i) => i.kind === kind) as Item<T>[];
  const signedIn = Boolean(userId);
  return {
    signedIn,
    ready: signedIn && s.status === "ready",
    profile: (s.items.find((i) => i.kind === "profile")?.data as Profile | undefined) ?? null,
    favs: of<Fav>("fav"),
    searches: of<SavedSearch>("search"),
    trips: of<Trip>("trip"),
    isFav: (key: string) => s.items.some((i) => i.kind === "fav" && i.key === key),
    setProfile: (p: Profile) => (signedIn ? put("profile", "me", p) : Promise.resolve(false)),
    toggleFav: (fav: Fav) => {
      if (!signedIn) return Promise.resolve(false);
      const key = fav.type === "city" ? favCityKey(fav.code, fav.slug) : favHotelKey(fav.name, fav.area);
      return s.items.some((i) => i.kind === "fav" && i.key === key) ? remove("fav", key) : put("fav", key, fav);
    },
    saveSearch: (q: SavedSearch) => (signedIn ? put("search", searchKey(q), q) : Promise.resolve(false)),
    saveTrip: (t: Trip) => (signedIn ? put("trip", tripKey(t), t) : Promise.resolve(false)),
    remove: (kind: ItemKind, key: string) => (signedIn ? remove(kind, key) : Promise.resolve(false)),
  };
}

/** For code outside React (the search forms' submit): keep a search when signed in. */
export function rememberSearchInAccount(q: SavedSearch): void {
  if (!currentUserId()) return;
  void put("search", searchKey(q), q);
}

/**
 * Starts a search form from the traveller's profile, once, when the form
 * opened empty (not from an "edit search" link, which carries its own
 * answers). Later edits are the traveller's own.
 */
export function useProfileOnce(fresh: boolean, apply: (p: Profile) => void): void {
  const { profile } = useMember();
  useEffect(() => {
    if (!fresh || !profile || appliedOnce.has(apply)) return;
    appliedOnce.add(apply);
    apply(profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the first profile counts
  }, [profile, fresh]);
}
const appliedOnce = new WeakSet<object>();
