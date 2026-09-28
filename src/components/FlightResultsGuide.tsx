"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/types";
import { getDictionary } from "@/lib/dictionaries";
import { findAirport } from "@/lib/airports";
import { countLabel } from "@/lib/format";
import Icon from "@/components/ui/Icon";

/**
 * The flight results, held to the traveller's budget.
 *
 * The widget draws every fare it finds, over budget or not, and leaves the
 * choosing to the reader. This turns that list into an answer, in the order
 * a traveller reads it:
 *
 *   1. one flight, picked for them — the widget's own "best" if it fits the
 *      budget, otherwise the cheapest that does — with, beside it, one quiet
 *      button: all the flights within the budget, and how many there are.
 *      Opened, they line up under the pick, cheapest first, each saying how
 *      much more or less it costs than the pick;
 *   2. under that, one row: the other flights to the same city that are over
 *      the budget, how many, and from how much. Opened, each says by how much
 *      it is over;
 *   3. when nothing fits, the panel says what flights there actually start
 *      at, and the over-budget row is the only thing below it.
 *
 * Colour is kept for the one thing that matters: the pick (gold). Everything
 * else is navy on white, so nothing competes with it.
 *
 * It works on the widget's cards in place (they live in its shadow root), by
 * marking each card and letting a stylesheet we add there order, show or
 * hide it — the widget keeps drawing and loading as it likes.
 *
 * Markers read (checked on sfrtna.com, 28 Sep 2026):
 *
 *   card          [class*="FlightCard-module__card___"]
 *   book button   [class*="FlightCard-module__cardLeftButton"]  (::after is a hover overlay)
 *   one leg       [class*="Flight-module__cardFlight___"]
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
const OVERBAR = "sfr-overbar";
const TOGGLE_EVENT = "sfr-guide-toggle";

function css(bookLabel: string): string {
  const label = bookLabel.replace(/["\\]/g, "");
  return `
/* The card's top line: its facts, all alike, on one side; on the other,
   where it stands against the budget — or, on the pick, the one button. */
