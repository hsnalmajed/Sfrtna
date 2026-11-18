"use client";

import { useEffect, useLayoutEffect, useState } from "react";

/**
 * First visit of «خريطتي»: a short guided tour (owner 18 Nov). Each step
 * lights one element (data-tour="…") and explains it. Skippable; shown once
 * on this device (the «؟» button replays it).
 */
export const TOUR_KEY = "sfr-mymap-tour-v1";
export const TOUR_TARGETS = ["map", "add", "views", "totals", "share"] as const;

export default function Tour({
  steps,
  labels,
  onDone,
}: {
  steps: readonly { title: string; body: string }[];
  labels: { next: string; done: string; skip: string };
  onDone: () => void;
}) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const target = TOUR_TARGETS[i];

  useLayoutEffect(() => {
    const el = document.querySelector(`[data-tour="${target}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    const measure = () => setRect(el.getBoundingClientRect());
    const id = window.setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [target]);

  const finish = () => {
    try {
      window.localStorage.setItem(TOUR_KEY, "1");
    } catch {
      /* storage off: the tour may show again */
    }
    onDone();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && finish();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const last = i === Math.min(steps.length, TOUR_TARGETS.length) - 1;
  const step = steps[i];
  const pad = 8;
  const below = rect ? rect.top + rect.height / 2 < window.innerHeight / 2 : true;

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label={step.title}>
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-3xl transition-all duration-300"
          style={{
            left: rect.left - pad,
            top: rect.top - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            boxShadow: "0 0 0 9999px rgb(2 12 25 / 0.72), 0 0 0 3px #f8b840",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-[#020c19]/70" />
      )}
      <div
        className="absolute inset-x-4 mx-auto max-w-sm rounded-3xl bg-white p-5 shadow-2xl"
        style={rect ? (below ? { top: Math.min(rect.bottom + 18, window.innerHeight - 220) } : { bottom: Math.min(window.innerHeight - rect.top + 18, window.innerHeight - 220) }) : { top: "30%" }}
      >
        <p className="text-xs font-extrabold text-[#c48a10]">
          {i + 1} / {Math.min(steps.length, TOUR_TARGETS.length)}
        </p>
        <p className="mt-1 font-display text-lg font-extrabold text-navy-950">{step.title}</p>
        <p className="mt-1 text-sm leading-7 text-navy-900/75">{step.body}</p>
        <div className="mt-4 flex items-center gap-2">
          <button type="button" onClick={finish} className="min-h-11 px-3 text-sm font-bold text-navy-900/55">
            {labels.skip}
          </button>
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => (last ? finish() : setI(i + 1))}
            className="min-h-11 rounded-full bg-[#061a33] px-6 text-sm font-extrabold text-white active:scale-95"
          >
            {last ? labels.done : labels.next}
          </button>
        </div>
      </div>
    </div>
  );
}
