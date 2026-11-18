"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { COUNTRIES, CONTINENTS, flagEmoji, type Continent } from "@/lib/countries";
import { ourCities, type MapCity } from "@/lib/visitedCities";
import { ARAB, GULF, continentOf, in195, type Visited, type VisitedStats } from "@/lib/visitedMap";
import { badgesOf } from "./badges";
import Sheet from "./Sheet";

type T = ReturnType<typeof useDictionary>["visited"];
const NAME = new Map(COUNTRIES.map((c) => [c.code, c]));
const nm = (code: string, ar: boolean) => (ar ? NAME.get(code)?.nameAr : NAME.get(code)?.nameEn) ?? code;

/** A country's cities (the merged list once loaded, ours meanwhile). */
export type CityLists = Map<string, MapCity[]>;
function listOf(lists: CityLists, code: string): MapCity[] {
  return lists.get(code) ?? ourCities(code);
}
/** Seen / total cities of a country, and the share (0–100). */
export function cityShare(lists: CityLists, visited: Visited, code: string) {
  const all = listOf(lists, code);
  const ids = visited.cities.get(code) ?? new Set<string>();
  const total = Math.max(all.length, ids.size);
  return { seen: ids.size, total, pct: total ? Math.round((ids.size / total) * 100) : 0 };
}

