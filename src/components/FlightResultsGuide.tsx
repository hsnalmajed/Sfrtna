"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Locale } from "@/lib/types";
import { getDictionary } from "@/lib/dictionaries";
import { findAirport } from "@/lib/airports";
import { countLabel } from "@/lib/format";
import Icon from "@/components/ui/Icon";

/**
 * The flight results, held to the traveller's budget.
 *
 * The widget draws every fare it finds, over budget or not, and leaves the
 * choosing to the reader. This turns that list into an answer:
 *
 *   - one flight, picked for them: the widget's own "best" if it fits the
 *     budget, otherwise the cheapest that does — the only card on the page;
 *   - under its booking button, two ways on: the other flights that fit, and
 *     the flights over budget (in a colour that stands out). Each opens a
 *     list over the page where every flight says, in a coloured figure, how
 *     much more or less it costs than the pick — and for the ones over
 *     budget, by how much they are over. Booking from the list opens that
 *     flight's offers in the widget, as its own button would;
 *   - and when nothing fits, a plain sentence: what flights to this place on
 *     these dates actually start at, and by how much that is over.
 *
 * It works on the widget's cards in place (they live in its shadow root), by
 * marking each card and letting a stylesheet we add there hide the rest —
 * the widget keeps drawing, sorting and loading as it likes. Each card also
 * gets a row that says in words what the widget buries: direct or where it
 * stops and for how long, baggage in or not, and the fare against the budget.
 *
 * Markers read (checked on sfrtna.com, 28 Sep 2026):
 *
 *   card          [class*="FlightCard-module__card___"]  (data-testid flight-card-…)
 *   price column  [class*="FlightCard-module__cardLeft___"]
 *   book button   [class*="FlightCard-module__cardLeftButton"]
 *   airline       [data-role="flight-card-air-company"]  (logo img + name)
 *   one leg       [class*="Flight-module__cardFlight___"]
 *   leg ends      [class*="cardFlightInfo"] → cardFlightTime, cardFlightCity
 *   duration      [class*="cardFlightTravelTop"]          → "مدة الرحلة: 4س 10دقيقة"
 *   airport code  [class*="airportCode"]
 *   a stop        [class*="cardFlightTravelLineTransfer"]  → "CAI 15س 15م transfer"
 *   price         [data-testid^="flight-card-price-"]
 *   baggage       [class*="cardLeftBaggageLeftPc"]          → "+481" when extra
 *   tags          [class*="cardBadges"]                     → "الاختيار الأمثل", "الأرخص"
 *   searching     [class*="SearchProgressbar"]
 *   direct box    [class*="DirectFlights-module__root"]     → hidden: it repeats the list
 *   more button   [class*="TicketsWidget-module__moreTickets"]
 */

const STYLE_ID = "sfr-guide-style";
const ROW = "sfr-notes";
const MORE = "sfr-more";
const OPEN_EVENT = "sfr-guide-open";

