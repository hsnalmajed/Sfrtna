"use client";

import { useEffect, useState } from "react";
import { useDictionary } from "@/lib/dict/context";
import { openPlanner } from "@/lib/planEvents";

const KEY = "sfr-welcome-v1";

/**
 * The app's first launch (owner, 20 Oct: "show the app's value in a few
 * simple steps — people want everything in one place"): three short cards,
 * once, skippable, ending on the search. Only inside the app.
 */
export default function AppWelcome() {
  const t = useDictionary().appWelcome;
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    if (!document.documentElement.classList.contains("in-app")) return;
    try {
      if (window.localStorage.getItem(KEY)) return;
    } catch {
      return;
    }
    const id = window.setTimeout(() => setStep(0), 400);
    return () => window.clearTimeout(id);
  }, []);

  if (step === null) return null;
  const cards = [
    { icon: "✈️", title: t.s1Title, body: t.s1Body, points: t.s1Points },
    { icon: "🏨", title: t.s2Title, body: t.s2Body, points: t.s2Points },
    { icon: "🧭", title: t.s3Title, body: t.s3Body, points: t.s3Points },
  ];
  const done = (search: boolean) => {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {}
    setStep(null);
    if (search) openPlanner();
  };
  const card = cards[step];
  const last = step === cards.length - 1;
  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-navy-990 px-6 pb-[calc(1.5rem+var(--safe-area-inset-bottom,0px))] pt-[calc(1.5rem+var(--safe-area-inset-top,0px))] text-white" role="dialog" aria-modal="true" aria-label={card.title}>
      <button type="button" onClick={() => done(false)} className="self-end rounded-full px-3 py-1.5 text-sm font-bold text-white/70">
        {t.skip}
      </button>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto py-2 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-sun-400/15 text-5xl ring-1 ring-sun-400/40" aria-hidden="true">
          {card.icon}
        </span>
        <h2 className="mt-6 font-display text-2xl font-black">{card.title}</h2>
        <p className="mt-3 max-w-xs text-base leading-relaxed text-white/75">{card.body}</p>
        {/* Each feature on its own line, so it reads at a glance. */}
        <ul className="mt-5 w-full max-w-xs space-y-2.5 text-start">
          {card.points.map((p) => (
            <li key={p} className="flex items-start gap-2.5 rounded-xl bg-white/[0.06] px-3.5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/10">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sun-400 text-[11px] font-black text-navy-950" aria-hidden="true">
                ✓
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className="mb-5 flex justify-center gap-2" aria-hidden="true">
        {cards.map((_, i) => (
          <span key={i} className={`h-2 rounded-full transition-all ${i === step ? "w-6 bg-sun-400" : "w-2 bg-white/25"}`} />
        ))}
      </div>
      <button
        type="button"
        onClick={() => (last ? done(true) : setStep(step + 1))}
        className="w-full rounded-2xl bg-sun-400 px-5 py-4 text-base font-extrabold text-navy-950"
      >
        {last ? t.start : t.next}
      </button>
    </div>
  );
}
