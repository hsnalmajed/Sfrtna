"use client";

import { useState } from "react";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { printPage } from "@/lib/nativeApp";
import type { PlanItem, SmartPlan } from "@/lib/ai/plan";

/** One stop's facts, each on its own line with its label — only those we have. */
function Facts({ item, t }: { item: PlanItem; t: ReturnType<typeof useDictionary>["smart"] }) {
  const rows: [string, string, string][] = [];
  if (item.hours) rows.push(["🕘", t.hours, item.hours]);
  if (item.booking) rows.push(["🎟️", t.booking, item.booking]);
  if (item.dish) rows.push(["🍽️", t.dish, item.dish]);
  if (item.halal) rows.push(["✅", t.halal, item.halal]);
  if (item.dress) rows.push(["👕", t.dress, item.dress]);
  if (item.gettingThere) rows.push(["🧭", t.gettingThere, item.gettingThere]);
  if (item.tip) rows.push(["💡", t.tip, item.tip]);
  if (!rows.length) return null;
  return (
    <dl className="mt-2 space-y-1.5">
      {rows.map(([icon, label, text]) => (
        <div key={label} className="flex gap-2 text-[13px] leading-relaxed">
          <dt className="shrink-0 font-bold text-navy-500">
            <span aria-hidden="true">{icon}</span> {label}:
          </dt>
          <dd className="min-w-0 text-navy-800">{text}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function SmartPlanView({ locale, plan, onNew }: { locale: Locale; plan: SmartPlan; onNew?: () => void }) {
  const t = useDictionary().smart;
  const isAr = locale === "ar";
  const [day, setDay] = useState(0);
  const d = plan.days[day];
  const fmt = (iso: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(iso)
      ? new Intl.DateTimeFormat(isAr ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`))
      : iso;
  const dur = (m: number) => (m >= 60 ? t.hoursMin.replace("{h}", String(Math.floor(m / 60))).replace("{m}", String(m % 60)) : t.minutes.replace("{n}", String(m)));

  // The day's stops in order, in Google Maps.
  const routeHref = (items: PlanItem[]) => {
    const pts = items.filter((i) => typeof i.lat === "number").map((i) => `${i.lat},${i.lon}`);
    if (pts.length < 2) return null;
    const u = new URL("https://www.google.com/maps/dir/");
    u.searchParams.set("api", "1");
    u.searchParams.set("origin", pts[0]);
    u.searchParams.set("destination", pts[pts.length - 1]);
    if (pts.length > 2) u.searchParams.set("waypoints", pts.slice(1, -1).join("|"));
    return u.toString();
  };

  const ess = plan.essentials;
  const essBlocks: [string, string, string[]][] = [
    ["🎒", t.packing, ess.packing],
    ["🤝", t.etiquette, ess.etiquette],
    ["🚇", t.transport, ess.transport],
    ["💳", t.money, ess.money],
    ["🗣️", t.phrases, ess.phrases],
    ["🛡️", t.safety, ess.safety],
  ].filter(([, , list]) => (list as string[]).length > 0) as [string, string, string[]][];

  const dayView = (dd: typeof d, i: number) => {
    const route = routeHref(dd.items);
    return (
      <section key={dd.date} className="rounded-3xl bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-navy-950/5 sm:p-6">
        <p className="text-xs font-bold text-sea-700">
          {t.day.replace("{n}", String(i + 1))} · {fmt(dd.date)}
          {dd.area ? ` · ${dd.area}` : ""}
        </p>
        <h3 className="mt-1 font-display text-lg font-extrabold text-navy-950 sm:text-xl">{dd.title}</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {dd.weather && (
            <p className="rounded-2xl bg-sky-50 px-3 py-2 text-[13px] leading-relaxed text-sky-950 ring-1 ring-sky-100">
              <span className="font-extrabold">🌤 {t.weather}:</span> {dd.weather}
            </p>
          )}
          {dd.wear && (
            <p className="rounded-2xl bg-violet-50 px-3 py-2 text-[13px] leading-relaxed text-violet-950 ring-1 ring-violet-100">
              <span className="font-extrabold">👕 {t.wear}:</span> {dd.wear}
            </p>
          )}
        </div>

        <ol className="relative mt-5 space-y-4 border-s-2 border-mist-200 ps-5">
          {dd.items.map((it, k) => (
            <li key={k} className="relative">
              <span
                className={`absolute -start-[1.72rem] top-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] ring-2 ring-white ${
                  it.kind === "meal" ? "bg-amber-400" : it.kind === "break" ? "bg-mist-300" : "bg-navy-900 text-white"
                }`}
                aria-hidden="true"
              >
                {it.kind === "meal" ? "🍴" : it.kind === "break" ? "☕" : k + 1}
              </span>
              <div className="flex flex-wrap items-baseline gap-x-2">
                {it.time && (
                  <span className="font-display text-sm font-black text-navy-950" dir="ltr">
                    {it.time}
                  </span>
                )}
                <span className="font-display text-base font-extrabold text-navy-950">{it.name}</span>
                {it.durationMin > 0 && <span className="text-xs font-semibold text-navy-500">· {dur(it.durationMin)}</span>}
                {it.kind !== "place" && <span className="text-xs font-semibold text-navy-500">· {it.kind === "meal" ? t.meal : t.rest}</span>}
              </div>
              {typeof it.fromPrevKm === "number" && it.fromPrevKm > 0 && <p className="mt-0.5 text-[11px] font-semibold text-navy-400">↳ {t.km.replace("{n}", String(it.fromPrevKm))}</p>}
              {it.why && <p className="mt-1 text-[13px] leading-relaxed text-navy-700">{it.why}</p>}
              <Facts item={it} t={t} />
              {it.ticketQuery && /تذكر|ticket|book|حجز/i.test(it.booking) && (
                <a
                  href={`/api/go/gyg?q=${encodeURIComponent(it.ticketQuery)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-partner="getyourguide"
                  className="mt-2 inline-flex min-h-9 items-center rounded-full bg-sun-400 px-3.5 text-xs font-extrabold text-navy-950 print:hidden"
                >
                  🎟️ {t.tickets}
                </a>
              )}
            </li>
          ))}
        </ol>

        {route && (
          <a
            href={route}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex min-h-10 items-center rounded-full bg-navy-900 px-4 text-sm font-extrabold text-white print:hidden"
          >
            🗺️ {t.openMap}
          </a>
        )}
      </section>
    );
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-5 sm:py-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-sm font-bold text-navy-700">
          {plan.city.name} · {fmt(plan.from)} – {fmt(plan.to)}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => printPage(`${plan.city.name}`)} className="min-h-10 rounded-full bg-white px-4 text-sm font-extrabold text-navy-900 ring-1 ring-mist-300">
            📄 {t.print}
          </button>
          {onNew && (
            <button type="button" onClick={onNew} className="min-h-10 rounded-full bg-white px-4 text-sm font-bold text-navy-700 ring-1 ring-mist-300">
              {t.newPlan}
            </button>
          )}
        </div>
      </div>

      {plan.summary && <p className="mb-5 rounded-3xl bg-navy-950 px-5 py-4 text-sm leading-relaxed text-white/90">{plan.summary}</p>}

      {/* Day tabs on screen; every day one after another on paper. */}
      <div className="mb-4 flex flex-wrap gap-2 print:hidden" role="tablist">
        {plan.days.map((dd, i) => (
          <button
            key={dd.date}
            type="button"
            role="tab"
            aria-selected={i === day}
            onClick={() => setDay(i)}
            className={`min-h-10 rounded-full px-4 text-sm font-extrabold ring-1 ${i === day ? "bg-sun-400 text-navy-950 ring-sun-400" : "bg-white text-navy-800 ring-mist-300"}`}
          >
            {t.day.replace("{n}", String(i + 1))}
          </button>
        ))}
      </div>
      <div className="print:hidden">{d && dayView(d, day)}</div>
      <div className="hidden space-y-6 print:block">{plan.days.map((dd, i) => dayView(dd, i))}</div>

      {(essBlocks.length > 0 || ess.emergency) && (
        <section className="mt-6 rounded-3xl bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-navy-950/5 sm:p-6">
          <h3 className="font-display text-lg font-extrabold text-navy-950">🧳 {t.essentials}</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {essBlocks.map(([icon, title, list]) => (
              <div key={title}>
                <p className="text-sm font-extrabold text-navy-900">
                  <span aria-hidden="true">{icon}</span> {title}
                </p>
                <ul className="mt-1.5 list-disc space-y-1 ps-5 text-[13px] leading-relaxed text-navy-700">
                  {list.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {ess.emergency && (
            <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-red-800 ring-1 ring-red-100">
              🚨 {t.emergency}: {ess.emergency}
            </p>
          )}
        </section>
      )}

      {plan.sources.length > 0 && (
        <section className="mt-6 rounded-3xl bg-white p-4 ring-1 ring-navy-950/5 sm:p-6">
          <h3 className="text-sm font-extrabold text-navy-900">🔗 {t.sources}</h3>
          <ul className="mt-2 space-y-1">
            {plan.sources.map((s) => (
              <li key={s.url} className="truncate text-xs">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-sea-700 hover:underline" dir="auto">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-navy-500">{t.sourcesNote}</p>
        </section>
      )}
    </div>
  );
}
