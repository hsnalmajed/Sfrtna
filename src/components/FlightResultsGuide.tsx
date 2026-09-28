"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/types";
import { getDictionary } from "@/lib/dictionaries";
import { findAirport } from "@/lib/airports";
import Icon from "@/components/ui/Icon";

/**
 * The flight results, held to the traveller's budget.
 *
 * The widget draws every fare it finds, over budget or not, and leaves the
 * choosing to the reader. This turns that list into an answer:
 *
 *   - one flight, picked for them: the widget's own "best" if it fits the
 *     budget, otherwise the cheapest that does;
 *   - the other flights that fit, one tap away, each saying how much more or
 *     less it costs than the pick;
 *   - the flights over budget, behind their own button, each saying by how
 *     much — so the choice to spend more stays theirs, and is never made for
 *     them by the order of a list;
 *   - and when nothing fits, a plain sentence: what flights to this place on
 *     these dates actually start at, and by how much that is over.
 *
 * It works on the widget's cards in place (they live in its shadow root), by
 * marking each card and letting a stylesheet we add there show or hide it —
 * the widget keeps drawing, sorting and filtering as it likes. Each card also
 * gets a row that says in words what the widget buries: direct or where it
 * stops and for how long, baggage in or not, and the fare against the budget.
 *
 * Markers read (checked on sfrtna.com, 27 Sep 2026):
 *
 *   card          [class*="FlightCard-module__card___"]
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
const MORE = "sfr-more";
const TOGGLE_EVENT = "sfr-guide-toggle";

const CSS = `
/* One tidy line across the top of the card: the flight's facts on one side,
   all the same shape and size; where it stands against the budget on the
   other. Only the pick and the budget carry colour, so they are what the eye
   finds first. */