.${ROW}{grid-column:1 / -1;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px;padding:12px 16px 10px;border-bottom:1px solid #eef2f7;font-family:inherit}
.${ROW} .grp{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.${ROW} span.c{display:inline-flex;align-items:center;gap:5px;height:28px;border-radius:8px;padding:0 10px;font-size:12.5px;font-weight:700;line-height:1;white-space:nowrap;background:#f3f6fa;color:#0b2d5b}
.${ROW} span.pick{background:#ffa630;color:#062653;font-weight:900}
.${ROW} span.over{background:#fff1f2;color:#9f1239}
.${ROW} button.all{display:inline-flex;align-items:center;gap:8px;height:36px;border:0;border-radius:999px;padding:0 14px;background:#0b2d5b;color:#fff;font:inherit;font-size:13.5px;font-weight:800;cursor:pointer;transition:background .15s}
.${ROW} button.all:hover{background:#123d78}
.${ROW} button.all:focus-visible{outline:2px solid #ffa630;outline-offset:2px}
.${ROW} button.all .n{display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;border-radius:999px;padding:0 7px;background:#fff;color:#0b2d5b;font-size:12.5px;font-weight:900}
.${ROW} button.all[aria-expanded="true"]{background:#fff;color:#0b2d5b;box-shadow:inset 0 0 0 1.5px #0b2d5b}
.${ROW} button.all[aria-expanded="true"] .n{background:#0b2d5b;color:#fff}
.chev{font-size:11px;transition:transform .2s}
[aria-expanded="true"] .chev{transform:rotate(180deg)}

/* One quiet row under the pick: the flights over budget. */
.${OVERBAR}{display:flex;align-items:center;justify-content:space-between;gap:16px;width:100%;box-sizing:border-box;margin:0 0 24px;padding:16px 20px;border:1px solid #dfe6ef;border-radius:16px;background:#fff;font:inherit;text-align:start;color:#0b2d5b;cursor:pointer;transition:border-color .15s,box-shadow .15s}
.${OVERBAR}:hover{border-color:#b9c6d8;box-shadow:0 6px 18px -10px rgba(6,38,83,.3)}
.${OVERBAR}:focus-visible{outline:2px solid #ffa630;outline-offset:2px}
.${OVERBAR} b{display:block;font-size:15px;font-weight:800;line-height:1.4}
.${OVERBAR} small{display:block;margin-top:3px;font-size:13px;font-weight:600;color:#5b6b82;line-height:1.5}
.${OVERBAR} .go{flex:none;display:inline-flex;align-items:center;gap:6px;height:34px;border-radius:999px;padding:0 14px;box-shadow:inset 0 0 0 1.5px #0b2d5b;font-size:13px;font-weight:800}

[data-sfr-tag]{font-weight:800 !important;font-size:13px !important;padding:3px 12px !important;border-radius:999px !important}
[data-sfr-tag="best"]{background:#ffa630 !important;color:#062653 !important}
[data-sfr-tag="cheapest"]{background:#0b2d5b !important;color:#fff !important}
[data-sfr-state="featured"]{box-shadow:0 0 0 2px #ffa630,0 12px 30px -12px rgba(6,38,83,.35) !important}
[class*="DirectFlights-module__root"]{display:none !important}

/* "Book this flight" instead of the widget's "Select ticket". */
[class*="FlightCard-module__cardLeftButton"] > span{display:none !important}
[class*="FlightCard-module__cardLeftButton"]::after{content:"${label}" !important;position:static !important;opacity:1 !important;background:none !important;width:auto !important;height:auto !important;inset:auto !important;font-family:inherit;font-weight:800}

/* The pick first; then what fits, cheapest first; then the over-budget row
   and what it opens; then "more". Orders are set on each card. */
:host([data-sfr-filter]) [data-sfr-list]{display:flex !important;flex-direction:column}
:host([data-sfr-filter]) [data-sfr-state="featured"]{order:-1 !important}
:host([data-sfr-filter]) [data-sfr-list] > [class*="TicketsWidget-module__moreTickets"]{order:2147483000}
:host([data-sfr-filter]:not([data-show-within])) [data-sfr-state="within"],
:host([data-sfr-filter]:not([data-show-over])) [data-sfr-state="over"],
:host([data-sfr-filter]:not([data-show-within]):not([data-show-over])) [class*="TicketsWidget-module__moreTickets"]{display:none !important}
/* Filters are for browsing; the page is an answer, so they stay away. */
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
function amountOf(text: string): number | null {
  const digits = text
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[^\d.,]/g, "")
    .replace(/,/g, "");
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
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
  const [showWithin, setShowWithin] = useState(false);
  const [showOver, setShowOver] = useState(false);
  const refresh = useRef<() => void>(() => {});
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
    // Our buttons sit inside cards the widget opens on click; they must not.
    const isolate = (el: HTMLElement) => {
      for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
        el.addEventListener(type, (e) => e.stopPropagation());
      }
    };
    const toggle = (which: "within" | "over") => (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      window.dispatchEvent(new CustomEvent(TOGGLE_EVENT, { detail: which }));
    };

    let lastKey = "";
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
      const openWithin = host.hasAttribute("data-show-within");
      const openOver = host.hasAttribute("data-show-over");

      const cards = [...root.querySelectorAll('[class*="FlightCard-module__card___"]')];
      const list = cards[0]?.parentElement ?? null;
      list?.setAttribute("data-sfr-list", "");
      const priced = cards.map((card) => {
        const text = card.querySelector('[data-testid^="flight-card-price-"]')?.textContent || "";
        let best = false;
        for (const tag of card.querySelectorAll('[class*="cardBadges"]')) {
          const tx = tag.textContent || "";
          if (TAG_BEST.test(tx)) {
            best = true;
            tag.setAttribute("data-sfr-tag", "best");
          } else if (TAG_CHEAPEST.test(tx)) {
            tag.setAttribute("data-sfr-tag", "cheapest");
          }
        }
        return { card: card as HTMLElement, price: amountOf(text), cur: currencyOf(text), best };
      });

      const widgetCurrency = priced.find((p) => p.cur)?.cur ?? null;
      const comparable = budget > 0 && (widgetCurrency === null || widgetCurrency === currency);
      const filtering = comparable && priced.length > 0;

      const within = filtering ? priced.filter((p) => p.price !== null && p.price <= budget) : [];
      const pick =
        within.find((p) => p.best) ??
        (within.length ? within.reduce((a, b) => ((a.price ?? 0) <= (b.price ?? 0) ? a : b)) : null);
      const overPrices = filtering
        ? priced.filter((p) => p.price !== null && p.price > budget).map((p) => p.price as number)
        : [];
      const withinCount = within.length ? within.length - 1 : 0;

      if (filtering) host.setAttribute("data-sfr-filter", "");
      else host.removeAttribute("data-sfr-filter");

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
        // Cheapest first within each group; the over-budget row sits between
        // the two groups (its order is the budget's, doubled plus one).
        const order = filtering && p.price !== null ? String(Math.round(p.price) * 2) : "";
        if (p.card.style.order !== order) p.card.style.order = order;

        // Facts, all alike: legs, stops, baggage.
        const facts: HTMLElement[] = [];
        const side: HTMLElement[] = [];
        if (state === "featured") facts.push(chip("c pick", `⭐ ${t.cardPicked.replace(/^⭐\s*/, "")}`));
        const legs = [...p.card.querySelectorAll('[class*="Flight-module__cardFlight___"]')];
        legs.forEach((leg, i) => {
          const label = legs.length === 2 ? (i === 0 ? t.cardOutbound : t.cardReturn) : t.cardLeg;
          const stops = [...leg.querySelectorAll('[class*="cardFlightTravelLineTransfer"]')];
          if (stops.length === 0) {
            facts.push(chip("c", `${label} · ${t.cardDirect}`));
            return;
          }
          const where = stops
            .map((s) => {
              const code = s.querySelector('[class*="airportCode"]')?.textContent?.trim() || "";
              const wait = (s.textContent || "").replace(code, "").replace(/transfer/i, "").replace(/\s+/g, " ").trim();
              return wait ? `${city(code)} (${wait})` : city(code);
            })
            .join("، ");
          const count = stops.length === 1 ? t.cardOneStop : t.cardStops.replace("{count}", String(stops.length));
          facts.push(chip("c", `${label} · ${count} — ${where}`));
        });
        const bag = p.card.querySelector('[class*="cardLeftBaggageLeftPc"]')?.textContent || "";
        if (bag.includes("+")) facts.push(chip("c", `🧳 ${t.cardBagExtra}`));
        else if (/تشمل الأمتعة|baggage included/i.test(p.card.textContent || "")) facts.push(chip("c", `🧳 ${t.cardBagIn}`));

        // The other side: on the pick, the button; elsewhere, the money.
        let key = facts.map((n) => n.textContent).join("|");
        if (state === "featured" && withinCount > 0) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "all";
          b.setAttribute("aria-expanded", String(openWithin));
          const label = document.createElement("span");
          label.textContent = openWithin ? t.allWithinHide : t.allWithinShow;
          const n = document.createElement("span");
          n.className = "n";
          n.textContent = String(withinCount);
          const chev = document.createElement("span");
          chev.className = "chev";
          chev.setAttribute("aria-hidden", "true");
          chev.textContent = "▾";
          b.append(label, n, chev);
          isolate(b);
          b.addEventListener("click", toggle("within"));
          side.push(b);
          key += `|btn:${openWithin}:${withinCount}`;
        } else if (state === "within" && pick?.price != null && p.price !== null) {
          const d = p.price - pick.price;
          side.push(
            chip(
              "c",
              d > 0
                ? t.cardMore.replace("{amount}", money(d))
                : d < 0
                  ? t.cardLess.replace("{amount}", money(d))
                  : t.cardSame
            )
          );
        } else if (state === "over" && p.price !== null) {
          side.push(chip("c over", t.cardOver.replace("{amount}", money(p.price - budget))));
        }
        key += "|" + side.map((n) => n.textContent).join("|");

        const existing = p.card.querySelector(`:scope > .${ROW}`);
        if (existing?.getAttribute("data-key") === key) continue;
        const row = document.createElement("div");
        row.className = ROW;
        row.setAttribute("data-key", key);
        for (const items of [facts, side]) {
          if (items.length === 0) continue;
          const g = document.createElement("div");
          g.className = "grp";
          items.forEach((n) => g.appendChild(n));
          row.appendChild(g);
        }
        if (existing) existing.replaceWith(row);
        else p.card.prepend(row);
      }

      // The over-budget row, between what fits and what does not.
      let bar = root.querySelector(`.${OVERBAR}`) as HTMLElement | null;
      if (!list || overPrices.length === 0) {
        bar?.remove();
      } else {
        const from = Math.min(...overPrices);
        const title = (pick ? t.overBarTitle : t.overBarTitleNone).replace("{city}", cityName);
        const sub = t.overBarSub
          .replace("{count}", flights(overPrices.length))
          .replace("{price}", money(from))
          .replace("{over}", money(from - budget));
        const key = `${title}|${sub}|${openOver}`;
        if (!bar || bar.parentElement !== list || bar.getAttribute("data-key") !== key) {
          bar?.remove();
          const next = document.createElement("button");
          next.type = "button";
          next.className = OVERBAR;
          next.setAttribute("data-key", key);
          next.setAttribute("aria-expanded", String(openOver));
          const text = document.createElement("span");
          const b = document.createElement("b");
          b.textContent = title;
          const sm = document.createElement("small");
          sm.textContent = sub;
          text.append(b, sm);
          const go = document.createElement("span");
          go.className = "go";
          const goLabel = document.createElement("span");
          goLabel.textContent = openOver ? t.overBarHide : t.overBarShow;
          const chev = document.createElement("span");
          chev.className = "chev";
          chev.setAttribute("aria-hidden", "true");
          chev.textContent = "▾";
          go.append(goLabel, chev);
          next.append(text, go);
          isolate(next);
          next.addEventListener("click", toggle("over"));
          list.appendChild(next);
          bar = next;
        }
        const order = String(Math.floor(budget) * 2 + 1);
        if (bar.style.order !== order) bar.style.order = order;
      }

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

    refresh.current = pass;
    pass();
    const id = window.setInterval(pass, 800);
    return () => window.clearInterval(id);
  }, [locale, budget, currency, cityName, t]);

  // Our buttons live in the widget's shadow root; they reach us by event.
  useEffect(() => {
    const onToggle = (e: Event) => {
      const which = (e as CustomEvent<string>).detail;
      if (which === "within") setShowWithin((v) => !v);
      if (which === "over") setShowOver((v) => !v);
    };
    window.addEventListener(TOGGLE_EVENT, onToggle);
    return () => window.removeEventListener(TOGGLE_EVENT, onToggle);
  }, []);

  // Open or close a group through attributes on the widget's host.
  useEffect(() => {
    const host = document.getElementById("tpwl-tickets");
    if (!host) return;
    if (showWithin) host.setAttribute("data-show-within", "");
    else host.removeAttribute("data-show-within");
    if (showOver) host.setAttribute("data-show-over", "");
    else host.removeAttribute("data-show-over");
    refresh.current();
  }, [showWithin, showOver]);

  const hasBudget = budget > 0;
  const noneWithin = hasBudget && stats.settled && stats.comparable && stats.total > 0 && stats.pickPrice === null;
  const picked = hasBudget && stats.comparable && stats.pickPrice !== null;

  return (
    <div
      className={`rounded-2xl p-4 ring-1 sm:p-5 ${noneWithin ? "bg-rose-50 ring-rose-200" : "bg-white shadow-sm ring-black/5"}`}
      aria-live="polite"
    >
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
        </div>
      )}

      {!hasBudget && stats.settled && (
        <p className="text-sm text-navy-600">{t.guideNoBudget.replace("{count}", String(travelers))}</p>
      )}
      {hasBudget && stats.settled && !stats.comparable && (
        <p className="text-sm text-navy-600">{t.guideOtherCurrency}</p>
      )}
      {stats.settled && stats.total === 0 && <p className="text-sm text-navy-600">{t.guideNoResults}</p>}
    </div>
  );
}
