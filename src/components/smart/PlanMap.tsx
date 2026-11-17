"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import type { PlanDay, PlanLeg } from "@/lib/ai/plan";
import { dayColor } from "@/lib/dayColors";
import ScrollRow from "@/components/ui/ScrollRow";
import type { MapCity, MapStop, PlanMapText } from "@/components/smart/PlanMapCanvas";

// Leaflet needs `window`: the map itself loads in the browser only.
const PlanMapCanvas = dynamic(() => import("@/components/smart/PlanMapCanvas"), {
  ssr: false,
  loading: () => <div className="h-72 w-full animate-pulse rounded-2xl bg-mist-100 sm:h-96" aria-hidden="true" />,
});

export interface PlanMapDict extends PlanMapText {
  title: string;
  hintRoute: string;
  hintPins: string;
  whole: string;
  allDays: string;
}

/**
 * «خريطة رحلتك» inside the plan: the cities of the route by number, and each
 * city's places of the plan as pins by day. The chips under the title do what
 * tapping the map does, for those who'd rather tap a word.
 */
export default function PlanMap({
  days,
  route,
  homeSlug,
  city,
  onCity,
  onDay,
  t,
}: {
  days: PlanDay[];
  route: PlanLeg[] | null;
  /** The plan's city: where days without their own city are spent. */
  homeSlug: string;
  /** The city in focus (route only), lifted so the cover's ribbon can set it. */
  city: string | null;
  onCity: (slug: string | null) => void;
  onDay: (day: number) => void;
  t: PlanMapDict;
}) {
  const [day, setDay] = useState<number | null>(null);

  const stops = useMemo<MapStop[]>(
    () =>
      days.flatMap((d, di) => {
        let order = 0;
        return d.items.flatMap((it, ii) => {
          if (it.kind === "move" || it.kind === "break" || typeof it.lat !== "number" || typeof it.lon !== "number") return [];
          order += 1;
          const q = it.mapQuery ?? `${it.lat},${it.lon}`;
          return [
            {
              id: `${di}-${ii}`,
              lat: it.lat,
              lon: it.lon,
              day: di,
              order,
              city: d.city?.slug ?? homeSlug,
              name: it.name,
              time: it.time,
              meal: it.kind === "meal",
              href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
            },
          ];
        });
      }),
    [days, homeSlug],
  );
  const cities = useMemo<MapCity[]>(() => (route ?? []).map((l, i) => ({ slug: l.slug, name: l.name, lat: l.lat, lon: l.lon, n: i + 1 })), [route]);

  if (!stops.length) return null;

  const multi = cities.length > 1;
  const whole = multi && !city;
  // Days to pick from: the city in focus, or every day of a one-city plan.
  const dayList = whole ? [] : [...new Set(stops.filter((s) => !multi || s.city === city).map((s) => s.day))];
  const pickCity = (slug: string | null) => {
    setDay(null);
    onCity(slug);
  };
  const chip = "flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-extrabold ring-1 transition";
  const on = "bg-navy-900 text-white ring-navy-900";
  const off = "bg-white text-navy-800 ring-mist-300 hover:ring-navy-300";

  return (
    <section id="plan-map" className="mt-4 scroll-mt-24 rounded-3xl bg-white p-4 shadow-[var(--shadow-card)] ring-1 ring-navy-950/5 sm:p-5 print:hidden">
      <h3 className="font-display text-lg font-black text-navy-950">🗺️ {t.title}</h3>
      <p className="mt-0.5 text-xs leading-relaxed text-navy-500">{whole ? t.hintRoute : t.hintPins}</p>

      {multi && (
        <ScrollRow outerClassName="-mx-4 mt-3 sm:-mx-5" className="flex gap-2 px-4 pb-1 sm:px-5">
          <button type="button" aria-pressed={whole} onClick={() => pickCity(null)} className={`${chip} ${whole ? on : off}`}>
            🧭 {t.whole}
          </button>
          {cities.map((c) => {
            const sel = c.slug === city;
            return (
              <button key={c.slug} type="button" aria-pressed={sel} onClick={() => pickCity(c.slug)} className={`${chip} ${sel ? "bg-sun-400 text-navy-950 ring-sun-400" : off}`}>
                <span className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-black ${sel ? "bg-navy-950 text-sun-300" : "bg-navy-900 text-sun-300"}`}>{c.n}</span>
                {c.name}
              </button>
            );
          })}
        </ScrollRow>
      )}

      {dayList.length > 1 && (
        <ScrollRow outerClassName="-mx-4 mt-2 sm:-mx-5" className="flex gap-2 px-4 pb-1 sm:px-5">
          <button type="button" aria-pressed={day === null} onClick={() => setDay(null)} className={`${chip} ${day === null ? on : off}`}>
            {t.allDays}
          </button>
          {dayList.map((d) => (
            <button key={d} type="button" aria-pressed={day === d} onClick={() => setDay(d)} className={`${chip} ${day === d ? on : off}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: dayColor(d) }} aria-hidden="true" />
              {t.day.replace("{n}", String(d + 1))}
            </button>
          ))}
        </ScrollRow>
      )}

      <div className="mt-3">
        <PlanMapCanvas stops={stops} cities={cities} city={multi ? city : null} day={day} onCity={(s) => pickCity(s)} onDay={onDay} t={t} />
      </div>
    </section>
  );
}
