"use client";

/**
 * Who is signed in, for any component (asked once per page load from
 * /api/auth/me, shared by every caller). Pages are cached at the edge for
 * everyone, so this is always asked by the browser, never rendered in.
 */

import { useEffect, useSyncExternalStore } from "react";

export interface AccountUser {
  id: string;
  email: string | null;
  name: string | null;
  google: boolean;
}

export interface AccountState {
  status: "loading" | "ready";
  user: AccountUser | null;
  methods: { google: string | null; email: boolean };
}

const initial: AccountState = { status: "loading", user: null, methods: { google: null, email: false } };
let state: AccountState = initial;
let asked = false;
const listeners = new Set<() => void>();

function set(next: AccountState) {
  state = next;
  listeners.forEach((l) => l());
}

export async function refreshAccount(): Promise<AccountState> {
  asked = true;
  try {
    const res = await fetch("/api/auth/me", { cache: "no-store" });
    const json = (await res.json()) as { user: AccountUser | null; methods: AccountState["methods"] };
    set({ status: "ready", user: json.user, methods: json.methods });
  } catch {
    set({ status: "ready", user: null, methods: { google: null, email: false } });
  }
  return state;
}

export function setSignedIn(user: AccountUser | null) {
  set({ ...state, status: "ready", user });
}

export function useAccount(): AccountState {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => initial
  );
  useEffect(() => {
    if (!asked) void refreshAccount();
  }, []);
  return s;
}

/** A plan waiting to be saved once the traveller has signed in. */
export const PENDING_PLAN_KEY = "sfr-pending-plan";
