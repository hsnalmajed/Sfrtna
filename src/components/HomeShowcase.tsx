"use client";

import { Suspense, useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/types";
import Photo from "@/components/Photo";
import { countLabel } from "@/lib/format";
import Icon, { type IconName } from "@/components/ui/Icon";
import { PLAN_EVENT, type PlanProduct } from "@/lib/planEvents";
import TripPlanner from "@/components/TripPlanner";
import HotelPlanner from "@/components/HotelPlanner";

/** A city in season this month, with the two numbers that put it there. */
export interface ShowcaseCity {
  code: string;
  slug: string;
  name: string;
  countryName: string;
  photo?: string;
  high: number;
  rainyDays: number;
  /** The homepage planner, pointed at this city's airport (see cityAirports.ts). */
  flightHref?: string;
  flightAirport?: string;
  flightKm?: number;
}

export interface ShowcaseTool {
  href: string;
  icon: string;
  title: string;
  body: string;
}

export interface ShowcaseStep {
  n: string;
  title: string;
  body: string;
}

interface ShowcaseDict {
  tabSeason: string;
  tabTools: string;
  tabHow: string;
  tabPlan: string;
  planSubtitle: string;
  flightsTitle: string;
  flightsHint: string;
  hotelsTitle: string;
  hotelsHint: string;
  seasonTitle: string;
  seasonSubtitle: string;
  seasonCta: string;
  seasonAllCities: string;
  seasonFewerCities: string;
  seasonCityWeather: string;
  seasonFlight: string;
  seasonFlightTitle: string;
  seasonHigh: string;
  seasonRainNone: string;
  seasonRainOne: string;
  seasonRainTwo: string;
  seasonRainFew: string;
  seasonRainMany: string;
  seasonMethod: string;
  toolsSubtitle: string;
  toolCta: string;
  stepsTitle: string;
}

type TabKey = "season" | "tools" | "how" | "plan";

/**
 * Everything the site is, on one screen.
 *
 * The homepage used to run four full-height sections deep — favourites, then
 * this month, then the tools, then how it works — so seeing what Sfrtna
 * actually offers meant scrolling past three screens of it. A visitor who
 * doesn't scroll never learns the site has visa rules, city maps and currency
 * in it at all, which is most of its value and all of its difference.
 *
 * So the four sections are four tabs in one panel of fixed height. Nothing was
 * cut; it is the same content, reachable in a tap instead of a scroll, and the
 * page is a third of the length it was.
 *
 * The panel is deliberately a constant height across tabs. A tab strip that
 * makes the page jump as you move between tabs feels broken, and the jump is
 * worse than the empty row it avoids.
 *
 * It is navy, not white. A white card under a sunset photograph reads as a
 * different website pasted over the first one — the palette here is navy and
 * sunset orange, and the panel is the biggest surface on the page, so it is
 * the last thing that should be neutral. Dark, it continues the photograph
 * instead of interrupting it, and the destination photos inside it sit on the
 * dark ground they were shot against.
 */
export default function HomeShowcase({
  locale,
  seasonCities,
  initialPlan = null,
  tools,
  steps,
  dict,
}: {
  locale: Locale;
  seasonCities: ShowcaseCity[];
  /** Open on the booking tab, on this search (from the URL). */
  initialPlan?: PlanProduct | null;
  tools: ShowcaseTool[];
  steps: ShowcaseStep[];
  dict: ShowcaseDict;
}) {
  const [active, setActive] = useState<TabKey>(
    initialPlan ? "plan" : seasonCities.length > 0 ? "season" : "tools"
  );
  // The season tab runs every city in season past as a moving strip; the
  // button lays them all out as a still grid, in place rather than on
  // another page.
  const [allCities, setAllCities] = useState(false);
  // "Book your trip": which search is open inside the tab, if any.
  const [planProduct, setPlanProduct] = useState<PlanProduct | null>(initialPlan);

  // The header's "book your trip" (see planEvents.ts), and arriving on
  // /#plan from another page: both mean "show me the search".
  useEffect(() => {
    function show(product?: PlanProduct) {
      setActive("plan");
      if (product) setPlanProduct(product);
      requestAnimationFrame(() =>
        document.getElementById("plan")?.scrollIntoView({ behavior: "smooth", block: "start" })
      );
    }
    function onOpen(e: Event) {
      const p = (e as CustomEvent<PlanProduct | undefined>).detail;
      show(p === "flights" || p === "hotels" ? p : undefined);
    }
    function onHash() {
      if (window.location.hash === "#plan") show();
    }
    // Deferred, not called here: no synchronous setState in an effect body.
    const arrived = initialPlan ? undefined : window.setTimeout(onHash, 0);
    window.addEventListener(PLAN_EVENT, onOpen);
    window.addEventListener("hashchange", onHash);
    return () => {
      window.clearTimeout(arrived);
      window.removeEventListener(PLAN_EVENT, onOpen);
      window.removeEventListener("hashchange", onHash);
    };
  }, [initialPlan]);
  const isAr = locale === "ar";
  const arrow = isAr ? "←" : "→";

  // "Book your trip" first: it is the site's search now, and on a phone
  // the strip scrolls, so a tab at the far end is a tab nobody finds.
  const tabs: { key: TabKey; label: string; hidden?: boolean }[] = [
    { key: "plan", label: dict.tabPlan },
    { key: "season", label: dict.tabSeason, hidden: seasonCities.length === 0 },
    { key: "tools", label: dict.tabTools },
    { key: "how", label: dict.tabHow },
  ];

  const blurb: Record<TabKey, string> = {
    season: dict.seasonSubtitle,
    tools: dict.toolsSubtitle,
    how: dict.stepsTitle,
    plan: dict.planSubtitle,
  };

  const tabClass = (on: boolean) =>
    `shrink-0 rounded-full px-4 py-2.5 text-sm font-bold transition duration-200 sm:px-5 sm:text-base ${
      on
        ? "bg-sun-400 text-navy-950 shadow-lg shadow-sun-900/25"
        : "text-white/60 hover:bg-white/10 hover:text-white"
    }`;

  // "Plan your trip" is not another thing to browse — it is the way out of
  // browsing and into a search. So it looks like it at rest: a blue pill
  // with a sky-blue glow, its word and plane in the brand's gold. The blue
  // runs Travel Blue to navy rather than sky blue, because gold on sky blue
  // is barely readable (about 1.6:1) and gold on this is comfortably so.
  const planTabClass = (on: boolean) =>
    `relative inline-flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 text-sm font-extrabold transition duration-200 sm:px-6 sm:text-base ${
      on
        ? "bg-white text-navy-950 ring-2 ring-sea-400 shadow-[0_0_28px_-6px_var(--sea-400)]"
        : "bg-gradient-to-l from-sea-600 to-navy-900 text-sun-400 ring-2 ring-sea-400/70 shadow-[0_0_28px_-4px_var(--sea-400)] hover:from-sea-500 hover:to-navy-800 hover:text-sun-300"
    }`;

  const planChoices: { value: PlanProduct; icon: IconName; title: string; hint: string }[] = [
    { value: "flights", icon: "plane", title: dict.flightsTitle, hint: dict.flightsHint },
    { value: "hotels", icon: "hotel", title: dict.hotelsTitle, hint: dict.hotelsHint },
  ];

  const cityCard = (c: ShowcaseCity) => (
    <div key={`${c.code}-${c.slug}`} className="group relative isolate aspect-[3/4] overflow-hidden rounded-2xl ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:ring-sun-400/50">
      <Link href={`/${locale}/attractions/${c.code}/${c.slug}`} className="absolute inset-0 block">
        <Photo
          src={c.photo}
          className="absolute inset-0 -z-10 h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]"
          fallback={<div className="absolute inset-0 -z-10 bg-gradient-to-br from-navy-700 to-navy-990" />}
        />
        <div className="scrim-soft absolute inset-0 -z-10" />
        <span className="sr-only">{c.name}</span>
      </Link>
      {c.flightHref && (
        // A full navigation, not a client one: the planner reads its starting
        // trip once, when the page loads. The title names the airport, since
        // for some cities it is a nearby one (Petra flies into Aqaba).
        <a
          href={c.flightHref}
          title={dict.seasonFlightTitle
            .replace("{airport}", c.flightAirport ?? "")
            .replace("{km}", String(c.flightKm ?? ""))}
          className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-full bg-navy-990/75 px-2.5 py-1.5 text-xs font-extrabold text-sun-400 ring-1 ring-sun-400/50 backdrop-blur-md transition hover:bg-navy-990/90"
        >
          <Icon name="plane" className="h-3.5 w-3.5" />
          {dict.seasonFlight}
        </a>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-3">
        <p className="truncate font-display text-sm font-extrabold text-white drop-shadow-sm sm:text-base">{c.name}</p>
        <p className="truncate text-xs font-semibold text-white/70">{c.countryName}</p>
        {/* Two numbers, each saying what it is: the typical afternoon
            temperature, and how many days of the month see rain. */}
        <div className="mt-1.5 flex flex-wrap gap-1">
          <span className="inline-flex rounded-full bg-navy-990/65 px-2 py-0.5 text-xs font-bold text-sun-300 backdrop-blur-sm">
            {dict.seasonHigh.replace("{high}", String(Math.round(c.high)))}
          </span>
          <span className="inline-flex rounded-full bg-navy-990/65 px-2 py-0.5 text-xs font-bold text-sea-200 backdrop-blur-sm">
            {Math.round(c.rainyDays) === 0
              ? dict.seasonRainNone
              : countLabel(Math.round(c.rainyDays), {
                  one: dict.seasonRainOne,
                  two: dict.seasonRainTwo,
                  few: dict.seasonRainFew,
                  many: dict.seasonRainMany,
                })}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div id="plan" className="mx-auto max-w-7xl scroll-mt-24 px-3 sm:px-6">
      <div className="rounded-[2rem] bg-gradient-to-b from-navy-900 to-navy-990 shadow-[0_30px_80px_-20px_rgba(4,24,47,0.6)] ring-1 ring-white/10">
        {/* ── The strip ─────────────────────────────────────────────── */}
        <div className="rail rail-fade flex items-center gap-2 overflow-x-auto rounded-t-[2rem] border-b border-white/10 bg-white/[0.04] px-3 py-3 sm:px-5">
          {tabs
            .filter((t) => !t.hidden)
            .map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActive(t.key)}
                aria-pressed={active === t.key}
                className={t.key === "plan" ? planTabClass(active === t.key) : tabClass(active === t.key)}
              >
                {t.key === "plan" && (
                  <>
                    {/* A small beacon, so the eye finds it even in passing.
                        Still when the visitor prefers reduced motion. */}
                    {active !== "plan" && (
                      <span className="absolute -top-0.5 -end-0.5 flex h-3 w-3" aria-hidden="true">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-sun-400 opacity-75 motion-safe:animate-ping" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-sun-400 ring-2 ring-navy-900" />
                      </span>
                    )}
                    <Icon name="plane" className="h-[1.1rem] w-[1.1rem]" />
                  </>
                )}
                {t.key === "season" ? dict.seasonTitle : t.label}
              </button>
            ))}
        </div>

        {/* ── The panel ─────────────────────────────────────────────── */}
        <div className="p-4 sm:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-sm leading-relaxed text-white/65">{blurb[active]}</p>
            {active === "season" && seasonCities.length > 6 && (
              <button
                type="button"
                onClick={() => setAllCities((v) => !v)}
                aria-expanded={allCities}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/10 px-4 py-2.5 text-sm font-bold text-white ring-1 ring-white/20 transition hover:bg-white/20"
              >
                {allCities
                  ? dict.seasonFewerCities
                  : dict.seasonAllCities.replace("{count}", String(seasonCities.length))}
                <span aria-hidden="true" className={`transition ${allCities ? "-rotate-90" : ""}`}>
                  {arrow}
                </span>
              </button>
            )}
          </div>

          {/* Keyed on the tab so the fade replays on every switch. The floor
              on the height is what stops the page jumping under the strip
              when a shorter panel replaces a taller one — a jump reads as a
              glitch, and is worse than the blank inch it saves. */}
          <div key={active} className="tab-fade min-h-[16rem] sm:min-h-[15rem]">
            {active === "season" && (
              <>
                {allCities || seasonCities.length <= 6 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
                    {seasonCities.map((c) => cityCard(c))}
                  </div>
                ) : (
                  // Every city in season, drifting past (see .marquee in
                  // globals.css). The second copy is only there to close the
                  // loop, so it is inert: screen readers and the Tab key meet
                  // each city once.
                  <div className="marquee -mx-4 px-4 py-1 sm:-mx-7 sm:px-7">
                    <div
                      className="marquee-track"
                      style={{ "--marquee-duration": `${seasonCities.length * 5}s` } as CSSProperties}
                    >
                      {[0, 1].map((copy) => (
                        <div
                          key={copy}
                          className={`flex gap-3 pe-3 sm:gap-4 sm:pe-4 ${copy === 1 ? "marquee-copy" : ""}`}
                          aria-hidden={copy === 1 || undefined}
                          inert={copy === 1}
                        >
                          {seasonCities.map((c) => (
                            <div key={`${c.code}-${c.slug}`} className="w-40 shrink-0 sm:w-48">
                              {cityCard(c)}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="mt-4 text-xs text-white/45">
                  {dict.seasonMethod}{" "}
                  <Link href={`/${locale}/seasons`} className="font-bold text-white/70 underline-offset-2 hover:underline">
                    {dict.seasonCta}
                  </Link>
                </p>
              </>
            )}

            {active === "tools" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
                {tools.map((t) => (
                  <Link
                    key={t.href}
                    href={t.href}
                    className="group relative flex flex-col overflow-hidden rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:bg-white/[0.12] hover:ring-sun-400/40"
                  >
                    <span
                      className="absolute inset-x-0 top-0 h-[3px] origin-left scale-x-0 bg-gradient-to-r from-sun-300 to-sun-600 transition-transform duration-300 group-hover:scale-x-100 rtl:origin-right"
                      aria-hidden="true"
                    />
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sun-400/15 text-xl ring-1 ring-sun-400/30">
                      {t.icon}
                    </span>
                    <h3 className="mt-3.5 font-display text-base font-extrabold text-white">
                      {t.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/60">{t.body}</p>
                    <span className="mt-auto inline-flex items-center gap-1 pt-3.5 text-sm font-bold text-sun-300">
                      {dict.toolCta}
                      <span
                        className="transition-transform group-hover:translate-x-1 rtl:group-hover:-translate-x-1"
                        aria-hidden="true"
                      >
                        {arrow}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {active === "plan" && (
              <div>
                {/* Flights or hotels, then that search opens right here —
                    the choice shrinks to a switch once a form is showing. */}
                <div
                  role="radiogroup"
                  aria-label={dict.tabPlan}
                  className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:gap-4"
                >
                  {planChoices.map((c) => {
                    const on = planProduct === c.value;
                    const compact = planProduct !== null;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setPlanProduct(c.value)}
                        className={`group flex items-center gap-3 rounded-2xl text-start ring-1 transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400 sm:gap-4 ${
                          compact ? "justify-center px-4 py-3" : "p-5 hover:-translate-y-1 sm:p-8"
                        } ${
                          on
                            ? "bg-white text-navy-950 ring-white"
                            : "bg-white/[0.06] text-white ring-white/10 hover:bg-white/[0.12] hover:ring-sun-400/50"
                        }`}
                      >
                        <span
                          className={`flex shrink-0 items-center justify-center rounded-full ${
                            compact ? "h-9 w-9" : "h-12 w-12 sm:h-14 sm:w-14"
                          } ${on || !compact ? "bg-sun-400 text-navy-950" : "bg-white/10 text-sun-400"}`}
                        >
                          <Icon name={c.icon} className={compact ? "h-[1.125rem] w-[1.125rem]" : "h-6 w-6 sm:h-7 sm:w-7"} />
                        </span>
                        <span className="min-w-0">
                          <span className={`block font-display font-extrabold ${compact ? "text-base" : "text-lg sm:text-h3"}`}>
                            {c.title}
                          </span>
                          <span className={`mt-0.5 block text-xs sm:text-sm ${on ? "text-navy-700" : "text-white/60"}`}>
                            {c.hint}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {planProduct !== null && (
                  // Top margin: each planner's own two tabs sit half outside
                  // its panel's top edge. No overflow-hidden anywhere above —
                  // the calendar and travellers counter hang below the panel.
                  <div className="mt-12 rounded-2xl bg-navy-990/60 px-4 pb-5 ring-1 ring-white/15 sm:px-6 sm:pb-6">
                    <Suspense fallback={null}>
                      {planProduct === "flights" ? (
                        <TripPlanner locale={locale} tone="dark" />
                      ) : (
                        <HotelPlanner locale={locale} tone="dark" />
                      )}
                    </Suspense>
                  </div>
                )}
              </div>
            )}

            {active === "how" && (
              <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
                {steps.map((s) => (
                  <li
                    key={s.n}
                    className="relative rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10"
                  >
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-sun-400 font-display text-base font-black text-navy-950">
                      {s.n}
                    </span>
                    <h3 className="mt-3.5 font-display text-base font-extrabold text-white">
                      {s.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-white/60">{s.body}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
