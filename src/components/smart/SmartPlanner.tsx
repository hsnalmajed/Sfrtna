"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import DateRangeInput from "@/components/DateRangeInput";
import HotelCityInput from "@/components/HotelCityInput";
import SmartPlanView from "@/components/smart/SmartPlanView";
import { track } from "@/lib/analytics";
import type { PlanAnswers, SmartPlan } from "@/lib/ai/plan";

const COMPANY = ["solo", "couple", "family_kids", "family_adults", "friends", "seniors"] as const;
const INTERESTS = ["famous", "history", "islamic", "museums", "art", "oldtown", "nature", "mountains", "beaches", "relax", "kids", "malls", "souqs", "food", "modern", "photo", "night", "churches"] as const;
const PACE = ["relaxed", "balanced", "packed"] as const;
const START = ["early", "normal", "late"] as const;
const FOOD = ["local", "international", "fine", "quick"] as const;
const MOVE = ["walk_transit", "taxi", "car"] as const;
const SPEND = ["budget", "mid", "luxury"] as const;
const DAY_PART = ["morning", "noon", "evening"] as const;
const NEEDS = ["prayer", "avoid_crowds", "free_first", "less_walking", "stroller", "wheelchair"] as const;

type Step = "where" | "dates" | "company" | "interests" | "day" | "food" | "move" | "about";

/** Opens the planner on a city page from anywhere on it (e.g. «أنشئ لي خطة»). */
export const SMART_OPEN_EVENT = "sfr-smart-open";

const blank: PlanAnswers = {
  company: "couple",
  interests: ["famous"],
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
  arrive: "morning",
  leave: "evening",
  needs: ["prayer"],
};

/**
 * «خطتي الذكية»: short questions (one screen each, tap answers), then the
 * plan (src/lib/guidePlan.ts — our own engine on our stored guide). Two forms:
 *   - on a city page: a card that opens the questions full screen;
 *   - standalone (travel tools → the trip plan, the app's «المزيد»): the
 *     questions on the page itself, the city asked first.
 */
