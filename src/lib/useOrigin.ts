"use client";

import { useEffect } from "react";
import type { OriginInfo } from "@/lib/originInfo";

let pending: Promise<OriginInfo | null> | null = null;

/** This visitor's departure airport (see /api/origin), asked once per page load. */
export function fetchUserOrigin(): Promise<OriginInfo | null> {
  if (!pending) {
    pending = fetch("/api/origin")
      .then((r) => (r.ok ? (r.json() as Promise<OriginInfo>) : null))
      .catch(() => null);
  }
  return pending;
}

/**
 * Fills an empty "from" field with the visitor's own airport — the nearest
 * one to them, or the one they chose — so a search from Al-Ahsa opens on
 * Dammam. A field that already has a value (from the address, or typed) is
 * left alone.
 */
export function useDefaultOrigin(current: string, set: (iata: string) => void): void {
  useEffect(() => {
    if (current) return;
    let live = true;
    fetchUserOrigin().then((o) => {
      if (live && o) set(o.iata);
    });
    return () => {
      live = false;
    };
    // Only on arrival: once the traveller edits the field it is theirs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