function Bar({ pct, tone = "gold" }: { pct: number; tone?: "gold" | "blue" }) {
  return (
    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-mist-100">
      <div className={`h-full rounded-full transition-[width] duration-700 ${tone === "gold" ? "bg-[#f8b840]" : "bg-[#88b1e1]"}`} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}
const pctText = (n: number, ar: boolean) => `${n}${ar ? "٪" : "%"}`;

// ── One country ─────────────────────────────────────────────────────────────
export function CountrySheet({
  locale,
  t,
  code,
  name,
  visited,
  lists,
  onBeen,
  onDream,
  onRemoveCity,
  onMoveToDream,
  onRemove,
  onRemoveDream,
  onClose,
}: {
  locale: Locale;
  t: T;
  code: string;
  name: string;
  visited: Visited;
  lists: CityLists;
  /** open the cities step (adds the country as visited) */
  onBeen: () => void;
  onDream: () => void;
  onRemoveCity: (id: string) => void;
  onMoveToDream: () => void;
  onRemove: () => void;
  onRemoveDream: () => void;
  onClose: () => void;
}) {
  const ar = locale === "ar";
  const been = visited.countries.has(code);
  const dream = !been && visited.dreams.has(code);
  const ids = visited.cities.get(code);
  const byId = new Map(listOf(lists, code).map((c) => [c.id, c]));
  const share = cityShare(lists, visited, code);
  const [confirm, setConfirm] = useState(false);
  const cont = continentOf(code);
  const contT = useDictionary().attractions.continents as Record<Continent, string>;

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
      <div className="-mt-1 mb-4 flex items-center gap-2">
        {cont && <span className="text-xs font-bold text-navy-900/50">{contT[cont]}</span>}
        {been && <span className="rounded-full bg-[#fff3d6] px-2.5 py-0.5 text-xs font-extrabold text-[#8a5a00]">{t.statusBeen}</span>}
        {dream && <span className="rounded-full bg-navy-50 px-2.5 py-0.5 text-xs font-extrabold text-navy-700">{t.statusDream}</span>}
      </div>

      {!been && !dream && (
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onBeen} className="rounded-2xl bg-[#061a33] p-4 text-start text-white ring-2 ring-[#f8b840] active:scale-[0.98]">
            <span className="flex items-center gap-2 font-display text-lg font-extrabold">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#f8b840] text-lg text-[#061a33]" aria-hidden="true">
                ✈️
              </span>
              {t.chooseBeen}
            </span>
            <span className="mt-1.5 block text-sm text-white/70">{t.chooseBeenBody}</span>
          </button>
          <button type="button" onClick={onDream} className="rounded-2xl bg-white p-4 text-start ring-2 ring-[#88b1e1] active:scale-[0.98]">
            <span className="flex items-center gap-2 font-display text-lg font-extrabold text-navy-950">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#88b1e1] text-lg" aria-hidden="true">
                ⭐
              </span>
              {t.chooseDream}
            </span>
            <span className="mt-1.5 block text-sm text-navy-900/65">{t.chooseDreamBody}</span>
          </button>
        </div>
      )}

      {dream && (
        <div className="flex flex-col gap-2">
          <button type="button" onClick={onBeen} className="min-h-12 rounded-2xl bg-[#f8b840] text-base font-extrabold text-[#061a33] active:scale-[0.98]">
            ✈️ {t.moveToBeen}
          </button>
          <button type="button" onClick={onRemoveDream} className="min-h-11 rounded-2xl text-sm font-bold text-navy-900/70 ring-1 ring-navy-900/15">
            {t.removeDream}
          </button>
        </div>
      )}

      {been && (
        <>
          <div className="rounded-2xl bg-[#061a33] p-4 text-white">
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-bold text-white/80">{t.citiesSeen.replace("{seen}", String(share.seen)).replace("{total}", String(share.total))}</p>
              <p className="font-display text-2xl font-extrabold text-[#f8b840]">{pctText(share.pct, ar)}</p>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[#f8b840] transition-[width] duration-700" style={{ width: `${share.pct}%` }} />
            </div>
          </div>
          <div className="mb-2 mt-5 flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-navy-900">{t.citiesYou}</h3>
            <button type="button" onClick={onBeen} className="min-h-10 rounded-full bg-[#f8b840] px-4 text-sm font-extrabold text-[#061a33] active:scale-95">
              {t.addCity}
            </button>
          </div>
          {ids?.size ? (
            <ul className="flex flex-wrap gap-2">
              {[...ids].map((id) => {
                const c = byId.get(id);
                const label = c ? (ar ? c.ar : c.en) : "…";
                return (
                  <li key={id} className="flex items-center rounded-full bg-[#fff8e8] ps-3 ring-1 ring-[#f8b840]/70">
                    {c?.ours ? (
                      <Link href={`/${locale}/attractions/${code}/${id}`} className="py-2 text-sm font-bold text-navy-900">
                        📍 {label}
                      </Link>
                    ) : (
                      <span className="py-2 text-sm font-bold text-navy-900">📍 {label}</span>
                    )}
                    <button
                      type="button"
                      onClick={() => onRemoveCity(id)}
                      aria-label={t.removeCity.replace("{city}", label)}
                      className="grid h-10 w-10 place-items-center rounded-full text-lg leading-none text-navy-900/45 hover:text-red-600"
                    >
                      ×
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-navy-900/55">{t.noCitiesYet}</p>
          )}
        </>
      )}

      {NAME.has(code) && (
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={`/${locale}/attractions/${code}`} className="min-h-11 rounded-full bg-navy-50 px-4 py-2.5 text-sm font-bold text-navy-900 ring-1 ring-navy-200">
            {t.guide.replace("{country}", name)}
          </Link>
          {!been && (
            <Link href={`/${locale}/itinerary`} className="min-h-11 rounded-full bg-navy-50 px-4 py-2.5 text-sm font-bold text-navy-900 ring-1 ring-navy-200">
              🗺️ {t.planTrip}
            </Link>
          )}
        </div>
      )}

      {been && (
        <div className="mt-6 space-y-2 border-t border-navy-900/10 pt-4">
          <button type="button" onClick={onMoveToDream} className="min-h-11 w-full rounded-2xl text-sm font-bold text-navy-900/75 ring-1 ring-navy-900/15">
            ⭐ {t.moveToDream}
          </button>
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

// ── Lists ───────────────────────────────────────────────────────────────────
export type ListKind = "countries" | "continents" | "cities" | "stats" | "badges" | "dreams";

export function ListSheet({
  kind,
  locale,
  t,
  visited,
  stats,
  lists,
  onCountry,
  onAddDream,
  onClose,
}: {
  kind: ListKind;
  locale: Locale;
  t: T;
  visited: Visited;
  stats: VisitedStats;
  lists: CityLists;
  onCountry: (code: string) => void;
  onAddDream: () => void;
  onClose: () => void;
}) {
  const ar = locale === "ar";
  const contT = useDictionary().attractions.continents as Record<Continent, string>;
  const title = { countries: t.rowCountries, continents: t.rowContinents, cities: t.rowCities, stats: t.rowStats, badges: t.rowBadges, dreams: t.rowDreams }[kind];
  const visitedCodes = [...visited.countries.keys()].sort((a, b) => nm(a, ar).localeCompare(nm(b, ar), ar ? "ar" : "en"));

  /** A country row: flag, name, its cities' share. */
  const countryRow = (code: string, sub?: ReactNode, right?: ReactNode) => (
    <li key={code}>
      <button type="button" onClick={() => onCountry(code)} className="flex min-h-16 w-full items-center gap-3 px-1 py-2 text-start active:bg-mist-50">
        <span className="text-2xl" aria-hidden="true">{flagEmoji(code)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold text-navy-950">{nm(code, ar)}</span>
          {sub}
        </span>
        {right}
        <span aria-hidden="true" className="text-navy-900/30 rtl:rotate-180">›</span>
      </button>
    </li>
  );
  const shareRow = (code: string) => {
    const s = cityShare(lists, visited, code);
    return countryRow(
      code,
      <span className="block">
        <span className="block text-xs text-navy-900/55">{t.citiesSeen.replace("{seen}", String(s.seen)).replace("{total}", String(s.total))}</span>
        <Bar pct={s.pct} />
      </span>,
      <span className="w-12 shrink-0 text-center font-display text-base font-extrabold text-[#c48a10]">{pctText(s.pct, ar)}</span>
    );
  };
  const progress = (label: string, seen: number, total: number, flags?: string[]) => (
    <li key={label} className="rounded-2xl bg-mist-50 p-3 ring-1 ring-navy-900/5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-extrabold text-navy-950">{label}</span>
        <span className="text-sm font-bold text-navy-900/60">
          {t.badgesOf.replace("{n}", String(seen)).replace("{total}", String(total))} · {pctText(total ? Math.round((seen / total) * 100) : 0, ar)}
        </span>
      </div>
      <Bar pct={total ? (seen / total) * 100 : 0} />
      {flags && flags.length > 0 && <p className="mt-2 text-lg leading-relaxed">{flags.map((c) => flagEmoji(c)).join(" ")}</p>}
    </li>
  );

  let body: ReactNode = null;
  if (kind === "countries" || kind === "cities") {
    body = visitedCodes.length ? <ul className="divide-y divide-navy-900/5">{visitedCodes.map(shareRow)}</ul> : <p className="py-6 text-center text-sm text-navy-900/60">{t.reportEmpty}</p>;
  } else if (kind === "continents") {
    body = (
      <ul className="space-y-3">
        {CONTINENTS.map((cont) => {
          const all = COUNTRIES.filter((c) => c.continent === cont && in195(c.code));
          const seen = all.filter((c) => visited.countries.has(c.code)).map((c) => c.code);
          return progress(contT[cont], seen.length, all.length, seen);
        })}
      </ul>
    );
  } else if (kind === "stats") {
    const top = visitedCodes
      .map((c) => ({ c, ...cityShare(lists, visited, c) }))
      .filter((x) => x.seen > 0)
      .sort((a, b) => b.pct - a.pct || b.seen - a.seen)
      .slice(0, 5);
    const arabSeen = ARAB.filter((c) => visited.countries.has(c));
    const gulfSeen = GULF.filter((c) => visited.countries.has(c));
    body = visitedCodes.length ? (
      <div className="space-y-5">
        <div className="rounded-2xl bg-[#061a33] p-5 text-center text-white">
          <p className="font-display text-5xl font-extrabold text-[#f8b840]">{pctText(stats.worldPct, ar)}</p>
          <p className="mt-1 text-sm font-bold text-white/70">{t.reportWorld}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-4">
            <Num big={stats.countries} label={t.statCountries} />
            <Num big={stats.cities} label={t.statCities} />
            <Num big={stats.continents} label={t.statContinents} />
          </div>
        </div>
        <section>
          <h3 className="mb-2 text-sm font-extrabold text-navy-900">{t.reportContinents}</h3>
          <ul className="space-y-2">
            {CONTINENTS.map((cont) => {
              const all = COUNTRIES.filter((c) => c.continent === cont && in195(c.code));
              return progress(contT[cont], all.filter((c) => visited.countries.has(c.code)).length, all.length);
            })}
          </ul>
        </section>
        <ul className="space-y-2">
          {progress(t.reportArab, arabSeen.length, ARAB.length, arabSeen)}
          {progress(t.reportGulf, gulfSeen.length, GULF.length, gulfSeen)}
        </ul>
        {top.length > 0 && (
          <section>
            <h3 className="mb-1 text-sm font-extrabold text-navy-900">{t.reportTop}</h3>
            <ul className="divide-y divide-navy-900/5">{top.map((x) => shareRow(x.c))}</ul>
          </section>
        )}
      </div>
    ) : (
      <p className="py-6 text-center text-sm text-navy-900/60">{t.reportEmpty}</p>
    );
  } else if (kind === "badges") {
    const list = badgesOf(visited, stats);
    const won = list.filter((b) => b.now >= b.need);
    const next = list.filter((b) => b.now < b.need).sort((a, b) => b.now / b.need - a.now / a.need);
    body = (
      <div className="space-y-5">
        <p className="rounded-2xl bg-[#fff8e8] p-3 text-sm leading-7 text-navy-900/80 ring-1 ring-[#f8b840]/40">🏅 {t.badgesIntro}</p>
        <section>
          <h3 className="mb-2 text-sm font-extrabold text-navy-900">
            {t.badgesWon} ({won.length})
          </h3>
          {won.length ? (
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {won.map((b) => (
                <li key={b.id} className="rounded-2xl bg-[#061a33] p-2.5 text-center text-white ring-2 ring-[#f8b840]">
                  <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f8b840]/20 text-2xl" aria-hidden="true">
                    {b.icon}
                  </span>
                  <p className="mt-1.5 text-xs font-extrabold leading-tight">{t.badges[b.id].name}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-navy-900/60">{t.badgesNone}</p>
          )}
        </section>
        <section>
          <h3 className="mb-2 text-sm font-extrabold text-navy-900">
            {t.badgesNext} ({next.length})
          </h3>
          <ul className="space-y-2">
            {next.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-2xl bg-mist-50 p-3 ring-1 ring-navy-900/5">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-2xl grayscale" aria-hidden="true">
                  {b.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold text-navy-950">
                    {t.badges[b.id].name} <span className="font-bold text-navy-900/55">— {t.badges[b.id].how}</span>
                  </p>
                  <Bar pct={(b.now / b.need) * 100} />
                  <p className="mt-1 text-[0.7rem] font-bold text-navy-900/50">{t.badgeProgress.replace("{now}", String(b.now)).replace("{need}", String(b.need))}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    );
  } else if (kind === "dreams") {
    body = (
      <>
        <button type="button" onClick={onAddDream} className="mb-3 min-h-12 w-full rounded-2xl bg-[#88b1e1] text-base font-extrabold text-[#061a33] active:scale-[0.98]">
          {t.addDream}
        </button>
        <ul className="divide-y divide-navy-900/5">{[...visited.dreams].map((code) => countryRow(code, undefined, <span aria-hidden="true">⭐</span>))}</ul>
      </>
    );
  }
  return (
    <Sheet title={title} onClose={onClose} closeLabel={t.close} tall>
      {body}
    </Sheet>
  );
}

function Num({ big, label }: { big: number; label: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-extrabold">{big}</p>
      <p className="text-[0.7rem] font-bold text-white/60">{label}</p>
    </div>
  );
}
