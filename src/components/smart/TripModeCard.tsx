"use client";

import { useEffect, useRef, useState } from "react";
import { useDictionary } from "@/lib/dict/context";
import {
  forgetPlanInApp,
  hapticInApp,
  keepPlanInApp,
  openTripModeInApp,
  planStateInApp,
  setPlanAlertsInApp,
  tripModeInApp,
  type AppPlanState,
} from "@/lib/nativeApp";
import type { OfflinePlan } from "@/lib/tripMode";

/**
 * «وضع الرحلة» under a trip plan — shown only inside an iPhone app build
 * that has it (feature «trip-mode»); renders nothing in browsers.
 *
 * «احفظ على جوالي» hands the plan to the app (an offline page + its
 * reminders, src/lib/tripMode.ts); no account needed. Then two switches:
 * reminders, and prayer alerts in the city's time (the phone asks for
 * permission only when one is turned on). A kept plan follows the
 * traveller's swaps: `version` changes → kept again.
 */
export default function TripModeCard({
  planId,
  version,
  hasPrayers,
  make,
}: {
  planId: string;
  /** Changes whenever the days change (swaps): a kept plan is refreshed. */
  version: string;
  hasPrayers: boolean;
  make: () => Promise<OfflinePlan>;
}) {
  const t = useDictionary().tripMode;
  const [available, setAvailable] = useState(false);
  const [state, setState] = useState<AppPlanState | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const makeRef = useRef(make);
  useEffect(() => {
    makeRef.current = make;
  }, [make]);

  useEffect(() => {
    let live = true;
    void tripModeInApp().then(async (yes) => {
      if (!live || !yes) return;
      setAvailable(true);
      const s = await planStateInApp(planId);
      if (live && s) setState(s);
    });
    return () => {
      live = false;
    };
  }, [planId]);

  // A kept plan follows the swaps made after keeping it.
  const keptVersion = useRef<string | null>(null);
  useEffect(() => {
    if (!state?.kept) return;
    if (keptVersion.current === null) {
      keptVersion.current = version;
      return;
    }
    if (keptVersion.current === version) return;
    keptVersion.current = version;
    const timer = setTimeout(() => {
      void makeRef.current().then((p) => keepPlanInApp(p).catch(() => null));
    }, 800);
    return () => clearTimeout(timer);
  }, [version, state?.kept]);

  if (!available) return null;

  async function keep() {
    setBusy(true);
    setNote(null);
    try {
      const s = await keepPlanInApp(await makeRef.current());
      if (!s) throw new Error("failed");
      keptVersion.current = version;
      setState(s);
      hapticInApp("success");
    } catch (e) {
      setNote(e instanceof Error && e.message === "full" ? t.full : t.failed);
    } finally {
      setBusy(false);
    }
  }

  async function alerts(remind: boolean, prayers: boolean) {
    setBusy(true);
    setNote(null);
    const s = await setPlanAlertsInApp(planId, remind, prayers).catch(() => null);
    setBusy(false);
    if (!s) return setNote(t.failed);
    setState(s);
    if (!s.granted) setNote(t.denied);
    else if (remind || prayers) hapticInApp("light");
  }

  async function forget() {
    const s = await forgetPlanInApp(planId).catch(() => null);
    if (s) setState(s);
  }

  const toggle = (on: boolean) =>
    `flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl px-4 text-start text-sm font-extrabold ring-1 transition disabled:opacity-60 ${
      on ? "bg-sun-400 text-navy-950 ring-sun-400" : "bg-white/10 text-white ring-white/25"
    }`;
  const chip = "inline-flex min-h-10 items-center rounded-full bg-white/10 px-4 text-sm font-bold text-white ring-1 ring-white/25 active:bg-white/20";

  return (
    <section className="mt-4 rounded-3xl bg-navy-900 p-4 text-white print:hidden" aria-label={t.title}>
      <p className="flex flex-wrap items-center gap-2 font-display text-base font-extrabold">
        📲 {t.title}
        <span className="rounded-full bg-sun-400 px-2.5 py-0.5 text-[11px] font-extrabold text-navy-950">{t.appOnly}</span>
      </p>
      {!state?.kept ? (
        <>
          <p className="mt-1.5 text-[13px] leading-relaxed text-white/80">{t.pitch}</p>
          <button
            type="button"
            onClick={keep}
            disabled={busy}
            className="mt-3 min-h-11 rounded-full bg-sun-400 px-5 text-sm font-extrabold text-navy-950 active:bg-sun-300 disabled:opacity-60"
          >
            {busy ? t.keeping : t.keep}
          </button>
        </>
      ) : (
        <>
          <p className="mt-1.5 text-sm font-bold text-emerald-300">{t.kept}</p>
          <div className="mt-3 space-y-2">
            <button type="button" aria-pressed={state.remind} disabled={busy} onClick={() => alerts(!state.remind, state.prayers)} className={toggle(state.remind)}>
              <span>{t.remind}</span>
              <span aria-hidden="true">{state.remind ? "✓" : "○"}</span>
            </button>
            {hasPrayers && (
              <button type="button" aria-pressed={state.prayers} disabled={busy} onClick={() => alerts(state.remind, !state.prayers)} className={toggle(state.prayers)}>
                <span>{t.prayers}</span>
                <span aria-hidden="true">{state.prayers ? "✓" : "○"}</span>
              </button>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => openTripModeInApp(planId)} className={chip}>
              {t.open}
            </button>
            <button type="button" onClick={() => openTripModeInApp("qibla")} className={chip}>
              {t.qibla}
            </button>
            <button type="button" onClick={() => openTripModeInApp("mosques")} className={chip}>
              {t.mosques}
            </button>
            <button type="button" onClick={() => openTripModeInApp("halal")} className={chip}>
              {t.halal}
            </button>
          </div>
          <button type="button" onClick={forget} className="mt-3 text-xs font-bold text-white/60 underline underline-offset-4">
            {t.forget}
          </button>
        </>
      )}
      {note && (
        <p role="alert" className="mt-2 text-[13px] font-bold text-sun-300">
          {note}
        </p>
      )}
    </section>
  );
}
