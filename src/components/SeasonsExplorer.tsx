"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/types";
import type { Continent } from "@/lib/countries";
import { flagEmoji } from "@/lib/countries";
import { MONTHS, seasonForCountry } from "@/lib/seasons";
import Photo from "@/components/Photo";
import DestinationFilters, {
  type CityOption,
  type FilterState,
  type FiltersDict,
} from "@/components/DestinationFilters";
import SearchableSelect from "@/components/SearchableSelect";
import { matchesFilters, type DestinationCountry } from "@/components/CountryCardGrid";
import { countLabel } from "@/lib/format";

interface SeasonsDict {
  intro: string;
  monthHeading: string;
  countriesInMonth: string;
  emptyMonth: string;
  seasonWinter: string;
  seasonSpring: string;
  seasonSummer: string;
  seasonAutumn: string;
  sourceNote: string;
  noResults: string;

  modeQuestion: string;
  byMonth: string;
  byMonthHint: string;
  byCountry: string;
  byCountryHint: string;
  pickCountry: string;
  pickCountryPlaceholder: string;
  countrySearchPlaceholder: string;
  countryNoMatches: string;
  noCountryChosen: string;
  yearFor: string;
  inSeason: string;
  outOfSeason: string;
  inSeasonCount: string;
  inSeasonOne: string;
  inSeasonTwo: string;
  inSeasonFew: string;
  noMonthsForCountry: string;
  changeMode: string;
  viewCountry: string;
}

const SEASON_STYLES: Record<string, { chip: string; ring: string }> = {
  winter: { chip: "bg-sky-100 text-sky-800", ring: "ring-sky-200" },
  spring: { chip: "bg-emerald-100 text-emerald-800", ring: "ring-emerald-200" },
  summer: { chip: "bg-amber-100 text-amber-800", ring: "ring-amber-200" },
  autumn: { chip: "bg-orange-100 text-orange-800", ring: "ring-orange-200" },
};

type Mode = "month" | "country" | null;

/**
 * The seasons page answers two different questions, and they want opposite
 * layouts.
 *
 * "Where should I go in March?" is a month with many countries under it.
 * "When should I go to Japan?" is one country with twelve months under it.
 * Showing the first and making the second a filtering exercise buried the
 * answer, so the page now asks which question you have before it draws
 * anything — the same pattern the homepage planner already uses.
 */