function css(bookLabel: string): string {
  const label = bookLabel.replace(/["\\]/g, "");
  return `
/* One tidy line across the top of the card: the flight's facts on one side,
   all the same shape and size; where it stands against the budget on the
   other. Only the pick and the budget carry colour. */
.${ROW}{grid-column:1 / -1;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px;padding:12px 16px 10px;margin-bottom:2px;border-bottom:1px dashed #dfe6ef;font-family:inherit}
.${ROW} .grp{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.${ROW} span{display:inline-flex;align-items:center;gap:5px;height:28px;border-radius:8px;padding:0 10px;font-size:12.5px;font-weight:700;line-height:1;white-space:nowrap}
.${ROW} .pick{background:#ffa630;color:#062653;font-weight:900}
.${ROW} .fact{background:#f1f5fa;color:#0b2d5b}
.${ROW} .fact.warn{color:#8a4b00}
.${ROW} .fact.muted{color:#5b6b82}
.${ROW} .fits{background:#e7f6ee;color:#135d3a}
.${ROW} .over{background:#e11d48;color:#fff}
[data-sfr-tag]{font-weight:800 !important;font-size:13px !important;padding:3px 12px !important;border-radius:999px !important}
[data-sfr-tag="best"]{background:#ffa630 !important;color:#062653 !important}
[data-sfr-tag="cheapest"]{background:#3bb6e4 !important;color:#062653 !important}
[data-sfr-state="featured"]{box-shadow:0 0 0 2px #ffa630,0 12px 30px -12px rgba(6,38,83,.35) !important}
[class*="DirectFlights-module__root"]{display:none !important}

/* "Book this flight" instead of the widget's "Select ticket". */
[class*="FlightCard-module__cardLeftButton"] > span{display:none !important}
/* The widget uses ::after as a transparent hover overlay; it becomes the label. */
[class*="FlightCard-module__cardLeftButton"]::after{content:"${label}" !important;position:static !important;opacity:1 !important;background:none !important;width:auto !important;height:auto !important;inset:auto !important;font-family:inherit;font-weight:800}

/* The two ways on, under the picked flight's booking button. */
.${MORE}{display:flex;flex-direction:column;gap:8px;width:100%;margin-top:12px;font-family:inherit}
.${MORE} button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;width:100%;min-height:52px;border:0;border-radius:12px;padding:8px 12px;font:inherit;text-align:center;cursor:pointer;transition:transform .15s,box-shadow .15s,filter .15s}
.${MORE} button:hover{transform:translateY(-1px);filter:brightness(1.03)}
.${MORE} button:focus-visible{outline:2px solid #ffa630;outline-offset:2px}
.${MORE} b{font-size:13.5px;font-weight:800;line-height:1.3}
.${MORE} small{font-size:11.5px;font-weight:700;line-height:1.3;opacity:.9}
.${MORE} .b-within{background:#e8f6fc;color:#0b2d5b;box-shadow:inset 0 0 0 1.5px #3bb6e4}
.${MORE} .b-over{background:linear-gradient(135deg,#e11d48,#f97316);color:#fff;box-shadow:0 8px 20px -8px rgba(225,29,72,.6)}

/* Only the pick is on the page; everything else is in the lists. */
:host([data-sfr-filter]) [data-sfr-state="within"],
:host([data-sfr-filter]) [data-sfr-state="over"],
:host([data-sfr-filter]) [class*="TicketsWidget-module__moreTickets"],
:host([data-sfr-filter]) [class*="FlightFilters-module__filerContainer"],
:host([data-sfr-filter]) [class*="FlightFiltersMobileMenu-module__root"]{display:none !important}
:host([data-sfr-filter]) [class*="TicketsWidget-module__wrapper"]{grid-column:1 / -1 !important}
`;
}

/** "1,250 SAR" — Western digits, like the rest of the site's prices. */
function moneyIn(currency: string, n: number): string {
  return `${Math.round(Math.abs(n)).toLocaleString("en-US")} ${currency}`;
}

const TAG_BEST = /الأمثل|best/i;
const TAG_CHEAPEST = /الأرخص|cheapest/i;

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
function westernDigits(text: string): string {
  return text.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}
function amountOf(text: string): number | null {
  const digits = westernDigits(text)
    .replace(/[^\d.,]/g, "")
    .replace(/,/g, "");
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}
/** "4س 10دقيقة" / "4h 10m" → 250. */
function minutesOf(text: string): number {
  const t = westernDigits(text);
  const h = t.match(/(\d+)\s*(?:س|h)/i);
  const m = t.match(/(\d+)\s*(?:د|m)/i);
  return (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
}

interface Leg {
  label: string;
  depTime: string;
  depCity: string;
  arrTime: string;
  arrCity: string;
  duration: string;
  stops: string;
  direct: boolean;
}
interface Option {
  id: string;
  state: "featured" | "within" | "over";
  price: number;
  airline: string;
  logo: string;
  legs: Leg[];
  minutes: number;
  bag: "in" | "extra" | null;
}

interface Stats {
  searching: boolean;
  settled: boolean;
  total: number;
  within: number;
  over: number;
  pickPrice: number | null;
  cheapest: number | null;
  /** The widget's prices are in the budget's currency. */
  comparable: boolean;
}

const EMPTY: Stats = {
  searching: true,
  settled: false,
  total: 0,
  within: 0,
  over: 0,
  pickPrice: null,
  cheapest: null,
  comparable: true,
};

type Group = "within" | "over";

export default function FlightResultsGuide({
  locale,
  budget,
  currency,
  travelers,
  cityName,
}: {
  locale: Locale;
  /** The flight budget for the whole party; 0 when none was given. */
  budget: number;
  currency: string;
  travelers: number;
  cityName: string;
}) {
  const t = getDictionary(locale).results;
  const [stats, setStats] = useState<Stats>(EMPTY);
  const [options, setOptions] = useState<Option[]>([]);
  const [open, setOpen] = useState<Group | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const money = (n: number) => moneyIn(currency, n);

  // Read the cards, mark them, write their notes — every 800ms, since the
  // widget re-draws them whenever it sorts, filters or loads more.
  useEffect(() => {
    const city = (code: string) => {
      const a = findAirport(code);
      return a ? (locale === "ar" ? a.cityAr : a.cityEn) : code;
    };
    const money = (n: number) => moneyIn(currency, n);
    const flights = (n: number) =>
      countLabel(n, { one: t.flightsOne, two: t.flightsTwo, few: t.flightsFew, many: t.flightsMany });
    const chip = (cls: string, text: string) => {
      const s = document.createElement("span");
      s.className = cls;
      s.textContent = text;
      return s;
    };
    const text = (el: Element | null | undefined) => (el?.textContent || "").replace(/\s+/g, " ").trim();

    let lastKey = "";
    let lastOptions = "";
    let lastChange = Date.now();
    let sawProgress = false;

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

      const cards = [...root.querySelectorAll('[class*="FlightCard-module__card___"]')];
      const priced = cards.map((card) => {
        const txt = card.querySelector('[data-testid^="flight-card-price-"]')?.textContent || "";
        const tags = [...card.querySelectorAll('[class*="cardBadges"]')];
        let best = false;
        for (const tag of tags) {
          const tx = tag.textContent || "";
          if (TAG_BEST.test(tx)) {
            best = true;
            tag.setAttribute("data-sfr-tag", "best");
          } else if (TAG_CHEAPEST.test(tx)) {
            tag.setAttribute("data-sfr-tag", "cheapest");
          }
        }
        return { card, price: amountOf(txt), cur: currencyOf(txt), best };
      });

      const widgetCurrency = priced.find((p) => p.cur)?.cur ?? null;
      const comparable = budget > 0 && (widgetCurrency === null || widgetCurrency === currency);
      const filtering = comparable && priced.length > 0;

      const within = filtering ? priced.filter((p) => p.price !== null && p.price <= budget) : [];
      const pick =
        within.find((p) => p.best) ??
        (within.length ? within.reduce((a, b) => ((a.price ?? 0) <= (b.price ?? 0) ? a : b)) : null);

      if (filtering) host.setAttribute("data-sfr-filter", "");
      else host.removeAttribute("data-sfr-filter");

      const collected: Option[] = [];
      for (const p of priced) {
        const state = !filtering
          ? null
          : p === pick
            ? "featured"
            : p.price !== null && p.price <= budget
              ? "within"
              : "over";
        if (state) p.card.setAttribute("data-sfr-state", state);
        else p.card.removeAttribute("data-sfr-state");

        // The notes row: facts on one side, budget on the other. The same
        // reading of each leg also feeds the lists.
        const facts: HTMLElement[] = [];
        const money2: HTMLElement[] = [];
        const legsOut: Leg[] = [];
        if (state === "featured") facts.push(chip("pick", `⭐ ${t.cardPicked.replace(/^⭐\s*/, "")}`));
        const legs = [...p.card.querySelectorAll('[class*="Flight-module__cardFlight___"]')];
        let minutes = 0;
        legs.forEach((leg, i) => {
          const label = legs.length === 2 ? (i === 0 ? t.cardOutbound : t.cardReturn) : t.cardLeg;
          const ends = [...leg.querySelectorAll('[class*="cardFlightInfo"]')];
          // "رحلة مباشرةمدة الرحلة: 4س 10دقيقة" → "4س 10دقيقة".
          const duration = text(leg.querySelector('[class*="cardFlightTravelTime"]')).replace(/^.*:\s*/, "");
          minutes += minutesOf(duration);
          const stops = [...leg.querySelectorAll('[class*="cardFlightTravelLineTransfer"]')];
          let stopsText: string = t.cardDirect;
          if (stops.length === 0) {
            facts.push(chip("fact", `✈ ${label} · ${t.cardDirect}`));
          } else {
            const where = stops
              .map((s) => {
                const code = s.querySelector('[class*="airportCode"]')?.textContent?.trim() || "";
                const wait = (s.textContent || "").replace(code, "").replace(/transfer/i, "").replace(/\s+/g, " ").trim();
                return wait ? `${city(code)} (${wait})` : city(code);
              })
              .join("، ");
            const count = stops.length === 1 ? t.cardOneStop : t.cardStops.replace("{count}", String(stops.length));
            stopsText = `${count} — ${where}`;
            facts.push(chip("fact warn", `✈ ${label} · ${stopsText}`));
          }
          legsOut.push({
            label,
            depTime: text(ends[0]?.querySelector('[class*="cardFlightTime"]')),
            depCity: text(ends[0]?.querySelector('[class*="cardFlightCity"]')),
            arrTime: text(ends[1]?.querySelector('[class*="cardFlightTime"]')),
            arrCity: text(ends[1]?.querySelector('[class*="cardFlightCity"]')),
            duration,
            stops: stopsText,
            direct: stops.length === 0,
          });
        });
        const bagText = p.card.querySelector('[class*="cardLeftBaggageLeftPc"]')?.textContent || "";
        const bag = bagText.includes("+")
          ? "extra"
          : /تشمل الأمتعة|baggage included/i.test(p.card.textContent || "")
            ? "in"
            : null;
        if (bag === "extra") facts.push(chip("fact muted", `🧳 ${t.cardBagExtra}`));
        else if (bag === "in") facts.push(chip("fact", `🧳 ${t.cardBagIn}`));

        if (filtering && p.price !== null) {
          if (state === "over") money2.push(chip("over", t.cardOver.replace("{amount}", money(p.price - budget))));
          else money2.push(chip("fits", `✓ ${t.cardFits.replace("{amount}", money(budget - p.price))}`));
        }
        const notes = [...facts, ...money2];
        const key = notes.map((n) => n.textContent).join("|");
        const existing = p.card.querySelector(`:scope > .${ROW}`);
        if (existing?.getAttribute("data-key") !== key) {
          const row = document.createElement("div");
          row.className = ROW;
          row.setAttribute("data-key", key);
          for (const items of [facts, money2]) {
            if (items.length === 0) continue;
            const g = document.createElement("div");
            g.className = "grp";
            items.forEach((n) => g.appendChild(n));
            row.appendChild(g);
          }
          if (existing) existing.replaceWith(row);
          else p.card.prepend(row);
        }

        if (state && p.price !== null) {
          // Each airline at the top of the card: its logo, and its name as
          // text or, when several share a card, in the logo's tooltip.
          const companies = [
            ...(p.card.querySelector('[class*="FlightCard-module__cardTop___"]') ?? p.card).querySelectorAll(
              '[class*="AirCompany-module__cardAirCompany___"]'
            ),
          ];
          const names = [
            ...new Set(
              companies
                .map((c) => text(c.querySelector('[data-role="flight-card-air-company"]')) || text(c.querySelector('[class*="Tooltip-module__text"]')))
                .filter(Boolean)
            ),
          ];
          collected.push({
            id: p.card.getAttribute("data-testid") || "",
            state,
            price: p.price,
            airline: names.join(" + "),
            logo: companies[0]?.querySelector("img")?.getAttribute("src") || "",
            legs: legsOut,
            minutes,
            bag,
          });
        }
      }

      // The two ways on, under the picked flight's booking button.
      const withinCount = within.length ? within.length - 1 : 0;
      const overPrices = filtering
        ? priced.filter((p) => p.price !== null && p.price > budget).map((p) => p.price as number)
        : [];
      for (const p of priced) {
        const bar = p.card.querySelector(`.${MORE}`);
        const column = p.card.querySelector('[class*="FlightCard-module__cardLeft___"]');
        if (p !== pick || !column || (withinCount === 0 && overPrices.length === 0)) {
          bar?.remove();
          continue;
        }
        const overSub = overPrices.length
          ? t.moreOverSub
              .replace("{count}", flights(overPrices.length))
              .replace("{amount}", money(Math.min(...overPrices) - budget))
          : "";
        const withinSub = t.moreWithinSub.replace("{count}", flights(withinCount));
        const key = `${withinSub}|${overSub}`;
        if (bar?.getAttribute("data-key") === key && bar.parentElement === column) continue;
        const next = document.createElement("div");
        next.className = MORE;
        next.setAttribute("data-key", key);
        // The whole card opens the widget's offers on click; these must not.
        for (const type of ["click", "pointerdown", "mousedown", "pointerup", "mouseup"]) {
          next.addEventListener(type, (e) => e.stopPropagation());
        }
        const button = (cls: string, title: string, sub: string, which: Group) => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = cls;
          b.setAttribute("aria-haspopup", "dialog");
          const tt = document.createElement("b");
          tt.textContent = title;
          const st = document.createElement("small");
          st.textContent = sub;
          b.append(tt, st);
          b.addEventListener("click", (e) => {
            e.preventDefault();
            window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: which }));
          });
          next.appendChild(b);
        };
        if (withinCount > 0) button("b-within", t.moreWithinTitle, withinSub, "within");
        if (overPrices.length > 0) button("b-over", t.moreOverTitle, overSub, "over");
        bar?.remove();
        column.appendChild(next);
      }

      const optionsKey = JSON.stringify(collected);
      if (optionsKey !== lastOptions) {
        lastOptions = optionsKey;
        setOptions(collected);
      }
      setHasMore(Boolean(root.querySelector('[class*="TicketsWidget-module__moreTickets"]')));

      const searching = Boolean(root.querySelector('[class*="SearchProgressbar"]'));
      if (searching) sawProgress = true;
      const prices = priced.map((p) => p.price).filter((n): n is number => n !== null);
      const next: Omit<Stats, "settled"> = {
        searching,
        total: priced.length,
        within: withinCount,
        over: overPrices.length,
        pickPrice: pick?.price ?? null,
        cheapest: prices.length ? Math.min(...prices) : null,
        comparable: budget <= 0 || comparable,
      };
      const key = JSON.stringify(next);
      if (key !== lastKey) {
        lastKey = key;
        lastChange = Date.now();
      }
      const calm = Date.now() - lastChange;
      const settled = !searching && (priced.length > 0 || sawProgress) && calm >= (sawProgress ? 1000 : 4000);
      setStats((prev) => {
        const merged = { ...next, settled };
        return JSON.stringify(prev) === JSON.stringify(merged) ? prev : merged;
      });
    }

    pass();
    const id = window.setInterval(pass, 800);
    return () => window.clearInterval(id);
  }, [locale, budget, currency, t]);

  // The buttons inside the card live in the widget's shadow root; they reach
  // this component through a window event.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const which = (e as CustomEvent<string>).detail;
      if (which === "within" || which === "over") setOpen(which);
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  const close = useCallback(() => setOpen(null), []);

  /** Book from the list: the widget opens that flight's offers, as its own button would. */
  const book = useCallback((id: string) => {
    setOpen(null);
    window.setTimeout(() => {
      const root = document.getElementById("tpwl-tickets")?.shadowRoot;
      const card = root?.querySelector(`[data-testid="${CSS.escape(id)}"]`);
      (card?.querySelector('[class*="FlightCard-module__cardLeftButton"]') as HTMLElement | null)?.click();
    }, 60);
  }, []);

  const loadMore = useCallback(() => {
    const root = document.getElementById("tpwl-tickets")?.shadowRoot;
    const more = root?.querySelector('[class*="TicketsWidget-module__moreTickets"]');
    (more?.querySelector("button") ?? (more as HTMLElement | null))?.click();
  }, []);

  const hasBudget = budget > 0;
  const noneWithin = hasBudget && stats.settled && stats.comparable && stats.total > 0 && stats.pickPrice === null;
  const picked = hasBudget && stats.comparable && stats.pickPrice !== null;
  const flightsLabel = (n: number) =>
    countLabel(n, { one: t.flightsOne, two: t.flightsTwo, few: t.flightsFew, many: t.flightsMany });

  return (
    <div
      className={`rounded-2xl p-4 ring-1 sm:p-5 ${noneWithin ? "bg-rose-50 ring-rose-200" : "bg-white shadow-sm ring-black/5"}`}
      aria-live="polite"
    >
      {/* The answer, first. */}
      {!stats.settled && !picked && (
        <p className="flex items-center gap-2 text-sm font-semibold text-navy-600">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-sun-400" aria-hidden="true" />
          {t.guideSearching}
        </p>
      )}

      {picked && (
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sun-400 text-navy-950">
            <Icon name="plane" className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display text-lg font-extrabold text-navy-950">{t.guidePickedTitle}</p>
            <p className="mt-0.5 text-sm text-navy-600">
              {t.guidePickedBody
                .replace("{price}", money(stats.pickPrice!))
                .replace("{count}", String(travelers))
                .replace("{left}", money(budget - stats.pickPrice!))}
            </p>
          </div>
        </div>
      )}

      {noneWithin && stats.cheapest !== null && (
        <div>
          <p className="font-display text-lg font-extrabold text-rose-900">{t.guideNoneTitle}</p>
          <p className="mt-1 text-sm leading-relaxed text-rose-900/90">
            {t.guideNoneBody
              .replace("{city}", cityName)
              .replace("{amount}", money(stats.cheapest))
              .replace("{count}", String(travelers))
              .replace("{budget}", money(budget))
              .replace("{over}", money(stats.cheapest - budget))}
          </p>
          {/* Nothing fits, so there is no card to hold the button: it sits here. */}
          {stats.over > 0 && (
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => setOpen("over")}
              className="mt-4 inline-flex flex-col items-center rounded-xl bg-gradient-to-l from-rose-600 to-orange-500 px-6 py-2.5 text-white shadow-[0_8px_20px_-8px_rgba(225,29,72,0.6)] transition hover:-translate-y-px"
            >
              <span className="text-sm font-extrabold">{t.moreOverTitle}</span>
              <span className="text-xs font-bold opacity-90">
                {t.moreOverSub
                  .replace("{count}", flightsLabel(stats.over))
                  .replace("{amount}", money(stats.cheapest - budget))}
              </span>
            </button>
          )}
        </div>
      )}

      {!hasBudget && stats.settled && (
        <p className="text-sm text-navy-600">{t.guideNoBudget.replace("{count}", String(travelers))}</p>
      )}
      {hasBudget && stats.settled && !stats.comparable && (
        <p className="text-sm text-navy-600">{t.guideOtherCurrency}</p>
      )}
      {stats.settled && stats.total === 0 && <p className="text-sm text-navy-600">{t.guideNoResults}</p>}

      {open && (
        <OptionsDialog
          group={open}
          options={options}
          budget={budget}
          currency={currency}
          locale={locale}
          hasMore={hasMore}
          onLoadMore={loadMore}
          onBook={book}
          onClose={close}
        />
      )}
    </div>
  );
}

