"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import DateRangeInput from "@/components/DateRangeInput";
import SmartPlanView from "@/components/smart/SmartPlanView";
import { track } from "@/lib/analytics";
import type { PlanAnswers, SmartPlan } from "@/lib/ai/plan";

const COMPANY = ["solo", "couple", "family_kids", "family_adults", "friends", "seniors"] as const;
const INTERESTS = ["landmarks", "museums", "nature", "shopping", "adventure", "beaches", "local_life", "kids_fun", "photography", "food", "nightlife_calm", "wellness"] as const;
const PACE = ["relaxed", "balanced", "packed"] as const;
const START = ["early", "normal", "late"] as const;
const FOOD = ["local", "international", "fine", "quick"] as const;
const MOVE = ["walk_transit", "taxi", "car"] as const;
const SPEND = ["budget", "mid", "luxury"] as const;

type Step = "dates" | "company" | "interests" | "day" | "food" | "move" | "about";
const STEPS: Step[] = ["dates", "company", "interests", "day", "food", "move", "about"];

const blank: PlanAnswers = {
  company: "couple",
  interests: [],
  pace: "balanced",
  start: "normal",
  lateNights: false,
  halalOnly: true,
  food: ["local"],
  vegetarian: false,
  move: "taxi",
  spend: "mid",
  firstVisit: true,
  note: "",
};

/**
 * «خطتي الذكية» on a city page: a card that opens a short set of questions
 * (one screen each, tap answers), then the plan (src/lib/ai/plan.ts). Shown
 * only when the AI is switched on (/api/ai/status).
 */
