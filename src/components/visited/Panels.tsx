"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { COUNTRIES, CONTINENTS, flagEmoji, type Continent } from "@/lib/countries";
import { COUNTRY_CITIES } from "@/lib/cities";
import { citiesOf, ourCities, type MapCity } from "@/lib/visitedCities";
import { ARAB, GULF, continentOf, counted, in195, type Visited, type VisitedStats } from "@/lib/visitedMap";
import { badgesOf } from "./badges";
import Sheet from "./Sheet";

type T = ReturnType<typeof useDictionary>["visited"];
const NAME = new Map(COUNTRIES.map((c) => [c.code, c]));
const nm = (code: string, ar: boolean) => (ar ? NAME.get(code)?.nameAr : NAME.get(code)?.nameEn) ?? code;

/** City names for a country's ticked ids (ours at once, the rest after the file loads). */
function useCityNames(code: string, ids: Set<string> | undefined): Map<string, MapCity> {
  const [list, setList] = useState<MapCity[]>(() => ourCities(code));
  useEffect(() => {
    let live = true;
    if (ids && [...ids].some((i) => i.startsWith("q"))) void citiesOf(code).then((l) => live && setList(l));
    return () => {
      live = false;
    };
  }, [code, ids]);
  return new Map(list.map((c) => [c.id, c]));
}

function Bar({ now, total }: { now: number; total: number }) {
  return (
    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-mist-100">
      <div className="h-full rounded-full bg-[#f8b840] transition-[width] duration-700" style={{ width: `${total ? Math.min(100, (now / total) * 100) : 0}%` }} />
    </div>
  );
}

