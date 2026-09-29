"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "@/lib/types";
import { getDictionary } from "@/lib/dictionaries";
import { findAirport } from "@/lib/airports";
import { countLabel } from "@/lib/format";
import Icon from "@/components/ui/Icon";

/**
 * The flight results, held to the traveller's budget — drawn as our own
 * cards, from the live search's own data.
 *
 * The partner widget still runs the search (every fare, airline and time on
 * these cards is read from what it found) and still takes the booking: our
 * "Book this flight" presses that same flight's button in the widget, so
 * its offers open and the booking carries our marker. What changes is what
 * the traveller sees, in the order they read it:
 *
 *   1. one flight picked for them within the budget — the widget's own
 *      "best" if it fits, otherwise the cheapest that does — as one card:
 *      the airline, each way with its times, airports, length and stops, and
 *      beside it the total, one booking button, and a quiet box for the
 *      flights over budget (how many, and from how much more);
 *   2. along its foot, the other flights within the budget, with their
 *      count. Opened, they line up under the pick, cheapest first, each
 *      with its difference from the pick;
 *   3. when nothing fits, the page says what flights there start at, and the
 *      over-budget flights are one tap away, each saying by how much.
 *
 * Gold is for the pick and the booking button; everything else is navy on
 * white, so nothing competes with the answer. Nothing is shown that the
 * search did not give us — no ratings, no meals.
 *
 * Markers read in the widget's shadow root (checked on sfrtna.com, 28 Sep 2026):
 *
 *   card          [class*="FlightCard-module__card___"]  (data-testid flight-card-…)
 *   book button   [class*="FlightCard-module__cardLeftButton"]  (::after is a hover overlay)
 *   airlines      [class*="FlightCard-module__cardTop___"] [class*="AirCompany-module__cardAirCompany___"]
 *                 → name as text, or in [class*="Tooltip-module__text"] when several share a card
 *   one leg       [class*="Flight-module__cardFlight___"]
 *   leg ends      [class*="cardFlightInfo"] → cardFlightTime, cardFlightCity, cardFlightDay, cardFlightAirport
 *   duration      [class*="cardFlightTravelTime"]  → "رحلة مباشرةمدة الرحلة: 4س 10دقيقة"
 *   a stop        [class*="cardFlightTravelLineTransfer"] → airportCode + "15س 15م transfer"
 *   price         [data-testid^="flight-card-price-"]
 *   baggage       [class*="cardLeftBaggageLeftPc"]  → "+481" when extra
 *   tags          [class*="cardBadges"]             → "الاختيار الأمثل"
 *   searching     [class*="SearchProgressbar"]
 *   more button   [class*="TicketsWidget-module__moreTickets"]
 */

const STYLE_ID = "sfr-guide-style";