export default function SmartPlanner({ locale, code, slug, cityName }: { locale: Locale; code: string; slug: string; cityName: string }) {
  const t = useDictionary().smart;
  const [on, setOn] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [a, setA] = useState<PlanAnswers>(blank);
  const [state, setState] = useState<"ask" | "building" | "done" | "error">("ask");
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<SmartPlan | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    fetch("/api/ai/status")
      .then((r) => r.json() as Promise<{ on: boolean }>)
      .then((j) => live && setOn(j.on))
      .catch(() => {});
    // Dates from the address (a search's «خطة سياحية» tab).
    const q = new URLSearchParams(window.location.search);
    const f = q.get("from");
    const tt = q.get("to");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the address once
    if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) setFrom(f);
    if (tt && /^\d{4}-\d{2}-\d{2}$/.test(tt)) setTo(tt);
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Printing the plan prints only the plan (globals.css → plan-open).
    document.body.classList.add("plan-open");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && state !== "building" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.body.classList.remove("plan-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [open, state]);

  useEffect(() => {
    if (state !== "building") return;
    const id = window.setInterval(() => setTick((n) => n + 1), 3500);
    return () => window.clearInterval(id);
  }, [state]);

  const days = from && to ? Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1 : 0;
  const can = useMemo(() => {
    const s = STEPS[step];
    if (s === "dates") return days >= 1 && days <= 14;
    if (s === "interests") return a.interests.length > 0;
    return true;
  }, [step, days, a.interests.length]);

  async function build() {
    setState("building");
    setTick(0);
    track("ai_plan_start", { city: slug, days });
    try {
      const res = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, slug, from, to, locale, answers: a }),
      });
      const j = (await res.json()) as { ok: boolean; plan?: SmartPlan; reason?: string };
      if (j.ok && j.plan) {
        setPlan(j.plan);
        setState("done");
        track("ai_plan_done", { city: slug, days });
        return;
      }
      setError(j.reason === "busy" ? t.busy : j.reason === "off" ? t.off : t.failed);
    } catch {
      setError(t.failed);
    }
    track("service_failure", { service: "ai_plan" });
    setState("error");
  }

  if (!on) return null;

  const chip = (sel: boolean) =>
    `min-h-11 rounded-2xl px-4 py-2.5 text-sm font-bold ring-1 transition text-start ${
      sel ? "bg-navy-900 text-white ring-navy-900" : "bg-white text-navy-900 ring-mist-300 hover:ring-navy-300"
    }`;
  const toggle = <K extends "interests" | "food">(k: K, v: PlanAnswers[K][number], max: number) =>
    setA((p) => {
      const list = p[k] as string[];
      const next = list.includes(v) ? list.filter((x) => x !== v) : list.length >= max ? list : [...list, v];
      return { ...p, [k]: next };
    });

  const question = (() => {
    switch (STEPS[step]) {
      case "dates":
        return (
          <>
            <h3 className="font-display text-xl font-extrabold text-navy-950">{t.datesQ}</h3>
            <p className="mt-1 text-sm text-navy-500">{t.datesHint}</p>
            <div className="mt-4">
              <DateRangeInput
                purpose="trip"
                locale={locale}
                departDate={from}
                returnDate={to}
                withReturn
                onChange={({ departDate, returnDate }) => {
                  setFrom(departDate);
                  setTo(returnDate);
                }}
              />
            </div>
          </>
        );
      case "company":
        return (
          <>
            <h3 className="font-display text-xl font-extrabold text-navy-950">{t.companyQ}</h3>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {COMPANY.map((c) => (
                <button key={c} type="button" className={chip(a.company === c)} onClick={() => setA({ ...a, company: c })}>
                  {t.company[c]}
                </button>
              ))}
            </div>
            {a.company === "family_kids" && (
              <div className="mt-5">
                <p className="text-sm font-bold text-navy-800">{t.kidsAgesQ}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {Array.from({ length: 18 }, (_, n) => n).map((n) => {
                    const sel = (a.kidsAges ?? []).includes(n);
                    return (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={sel}
                        onClick={() => setA({ ...a, kidsAges: sel ? (a.kidsAges ?? []).filter((x) => x !== n) : [...(a.kidsAges ?? []), n].slice(0, 6) })}
                        className={`h-10 w-10 rounded-full text-sm font-bold ring-1 ${sel ? "bg-sun-400 text-navy-950 ring-sun-400" : "bg-white text-navy-800 ring-mist-300"}`}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        );
      case "interests":
        return (
          <>
            <h3 className="font-display text-xl font-extrabold text-navy-950">{t.interestsQ}</h3>
            <p className="mt-1 text-sm text-navy-500">{t.interestsHint}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {INTERESTS.map((i) => (
                <button key={i} type="button" aria-pressed={a.interests.includes(i)} className={chip(a.interests.includes(i))} onClick={() => toggle("interests", i, 6)}>
                  {t.interests[i]}
                </button>
              ))}
            </div>
          </>
        );
      case "day":
        return (
          <>
            <h3 className="font-display text-xl font-extrabold text-navy-950">{t.paceQ}</h3>
            <div className="mt-3 grid gap-2">
              {PACE.map((p) => (
                <button key={p} type="button" className={chip(a.pace === p)} onClick={() => setA({ ...a, pace: p })}>
                  {t.pace[p]}
                </button>
              ))}
            </div>
            <h3 className="mt-6 font-display text-lg font-extrabold text-navy-950">{t.startQ}</h3>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {START.map((s) => (
                <button key={s} type="button" className={`${chip(a.start === s)} !px-2 text-center`} onClick={() => setA({ ...a, start: s })}>
                  {t.start[s]}
                </button>
              ))}
            </div>
            <label className="mt-4 flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl bg-white px-4 ring-1 ring-mist-300">
              <input type="checkbox" checked={a.lateNights} onChange={(e) => setA({ ...a, lateNights: e.target.checked })} className="h-5 w-5 accent-navy-900" />
              <span className="text-sm font-bold text-navy-900">{t.lateNights}</span>
            </label>
          </>
        );
      case "food":
        return (
          <>
            <h3 className="font-display text-xl font-extrabold text-navy-950">{t.foodQ}</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" aria-pressed={a.halalOnly} className={chip(a.halalOnly)} onClick={() => setA({ ...a, halalOnly: !a.halalOnly })}>
                {a.halalOnly ? "✓ " : ""}
                {t.halalOnly}
              </button>
              <button type="button" aria-pressed={a.vegetarian} className={chip(a.vegetarian)} onClick={() => setA({ ...a, vegetarian: !a.vegetarian })}>
                {a.vegetarian ? "✓ " : ""}
                {t.vegetarian}
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {FOOD.map((f) => (
                <button key={f} type="button" aria-pressed={a.food.includes(f)} className={chip(a.food.includes(f))} onClick={() => toggle("food", f, 4)}>
                  {a.food.includes(f) ? "✓ " : ""}
                  {t.food[f]}
                </button>
              ))}
            </div>
          </>
        );
      case "move":
        return (
          <>
            <h3 className="font-display text-xl font-extrabold text-navy-950">{t.moveQ}</h3>
            <div className="mt-3 grid gap-2">
              {MOVE.map((m) => (
                <button key={m} type="button" className={chip(a.move === m)} onClick={() => setA({ ...a, move: m })}>
                  {t.move[m]}
                </button>
              ))}
            </div>
            <h3 className="mt-6 font-display text-lg font-extrabold text-navy-950">{t.spendQ}</h3>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {SPEND.map((s) => (
                <button key={s} type="button" className={`${chip(a.spend === s)} text-center`} onClick={() => setA({ ...a, spend: s })}>
                  {t.spend[s]}
                </button>
              ))}
            </div>
          </>
        );
      case "about":
        return (
          <>
            <h3 className="font-display text-xl font-extrabold text-navy-950">{t.firstVisitQ}</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" className={chip(a.firstVisit)} onClick={() => setA({ ...a, firstVisit: true })}>
                {t.firstVisitYes}
              </button>
              <button type="button" className={chip(!a.firstVisit)} onClick={() => setA({ ...a, firstVisit: false })}>
                {t.firstVisitNo}
              </button>
            </div>
            <label className="mt-6 block font-display text-lg font-extrabold text-navy-950" htmlFor="smart-note">
              {t.noteQ}
            </label>
            <textarea
              id="smart-note"
              rows={3}
              maxLength={200}
              value={a.note}
              onChange={(e) => setA({ ...a, note: e.target.value })}
              placeholder={t.notePlaceholder}
              className="mt-3 w-full rounded-2xl border border-mist-300 bg-white px-4 py-3 text-base text-navy-900 outline-none focus:border-sea-500 focus:ring-2 focus:ring-sea-200"
            />
          </>
        );
    }
  })();

  const last = step === STEPS.length - 1;
  const overlay = (
    <div className="plan-root fixed inset-0 z-[75] flex flex-col bg-mist-50" role="dialog" aria-modal="true" aria-label={t.title.replace("{city}", cityName)}>
      <div className="flex items-center justify-between gap-3 bg-navy-950 px-4 py-3 text-white print:hidden">
        <p className="min-w-0 truncate font-display text-base font-extrabold">✨ {t.title.replace("{city}", cityName)}</p>
        {state !== "building" && (
          <button type="button" onClick={() => setOpen(false)} aria-label={t.close} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
            ✕
          </button>
        )}
      </div>

      {state === "done" && plan ? (
        <div className="flex-1 overflow-y-auto">
          <SmartPlanView
            locale={locale}
            plan={plan}
            onNew={() => {
              setPlan(null);
              setState("ask");
              setStep(0);
            }}
          />
        </div>
      ) : state === "building" ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <div className="sfr-flight-track mb-6 w-full max-w-xs" aria-hidden="true" />
          <p className="font-display text-xl font-extrabold text-navy-950">{t.building}</p>
          <ul className="mt-5 space-y-2 text-start">
            {t.buildingSteps.map((s, i) => {
              const at = Math.min(tick, t.buildingSteps.length - 1);
              return (
                <li key={s} className={`flex items-center gap-2 text-sm font-bold ${i < at ? "text-emerald-700" : i === at ? "text-navy-900" : "text-navy-300"}`}>
                  <span aria-hidden="true">{i < at ? "✓" : i === at ? "•" : "○"}</span>
                  {s}
                </li>
              );
            })}
          </ul>
          <p className="mt-6 text-xs text-navy-500">{t.buildingNote}</p>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-5">
            <div className="mx-auto max-w-lg">
              {step === 0 && <p className="mb-5 rounded-2xl bg-sea-50 px-4 py-3 text-sm leading-relaxed text-navy-800 ring-1 ring-sea-100">{t.intro}</p>}
              <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-mist-200" aria-hidden="true">
                <div className="h-full rounded-full bg-sun-400 transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
              </div>
              <p className="mb-2 text-xs font-bold text-navy-500">{t.stepOf.replace("{n}", String(step + 1)).replace("{total}", String(STEPS.length))}</p>
              {question}
              {state === "error" && (
                <p role="alert" className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                  {error}
                </p>
              )}
            </div>
          </div>
          <div className="border-t border-mist-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto flex max-w-lg gap-2">
              {step > 0 && (
                <button type="button" onClick={() => setStep(step - 1)} className="min-h-12 rounded-full px-5 font-bold text-navy-700 ring-1 ring-mist-300">
                  {t.back}
                </button>
              )}
              <button
                type="button"
                disabled={!can}
                onClick={() => (last ? build() : setStep(step + 1))}
                className="min-h-12 flex-1 rounded-full bg-sun-400 px-5 font-extrabold text-navy-950 shadow-[var(--shadow-sun)] transition hover:bg-sun-300 disabled:opacity-50"
              >
                {last ? (state === "error" ? t.retry : t.build) : t.next}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          if (state === "error") setState("ask");
        }}
        className="flex flex-1 items-start gap-3 rounded-2xl bg-sun-400 px-4 py-3.5 text-start text-navy-950 shadow-[var(--shadow-sun)] ring-1 ring-sun-400 transition hover:bg-sun-300"
      >
        <span className="text-2xl leading-none" aria-hidden="true">
          🤖
        </span>
        <span>
          <span className="flex items-center gap-2 font-display font-extrabold">
            {t.cardTitle}
            <span className="rounded-full bg-navy-950 px-2 py-0.5 text-[10px] font-extrabold text-sun-300">{t.badge}</span>
          </span>
          <span className="mt-0.5 block text-xs text-navy-900/75">{t.cardHint}</span>
        </span>
      </button>
      {open && createPortal(overlay, document.body)}
    </>
  );
}