/**
 * The other flights, as a list over the page.
 *
 * A comparison wants the screen to itself, and the pick stays put
 * underneath. The pick heads the list for reference; every other flight
 * carries a coloured figure — its difference from the pick (green when
 * cheaper, red when dearer) — and, in the over-budget list, how far over
 * the budget it goes. Escape or the backdrop closes it.
 */
function OptionsDialog({
  group,
  options,
  budget,
  currency,
  locale,
  hasMore,
  onLoadMore,
  onBook,
  onClose,
}: {
  group: Group;
  options: Option[];
  budget: number;
  currency: string;
  locale: Locale;
  hasMore: boolean;
  onLoadMore: () => void;
  onBook: (id: string) => void;
  onClose: () => void;
}) {
  const t = getDictionary(locale).results;
  const panelRef = useRef<HTMLDivElement>(null);
  const headingId = useId();
  const [sort, setSort] = useState<"cheapest" | "fastest">("cheapest");
  const money = (n: number) => moneyIn(currency, n);
  const arrow = locale === "ar" ? "←" : "→";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  const pick = options.find((o) => o.state === "featured") ?? null;
  const rows = useMemo(() => {
    const list = options.filter((o) => o.state === group);
    return list.sort((a, b) =>
      sort === "fastest" ? a.minutes - b.minutes || a.price - b.price : a.price - b.price || a.minutes - b.minutes
    );
  }, [options, group, sort]);
  const cheapestId = rows.length ? rows.reduce((a, b) => (a.price <= b.price ? a : b)).id : "";

  const dialog = (
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
        className="relative flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl outline-none sm:max-h-[85vh] sm:rounded-2xl"
      >
        <div
          className={`shrink-0 px-5 pb-4 pt-5 sm:px-6 ${
            group === "over" ? "bg-gradient-to-l from-rose-600 to-orange-500 text-white" : "bg-navy-950 text-white"
          }`}
        >
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/40 sm:hidden" aria-hidden="true" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={headingId} className="font-display text-lg font-extrabold">
                {group === "over" ? t.moreOverTitle : t.moreWithinTitle}
              </h2>
              <p className="mt-1 text-sm text-white/85">
                {group === "over" ? t.dialogOverNote.replace("{budget}", money(budget)) : t.dialogWithinNote}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t.closeOptions}
              className="-me-1 shrink-0 rounded-lg p-2 text-white/80 transition hover:bg-white/15 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <div className="mt-3.5 flex flex-wrap gap-2">
            {(["cheapest", "fastest"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSort(k)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${
                  sort === k ? "bg-white text-navy-950" : "bg-white/10 text-white ring-1 ring-white/30 hover:bg-white/20"
                }`}
              >
                {k === "cheapest" ? t.sortCheapest : t.sortFastest}
              </button>
            ))}
          </div>
        </div>

        <ul className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain bg-mist-50 px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-5">
          {pick && <OptionRow option={pick} pick={pick} group={group} budget={budget} money={money} t={t} currency={currency} arrow={arrow} onBook={onBook} isPick />}
          {rows.map((o) => (
            <OptionRow
              key={o.id}
              option={o}
              pick={pick}
              group={group}
              budget={budget}
              money={money}
              t={t}
              currency={currency}
              arrow={arrow}
              onBook={onBook}
              cheapest={o.id === cheapestId && sort === "fastest"}
            />
          ))}
          {rows.length === 0 && <li className="py-6 text-center text-sm text-navy-500">{t.dialogEmpty}</li>}
          {hasMore && (
            <li className="pt-1 text-center">
              <button
                type="button"
                onClick={onLoadMore}
                className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-navy-800 ring-1 ring-mist-300 transition hover:ring-navy-300"
              >
                {t.dialogLoadMore}
              </button>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
  return createPortal(dialog, document.body);
}

/**
 * The difference, as a signed amount. Forced to LTR so the sign stays glued
 * to the front of the number inside an Arabic line.
 */
function Delta({ diff, currency }: { diff: number; currency: string }) {
  const tone =
    diff > 0 ? "bg-rose-50 text-rose-700 ring-rose-200" : diff < 0 ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-mist-100 text-navy-600 ring-mist-200";
  return (
    <span dir="ltr" className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${tone}`}>
      {diff > 0 ? "+" : diff < 0 ? "−" : ""}
      {Math.round(Math.abs(diff)).toLocaleString("en-US")} {currency}
    </span>
  );
}

function OptionRow({
  option,
  pick,
  group,
  budget,
  money,
  t,
  currency,
  arrow,
  onBook,
  isPick = false,
  cheapest = false,
}: {
  option: Option;
  pick: Option | null;
  group: Group;
  budget: number;
  money: (n: number) => string;
  t: ReturnType<typeof getDictionary>["results"];
  currency: string;
  arrow: string;
  onBook: (id: string) => void;
  isPick?: boolean;
  cheapest?: boolean;
}) {
  const over = option.price - budget;
  return (
    <li
      className={`rounded-xl bg-white p-3.5 ring-1 ${
        isPick ? "ring-2 ring-sun-400" : group === "over" ? "ring-rose-200" : "ring-mist-200"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {option.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={option.logo} alt="" className="h-9 w-9 shrink-0 rounded-lg object-contain" />
          ) : (
            <span className="h-9 w-9 shrink-0 rounded-lg bg-mist-100" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-navy-950">{option.airline}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {isPick && (
                <span className="rounded-full bg-sun-400 px-2 py-0.5 text-[11px] font-extrabold text-navy-950">
                  ⭐ {t.dialogPick}
                </span>
              )}
              {cheapest && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-100">
                  {t.cheapestOption}
                </span>
              )}
              {option.bag && (
                <span className="rounded-full bg-mist-100 px-2 py-0.5 text-[11px] font-bold text-navy-700">
                  🧳 {option.bag === "in" ? t.cardBagIn : t.cardBagExtra}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          {!isPick && group === "over" && (
            <span className="rounded-full bg-rose-600 px-2.5 py-1 text-xs font-extrabold text-white">
              {t.cardOver.replace("{amount}", money(over))}
            </span>
          )}
          {!isPick && pick && <Delta diff={option.price - pick.price} currency={currency} />}
          <span dir="ltr" className="font-display text-base font-black text-navy-950">
            {money(option.price)}
          </span>
        </div>
      </div>

      <ul className="mt-2.5 space-y-1.5">
        {option.legs.map((l, i) => (
          <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-navy-700">
            <span className="font-bold text-navy-500">{l.label}</span>
            <span className="font-bold text-navy-950">
              {l.depTime} {l.depCity} {arrow} {l.arrTime} {l.arrCity}
            </span>
            {l.duration && <span className="text-navy-500">· {l.duration}</span>}
            <span className={l.direct ? "text-emerald-700" : "text-amber-800"}>· {l.stops}</span>
          </li>
        ))}
      </ul>

      {!isPick && (
        <button
          type="button"
          onClick={() => onBook(option.id)}
          className="mt-3 w-full rounded-lg bg-sun-400 px-4 py-2.5 text-sm font-extrabold text-navy-950 transition hover:bg-sun-300"
        >
          {t.cardBook}
        </button>
      )}
    </li>
  );
}
