"use client";

/**
 * «رحلتي» — the trip the traveller is getting ready now (owner's relatives,
 * 23 Oct: "the features are not found without someone explaining them, and
 * there is too much moving between tabs"). One trip, kept in this browser
 * for everyone (no account needed), set by the last flight search with a
 * destination and dates; each step of getting ready is ticked when the
 * traveller opens it (NextStepTabs.markStep) or ticks it by hand.
 * Signed in, «احجز» also keeps it in the account («رحلاتي», every device).
 */

import { useSyncExternalStore } from "react";
import { TRIP_STEPS, type Trip, type TripStep } from "@/lib/memberItems";
import { tripSteps } from "@/components/member/tripLinks";

const KEY = "sfr-my-trip-v1";
export const MY_TRIP_EVENT = "sfr:my-trip";

export interface MyTrip extends Trip {
  /** The live flight search it came from (path + query). */
  flightUrl?: string;
  /** «احجز» was pressed on one of its flights. */
  picked?: boolean;
  /** When the trip was last set from a search. */
  at: number;
}

let cache: { raw: string | null; trip: MyTrip | null } = { raw: null, trip: null };

function read(): MyTrip | null {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (raw === cache.raw) return cache.trip;
  let trip: MyTrip | null = null;
  try {
    const t = raw ? (JSON.parse(raw) as MyTrip) : null;
    const today = new Date().toISOString().slice(0, 10);
    // A trip that is over is not "my trip" any more.
    if (t && typeof t.depart === "string" && (t.back || t.depart) >= today) trip = { ...t, done: (t.done || []).filter((d) => (TRIP_STEPS as readonly string[]).includes(d)) };
  } catch {
    trip = null;
  }
  cache = { raw, trip };
  return trip;
}

function write(trip: MyTrip | null) {
  try {
    if (trip) window.localStorage.setItem(KEY, JSON.stringify(trip));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* storage off: the page still works for this visit */
  }
  window.dispatchEvent(new Event(MY_TRIP_EVENT));
}

const same = (a: Pick<Trip, "origin" | "destination" | "depart" | "back">, b: Pick<Trip, "origin" | "destination" | "depart" | "back">) =>
  a.origin === b.origin && a.destination === b.destination && a.depart === b.depart && (a.back || "") === (b.back || "");

/** The flight results page sets it; the same route and dates keep their ticks. */
export function setMyTrip(t: Omit<MyTrip, "at" | "done" | "booked" | "picked"> & Partial<Pick<MyTrip, "done" | "booked" | "picked">>) {
  const before = read();
  const keep = before && same(before, t) ? before : null;
  write({
    ...t,
    done: t.done ?? keep?.done ?? [],
    booked: t.booked ?? keep?.booked ?? false,
    picked: t.picked ?? keep?.picked ?? false,
    at: Date.now(),
  });
}

export function updateMyTrip(change: (t: MyTrip) => MyTrip) {
  const t = read();
  if (t) write(change(t));
}

export function toggleMyTripStep(step: TripStep, on?: boolean) {
  updateMyTrip((t) => {
    const has = t.done.includes(step);
    const want = on ?? !has;
    return { ...t, done: want ? [...new Set([...t.done, step])] : t.done.filter((d) => d !== step) };
  });
}

/** From NextStepTabs.markStep: a step opened for a city ticks it on this trip. */
export function markMyTripForCity(slug: string, step: string) {
  const t = read();
  if (!t || t.slug !== slug) return;
  if (step === "flight") {
    if (!t.picked) write({ ...t, picked: true });
    return;
  }
  if ((TRIP_STEPS as readonly string[]).includes(step) && !t.done.includes(step as TripStep)) {
    write({ ...t, done: [...t.done, step as TripStep] });
  }
}

export function clearMyTrip() {
  write(null);
}

function subscribe(l: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) l();
  };
  window.addEventListener(MY_TRIP_EVENT, l);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(MY_TRIP_EVENT, l);
    window.removeEventListener("storage", onStorage);
  };
}

/** The current trip, or null; always null on the server's first render. */
export function useMyTrip(): MyTrip | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** Every step of this trip, the flight first: what «جاهزيتك» counts. */
export function myTripProgress(t: MyTrip): { done: number; total: number; next: TripStep | "flight" | null } {
  const steps = tripSteps(t);
  const flightDone = t.booked;
  const done = steps.filter((s) => t.done.includes(s)).length + (flightDone ? 1 : 0);
  const next = !flightDone ? "flight" : steps.find((s) => !t.done.includes(s)) ?? null;
  return { done, total: steps.length + 1, next };
}