export default function SmartPlanner({
  locale,
  code: fixedCode,
  slug: fixedSlug,
  cityName: fixedName,
  standalone = false,
  initial,
}: {
  locale: Locale;
  code?: string;
  slug?: string;
  cityName?: string;
  standalone?: boolean;
  /** Standalone: a city and dates already known (from a search). */
  initial?: { code?: string; slug?: string; cityName?: string; from?: string; to?: string };
}) {
  const t = useDictionary().smart;
  const steps: Step[] = useMemo(
    () => (standalone ? ["where", "dates", "company", "interests", "day", "food", "move", "about"] : ["dates", "company", "interests", "day", "food", "move", "about"]),
    [standalone]
  );
  const [city, setCity] = useState<{ code: string; slug: string; name: string } | null>(
    fixedSlug && fixedCode ? { code: fixedCode, slug: fixedSlug, name: fixedName ?? "" } : initial?.slug && initial.code ? { code: initial.code, slug: initial.slug, name: initial.cityName ?? "" } : null
  );
  const [cityText, setCityText] = useState(initial?.cityName ?? "");
  const [ready, setReady] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [from, setFrom] = useState(initial?.from ?? "");
  const [to, setTo] = useState(initial?.to ?? "");
  const [a, setA] = useState<PlanAnswers>(blank);
  const [state, setState] = useState<"ask" | "building" | "done" | "error">("ask");
  const [error, setError] = useState("");
  const [plan, setPlan] = useState<SmartPlan | null>(null);
  const [tick, setTick] = useState(0);

  // Is the plan ready for this city (our guide has its places written up)?
  useEffect(() => {
    if (!city) return;
    let live = true;
    fetch(`/api/ai/status?city=${encodeURIComponent(city.slug)}`)
      .then((r) => r.json() as Promise<{ on: boolean }>)
      .then((j) => live && setReady(j.on))
      .catch(() => live && setReady(false));
    return () => {
      live = false;
    };
  }, [city]);

  // City page: dates from the address, and «أنشئ لي» (or ?mode=auto) opens it.
  useEffect(() => {
    if (standalone) return;
    const q = new URLSearchParams(window.location.search);
    const f = q.get("from");
    const tt = q.get("to");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read the address once
    if (f && /^\d{4}-\d{2}-\d{2}$/.test(f)) setFrom(f);
    if (tt && /^\d{4}-\d{2}-\d{2}$/.test(tt)) setTo(tt);
    if (q.get("mode") === "auto") setOpen(true);
    const onOpen = () => setOpen(true);
    window.addEventListener(SMART_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(SMART_OPEN_EVENT, onOpen);
  }, [standalone]);

  // The full-screen layer: questions on a city page; the plan everywhere.
  const layer = open || state === "done";
  useEffect(() => {
    if (!layer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Printing the plan prints only the plan (globals.css → plan-open).
    document.body.classList.add("plan-open");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && state !== "building" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.body.classList.remove("plan-open");
      window.removeEventListener("keydown", onKey);
    };
  });

  useEffect(() => {
    if (state !== "building") return;
    const id = window.setInterval(() => setTick((n) => n + 1), 700);
    return () => window.clearInterval(id);
  }, [state]);

  function close() {
    setOpen(false);
    if (state === "done") setState("ask");
  }

  const days = from && to ? Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1 : 0;
  const can = useMemo(() => {
    const s = steps[step];
    if (s === "where") return Boolean(city) && ready === true;
    if (s === "dates") return days >= 1 && days <= 14;
    if (s === "interests") return a.interests.length > 0;
    return true;
  }, [steps, step, city, ready, days, a.interests.length]);

  async function build() {
    if (!city) return;
    setState("building");
    setTick(0);
    track("ai_plan_start", { city: city.slug, days, standalone });
    const started = Date.now();
    try {
      const res = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: city.code, slug: city.slug, from, to, locale, answers: a }),
      });
      const j = (await res.json()) as { ok: boolean; plan?: SmartPlan; reason?: string };
      if (j.ok && j.plan) {
        // A short moment on the building screen, so the steps can be read.
        await new Promise((r) => setTimeout(r, Math.max(0, 2600 - (Date.now() - started))));
        setPlan(j.plan);
        setState("done");
        track("ai_plan_done", { city: city.slug, days, interests: a.interests.join(","), needs: (a.needs ?? []).join(",") });
        return;
      }
      setError(j.reason === "busy" ? t.busy : j.reason === "off" ? t.off : t.failed);
    } catch {
      setError(t.failed);
    }
    track("service_failure", { service: "ai_plan" });
    setState("error");
  }

  if (!standalone && (!city || ready !== true)) return null;

  const chip = (sel: boolean) =>
    `min-h-11 rounded-2xl px-4 py-2.5 text-sm font-bold ring-1 transition text-start ${
      sel ? "bg-navy-900 text-white ring-navy-900" : "bg-white text-navy-900 ring-mist-300 hover:ring-navy-300"
    }`;
  const toggle = <K extends "interests" | "food" | "needs">(k: K, v: string, max: number) =>
    setA((p) => {
      const list = (p[k] ?? []) as string[];
      const next = list.includes(v) ? list.filter((x) => x !== v) : list.length >= max ? list : [...list, v];
      return { ...p, [k]: next };
    });
  const dayPart = (key: "arrive" | "leave") => (
    <div className="mt-2 grid grid-cols-3 gap-2">
      {DAY_PART.map((d) => (
        <button key={d} type="button" className={`${chip(a[key] === d)} !px-2 text-center`} onClick={() => setA({ ...a, [key]: d })}>
          {t.dayPart[d]}
        </button>
      ))}
    </div>
  );

  const question = (() => {
    switch (steps[step]) {
      case "where":
        return (
          <>
            <h3 className="font-display text-xl font-extrabold text-navy-950">{t.whereQ}</h3>
            <p className="mt-1 text-sm text-navy-500">{t.whereHint}</p>
            <div className="mt-4">
              <HotelCityInput
                id="smart-city"
                locale={locale}
                value={cityText}
                onType={(v) => {
                  setCityText(v);
                  setCity(null);
                  setReady(null);
                }}
                onPick={(c, cc) => {
                  const nm = locale === "ar" ? c.nameAr : c.nameEn;
                  setCityText(nm);
                  setReady(null);
                  setCity({ code: cc, slug: c.slug, name: nm });
                }}
                placeholder={t.whereQ}
                className="w-full rounded-2xl border border-mist-300 bg-white px-4 py-3 text-base text-navy-900 outline-none focus:border-sun-400 focus:ring-4 focus:ring-sun-400/20"
              />
            </div>
            {city && ready === false && (
              <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900 ring-1 ring-amber-200">
                <p>{t.notReady}</p>
                <Link href={`/${locale}/attractions/${city.code}/${city.slug}#trip-plan`} className="mt-2 inline-block font-extrabold text-sea-700 hover:underline">
                  {t.notReadyLink.replace("{city}", city.name)} ←
                </Link>
              </div>
            )}
          </>
        );
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
            {days > 1 && (
              <>
                <p className="mt-5 text-sm font-bold text-navy-800">{t.arriveQ}</p>
                {dayPart("arrive")}
                <p className="mt-4 text-sm font-bold text-navy-800">{t.leaveQ}</p>
                {dayPart("leave")}
              </>
            )}
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
                <button key={i} type="button" aria-pressed={a.interests.includes(i)} className={chip(a.interests.includes(i))} onClick={() => toggle("interests", i, 8)}>
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
            <h3 className="mt-6 font-display text-lg font-extrabold text-navy-950">{t.needsQ}</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {NEEDS.map((n) => {
                const sel = (a.needs ?? []).includes(n);
                return (
                  <button key={n} type="button" aria-pressed={sel} className={chip(sel)} onClick={() => toggle("needs", n, NEEDS.length)}>
                    {sel ? "✓ " : ""}
                    {t.needs[n]}
                  </button>
                );
              })}
            </div>
          </>
        );
    }
  })();

  const last = step === steps.length - 1;
  const title = t.title.replace("{city}", city?.name ?? "");

  const building = (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
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
  );

  const questions = (
    <>
      <div className={standalone ? "" : "flex-1 overflow-y-auto px-4 py-5"}>
        <div className="mx-auto max-w-lg">
          {step === 0 && <p className="mb-5 rounded-2xl bg-sea-50 px-4 py-3 text-sm leading-relaxed text-navy-800 ring-1 ring-sea-100">{t.intro}</p>}
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-mist-200" aria-hidden="true">
            <div className="h-full rounded-full bg-sun-400 transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
          <p className="mb-2 text-xs font-bold text-navy-500">{t.stepOf.replace("{n}", String(step + 1)).replace("{total}", String(steps.length))}</p>
          {question}
          {state === "error" && (
            <p role="alert" className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </p>
          )}
        </div>
      </div>
      <div className={standalone ? "mt-6" : "border-t border-mist-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"}>
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
  );

  const overlay = (
    <div className="plan-root fixed inset-0 z-[75] flex flex-col bg-mist-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex items-center justify-between gap-3 bg-navy-950 px-4 py-3 text-white print:hidden">
        <p className="min-w-0 truncate font-display text-base font-extrabold">✨ {title}</p>
        {state !== "building" && (
          <button type="button" onClick={close} aria-label={t.close} className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20">
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
              if (standalone) setOpen(false);
            }}
          />
        </div>
      ) : state === "building" ? (
        building
      ) : (
        questions
      )}
    </div>
  );

  if (standalone) {
    return (
      <>
        <div className="rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-navy-950/5 sm:p-7">{state === "building" ? building : questions}</div>
        {state === "done" && plan && createPortal(overlay, document.body)}
      </>
    );
  }

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
      {layer && createPortal(overlay, document.body)}
    </>
  );
}
