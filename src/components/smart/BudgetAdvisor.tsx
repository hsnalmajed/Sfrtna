"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import AirportInput from "@/components/AirportInput";
import DateRangeInput from "@/components/DateRangeInput";
import TravelersPicker from "@/components/TravelersPicker";
import type { TravelerCounts } from "@/lib/types";
import { BudgetInput, ChoiceChips, Toggle } from "@/components/PlannerFields";
import { CONTINENTS, type Continent } from "@/lib/countries";
import { serializeChildrenAges } from "@/lib/searchParamsUtil";
import { trackSearchUrl, track } from "@/lib/analytics";
import { useDefaultOrigin } from "@/lib/useOrigin";
import { useProfileOnce } from "@/lib/useMember";
import type { BudgetUnderstanding } from "@/lib/ai/budget";
import type { Profile } from "@/lib/memberItems";

type Scope = "both" | "flight" | "hotel";

/**
 * «مستشار الميزانية»: the trip in the traveller's words (AI reads it into the
 * fields), or the fields straight away; then our own live searches answer —
 * the flight + hotel results for a destination, or every destination the
 * budget reaches. The AI never prices anything.
 */
export default function BudgetAdvisor({ locale }: { locale: Locale }) {
  const dict = useDictionary();
  const t = dict.budgetAdvisor;
  const router = useRouter();
  const [aiOn, setAiOn] = useState(false);
  const [text, setText] = useState("");
  const [reading, setReading] = useState(false);
  const [readFailed, setReadFailed] = useState(false);
  const [shown, setShown] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);

  const [origin, setOrigin] = useState("");
  useDefaultOrigin(origin, setOrigin);
  const [destination, setDestination] = useState("");
  const [continents, setContinents] = useState<Continent[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [travelers, setTravelers] = useState<TravelerCounts>({ adults: 2, childrenAges: [], infants: 0 });
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("SAR");
  const [scope, setScope] = useState<Scope>("both");
  const [flightShare, setFlightShare] = useState(40);
  const [stars, setStars] = useState(0);
  const [direct, setDirect] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [applyProfile] = useState(() => (p: Profile) => {
    if (p.origin) setOrigin(p.origin);
    if (p.adults) setTravelers({ adults: p.adults, childrenAges: p.childrenAges ?? [], infants: p.infants ?? 0 });
    if (p.currency) setCurrency(p.currency);
    if (p.minStars) setStars(p.minStars);
    if (p.directOnly !== undefined) setDirect(p.directOnly);
  });
  useProfileOnce(true, applyProfile);

  useEffect(() => {
    let live = true;
    fetch("/api/ai/status")
      .then((r) => r.json() as Promise<{ on: boolean }>)
      .then((j) => live && setAiOn(j.on))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  async function read() {
    if (text.trim().length < 3) return;
    setReading(true);
    setReadFailed(false);
    try {
      const res = await fetch("/api/ai/understand", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, locale }) });
      const j = (await res.json()) as { ok: boolean; fields?: BudgetUnderstanding };
      if (j.ok && j.fields) {
        const f = j.fields;
        if (f.originIata) setOrigin(f.originIata);
        setDestination(f.destinationIata ?? "");
        setContinents(f.continents);
        if (f.departDate) setFrom(f.departDate);
        if (f.returnDate) setTo(f.returnDate);
        else if (f.departDate && f.nights) setTo(new Date(Date.parse(f.departDate) + f.nights * 86_400_000).toISOString().slice(0, 10));
        if (f.adults) setTravelers({ adults: f.adults, childrenAges: f.childrenAges, infants: 0 });
        if (f.budget) setBudget(String(f.budget));
        if (f.currency) setCurrency(f.currency);
        if (f.scope) setScope(f.scope);
        if (f.hotelStars) setStars(f.hotelStars);
        setDirect(f.directOnly);
        setMissing(f.missing);
        track("ai_budget_read", { ok: true });
      } else {
        setReadFailed(true);
      }
    } catch {
      setReadFailed(true);
    } finally {
      setReading(false);
      setShown(true);
    }
  }

  function go() {
    const e: Record<string, string> = {};
    if (!origin && scope !== "hotel") e.origin = t.errorFrom;
    if (!from || !to) e.dates = t.errorDates;
    if (!(Number(budget) > 0)) e.budget = t.errorBudget;
    setErrors(e);
    if (Object.keys(e).length) return;
    const total = Number(budget);
    const flightBudget = scope === "both" ? Math.round((total * flightShare) / 100) : total;
    const hotelBudget = scope === "both" ? total - flightBudget : total;
    const nights = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000));
    const party = { adults: String(travelers.adults), childrenAges: serializeChildrenAges(travelers.childrenAges), infants: String(travelers.infants) };
    let url: string;
    if (scope === "hotel") {
      const p = new URLSearchParams({ hmode: "discover", checkIn: from, checkOut: to, ...party, budget: String(total), currency });
      if (destination) p.set("city", destination);
      if (stars) p.set("minStars", String(stars));
      url = `/${locale}/hotel-results?${p}`;
    } else {
      const p = new URLSearchParams({
        tripType: "flight",
        tripRoute: "roundtrip",
        origin,
        departDate: from,
        returnDate: to,
        ...party,
        budget: String(flightBudget),
        currency,
        directOnly: String(direct),
        baggageIncluded: "false",
        nights: String(nights),
      });
      if (scope === "both") {
        p.set("combo", "1");
        p.set("hb", String(hotelBudget));
        if (stars) p.set("hs", String(stars));
      }
      if (destination) {
        p.set("mode", "known");
        p.set("destination", destination);
        url = `/${locale}/results?${p}`;
      } else {
        p.set("mode", "discover");
        if (continents.length) p.set("continents", continents.join(","));
        url = `/${locale}/discover-results?${p}`;
      }
    }
    track("ai_budget_go", { scope, known: Boolean(destination) });
    trackSearchUrl(url);
    router.push(url);
  }

  const label = "mb-1.5 block text-sm font-bold text-navy-800";
  const card = "rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-navy-950/5 sm:p-6";

  return (
    <div className="space-y-5">
      {aiOn && (
        <div className={card}>
          <label htmlFor="ba-text" className="font-display text-lg font-extrabold text-navy-950">
            💬 {t.describe}
          </label>
          <textarea
            id="ba-text"
            rows={3}
            maxLength={600}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.placeholder}
            className="mt-3 w-full rounded-2xl border border-mist-300 bg-white px-4 py-3 text-base text-navy-900 outline-none focus:border-sea-500 focus:ring-2 focus:ring-sea-200"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {t.examples.map((x) => (
              <button key={x} type="button" onClick={() => setText(x)} className="min-h-9 rounded-full bg-mist-50 px-3 text-xs font-bold text-navy-700 ring-1 ring-mist-200 hover:ring-navy-300">
                {x}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" onClick={read} disabled={reading || text.trim().length < 3} className="min-h-11 rounded-full bg-sun-400 px-6 font-extrabold text-navy-950 shadow-[var(--shadow-sun)] disabled:opacity-50">
              {reading ? t.understanding : `✨ ${t.understand}`}
            </button>
            {!shown && (
              <button type="button" onClick={() => setShown(true)} className="min-h-11 text-sm font-bold text-sea-700 hover:underline">
                {t.orForm}
              </button>
            )}
          </div>
          {readFailed && <p className="mt-3 text-sm font-bold text-amber-800">{t.failed}</p>}
        </div>
      )}

      {(shown || !aiOn) && (
        <div className={card}>
          <p className="font-display text-lg font-extrabold text-navy-950">{aiOn && text ? t.checkTitle : t.title}</p>
          {missing.length > 0 && (
            <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
              <p className="font-extrabold">{t.needs}</p>
              <ul className="mt-1 list-disc ps-5">
                {missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4 space-y-4">
            <div>
              <span className={label}>{t.scope}</span>
              <ChoiceChips<Scope> dark={false} options={(["both", "flight", "hotel"] as Scope[]).map((s) => ({ value: s, label: t.scopes[s] }))} isOn={(v) => v === scope} onPick={setScope} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {scope !== "hotel" && (
                <div>
                  <span className={label}>{t.from}</span>
                  <AirportInput locale={locale} value={origin} onChange={setOrigin} placeholder={dict.form.originPlaceholder} ariaLabel={t.from} />
                  {errors.origin && <p className="mt-1 text-xs font-bold text-red-600">{errors.origin}</p>}
                </div>
              )}
              <div>
                <span className={label}>{t.to}</span>
                <AirportInput locale={locale} value={destination} onChange={setDestination} placeholder={dict.form.destinationPlaceholder} ariaLabel={t.to} />
              </div>
            </div>
            {!destination && scope !== "hotel" && (
              <div>
                <span className={label}>{t.continents}</span>
                <div className="flex flex-wrap gap-2">
                  {CONTINENTS.map((c) => {
                    const sel = continents.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={sel}
                        onClick={() => setContinents(sel ? continents.filter((x) => x !== c) : [...continents, c])}
                        className={`min-h-10 rounded-full px-3.5 text-xs font-bold ring-1 ${sel ? "bg-sun-400 text-navy-950 ring-sun-400" : "bg-white text-navy-700 ring-mist-300"}`}
                      >
                        {sel ? "✓ " : ""}
                        {dict.attractions.continents[c]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div>
              <span className={label}>{t.dates}</span>
              <DateRangeInput
                purpose="trip"
                locale={locale}
                departDate={from}
                returnDate={to}
                withReturn
                onChange={({ departDate, returnDate }) => {
                  setFrom(departDate);
                  setTo(returnDate);
                }}
              />
              {errors.dates && <p className="mt-1 text-xs font-bold text-red-600">{errors.dates}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <span className={label}>{t.travellers}</span>
                <TravelersPicker locale={locale} value={travelers} onChange={setTravelers} />
              </div>
              <BudgetInput
                id="ba-budget"
                locale={locale}
                dark={false}
                label={t.budget}
                placeholder={t.budget}
                currencyLabel={dict.form.currency}
                value={budget}
                onChange={setBudget}
                currency={currency}
                onCurrencyChange={setCurrency}
                error={errors.budget}
              />
            </div>
            {scope === "both" && (
              <div>
                <span className={label}>{t.split}</span>
                <input type="range" min={20} max={80} step={5} value={flightShare} onChange={(e) => setFlightShare(Number(e.target.value))} className="w-full accent-navy-900" aria-label={t.split} />
                <div className="mt-1 flex justify-between text-xs font-bold text-navy-600">
                  <span>✈️ {t.splitFlight.replace("{p}", String(flightShare))}{Number(budget) > 0 ? ` · ${Math.round((Number(budget) * flightShare) / 100).toLocaleString("en-US")}` : ""}</span>
                  <span>🏨 {t.splitHotel.replace("{p}", String(100 - flightShare))}{Number(budget) > 0 ? ` · ${(Number(budget) - Math.round((Number(budget) * flightShare) / 100)).toLocaleString("en-US")}` : ""}</span>
                </div>
              </div>
            )}
            {scope !== "flight" && (
              <div>
                <span className={label}>{t.stars}</span>
                <ChoiceChips<number> dark={false} options={[{ value: 0, label: t.anyStars }, ...[3, 4, 5].map((n) => ({ value: n, label: "★".repeat(n) }))]} isOn={(v) => v === stars} onPick={setStars} />
              </div>
            )}
            {scope !== "hotel" && (
              <Toggle dark={false} id="ba-direct" checked={direct} onChange={setDirect} icon="takeoff">
                {t.direct}
              </Toggle>
            )}
          </div>
          <button type="button" onClick={go} className="mt-6 min-h-12 w-full rounded-full bg-sun-400 px-6 font-extrabold text-navy-950 shadow-[var(--shadow-sun)] hover:bg-sun-300">
            {t.show}
          </button>
          <p className="mt-3 text-center text-xs text-navy-500">{t.note}</p>
        </div>
      )}
    </div>
  );
}
