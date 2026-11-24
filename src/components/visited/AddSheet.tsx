"use client";

import { useEffect, useMemo, useState } from "react";
import { COUNTRIES, flagEmoji } from "@/lib/countries";
import { searchMatches } from "@/lib/search";
import { citiesOf, ourCities, type MapCity } from "@/lib/visitedCities";
import { counted, type Visited } from "@/lib/visitedMap";
import type { useDictionary } from "@/lib/dict/context";
import Sheet from "./Sheet";

type T = ReturnType<typeof useDictionary>["visited"];

/**
 * «+»: which country → which cities there. A country already on the map
 * opens with its cities ticked, so a later trip only adds the new ones
 * (owner 18 Nov 13:15: no years, no trip counts). `dream` mode picks a
 * country for «أحلامي», then, if the traveller wants, the cities there they
 * dream of (owner 24 Nov 2026: city optional).
 */
export default function AddSheet({
  t,
  ar,
  visited,
  mode = "been",
  start,
  onSave,
  onSaveDream,
  onClose,
}: {
  t: T;
  ar: boolean;
  visited: Visited;
  mode?: "been" | "dream";
  /** open straight on this country (and tick this city) */
  start?: { code: string; city?: string } | null;
  onSave: (code: string, cities: Set<string>) => Promise<boolean>;
  onSaveDream: (code: string, cities: Set<string>) => Promise<boolean>;
  onClose: () => void;
}) {
  const [code, setCode] = useState<string | null>(start?.code ?? null);
  const [query, setQuery] = useState("");
  const pick = (c: string) => {
    setCode(c);
    setQuery("");
  };

  if (!code) {
    const list = COUNTRIES.filter((c) => searchMatches([c.nameAr, c.nameEn, c.code], query))
      .filter((c) => mode === "been" || !visited.countries.has(c.code))
      .sort((a, b) => (ar ? a.nameAr : a.nameEn).localeCompare(ar ? b.nameAr : b.nameEn, ar ? "ar" : "en"));
    return (
      <Sheet title={mode === "dream" ? t.pickDream : t.pickCountry} onClose={onClose} closeLabel={t.close} tall>
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchCountry}
          className="sticky top-0 z-10 mb-2 w-full rounded-2xl bg-mist-50 px-4 py-3 text-base text-navy-900 ring-1 ring-navy-900/10 outline-none focus:ring-2 focus:ring-[#f8b840]"
        />
        {list.length === 0 && <p className="py-6 text-center text-sm text-navy-900/60">{t.noMatch}</p>}
        <ul className="divide-y divide-navy-900/5">
          {list.map((c) => {
            const been = visited.countries.has(c.code);
            const dream = visited.dreams.has(c.code);
            const n = visited.cities.get(c.code)?.size ?? 0;
            return (
              <li key={c.code}>
                <button type="button" onClick={() => pick(c.code)} className="flex min-h-14 w-full items-center gap-3 px-1 text-start active:bg-mist-50">
                  <span className="text-2xl" aria-hidden="true">{flagEmoji(c.code)}</span>
                  <span className="min-w-0 flex-1 truncate text-[0.95rem] font-bold text-navy-950">{ar ? c.nameAr : c.nameEn}</span>
                  {been && (
                    <span className="rounded-full bg-[#fff3d6] px-2.5 py-1 text-xs font-extrabold text-[#8a5a00]">
                      {t.statusBeen}
                      {n ? ` · ${counted(t.cityForms, n)}` : ""}
                    </span>
                  )}
                  {!been && dream && <span className="rounded-full bg-navy-50 px-2.5 py-1 text-xs font-extrabold text-navy-700">{t.statusDream}</span>}
                  <span aria-hidden="true" className="text-navy-900/30 rtl:rotate-180">›</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    );
  }
  return (
    <CitiesStep
      key={code}
      t={t}
      ar={ar}
      code={code}
      visited={visited}
      dream={mode === "dream"}
      startCity={start?.code === code ? start.city : undefined}
      onBack={start ? undefined : () => setCode(null)}
      onSave={mode === "dream" ? onSaveDream : onSave}
      onClose={onClose}
    />
  );
}

function CitiesStep({
  t,
  ar,
  code,
  visited,
  dream = false,
  startCity,
  onBack,
  onSave,
  onClose,
}: {
  t: T;
  ar: boolean;
  code: string;
  visited: Visited;
  /** cities dreamt of: optional, the country alone is a full answer */
  dream?: boolean;
  startCity?: string;
  onBack?: () => void;
  onSave: (code: string, cities: Set<string>) => Promise<boolean>;
  onClose: () => void;
}) {
  const country = COUNTRIES.find((c) => c.code === code);
  const name = (ar ? country?.nameAr : country?.nameEn) ?? code;
  const [cities, setCities] = useState<MapCity[]>(() => ourCities(code));
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    void citiesOf(code).then((list) => {
      if (!live) return;
      setCities(list);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [code]);
  const [ticked, setTicked] = useState<Set<string>>(() => {
    const s = new Set((dream ? visited.dreamCities : visited.cities).get(code) ?? []);
    if (startCity) s.add(startCity);
    return s;
  });
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const shown = useMemo(() => {
    const list = cities.filter((c) => searchMatches([c.ar, c.en], query));
    // ticked first, then ours, then the rest by size (file order)
    return [...list.filter((c) => ticked.has(c.id)), ...list.filter((c) => !ticked.has(c.id))];
    // the order is fixed when the sheet opens or the search changes, not on each tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cities, query]);

  const toggle = (id: string) =>
    setTicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const save = async () => {
    setBusy(true);
    const ok = await onSave(code, ticked);
    setBusy(false);
    if (ok) onClose();
  };

  const label = dream
    ? ticked.size
      ? t.saveDreamWith.replace("{cities}", counted(t.cityForms, ticked.size))
      : t.saveDreamOnly.replace("{country}", name)
    : ticked.size
      ? t.saveWith.replace("{cities}", counted(t.cityForms, ticked.size))
      : t.save;

  return (
    <Sheet
      title={
        <span className="flex items-center gap-2">
          <span aria-hidden="true">{flagEmoji(code)}</span>
          <span className="truncate">{name}</span>
        </span>
      }
      onClose={onClose}
      onBack={onBack}
      backLabel={t.back}
      closeLabel={t.close}
      tall
      footer={
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className={`flex min-h-12 w-full items-center justify-center rounded-2xl text-base font-extrabold text-[#061a33] transition active:scale-[0.98] disabled:opacity-60 ${
            dream ? "bg-[#88b1e1] shadow-[0_8px_24px_-8px_rgb(136_177_225/0.7)]" : "bg-[#f8b840] shadow-[0_8px_24px_-8px_rgb(248_184_64/0.7)]"
          }`}
        >
          {busy ? t.saving : label}
        </button>
      }
    >
      <h3 className="mb-2 text-sm font-extrabold text-navy-900">{(dream ? t.pickDreamCities : t.pickCities).replace("{country}", name)}</h3>
      {dream && <p className="-mt-1 mb-2 text-xs font-bold text-navy-900/55">{t.pickDreamCitiesHint}</p>}
      {cities.length > 8 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchCity}
          className="mb-2 w-full rounded-2xl bg-mist-50 px-4 py-3 text-base text-navy-900 ring-1 ring-navy-900/10 outline-none focus:ring-2 focus:ring-[#f8b840]"
        />
      )}
      {loading && cities.length === 0 && <p className="py-4 text-center text-sm text-navy-900/50">{t.loadingCities}</p>}
      {!loading && cities.length === 0 && <p className="py-4 text-center text-sm text-navy-900/60">{t.noCities}</p>}
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {shown.map((c) => {
          const on = ticked.has(c.id);
          return (
            <li key={c.id}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(c.id)}
                className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-start ring-1 transition active:scale-[0.99] ${
                  on ? (dream ? "bg-[#eef4fb] ring-[#88b1e1]" : "bg-[#fff8e8] ring-[#f8b840]") : "bg-white ring-navy-900/10"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg text-sm font-black ${on ? (dream ? "bg-[#88b1e1] text-[#061a33]" : "bg-[#f8b840] text-[#061a33]") : "bg-white text-transparent ring-1 ring-navy-900/25"}`}
                >
                  ✓
                </span>
                <span className="min-w-0 flex-1 truncate text-[0.95rem] font-bold text-navy-950">{ar ? c.ar : c.en}</span>
                {c.ours && <span className="shrink-0 rounded-full bg-navy-50 px-2 py-0.5 text-[0.65rem] font-bold text-navy-600">{t.ourGuide}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {loading && cities.length > 0 && <p className="py-3 text-center text-xs text-navy-900/45">{t.loadingCities}</p>}
    </Sheet>
  );
}