.${ROW}{grid-column:1 / -1;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px 16px;padding:12px 16px 10px;margin-bottom:2px;border-bottom:1px dashed #dfe6ef;font-family:inherit}
.${ROW} .grp{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.${ROW} span{display:inline-flex;align-items:center;gap:5px;height:28px;border-radius:8px;padding:0 10px;font-size:12.5px;font-weight:700;line-height:1;white-space:nowrap}
.${ROW} .pick{background:#ffa630;color:#062653;font-weight:900}
.${ROW} .fact{background:#f1f5fa;color:#0b2d5b}
.${ROW} .fact.warn{color:#8a4b00}
.${ROW} .fact.muted{color:#5b6b82}
.${ROW} .fits{background:#e7f6ee;color:#135d3a}
.${ROW} .diff{background:transparent;color:#3b4a60;box-shadow:inset 0 0 0 1px #d5dde8}
[data-sfr-tag]{font-weight:800 !important;font-size:13px !important;padding:3px 12px !important;border-radius:999px !important}
[data-sfr-tag="best"]{background:#ffa630 !important;color:#062653 !important}
[data-sfr-tag="cheapest"]{background:#3bb6e4 !important;color:#062653 !important}
[data-sfr-state="featured"]{box-shadow:0 0 0 2px #ffa630,0 12px 30px -12px rgba(6,38,83,.35) !important}
[class*="DirectFlights-module__root"]{display:none !important}
/* The two ways on, at the foot of the picked flight's own card. */
.${MORE}{grid-column:1 / -1;display:flex;flex-wrap:wrap;gap:10px;padding:12px 16px 14px;border-top:1px dashed #dfe6ef;font-family:inherit}
.${MORE} button{flex:1 1 240px;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:44px;border:0;border-radius:12px;padding:8px 16px;font:inherit;font-size:14px;font-weight:800;line-height:1.3;cursor:pointer;transition:transform .15s,box-shadow .15s,background .15s}
.${MORE} button:hover{transform:translateY(-1px)}
.${MORE} button:focus-visible{outline:2px solid #ffa630;outline-offset:2px}
.${MORE} .b-within{background:#e8f6fc;color:#0b2d5b;box-shadow:inset 0 0 0 1.5px #3bb6e4}
.${MORE} .b-within[aria-pressed="true"]{background:#0b2d5b;color:#fff;box-shadow:none}
.${MORE} .b-over{background:linear-gradient(135deg,#e11d48,#f97316);color:#fff;box-shadow:0 8px 20px -8px rgba(225,29,72,.6)}
.${MORE} .b-over[aria-pressed="true"]{background:#fff1f2;color:#9f1239;box-shadow:inset 0 0 0 1.5px #fda4af}
.${MORE} .arr{font-size:12px;transition:transform .2s}
.${MORE} [aria-pressed="true"] .arr{transform:rotate(180deg)}
/* The pick first, then what else fits, then what does not, then "more". */
:host([data-sfr-filter]) [data-sfr-list]{display:flex !important;flex-direction:column}
:host([data-sfr-filter]) [data-sfr-state="featured"]{order:-1 !important}
:host([data-sfr-filter]) [data-sfr-state="within"]{box-shadow:0 0 0 1.5px #9fdcf3 !important}
:host([data-sfr-filter]) [data-sfr-state="over"]{box-shadow:0 0 0 1.5px #fecdd3 !important}
:host([data-sfr-filter]) [data-sfr-list] > [class*="TicketsWidget-module__moreTickets"]{order:99999999}
.${ROW} .over{background:#e11d48;color:#fff}
:host([data-sfr-filter]:not([data-show-within])) [data-sfr-state="within"]{display:none !important}
:host([data-sfr-filter]:not([data-show-over])) [data-sfr-state="over"]{display:none !important}
:host([data-sfr-filter]:not([data-show-within]):not([data-show-over])) [class*="TicketsWidget-module__moreTickets"]{display:none !important}
/* Filters are for browsing a list. While only the pick (or nothing) is on
   screen they are a tall empty column; they come back with the other options. */
:host([data-sfr-filter]:not([data-show-within]):not([data-show-over])) [class*="FlightFilters-module__filerContainer"],
:host([data-sfr-filter]:not([data-show-within]):not([data-show-over])) [class*="FlightFiltersMobileMenu-module__root"]{display:none !important}
:host([data-sfr-filter]:not([data-show-within]):not([data-show-over])) [class*="TicketsWidget-module__wrapper"]{grid-column:1 / -1 !important}
`;

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
  const money = (n: number) => moneyIn(currency, n);
  // Lets the show/hide effect redraw the in-card buttons at once.
  const refresh = useRef<() => void>(() => {});

  // Read the cards, mark them, write their notes — every second, since the
  // widget re-draws them whenever it sorts, filters or loads more.
  useEffect(() => {
    const city = (code: string) => {
      const a = findAirport(code);
      return a ? (locale === "ar" ? a.cityAr : a.cityEn) : code;
    };
    const money = (n: number) => moneyIn(currency, n);
    const chip = (cls: string, text: string) => {
      const s = document.createElement("span");
      s.className = cls;
      s.textContent = text;
      return s;
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
        style.textContent = CSS;
        root.appendChild(style);
      }

      const cards = [...root.querySelectorAll('[class*="FlightCard-module__card___"]')];
      const priced = cards.map((card) => {
        const text = card.querySelector('[data-testid^="flight-card-price-"]')?.textContent || "";
        const tags = [...card.querySelectorAll('[class*="cardBadges"]')];
        let best = false;
        let cheapest = false;
        for (const tag of tags) {
          const tx = tag.textContent || "";
          if (TAG_BEST.test(tx)) {
            best = true;
            tag.setAttribute("data-sfr-tag", "best");
          } else if (TAG_CHEAPEST.test(tx)) {
            cheapest = true;
            tag.setAttribute("data-sfr-tag", "cheapest");
          }
        }
        return { card, price: amountOf(text), cur: currencyOf(text), best, cheapest };
      });

      const widgetCurrency = priced.find((p) => p.cur)?.cur ?? null;
      const comparable = budget > 0 && (widgetCurrency === null || widgetCurrency === currency);
      const filtering = comparable && priced.length > 0;

      const within = filtering ? priced.filter((p) => p.price !== null && p.price <= budget) : [];
      const pick =
        within.find((p) => p.best) ??
        (within.length ? within.reduce((a, b) => ((a.price ?? 0) <= (b.price ?? 0) ? a : b)) : null);

      if (cards[0]?.parentElement) cards[0].parentElement.setAttribute("data-sfr-list", "");
      if (filtering) host.setAttribute("data-sfr-filter", "");
      else host.removeAttribute("data-sfr-filter");
      // Nothing fits: no list to filter, so no filter column beside it.
      if (filtering && !pick) host.setAttribute("data-sfr-none", "");
      else host.removeAttribute("data-sfr-none");

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
        // Opened groups read cheapest first, so the smallest difference is
        // the first one seen.
        const rank = filtering && p.price !== null ? String(Math.round(p.price)) : "";
        const el = p.card as HTMLElement;
        if (el.style.order !== rank) el.style.order = rank;

        // The notes row: facts on one side, budget on the other.
        const facts: HTMLElement[] = [];
        const money2: HTMLElement[] = [];
        if (state === "featured") facts.push(chip("pick", `⭐ ${t.cardPicked.replace(/^⭐\s*/, "")}`));
        const legs = [...p.card.querySelectorAll('[class*="Flight-module__cardFlight___"]')];
        legs.forEach((leg, i) => {
          const label = legs.length === 2 ? (i === 0 ? t.cardOutbound : t.cardReturn) : t.cardLeg;
          const stops = [...leg.querySelectorAll('[class*="cardFlightTravelLineTransfer"]')];
          if (stops.length === 0) {
            facts.push(chip("fact", `✈ ${label} · ${t.cardDirect}`));
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
          facts.push(chip("fact warn", `✈ ${label} · ${count} — ${where}`));
        });
        const bag = p.card.querySelector('[class*="cardLeftBaggageLeftPc"]')?.textContent || "";
        if (bag.includes("+")) facts.push(chip("fact muted", `🧳 ${t.cardBagExtra}`));
        else if (/تشمل الأمتعة|baggage included/i.test(p.card.textContent || "")) facts.push(chip("fact", `🧳 ${t.cardBagIn}`));

        if (filtering && p.price !== null) {
          if (state === "over") money2.push(chip("over", t.cardOver.replace("{amount}", money(p.price - budget))));
          else money2.push(chip("fits", `✓ ${t.cardFits.replace("{amount}", money(budget - p.price))}`));
          if (state === "within" && pick?.price != null) {
            const d = p.price - pick.price;
            money2.push(
              chip(
                "diff",
                d > 0
                  ? t.cardMore.replace("{amount}", money(d))
                  : d < 0
                    ? t.cardLess.replace("{amount}", money(d))
                    : t.cardSame
              )
            );
          }
        }
        const notes = [...facts, ...money2];
        const key = notes.map((n) => n.textContent).join("|");
        const existing = p.card.querySelector(`:scope > .${ROW}`);
        if (existing?.getAttribute("data-key") === key) continue;
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

      // The other options, and the flights over budget, open from the
      // picked flight's own card — not from a panel above it.
      const withinCount = within.length ? within.length - 1 : 0;
      const overPrices = filtering
        ? priced.filter((p) => p.price !== null && p.price > budget).map((p) => p.price as number)
        : [];
      for (const p of priced) {
        const bar = p.card.querySelector(`:scope > .${MORE}`);
        if (p !== pick || (withinCount === 0 && overPrices.length === 0)) {
          bar?.remove();
          continue;
        }
        const openW = host.hasAttribute("data-show-within");
        const openO = host.hasAttribute("data-show-over");
        const overLabel = openO
          ? t.guideHideOver
          : t.guideShowOver
              .replace("{count}", String(overPrices.length))
              .replace("{amount}", overPrices.length ? money(Math.min(...overPrices) - budget) : "");
        const withinLabel = openW ? t.guideHideWithin : t.guideShowWithin.replace("{count}", String(withinCount));
        const key = `${withinCount}|${overPrices.length}|${withinLabel}|${overLabel}`;
        if (bar?.getAttribute("data-key") === key) continue;
        const next = document.createElement("div");
        next.className = MORE;
        next.setAttribute("data-key", key);
        next.addEventListener("click", (e) => e.stopPropagation());
        const button = (cls: string, label: string, open: boolean, which: "within" | "over") => {
          const b = document.createElement("button");
          b.type = "button";
          b.className = cls;
          b.setAttribute("aria-pressed", String(open));
          b.append(document.createTextNode(label));
          const arr = document.createElement("span");
          arr.className = "arr";
          arr.setAttribute("aria-hidden", "true");
          arr.textContent = "▼";
          b.append(arr);
          // The whole card opens the widget's ticket drawer on click; this
          // button must not.
          for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
            b.addEventListener(type, (e) => e.stopPropagation());
          }
          b.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            window.dispatchEvent(new CustomEvent(TOGGLE_EVENT, { detail: which }));
          });
          next.appendChild(b);
        };
        if (withinCount > 0) button("b-within", withinLabel, openW, "within");
        if (overPrices.length > 0) button("b-over", overLabel, openO, "over");
        if (bar) bar.replaceWith(next);
        else p.card.appendChild(next);
      }

      const searching = Boolean(root.querySelector('[class*="SearchProgressbar"]'));
      if (searching) sawProgress = true;
      const prices = priced.map((p) => p.price).filter((n): n is number => n !== null);
      const next: Omit<Stats, "settled"> = {
        searching,
        total: priced.length,
        within: within.length ? within.length - 1 : 0,
        over: filtering ? priced.length - within.length : 0,
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
  }, [locale, budget, currency, t]);

  // The two buttons open the hidden groups through attributes on the host.
  useEffect(() => {
    const host = document.getElementById("tpwl-tickets");
    if (!host) return;
    if (showWithin) host.setAttribute("data-show-within", "");
    else host.removeAttribute("data-show-within");
    if (showOver) host.setAttribute("data-show-over", "");
    else host.removeAttribute("data-show-over");
    refresh.current();
  }, [showWithin, showOver]);

  // The buttons inside the card live in the widget's shadow root; they
  // reach this component through a window event.
  useEffect(() => {
    const onToggle = (e: Event) => {
      const which = (e as CustomEvent<string>).detail;
      if (which === "within") setShowWithin((v) => !v);
      if (which === "over") setShowOver((v) => !v);
    };
    window.addEventListener(TOGGLE_EVENT, onToggle);
    return () => window.removeEventListener(TOGGLE_EVENT, onToggle);
  }, []);

  const hasBudget = budget > 0;
  const noneWithin = hasBudget && stats.settled && stats.comparable && stats.total > 0 && stats.pickPrice === null;
  const picked = hasBudget && stats.comparable && stats.pickPrice !== null;

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
        </div>
      )}

      {!hasBudget && stats.settled && (
        <p className="text-sm text-navy-600">{t.guideNoBudget.replace("{count}", String(travelers))}</p>
      )}
      {hasBudget && stats.settled && !stats.comparable && (
        <p className="text-sm text-navy-600">{t.guideOtherCurrency}</p>
      )}
      {stats.settled && stats.total === 0 && <p className="text-sm text-navy-600">{t.guideNoResults}</p>}

      {/* Nothing fits, so there is no card to hold the button: it sits here. */}
      {noneWithin && stats.over > 0 && (
        <button
          type="button"
          aria-pressed={showOver}
          onClick={() => setShowOver((v) => !v)}
          className={`mt-4 inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-extrabold transition hover:-translate-y-px ${
            showOver
              ? "bg-white text-rose-800 ring-1 ring-rose-300"
              : "bg-gradient-to-l from-rose-600 to-orange-500 text-white shadow-[0_8px_20px_-8px_rgba(225,29,72,0.6)]"
          }`}
        >
          {showOver
            ? t.guideHideOver
            : t.guideShowOver
                .replace("{count}", String(stats.over))
                .replace("{amount}", money((stats.cheapest ?? budget) - budget))}
          <span aria-hidden="true" className={`text-xs transition ${showOver ? "rotate-180" : ""}`}>▼</span>
        </button>
      )}
    </div>
  );
}