export default function SeasonsExplorer({
  locale,
  countries,
  cities,
  filtersDict,
  dict,
}: {
  locale: Locale;
  countries: DestinationCountry[];
  cities: CityOption[];
  filtersDict: FiltersDict;
  dict: SeasonsDict;
}) {
  /**
   * The page opens on the question, not on an answer to it.
   *
   * For a while it opened straight into the month-by-month view, on the
   * argument that "where should I go now" is the common case and shouldn't
   * cost a click. That reasoning was wrong about what this page is. The two
   * views answer genuinely different questions — "which countries suit
   * September" and "which months suit Japan" — and dropping someone into one
   * of them hides the other behind a control they have no reason to look
   * for, especially when the view they landed in isn't the one they came
   * for. The chooser is the page's table of contents; both routes are named
   * and one tap away.
   */
  const [mode, setMode] = useState<Mode>(null);
  const [filters, setFilters] = useState<FilterState>({
    query: "",
    continent: "all",
    month: "all",
  });
  const [countryCode, setCountryCode] = useState("");

  const isAr = locale === "ar";
  const nameOf = (c: DestinationCountry) => (isAr ? c.nameAr : c.nameEn);

  const matching = useMemo(
    () => countries.filter((c) => matchesFilters(c, filters)),
    [countries, filters]
  );

  // A chosen month collapses the page to that one section; otherwise the
  // whole year is shown.
  /**
   * The year starts now, not in January.
   *
   * Someone opening this page in September is deciding about September,
   * October and November. Listing January first buries all three under eight
   * months that have already gone, and the page reads as a reference table
   * rather than an answer. It still runs a full twelve months — it just
   * begins where the reader is.
   */
  const visibleMonths = useMemo(() => {
    if (filters.month !== "all") return MONTHS.filter((m) => m.number === filters.month);
    const now = new Date().getMonth(); // 0-based, so this is the current month's index
    return [...MONTHS.slice(now), ...MONTHS.slice(0, now)];
  }, [filters.month]);

  const countryOptions = useMemo(
    () =>
      [...countries]
        .sort((a, b) => nameOf(a).localeCompare(nameOf(b), isAr ? "ar" : "en"))
        .map((c) => ({
          value: c.code,
          label: nameOf(c),
          // Both spellings are searchable, so typing "Japan" finds اليابان.
          keywords: `${c.nameAr} ${c.nameEn} ${c.code}`,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [countries, isAr]
  );

  const chosen = countries.find((c) => c.code === countryCode);

  const seasonLabel = (season: string) =>
    season === "winter"
      ? dict.seasonWinter
      : season === "spring"
        ? dict.seasonSpring
        : season === "summer"
          ? dict.seasonSummer
          : dict.seasonAutumn;

  // ── The question ────────────────────────────────────────────────────
  if (mode === null) {
    const card =
      "group flex flex-1 items-start gap-4 rounded-2xl bg-white p-5 text-start shadow-[var(--shadow-card)] ring-1 ring-navy-950/5 transition duration-200 hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] hover:ring-sun-300";

    return (
      <div>
        <p className="mb-6 rounded-xl bg-navy-50 px-4 py-3 text-sm leading-relaxed text-navy-800 ring-1 ring-navy-100">
          {dict.intro}
        </p>

        <h2 className="mb-4 text-center font-display text-xl font-extrabold text-navy-900 sm:text-2xl">
          {dict.modeQuestion}
        </h2>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => setMode("month")} className={card}>
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sun-50 text-2xl ring-1 ring-sun-200">
              🗓
            </span>
            <span className="min-w-0">
              <span className="block font-display text-lg font-extrabold text-navy-900">
                {dict.byMonth}
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-navy-600">
                {dict.byMonthHint}
              </span>
            </span>
          </button>

          <button type="button" onClick={() => setMode("country")} className={card}>
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sun-50 text-2xl ring-1 ring-sun-200">
              🌍
            </span>
            <span className="min-w-0">
              <span className="block font-display text-lg font-extrabold text-navy-900">
                {dict.byCountry}
              </span>
              <span className="mt-1 block text-sm leading-relaxed text-navy-600">
                {dict.byCountryHint}
              </span>
            </span>
          </button>
        </div>

        <p className="mt-6 rounded-xl bg-mist-100 px-3.5 py-3 text-xs leading-relaxed text-navy-500 ring-1 ring-mist-200">
          {dict.sourceNote}
        </p>
      </div>
    );
  }

  const backToModes = (
    <button
      type="button"
      onClick={() => setMode(null)}
      className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2 text-sm font-bold text-navy-800 shadow-[var(--shadow-card)] ring-1 ring-navy-950/5 transition hover:ring-sun-300"
    >
      <span aria-hidden="true">{isAr ? "→" : "←"}</span>
      {dict.changeMode}
    </button>
  );

  // ── One country, twelve months ──────────────────────────────────────
  if (mode === "country") {
    const months = chosen?.months ?? [];

    return (
      <div>
        {backToModes}

        <div className="mb-6 max-w-md">
          <SearchableSelect
            value={countryCode}
            options={countryOptions}
            onChange={setCountryCode}
            label={dict.pickCountry}
            placeholder={dict.pickCountryPlaceholder}
            searchPlaceholder={dict.countrySearchPlaceholder}
            emptyText={dict.countryNoMatches}
          />
        </div>

        {!chosen ? (
          <p className="rounded-2xl bg-mist-100 px-4 py-12 text-center text-sm text-navy-500 ring-1 ring-mist-200">
            {dict.noCountryChosen}
          </p>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <h2 className="font-display text-2xl font-extrabold text-navy-900">
                {dict.yearFor.replace("{country}", nameOf(chosen))}
              </h2>
              {months.length > 0 && (
                <span className="rounded-full bg-sun-100 px-3 py-1 text-xs font-bold text-sun-800 ring-1 ring-sun-200">
                  {countLabel(months.length, {
                    many: dict.inSeasonCount,
                    one: dict.inSeasonOne,
                    two: dict.inSeasonTwo,
                    few: dict.inSeasonFew,
                  })}
                </span>
              )}
              <Link
                href={`/${locale}/attractions/${chosen.code}`}
                className="rounded-full bg-navy-900 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-navy-800"
              >
                {dict.viewCountry}
              </Link>
            </div>

            {months.length === 0 ? (
              <p className="rounded-2xl bg-amber-50 px-4 py-8 text-center text-sm leading-relaxed text-amber-900 ring-1 ring-amber-200">
                {dict.noMonthsForCountry}
              </p>
            ) : (
              /* All twelve months always render. Showing only the good ones
                 would answer "when is it good" but not "is October any good",
                 which is the question someone with fixed leave dates has. */
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {MONTHS.map((month) => {
                  const on = months.includes(month.number);
                  // March is spring in Istanbul and autumn in Sydney. The
                  // season shown is the one the traveller would actually
                  // land in.
                  const season = seasonForCountry(month, countryCode);
                  const style = SEASON_STYLES[season];
                  return (
                    <div
                      key={month.number}
                      className={`rounded-2xl p-4 transition ${
                        on
                          ? `bg-white shadow-[var(--shadow-card)] ring-1 ${style.ring}`
                          : "bg-mist-100 ring-1 ring-mist-200"
                      }`}
                    >
                      <p
                        className={`font-display text-lg font-extrabold ${
                          on ? "text-navy-900" : "text-navy-400"
                        }`}
                      >
                        {isAr ? month.nameAr : month.nameEn}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            on ? style.chip : "bg-mist-200 text-navy-400"
                          }`}
                        >
                          {seasonLabel(season)}
                        </span>
                        <span
                          className={`text-[11px] font-bold ${
                            on ? "text-sun-700" : "text-navy-300"
                          }`}
                        >
                          {on ? `✓ ${dict.inSeason}` : dict.outOfSeason}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <p className="mt-6 rounded-xl bg-mist-100 px-3.5 py-3 text-xs leading-relaxed text-navy-500 ring-1 ring-mist-200">
          {dict.sourceNote}
        </p>
      </div>
    );
  }

  // ── The year, month by month ────────────────────────────────────────
  return (
    <div>
      {backToModes}

      <DestinationFilters
        locale={locale}
        state={filters}
        onChange={setFilters}
        cities={cities}
        cityHrefBase={`/${locale}/attractions`}
        dict={filtersDict}
        resultCount={matching.length}
        resultLabel={filtersDict.countriesCount}
      />

      {matching.length === 0 ? (
        <p className="mt-8 rounded-2xl bg-mist-100 px-4 py-10 text-center text-sm text-navy-500 ring-1 ring-mist-200">
          {dict.noResults}
        </p>
      ) : (
        <div className="mt-8 space-y-8">
          {visibleMonths.map((month) => {
            const inMonth = matching.filter((c) => c.months.includes(month.number));
            // This view spans every country at once, so the season shown is
            // the northern one — qualified in the dictionary string rather
            // than silently asserted, since it is wrong for Australia.
            const style = SEASON_STYLES[month.season];

            return (
              <section key={month.number} className={`rounded-2xl bg-white p-4 shadow-[var(--shadow-card)] ring-1 ${style.ring}`}>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-extrabold text-navy-900">
                    {dict.monthHeading.replace("{month}", isAr ? month.nameAr : month.nameEn)}
                  </h2>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${style.chip}`}>
                    {seasonLabel(month.season)}
                  </span>
                  <span className="text-xs font-semibold text-navy-400">
                    {dict.countriesInMonth.replace("{count}", String(inMonth.length))}
                  </span>
                </div>

                {inMonth.length === 0 ? (
                  <p className="rounded-lg bg-mist-100 px-3 py-4 text-center text-xs text-navy-400">
                    {dict.emptyMonth}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                    {inMonth.map((c) => (
                      <Link
                        key={c.code}
                        href={`/${locale}/attractions/${c.code}`}
                        className="group relative isolate block aspect-[4/3] overflow-hidden rounded-xl ring-1 ring-navy-950/5 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]"
                      >
                        <Photo
                          placeholder
                          src={c.photo}
                          className="absolute inset-0 -z-10 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          fallback={
                            <div className="absolute inset-0 -z-10 flex items-center justify-center bg-gradient-to-br from-navy-700 to-navy-990 text-3xl">
                              {flagEmoji(c.code)}
                            </div>
                          }
                        />
                        <div className="scrim-soft absolute inset-0 -z-10" />
                        <p className="absolute bottom-2 start-2.5 end-2.5 truncate text-xs font-bold text-white drop-shadow-sm sm:text-sm">
                          {nameOf(c)}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-6 rounded-xl bg-mist-100 px-3.5 py-3 text-xs leading-relaxed text-navy-500 ring-1 ring-mist-200">
        {dict.sourceNote}
      </p>
    </div>
  );
}

export type { Continent };