function css(bookLabel: string): string {
  const label = bookLabel.replace(/["\\]/g, "");
  return `
[class*="DirectFlights-module__root"]{display:none !important}
/* Its nearby-dates strip: prices there are not the live ones. */
[class*="FlightMatrix"]{display:none !important}
/* "Book this flight" instead of the widget's "Select ticket", where its own
   cards are shown (no budget, or another currency). */
[class*="FlightCard-module__cardLeftButton"] > span{display:none !important}
[class*="FlightCard-module__cardLeftButton"]::after{content:"${label}" !important;position:static !important;opacity:1 !important;background:none !important;width:auto !important;height:auto !important;inset:auto !important;font-family:inherit;font-weight:800}
/* With a budget, our cards above are the list; the widget's stay hidden
   (still there, so their buttons open the offers). */
:host([data-sfr-filter]) [class*="FlightCard-module__card___"],
:host([data-sfr-filter]) [class*="TicketsWidget-module__moreTickets"],
:host([data-sfr-filter]) [class*="FlightFilters-module__filerContainer"],
:host([data-sfr-filter]) [class*="FlightFiltersMobileMenu-module__root"]{display:none !important}
:host([data-sfr-filter]) [class*="TicketsWidget-module__wrapper"]{grid-column:1 / -1 !important}
/* With a budget, our page is the list: the widget's own results, its
   placeholders and its progress bar stay hidden (still running, so its
   buttons open the offers). Our search bar sits at the top instead. */
:host([data-sfr-own]) [class*="TicketsWidget-module__root"]{display:none !important}
`;
}

/** "1,250 SAR" — Western digits, like the rest of the site's prices. */
function moneyIn(currency: string, n: number): string {
  return `${Math.round(Math.abs(n)).toLocaleString("en-US")} ${currency}`;
}

const TAG_BEST = /الأمثل|best/i;

const CURRENCY_MARKS: [RegExp, string][] = [
  [/ر\.س|SAR/, "SAR"],
  [/د\.إ|AED/, "AED"],
  [/د\.ك|KWD/, "KWD"],
  [/ر\.ق|QAR/, "QAR"],
  [/د\.ب|BHD/, "BHD"],
  [/ر\.ع|OMR/, "OMR"],
  [/US\$|\$|USD/, "USD"],
  [/€|EUR/, "EUR"],
  [/£|GBP/, "GBP"],
];
function currencyOf(text: string): string | null {
  for (const [re, code] of CURRENCY_MARKS) if (re.test(text)) return code;
  return null;
}
function western(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}
function amountOf(text: string): number | null {
  const n = Number(western(text).replace(/[^\d.,]/g, "").replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}
function clean(el: Element | null | undefined): string {
  return (el?.textContent || "").replace(/[\u202a-\u202e]/g, "").replace(/\s+/g, " ").trim();
}


interface Stop {
  city: string;
  wait: string;
}
interface Leg {
  depTime: string;
  depCode: string;
  depCity: string;
  depDay: string;
  arrTime: string;
  arrCode: string;
  arrCity: string;
  /** Days later than it left: "+1" on the arrival time. */
  plusDays: number;
  duration: string;
  minutes: number;
  stops: Stop[];
}
interface Flight {
  id: string;
  /** The fare as found, without an added bag — what the budget is held to. */
  price: number;
  airlines: string[];
  logos: string[];
  legs: Leg[];
  /** Average length of its flights, in minutes. */
  avgMinutes: number;
  /** Most stops on any one way. */
  maxStops: number;
  /** "in": the fare includes a checked bag; "extra": one can be added. */
  bag: "in" | "extra" | null;
  /** What adding the bag costs, as the widget prices it. */
  bagExtra: number | null;
  /** "1×23 كجم". */
  bagAllowance: string;
  /** The traveller added the bag here; `total` is then the widget's own new fare. */
  bagOn: boolean;
  total: number;
  best: boolean;
}

interface State {
  searching: boolean;
  settled: boolean;
  /** With a budget in the widget's currency, we draw the cards. */
  filtering: boolean;
  comparable: boolean;
  total: number;
  /** Within the budget, cheapest first. */
  fits: Flight[];
  /** Over the budget, cheapest first. */
  over: Flight[];
  hasMore: boolean;
}

const EMPTY: State = {
  searching: true,
  settled: false,
  filtering: false,
  comparable: true,
  total: 0,
  fits: [],
  over: [],
  hasMore: false,
};

/**
 * Cards where the traveller added a bag through our switch, with the fare
 * they had before it. The widget then shows the fare with the bag; we keep
 * holding the flight to the budget by the fare without it.
 */
const bagBase = new Map<string, number>();

function ticketsRoot(): ShadowRoot | null {
  return document.getElementById("tpwl-tickets")?.shadowRoot ?? null;
}
function cardById(id: string): Element | null {
  return ticketsRoot()?.querySelector(`[data-testid="${CSS.escape(id)}"]`) ?? null;
}
/** "4س 25دقيقة" / "1يوم 3س" / "1d 3h 25m" → minutes. */
function minutesOf(text: string): number {
  const s = western(text);
  const d = s.match(/(\d+)\s*(?:يوم|أيام|ايام|d)/i);
  const h = s.match(/(\d+)\s*(?:س|h)/i);
  const m = s.match(/(\d+)\s*(?:د|m)/i);
  return (d ? Number(d[1]) * 1440 : 0) + (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

type Tab = "best" | "cheapest" | "fastest";
type Sort = "cheapest" | "fastest";

export default function FlightResultsGuide({
  locale,
  budget,
  currency,
  travelers,
  cityName,
  editHref,
  directOnly = false,
  bagIncluded = false,
}: {
  locale: Locale;
  /** The flight budget for the whole party; 0 when none was given. */
  budget: number;
  currency: string;
  travelers: number;
  cityName: string;
  /** Back to the search form, filled in. */
  editHref: string;
  /** Preferences from the search form: held to on the pick and the lists. */
  directOnly?: boolean;
  bagIncluded?: boolean;
}) {
  const t = getDictionary(locale).results;
  const [state, setState] = useState<State>(EMPTY);
  const [tab, setTab] = useState<Tab>("best");
  const [showWithin, setShowWithin] = useState(false);
  const [showOver, setShowOver] = useState(false);
  const [sort, setSort] = useState<Sort>("cheapest");
  const [onlyDirect, setOnlyDirect] = useState(directOnly);
  const [onlyBag, setOnlyBag] = useState(bagIncluded);
  const [limit, setLimit] = useState(10);
  const money = (n: number) => moneyIn(currency, n);
  const dur = (min: number) => {
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return `${h}${t.durHours} ${String(m).padStart(2, "0")}${t.durMinutes}`;
  };

  // Read the widget's cards every 800ms: it re-draws them whenever it
  // sorts, loads more, or refreshes a fare.
  useEffect(() => {
    const cityOf = (code: string) => {
      const a = findAirport(code);
      return a ? (locale === "ar" ? a.cityAr : a.cityEn) : code;
    };
    let lastKey = "";
    let lastChange = Date.now();
    let sawProgress = false;
    let autoLoaded = false;
    // Reading two hundred cards takes tens of milliseconds; once the search
    // has settled, read again only when the widget has changed something.
    let dirty = true;
    let settledOnce = false;
    let watched: ShadowRoot | null = null;
    const observer = new MutationObserver(() => {
      dirty = true;
    });

    function read(card: Element, shown: number, best: boolean): Flight {
      const id = card.getAttribute("data-testid") || "";
      const top = card.querySelector('[class*="FlightCard-module__cardTop___"]') ?? card;
      const companies = [...top.querySelectorAll('[class*="AirCompany-module__cardAirCompany___"]')];
      const airlines = [
        ...new Set(
          companies
            .map((c) => clean(c.querySelector('[data-role="flight-card-air-company"]')) || clean(c.querySelector('[class*="Tooltip-module__text"]')))
            .filter(Boolean)
        ),
      ];
      const logos = [
        ...new Set(companies.map((c) => c.querySelector("img")?.getAttribute("src") || "").filter(Boolean)),
      ].slice(0, 2);
      const legs = [...card.querySelectorAll('[class*="Flight-module__cardFlight___"]')].map((leg): Leg => {
        const [dep, arr] = [...leg.querySelectorAll('[class*="cardFlightInfo"]')];
        const part = (end: Element | undefined, cls: string) => clean(end?.querySelector(`[class*="${cls}"]`));
        const depDay = part(dep, "cardFlightDay");
        const dayNum = (s: string) => Number(western(s).match(/\d+/)?.[0] ?? NaN);
        const d = dayNum(part(arr, "cardFlightDay")) - dayNum(depDay);
        const plusDays = Number.isFinite(d) ? (d < 0 ? 1 : d) : 0;
        const stops = [...leg.querySelectorAll('[class*="cardFlightTravelLineTransfer"]')].map((s) => {
          const code = clean(s.querySelector('[class*="airportCode"]'));
          const wait = clean(s).replace(code, "").replace(/transfer/i, "").trim();
          return { city: cityOf(code), wait };
        });
        const duration = clean(leg.querySelector('[class*="cardFlightTravelTime"]')).replace(/^.*:\s*/, "");
        return {
          depTime: part(dep, "cardFlightTime"),
          depCode: part(dep, "cardFlightAirport"),
          depCity: part(dep, "cardFlightCity"),
          depDay,
          arrTime: part(arr, "cardFlightTime"),
          arrCode: part(arr, "cardFlightAirport"),
          arrCity: part(arr, "cardFlightCity"),
          plusDays,
          duration,
          minutes: minutesOf(duration),
          stops,
        };
      });

      // Baggage, as the widget prices it: "+308 ر.س" beside its switch
      // when a bag can be added; the allowance in its tooltip.
      const bagBox = card.querySelector('[class*="cardLeftBaggage"]');
      const bagLabel = clean(card.querySelector('[class*="cardLeftBaggageLeftPc"]'));
      const allowance = western(clean(card.querySelector('[class*="cardTooltipBaggageItem"]'))).match(/(\d+)\s*x\s*(\d+)/i);
      const checked = Boolean((bagBox?.querySelector("input") as HTMLInputElement | null)?.checked);
      const base = bagBase.get(id);
      const bagOn = checked && base !== undefined;
      const price = bagOn ? (base as number) : shown;
      const bag: Flight["bag"] = bagOn || bagLabel.includes("+") ? "extra" : /تشمل الأمتعة|baggage included/i.test(bagLabel) ? "in" : null;
      const bagExtra = bagOn ? shown - price : bagLabel.includes("+") ? amountOf(bagLabel.split("+")[1] ?? "") : null;

      const minutes = legs.map((l) => l.minutes).filter((m) => m > 0);
      return {
        id,
        price,
        airlines,
        logos,
        legs,
        avgMinutes: minutes.length ? minutes.reduce((a, b) => a + b, 0) / minutes.length : 0,
        maxStops: legs.reduce((m, l) => Math.max(m, l.stops.length), 0),
        bag,
        bagExtra,
        bagAllowance: allowance ? `${allowance[1]}×${allowance[2]} ${locale === "ar" ? "كجم" : "kg"}` : "",
        bagOn,
        total: shown,
        best,
      };
    }

    function pass() {
      const host = document.getElementById("tpwl-tickets");
      const root = host?.shadowRoot;
      if (!host || !root) return;
      if (!root.getElementById(STYLE_ID)) {
        const style = document.createElement("style");
        style.id = STYLE_ID;
        style.textContent = css(t.cardBook);
        root.appendChild(style);
      }
      if (watched !== root) {
        observer.disconnect();
        observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true });
        watched = root;
        dirty = true;
      }
      if (!dirty && settledOnce) return;
      dirty = false;

      const cards = [...root.querySelectorAll('[class*="FlightCard-module__card___"]')];
      const priced = cards.map((card) => {
        const text = card.querySelector('[data-testid^="flight-card-price-"]')?.textContent || "";
        const best = [...card.querySelectorAll('[class*="cardBadges"]')].some((b) => TAG_BEST.test(b.textContent || ""));
        return { card, price: amountOf(text), cur: currencyOf(text), best };
      });
      const widgetCurrency = priced.find((p) => p.cur)?.cur ?? null;
      const comparable = budget > 0 && (widgetCurrency === null || widgetCurrency === currency);
      const filtering = comparable && priced.length > 0;
      if (filtering) host.setAttribute("data-sfr-filter", "");
      else host.removeAttribute("data-sfr-filter");
      // Until a fare shows otherwise, assume it can be held to the budget.
      if (budget > 0 && (priced.length === 0 || comparable)) host.setAttribute("data-sfr-own", "");
      else host.removeAttribute("data-sfr-own");

      const flights = filtering
        ? priced.filter((p) => p.price !== null).map((p) => read(p.card, p.price as number, p.best))
        : [];
      const fits = flights.filter((f) => f.price <= budget).sort((a, b) => a.price - b.price);
      const over = flights.filter((f) => f.price > budget).sort((a, b) => a.price - b.price);

      const searching = Boolean(root.querySelector('[class*="SearchProgressbar"]'));
      if (searching) sawProgress = true;
      const moreButton = root.querySelector('[class*="TicketsWidget-module__moreTickets"]');
      // The widget shows its ten cheapest first — often all low-cost fares
      // without a bag. Load the rest once the search is done, so "best",
      // "fastest" and "bag included" are chosen from every flight found.
      if (filtering && !searching && sawProgress && !autoLoaded && moreButton) {
        autoLoaded = true;
        ((moreButton.querySelector("button") ?? moreButton) as HTMLElement).click();
      }
      const hasMore = Boolean(moreButton);
      const base = { searching, filtering, comparable: budget <= 0 || comparable, total: priced.length, fits, over, hasMore };
      const key = JSON.stringify(base);
      if (key !== lastKey) {
        lastKey = key;
        lastChange = Date.now();
      }
      const calm = Date.now() - lastChange;
      const settled = !searching && (priced.length > 0 || sawProgress) && calm >= (sawProgress ? 1000 : 4000);
      if (settled) settledOnce = true;
      else dirty = true; // keep reading until the search has settled
      setState((prev) => {
        const next = { ...base, settled };
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
    }

    pass();
    // Every 400 ms while the search runs, so the answer shows the moment the
    // first fares land; once settled the observer above keeps reads rare.
    const id = window.setInterval(pass, 400);
    return () => {
      window.clearInterval(id);
      observer.disconnect();
    };
  }, [locale, budget, currency, t]);

  /** The widget opens this flight's offers, as its own button would. */
  const book = useCallback((id: string) => {
    (cardById(id)?.querySelector('[class*="FlightCard-module__cardLeftButton"]') as HTMLElement | null)?.click();
  }, []);
  /** Add or remove the bag through the widget's own switch, so its fare is the one booked. */
  const toggleBag = useCallback((f: Flight) => {
    const input = cardById(f.id)?.querySelector('[class*="cardLeftBaggage"] input') as HTMLInputElement | null;
    if (!input) return;
    if (!input.checked) bagBase.set(f.id, f.price);
    else window.setTimeout(() => bagBase.delete(f.id), 4000);
    input.click();
  }, []);
  const loadMore = useCallback(() => {
    const more = ticketsRoot()?.querySelector('[class*="TicketsWidget-module__moreTickets"]');
    ((more?.querySelector("button") ?? more) as HTMLElement | null)?.click();
  }, []);

  const hasBudget = budget > 0;
  // The traveller's preferences from the search form — direct only, a
  // checked bag in the fare — decide what can be picked. A bag counts only
  // when the fare includes it, so the price shown is the price with it.
  // When nothing found meets them, say so and show everything found.
  const meets = (f: Flight) => (!directOnly || f.maxStops === 0) && (!bagIncluded || f.bag === "in");
  const prefsSet = directOnly || bagIncluded;
  const prefsMatch = !prefsSet || [...state.fits, ...state.over].some(meets);
  // Until every flight is in, a flight that ignores the preferences is not
  // shown as the answer: the one that meets them may still be loading.
  const waitForPrefs = prefsSet && !prefsMatch && !state.settled;
  const fits = waitForPrefs ? [] : prefsSet && prefsMatch ? state.fits.filter(meets) : state.fits;
  const over = waitForPrefs ? [] : prefsSet && prefsMatch ? state.over.filter(meets) : state.over;
  const prefsLabel = [directOnly ? t.chipDirect : "", bagIncluded ? t.chipBag : ""].filter(Boolean).join(" · ");
  const bestFit = fits.find((f) => f.best) ?? fits[0] ?? null;
  const cheapestFit = fits[0] ?? null;
  const fastestFit = fits.length
    ? fits.reduce((a, b) => (b.avgMinutes > 0 && (a.avgMinutes === 0 || b.avgMinutes < a.avgMinutes) ? b : a))
    : null;
  const shown = tab === "cheapest" ? cheapestFit : tab === "fastest" ? fastestFit : bestFit;
  const others = fits.filter((f) => f !== shown);
  // Nothing fits — said as soon as the first fares are in, not after the
  // whole search: the cheapest so far is a real fare, labelled "so far",
  // and becomes "start from" once every agency has answered. Should a fare
  // within budget turn up later, this gives way to it.
  const noneWithin = hasBudget && state.filtering && !shown && over.length > 0 && !waitForPrefs;
  const noneBody = (state.settled ? t.guideNoneBody : t.guideNoneSoFar)
    .replace("{city}", cityName)
    .replace("{amount}", money(over[0]?.price ?? 0))
    .replace("{count}", String(travelers))
    .replace("{budget}", money(budget))
    .replace("{over}", money((over[0]?.price ?? budget) - budget));
  // Nothing fits: say so over the page, once, when every flight is in —
  // not from the first ten, whose cheapest may not be the cheapest.
  const [noneDismissed, setNoneDismissed] = useState(false);
  const closeNone = useCallback(() => setNoneDismissed(true), []);
  const flightsLabel = (n: number) =>
    countLabel(n, { one: t.flightsOne, two: t.flightsTwo, few: t.flightsFew, many: t.flightsMany });
  const overFrom = over.length ? over[0].price - budget : 0;

  const refine = (list: Flight[]) =>
    list
      .filter((f) => (!onlyDirect || f.maxStops === 0) && (!onlyBag || f.bag === "in" || f.bagOn))
      .sort((a, b) => (sort === "fastest" ? a.avgMinutes - b.avgMinutes || a.price - b.price : a.price - b.price));
  const withinAll = refine(others);
  const overAll = refine(over);
  const withinShown = withinAll.slice(0, limit);
  const overShown = overAll.slice(0, limit);
  const moreHidden = (showWithin && withinAll.length > limit) || (showOver && overAll.length > limit);

  const card = { locale, t, money, travelers, budget, onBook: book, onBag: toggleBag };

  const chip = (on: boolean, onClick: () => void, label: string) => (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-bold transition ${
        on ? "bg-navy-950 text-white" : "bg-white text-navy-800 ring-1 ring-mist-300 hover:ring-navy-300"
      }`}
    >
      {label}
    </button>
  );
  const controls = (
    <div className="mb-3 mt-4 flex flex-wrap items-center gap-2">
      {chip(sort === "cheapest", () => setSort("cheapest"), t.tabCheapest)}
      {chip(sort === "fastest", () => setSort("fastest"), t.tabFastest)}
      <span className="mx-1 h-6 w-px bg-mist-300" aria-hidden="true" />
      {chip(onlyDirect, () => setOnlyDirect((v) => !v), t.chipDirect)}
      {chip(onlyBag, () => setOnlyBag((v) => !v), t.chipBag)}
    </div>
  );

  const overToggle = over.length > 0 && (
    <button
      type="button"
      aria-expanded={showOver}
      onClick={() => setShowOver((v) => !v)}
      className="flex w-full items-center gap-3 rounded-xl bg-mist-50 px-4 py-3 text-start ring-1 ring-mist-200 transition hover:ring-navy-300"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold text-navy-950">{t.overBoxTitle}</span>
        <span className="mt-0.5 block text-xs font-semibold text-navy-500">
          {t.overBoxSub.replace("{count}", flightsLabel(over.length)).replace("{amount}", money(overFrom))}
        </span>
      </span>
      <Icon name="chevron" className={`h-4 w-4 text-navy-600 transition ${showOver ? "rotate-180" : ""}`} />
    </button>
  );

  const tabs: { key: Tab; label: string; f: Flight | null }[] = [
    { key: "best", label: t.tabBest, f: bestFit },
    { key: "cheapest", label: t.tabCheapest, f: cheapestFit },
    { key: "fastest", label: t.tabFastest, f: fastestFit },
  ];

  return (
    <section aria-live="polite">
      {state.settled && prefsSet && !prefsMatch && state.total > 0 && (
        <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 ring-1 ring-amber-200">
          {t.prefsNoMatch.replace("{prefs}", prefsLabel)}
        </p>
      )}

      {/* The search, while it runs: at the top, where the answer will be. */}
      {(state.searching || (!state.settled && !shown)) && !noneWithin && (
        <div className="mb-6 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-navy-700">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sun-400" aria-hidden="true" />
              {t.guideSearching}
            </p>
          </div>
          <div className="h-1 w-full overflow-hidden bg-sun-100" aria-hidden="true">
            <div className="sfr-progress h-full w-1/3 rounded-full bg-sun-400" />
          </div>
        </div>
      )}


      {shown && (
        <>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div>
              <h2 className="font-display text-xl font-extrabold text-navy-950">{t.guidePickedTitle}</h2>
              {prefsSet && prefsMatch && (
                <p className="mt-1 text-sm font-semibold text-navy-600">{t.prefsApplied.replace("{prefs}", prefsLabel)}</p>
              )}
            </div>
            <p className="text-sm font-semibold text-navy-600">{t.pickLeft.replace("{amount}", money(budget - shown.price))}</p>
          </div>

          {/* Best, cheapest, fastest — within the budget, at a glance. */}
          <div role="tablist" className="mb-6 grid grid-cols-3 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-mist-200">
            {tabs.map(({ key, label, f }, i) => {
              const on = tab === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  disabled={!f}
                  onClick={() => setTab(key)}
                  className={`px-3 py-3 text-start transition sm:px-5 ${i > 0 ? "border-s border-mist-200" : ""} ${
                    on ? "bg-navy-950 text-white" : "text-navy-950 hover:bg-mist-50"
                  }`}
                >
                  <span className={`block text-sm font-bold ${on ? "text-white/80" : "text-navy-600"}`}>{label}</span>
                  <span className="mt-0.5 block font-display text-lg font-black sm:text-xl">
                    {f ? <bdi dir="ltr">{money(f.price)}</bdi> : "—"}
                  </span>
                  {f && f.avgMinutes > 0 && (
                    <span className={`block text-xs ${on ? "text-white/70" : "text-navy-500"}`}>
                      {t.tabAvg.replace("{d}", dur(f.avgMinutes))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <FlightCard
            {...card}
            flight={shown}
            featured
            badge={tab === "cheapest" ? t.badgeCheapest : tab === "fastest" ? t.badgeFastest : t.pickBadge}
            aside={overToggle || null}
            foot={
              others.length > 0 && (
                <button
                  type="button"
                  aria-expanded={showWithin}
                  onClick={() => setShowWithin((v) => !v)}
                  className="flex w-full items-center gap-3 rounded-xl bg-navy-950/[0.04] px-4 py-3.5 text-start transition hover:bg-navy-950/[0.07]"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-navy-800 ring-1 ring-mist-200">
                    <Icon name="search" className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-base font-extrabold text-navy-950">
                      {showWithin ? t.allWithinHide : t.withinBarTitle}
                      <span className="rounded-full bg-navy-900 px-2 py-0.5 text-xs font-black text-white">{others.length}</span>
                    </span>
                    <span className="mt-0.5 block text-xs font-semibold text-navy-500">{t.withinBarSub}</span>
                  </span>
                  <Icon name="chevron" className={`h-5 w-5 text-navy-700 transition ${showWithin ? "rotate-180" : ""}`} />
                </button>
              )
            }
          />

          {showWithin && (
            <>
              {controls}
              <ol className="space-y-3">
                {withinShown.map((f) => (
                  <li key={f.id}>
                    <FlightCard {...card} flight={f} diff={f.price - shown.price} />
                  </li>
                ))}
              </ol>
              {withinShown.length === 0 && (
                <p className="rounded-2xl bg-white px-5 py-4 text-sm text-navy-600 ring-1 ring-mist-200">{t.listNone}</p>
              )}
            </>
          )}
        </>
      )}

      {noneWithin && !noneDismissed && over.length > 0 && (
        <NoneWithinDialog
          title={t.guideNoneTitle}
          body={noneBody}
          searching={!state.settled}
          searchingLabel={t.guideStillSearching}
          showLabel={t.noneShowFlights}
          editLabel={t.noneEditSearch}
          closeLabel={t.closeOptions}
          editHref={editHref}
          onShow={() => {
            setNoneDismissed(true);
            setShowOver(true);
          }}
          onClose={closeNone}
        />
      )}

      {noneWithin && state.total > 0 && over.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5">
          <p className="font-display text-lg font-extrabold text-navy-950">{t.guideNoneTitle}</p>
          <p className="mt-1 text-sm leading-relaxed text-navy-600">{noneBody}</p>
          <div className="mt-4">{overToggle}</div>
        </div>
      )}

      {showOver && over.length > 0 && (
        <>
          {!showWithin && controls}
          <ol className={`space-y-3 ${showWithin ? "mt-3" : ""}`}>
            {overShown.map((f) => (
              <li key={f.id}>
                <FlightCard {...card} flight={f} overBy={f.price - budget} diff={shown ? f.price - shown.price : undefined} />
              </li>
            ))}
          </ol>
          {overShown.length === 0 && (
            <p className="rounded-2xl bg-white px-5 py-4 text-sm text-navy-600 ring-1 ring-mist-200">{t.listNone}</p>
          )}
        </>
      )}

      {(showWithin || showOver) && (moreHidden || state.hasMore) && (
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => (moreHidden ? setLimit((n) => n + 10) : loadMore())}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-navy-800 ring-1 ring-mist-300 transition hover:ring-navy-300"
          >
            {t.dialogLoadMore}
          </button>
        </div>
      )}

      {!hasBudget && state.settled && (
        <p className="rounded-2xl bg-white px-5 py-4 text-sm text-navy-600 ring-1 ring-black/5">
          {t.guideNoBudget.replace("{count}", String(travelers))}
        </p>
      )}
      {hasBudget && state.settled && !state.comparable && (
        <p className="rounded-2xl bg-white px-5 py-4 text-sm text-navy-600 ring-1 ring-black/5">{t.guideOtherCurrency}</p>
      )}
      {state.settled && state.total === 0 && (
        <p className="rounded-2xl bg-white px-5 py-4 text-sm text-navy-600 ring-1 ring-black/5">{t.guideNoResults}</p>
      )}
    </section>
  );
}

type Dict = ReturnType<typeof getDictionary>["results"];

/**
 * One flight, as a card: the airline and two tags — direct (blue) or its
 * stops (light red), bag included (green) or not (grey); each way as
 * departure — the line with its length and stops — arrival; and beside it
 * the total, the bag switch with its price, and the booking button.
 */
function FlightCard({
  flight,
  locale,
  t,
  money,
  travelers,
  budget,
  onBook,
  onBag,
  featured = false,
  badge,
  aside,
  foot,
  diff,
  overBy,
}: {
  flight: Flight;
  locale: Locale;
  t: Dict;
  money: (n: number) => string;
  travelers: number;
  budget: number;
  onBook: (id: string) => void;
  onBag: (f: Flight) => void;
  featured?: boolean;
  badge?: string;
  aside?: React.ReactNode;
  foot?: React.ReactNode;
  diff?: number;
  overBy?: number;
}) {
  const isAr = locale === "ar";
  const labels = flight.legs.length === 2 ? [t.cardOutbound, t.cardReturn] : flight.legs.map(() => t.cardLeg);
  const pay = flight.bagOn ? flight.total : flight.price;
  const bagOver = flight.bagOn && budget > 0 ? flight.total - budget : 0;

  return (
    <article
      className={`relative rounded-3xl bg-white shadow-sm ${
        featured ? "mt-5 ring-2 ring-sun-400 shadow-[0_18px_40px_-24px_rgba(6,38,83,0.45)]" : "ring-1 ring-mist-200"
      }`}
    >
      {featured && badge && (
        <span className="absolute -top-4 start-6 inline-flex items-center gap-1.5 rounded-full bg-sun-400 px-4 py-1.5 text-sm font-extrabold text-navy-950 shadow-sm">
          <Icon name="star" className="h-4 w-4" />
          {badge}
        </span>
      )}

      <div className="grid md:grid-cols-[minmax(0,1fr)_260px]">
        {/* The flight. */}
        <div className={`p-4 sm:p-5 ${featured ? "pt-6 sm:pt-7" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex shrink-0 -space-x-2 rtl:space-x-reverse">
                {flight.logos.length ? (
                  flight.logos.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={src} src={src} alt="" className="h-11 w-11 rounded-xl bg-white object-contain ring-1 ring-mist-200" />
                  ))
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mist-100 text-navy-700">
                    <Icon name="plane" className="h-5 w-5" />
                  </span>
                )}
              </div>
              <p className="min-w-0 truncate font-display text-base font-extrabold text-navy-950 sm:text-lg">
                {flight.airlines.join(" + ")}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {flight.legs.length > 0 &&
                (flight.maxStops === 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800 ring-1 ring-sky-200">
                    <Icon name="plane" className="h-3.5 w-3.5" />
                    {t.chipDirect}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 ring-1 ring-rose-200">
                    <Icon name="route" className="h-3.5 w-3.5" />
                    {t.chipStops.replace("{n}", String(flight.maxStops))}
                  </span>
                ))}
              {flight.bag === "in" || flight.bagOn ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
                  <Icon name="luggage" className="h-3.5 w-3.5" />
                  {t.cardBagIn}
                  {flight.bagAllowance && <span className="font-semibold">· {flight.bagAllowance}</span>}
                </span>
              ) : flight.bag === "extra" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-mist-100 px-3 py-1.5 text-xs font-bold text-navy-600 ring-1 ring-mist-200">
                  <Icon name="luggage" className="h-3.5 w-3.5" />
                  {t.cardBagExtra}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-4 divide-y divide-mist-100 rounded-2xl ring-1 ring-mist-100">
            {flight.legs.map((l, i) => (
              <div key={i} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 p-3 sm:grid-cols-[140px_minmax(0,1fr)] sm:p-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mist-50 text-navy-800">
                    <Icon name={i === 0 ? "takeoff" : "plane"} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold text-navy-950">{labels[i]}</p>
                    <p className="truncate text-xs text-navy-500">{l.depDay}</p>
                  </div>
                </div>

                <div className="col-span-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:col-span-1">
                  <div className="text-start">
                    <p className="font-display text-lg font-black text-navy-950 sm:text-xl">{l.depTime}</p>
                    <p className="text-xs font-bold text-navy-700">
                      {l.depCode} <span className="font-semibold text-navy-500">{l.depCity}</span>
                    </p>
                  </div>
                  <div className="min-w-0 text-center">
                    <p className="text-xs font-semibold text-navy-500">{l.duration}</p>
                    <div className="my-1 flex items-center gap-1.5" aria-hidden="true">
                      <span className="h-2 w-2 rounded-full ring-2 ring-navy-200" />
                      <span className="h-px flex-1 bg-navy-200" />
                      {l.stops.map((_, k) => (
                        <span key={k} className="h-2 w-2 rounded-full bg-rose-400" />
                      ))}
                      {l.stops.length > 0 && <span className="h-px flex-1 bg-navy-200" />}
                      <span className="h-2 w-2 rounded-full ring-2 ring-navy-200" />
                    </div>
                    <p className={`truncate text-xs font-bold ${l.stops.length ? "text-rose-700" : "text-sky-700"}`}>
                      {l.stops.length === 0
                        ? t.legDirect
                        : `${t.chipStops.replace("{n}", String(l.stops.length))} · ${l.stops
                            .map((s) => (s.wait ? `${s.city} (${s.wait})` : s.city))
                            .join("، ")}`}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="font-display text-lg font-black text-navy-950 sm:text-xl">
                      {l.arrTime}
                      {l.plusDays > 0 && (
                        <sup dir="ltr" className="ms-1 text-xs font-extrabold text-rose-700">
                          +{l.plusDays}
                        </sup>
                      )}
                    </p>
                    <p className="text-xs font-bold text-navy-700">
                      {l.arrCode} <span className="font-semibold text-navy-500">{l.arrCity}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* The price, the bag, and the way to book. */}
        <div className="flex flex-col gap-3 border-t border-mist-100 p-4 sm:p-5 md:border-s md:border-t-0">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold text-navy-500">
              <Icon name="users" className="h-3.5 w-3.5" />
              {t.priceTotalLabel}
            </p>
            <p className="mt-1 font-display text-3xl font-black text-navy-950">
              <bdi dir="ltr">{money(pay)}</bdi>
            </p>
            <p className="mt-0.5 text-xs text-navy-500">
              {t.travellersCount.replace("{count}", String(travelers))}
              {flight.bagOn && ` · ${t.bagAdded}`}
            </p>
          </div>

          {flight.bag === "extra" && flight.bagExtra !== null && (
            <div className="rounded-xl ring-1 ring-mist-200">
              <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5">
                <input
                  type="checkbox"
                  checked={flight.bagOn}
                  onChange={() => onBag(flight)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`relative h-5 w-9 shrink-0 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-sun-400 ${
                    flight.bagOn ? "bg-emerald-600" : "bg-mist-300"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                      flight.bagOn ? "start-[18px]" : "start-0.5"
                    }`}
                  />
                </span>
                <span className="min-w-0 flex-1 text-xs font-bold text-navy-800">
                  <span className="block">{t.bagAdd}</span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <span className="font-semibold text-navy-500">{flight.bagAllowance}</span>
                    <bdi dir="ltr" className="font-extrabold text-navy-950">
                      +{money(flight.bagExtra)}
                    </bdi>
                  </span>
                </span>
              </label>
              {bagOver > 0 && (
                <p className="border-t border-mist-100 px-3 py-2 text-xs font-bold text-rose-700">
                  <Amount template={t.bagOverBudget} amount={money(bagOver)} />
                </p>
              )}
            </div>
          )}

          {overBy !== undefined && (
            <p className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-800">
              <Amount template={t.cardOver} amount={money(overBy)} />
            </p>
          )}
          {diff !== undefined && (
            <p className="rounded-lg bg-mist-50 px-3 py-1.5 text-xs font-bold text-navy-700">
              {diff === 0 ? t.cardSame : <Amount template={diff > 0 ? t.cardMore : t.cardLess} amount={money(diff)} />}
            </p>
          )}
          <button
            type="button"
            onClick={() => onBook(flight.id)}
            className={`flex w-full items-center justify-center gap-2 rounded-xl bg-sun-400 px-4 font-extrabold text-navy-950 shadow-[var(--shadow-sun)] transition hover:bg-sun-300 ${
              featured ? "py-3.5 text-base" : "py-3 text-sm"
            }`}
          >
            {t.cardBook}
            <span aria-hidden="true">{isAr ? "←" : "→"}</span>
          </button>
          {aside}
        </div>
      </div>

      {foot && <div className="border-t border-mist-100 p-3 sm:p-4">{foot}</div>}
    </article>
  );
}

/** A sentence with an amount in it, the amount kept left-to-right ("+9 SAR"). */
function Amount({ template, amount }: { template: string; amount: string }) {
  const [before, after = ""] = template.split("{amount}");
  const plus = before.endsWith("+");
  return (
    <>
      {plus ? before.slice(0, -1) : before}
      <bdi dir="ltr">{plus ? `+${amount}` : amount}</bdi>
      {after}
    </>
  );
}

/** "No flight fits your budget": the cheapest real fare, and the two ways on. */
function NoneWithinDialog({
  title,
  body,
  searching,
  searchingLabel,
  showLabel,
  editLabel,
  closeLabel,
  editHref,
  onShow,
  onClose,
}: {
  title: string;
  body: string;
  searching: boolean;
  searchingLabel: string;
  showLabel: string;
  editLabel: string;
  closeLabel: string;
  editHref: string;
  onShow: () => void;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6"
      role="presentation"
      onMouseDown={(e) => {
        if (!panelRef.current?.contains(e.target as Node)) onClose();
      }}
    >
      <div className="absolute inset-0 bg-navy-990/70 backdrop-blur-sm" aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className="relative w-full max-w-md overflow-hidden rounded-t-3xl bg-white p-6 shadow-2xl outline-none sm:rounded-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="absolute end-3 top-3 rounded-lg p-2 text-navy-400 transition hover:bg-mist-100 hover:text-navy-800"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-2xl" aria-hidden="true">
          💸
        </span>
        <h2 id={headingId} className="mt-4 font-display text-xl font-extrabold text-navy-950">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-navy-700">{body}</p>
        {searching && (
          <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-navy-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-sun-400" aria-hidden="true" />
            {searchingLabel}
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <a
            href={editHref}
            className="flex flex-1 items-center justify-center rounded-xl bg-sun-400 px-4 py-3 text-sm font-extrabold text-navy-950 transition hover:bg-sun-300"
          >
            {editLabel}
          </a>
          <button
            type="button"
            onClick={onShow}
            className="flex flex-1 items-center justify-center rounded-xl bg-white px-4 py-3 text-sm font-bold text-navy-800 ring-1 ring-mist-300 transition hover:ring-navy-300"
          >
            {showLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