// ── One country ─────────────────────────────────────────────────────────────
export function CountrySheet({
  locale,
  t,
  code,
  name,
  visited,
  onAdd,
  onDream,
  onRemove,
  onDeleteTrip,
  onClose,
}: {
  locale: Locale;
  t: T;
  code: string;
  name: string;
  visited: Visited;
  onAdd: () => void;
  onDream: () => void;
  onRemove: () => void;
  onDeleteTrip: (index: number) => void;
  onClose: () => void;
}) {
  const ar = locale === "ar";
  const trips = visited.countries.get(code);
  const ids = visited.cities.get(code);
  const names = useCityNames(code, ids);
  const ourTotal = (COUNTRY_CITIES[code] ?? []).length;
  const ourSeen = (COUNTRY_CITIES[code] ?? []).filter((c) => ids?.has(c.slug)).length;
  const [confirm, setConfirm] = useState(false);
  const cont = continentOf(code);
  const contT = useContinentNames();
  return (
    <Sheet
      title={
        <span className="flex items-center gap-2">
          <span aria-hidden="true">{flagEmoji(code)}</span>
          <span className="truncate">{name}</span>
        </span>
      }
      onClose={onClose}
      closeLabel={t.close}
    >
      {cont && <p className="-mt-1 mb-3 text-xs font-bold text-navy-900/50">{contT[cont]}</p>}
      {trips ? (
        <>
          <div className="flex items-center gap-3 rounded-2xl bg-[#061a33] p-4 text-white">
            <span className="text-3xl" aria-hidden="true">✈️</span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-extrabold">{t.beenTimes.replace("{times}", counted(t.timesForms, trips.length))}</p>
              <p className="text-xs text-white/65">{ids?.size ? counted(t.cityForms, ids.size) : t.noCitiesYet}</p>
            </div>
            <button type="button" onClick={onAdd} className="min-h-11 shrink-0 rounded-full bg-[#f8b840] px-4 text-sm font-extrabold text-[#061a33] active:scale-95">
              {t.addTrip}
            </button>
          </div>
          <h3 className="mb-2 mt-5 text-sm font-extrabold text-navy-900">{t.trips}</h3>
          <ul className="flex flex-wrap gap-2">
            {trips.map((y, i) => (
              <li key={i} className="flex items-center gap-1 rounded-full bg-mist-50 py-1 pe-1 ps-3 text-sm font-bold text-navy-900 ring-1 ring-navy-900/10">
                {y || t.noYear}
                {trips.length > 1 && (
                  <button type="button" onClick={() => onDeleteTrip(i)} aria-label={t.deleteTrip} className="grid h-8 w-8 place-items-center rounded-full text-navy-900/40 hover:bg-white">
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
          <h3 className="mb-2 mt-5 text-sm font-extrabold text-navy-900">{t.citiesYou}</h3>
          {ids?.size ? (
            <div className="flex flex-wrap gap-2">
              {[...ids].map((id) => {
                const c = names.get(id);
                const label = c ? (ar ? c.ar : c.en) : "…";
                return c?.ours ? (
                  <Link key={id} href={`/${locale}/attractions/${code}/${id}`} className="rounded-full bg-[#fff8e8] px-3 py-2 text-sm font-bold text-navy-900 ring-1 ring-[#f8b840]">
                    📍 {label}
                  </Link>
                ) : (
                  <span key={id} className="rounded-full bg-[#fff8e8] px-3 py-2 text-sm font-bold text-navy-900 ring-1 ring-[#f8b840]/60">
                    📍 {label}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-navy-900/55">{t.noCitiesYet}</p>
          )}
          {ourTotal > 0 && (
            <div className="mt-4">
              <p className="text-xs font-bold text-navy-900/60">{t.explored.replace("{seen}", String(ourSeen)).replace("{total}", String(ourTotal))}</p>
              <Bar now={ourSeen} total={ourTotal} />
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={onAdd} className="min-h-12 rounded-2xl bg-[#f8b840] text-base font-extrabold text-[#061a33] active:scale-[0.98]">
            ✈️ {t.add}
          </button>
          <button
            type="button"
            onClick={onDream}
            className={`min-h-12 rounded-2xl text-sm font-extrabold ring-1 active:scale-[0.98] ${visited.dreams.has(code) ? "bg-navy-50 text-navy-900 ring-navy-300" : "bg-white text-navy-900 ring-navy-900/15"}`}
          >
            {visited.dreams.has(code) ? t.wishOn : `⭐ ${t.wish}`}
          </button>
        </div>
      )}
      <div className="mt-5 flex flex-wrap gap-2">
        {NAME.has(code) && (
          <Link href={`/${locale}/attractions/${code}`} className="min-h-11 rounded-full bg-navy-50 px-4 py-2.5 text-sm font-bold text-navy-900 ring-1 ring-navy-200">
            {t.guide.replace("{country}", name)}
          </Link>
        )}
        {!trips && (
          <Link href={`/${locale}/itinerary`} className="min-h-11 rounded-full bg-navy-50 px-4 py-2.5 text-sm font-bold text-navy-900 ring-1 ring-navy-200">
            🗺️ {t.planTrip}
          </Link>
        )}
      </div>
      {trips && (
        <div className="mt-6 border-t border-navy-900/10 pt-4">
          {confirm ? (
            <button type="button" onClick={onRemove} className="min-h-11 w-full rounded-2xl bg-red-600 text-sm font-extrabold text-white">
              {t.removeConfirm}
            </button>
          ) : (
            <button type="button" onClick={() => setConfirm(true)} className="min-h-11 w-full rounded-2xl text-sm font-bold text-red-700 ring-1 ring-red-200">
              {t.remove}
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}

function useContinentNames(): Record<Continent, string> {
  return useDictionary().attractions.continents as Record<Continent, string>;
}

// ── Lists ───────────────────────────────────────────────────────────────────
export type ListKind = "countries" | "continents" | "cities" | "years" | "badges" | "dreams" | "gulf";

export function ListSheet({
  kind,
  locale,
  t,
  visited,
  stats,
  onCountry,
  onClose,
}: {
  kind: ListKind;
  locale: Locale;
  t: T;
  visited: Visited;
  stats: VisitedStats;
  onCountry: (code: string) => void;
  onClose: () => void;
}) {
  const ar = locale === "ar";
  const contT = useContinentNames();
  const title = { countries: t.rowCountries, continents: t.rowContinents, cities: t.rowCities, years: t.rowYears, badges: t.rowBadges, dreams: t.rowDreams, gulf: t.rowGulf }[kind];
  const visitedCodes = [...visited.countries.keys()].sort((a, b) => nm(a, ar).localeCompare(nm(b, ar), ar ? "ar" : "en"));
  const row = (code: string, right: React.ReactNode, sub?: React.ReactNode) => (
    <li key={code}>
      <button type="button" onClick={() => onCountry(code)} className="flex min-h-14 w-full items-center gap-3 px-1 text-start active:bg-mist-50">
        <span className="text-2xl" aria-hidden="true">{flagEmoji(code)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-navy-950">{nm(code, ar)}</span>
          {sub && <span className="block text-xs text-navy-900/55">{sub}</span>}
        </span>
        {right}
        <span aria-hidden="true" className="text-navy-900/30 rtl:rotate-180">›</span>
      </button>
    </li>
  );

  let body: React.ReactNode = null;
  if (kind === "countries") {
    body = (
      <ul className="divide-y divide-navy-900/5">
        {visitedCodes.map((code) => {
          const trips = visited.countries.get(code)!;
          const n = visited.cities.get(code)?.size ?? 0;
          return row(
            code,
            trips.length > 1 ? <span className="rounded-full bg-[#fff3d6] px-2 py-0.5 text-xs font-extrabold text-[#8a5a00]">×{trips.length}</span> : null,
            [n ? counted(t.cityForms, n) : null, trips.filter((y) => y).join(" · ") || null].filter(Boolean).join(" — ")
          );
        })}
      </ul>
    );
  } else if (kind === "continents") {
    body = (
      <ul className="space-y-4">
        {CONTINENTS.map((cont) => {
          const all = COUNTRIES.filter((c) => c.continent === cont && in195(c.code));
          const seen = all.filter((c) => visited.countries.has(c.code));
          return (
            <li key={cont}>
              <div className="flex items-baseline justify-between">
                <span className="font-extrabold text-navy-950">{contT[cont]}</span>
                <span className="text-sm font-bold text-navy-900/60">
                  {t.badgesOf.replace("{n}", String(seen.length)).replace("{total}", String(all.length))} · {Math.round((seen.length / all.length) * 100)}
                  {ar ? "٪" : "%"}
                </span>
              </div>
              <Bar now={seen.length} total={all.length} />
              {seen.length > 0 && <p className="mt-1.5 text-lg leading-relaxed">{seen.map((c) => flagEmoji(c.code)).join(" ")}</p>}
            </li>
          );
        })}
      </ul>
    );
  } else if (kind === "gulf") {
    const block = (list: string[], label: string) => {
      const seen = list.filter((c) => visited.countries.has(c));
      return (
        <section className="mb-5">
          <div className="flex items-baseline justify-between">
            <span className="font-extrabold text-navy-950">{label}</span>
            <span className="text-sm font-bold text-navy-900/60">{t.badgesOf.replace("{n}", String(seen.length)).replace("{total}", String(list.length))}</span>
          </div>
          <Bar now={seen.length} total={list.length} />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {list.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onCountry(c)}
                className={`min-h-10 rounded-full px-3 text-sm font-bold ring-1 ${visited.countries.has(c) ? "bg-[#fff8e8] text-navy-900 ring-[#f8b840]" : "bg-white text-navy-900/50 ring-navy-900/10"}`}
              >
                {flagEmoji(c)} {nm(c, ar)}
              </button>
            ))}
          </div>
        </section>
      );
    };
    body = (
      <>
        {block(GULF, ar ? "دول الخليج" : "Gulf countries")}
        {block(ARAB, ar ? "الدول العربية" : "Arab countries")}
      </>
    );
  } else if (kind === "cities") {
    body = (
      <div className="space-y-4">
        {visitedCodes
          .filter((c) => visited.cities.get(c)?.size)
          .map((code) => (
            <CityGroup key={code} code={code} locale={locale} ids={visited.cities.get(code)!} onCountry={onCountry} />
          ))}
        {stats.cities === 0 && <p className="text-sm text-navy-900/60">{t.noCitiesYet}</p>}
      </div>
    );
  } else if (kind === "years") {
    const byYear = new Map<number, string[]>();
    for (const [code, trips] of visited.countries) for (const y of new Set(trips)) byYear.set(y, [...(byYear.get(y) ?? []), code]);
    const years = [...byYear.keys()].sort((a, b) => (a === 0 ? 1 : b === 0 ? -1 : b - a));
    body = (
      <>
        {years.every((y) => y === 0) && <p className="mb-3 rounded-2xl bg-mist-50 p-3 text-sm text-navy-900/70">{t.yearsNone}</p>}
        <ol className="relative space-y-5 border-s-2 border-[#f8b840]/40 ps-5">
          {years.map((y) => (
            <li key={y} className="relative">
              <span className="absolute -start-[1.72rem] top-1 h-3 w-3 rounded-full bg-[#f8b840] ring-4 ring-white" aria-hidden="true" />
              <p className="font-display text-lg font-extrabold text-navy-950">{y || t.noYear}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {byYear.get(y)!.map((c) => (
                  <button key={c} type="button" onClick={() => onCountry(c)} className="min-h-10 rounded-full bg-[#fff8e8] px-3 text-sm font-bold text-navy-900 ring-1 ring-[#f8b840]/60">
                    {flagEmoji(c)} {nm(c, ar)}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </>
    );
  } else if (kind === "badges") {
    const list = badgesOf(visited, stats);
    body = (
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {list.map((b) => {
          const on = b.now >= b.need;
          const bt = t.badges[b.id];
          return (
            <li key={b.id} className={`rounded-2xl p-3 text-center ring-1 ${on ? "bg-[#061a33] text-white ring-[#f8b840]" : "bg-mist-50 text-navy-900 ring-navy-900/10"}`}>
              <span className={`mx-auto grid h-14 w-14 place-items-center rounded-full text-3xl ${on ? "bg-[#f8b840]/20" : "bg-white grayscale"}`} aria-hidden="true">
                {b.icon}
              </span>
              <p className="mt-2 text-sm font-extrabold">{bt.name}</p>
              <p className={`text-xs ${on ? "text-white/65" : "text-navy-900/55"}`}>{bt.how}</p>
              {!on && (
                <>
                  <Bar now={b.now} total={b.need} />
                  <p className="mt-1 text-[0.7rem] font-bold text-navy-900/50">{t.badgesOf.replace("{n}", String(b.now)).replace("{total}", String(b.need))}</p>
                </>
              )}
            </li>
          );
        })}
      </ul>
    );
  } else if (kind === "dreams") {
    body = (
      <ul className="divide-y divide-navy-900/5">
        {[...visited.dreams].map((code) => row(code, <span aria-hidden="true">⭐</span>))}
        {visited.dreams.size === 0 && <p className="text-sm text-navy-900/60">{t.wish}</p>}
      </ul>
    );
  }
  return (
    <Sheet title={title} onClose={onClose} closeLabel={t.close} tall>
      {body}
    </Sheet>
  );
}

function CityGroup({ code, locale, ids, onCountry }: { code: string; locale: Locale; ids: Set<string>; onCountry: (c: string) => void }) {
  const ar = locale === "ar";
  const names = useCityNames(code, ids);
  return (
    <section>
      <button type="button" onClick={() => onCountry(code)} className="mb-1.5 flex min-h-10 items-center gap-2 font-extrabold text-navy-950">
        <span aria-hidden="true">{flagEmoji(code)}</span> {nm(code, ar)} <span className="text-xs font-bold text-navy-900/45">({ids.size})</span>
      </button>
      <div className="flex flex-wrap gap-1.5">
        {[...ids].map((id) => {
          const c = names.get(id);
          return (
            <span key={id} className="rounded-full bg-[#fff8e8] px-3 py-1.5 text-sm font-bold text-navy-900 ring-1 ring-[#f8b840]/60">
              {c ? (ar ? c.ar : c.en) : "…"}
            </span>
          );
        })}
      </div>
    </section>
  );
}
