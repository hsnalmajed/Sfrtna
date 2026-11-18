"use client";

import { useEffect, useMemo, useState } from "react";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { showToast } from "@/components/member/events";
import { citiesOf, type MapCity } from "@/lib/visitedCities";
import { counted, project, useVisited, WORLD_TOTAL, type WorldMapFile } from "@/lib/visitedMap";
import WorldCanvas, { countryName, NIGHT, type CityPoint, type MapView } from "./WorldCanvas";
import AddSheet from "./AddSheet";
import { CountrySheet, ListSheet, type ListKind } from "./Panels";
import MapGate from "./MapGate";
import Tour, { TOUR_KEY } from "./Tour";
import { badgesOf } from "./badges";
import { shareVisitedImage } from "./visitedImage";

const VIEWS: MapView[] = ["countries", "cities"];

export function levelOf(levels: readonly string[], countries: number): string {
  const i = countries === 0 ? 0 : countries < 5 ? 1 : countries < 15 ? 2 : countries < 30 ? 3 : countries < 60 ? 4 : 5;
  return levels[i] ?? levels[levels.length - 1];
}

/**
 * «خريطتي» (owner's spec, 18 Nov 2026): a wide night map first, a «+» that
 * asks for the country and then its cities (and the trip's year — people go
 * back), the totals under it, then rows that open each list. Account only;
 * signed out, the page itself signs them in. First visit: a guided tour.
 */
export default function MyMap({ locale }: { locale: Locale }) {
  const dict = useDictionary();
  const t = dict.visited;
  const ar = locale === "ar";
  const v = useVisited();
  const { visited, stats: s } = v;

  const [world, setWorld] = useState<WorldMapFile | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/geo/world-map.json")
      .then((r) => (r.ok ? (r.json() as Promise<WorldMapFile>) : Promise.reject(new Error(String(r.status)))))
      .then((w) => live && setWorld(w))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  const [view, setView] = useState<MapView>("countries");
  const [selected, setSelected] = useState<string | null>(null);
  const [sheet, setSheet] = useState<
    null | { kind: "add"; mode?: "been" | "dream"; start?: { code: string; city?: string } | null } | { kind: "country"; code: string } | { kind: "list"; list: ListKind }
  >(null);
  const [glow, setGlow] = useState<string | null>(null);
  const [tour, setTour] = useState(false);
  const [sharing, setSharing] = useState(false);

  // Cities of the visited countries (and the chosen one), for pins and names.
  const [cityLists, setCityLists] = useState<Map<string, MapCity[]>>(new Map());
  const wanted = useMemo(() => [...new Set([...visited.countries.keys(), ...visited.cities.keys(), ...(selected ? [selected] : [])])].sort().join(","), [visited, selected]);
  useEffect(() => {
    let live = true;
    const codes = wanted ? wanted.split(",") : [];
    void Promise.all(codes.map(async (c) => [c, await citiesOf(c)] as const)).then((pairs) => {
      if (live) setCityLists(new Map(pairs));
    });
    return () => {
      live = false;
    };
  }, [wanted]);
  const points = useMemo((): CityPoint[] => {
    if (!world) return [];
    const out: CityPoint[] = [];
    for (const [code, list] of cityLists) {
      const been = visited.cities.get(code);
      for (const c of list) {
        const on = been?.has(c.id) ?? false;
        if (!on && code !== selected) continue;
        const [x, y] = project(c.lat, c.lon, world.proj);
        out.push({ code, id: c.id, name: ar ? c.ar : c.en, x, y, been: on });
      }
    }
    return out;
  }, [cityLists, visited, selected, world, ar]);

  // Signed in and ready: ?add=TR(&city=istanbul) from the guide pages opens «+»; first visit → the tour.
  const ready = !v.loading && v.signedIn;
  useEffect(() => {
    if (!ready) return;
    const q = new URLSearchParams(window.location.search);
    const add = q.get("add")?.toUpperCase();
    let next: typeof sheet = null;
    if (add && /^[A-Z]{2}$/.test(add)) next = { kind: "add", start: { code: add, city: q.get("city") ?? undefined } };
    let seen = true;
    try {
      seen = Boolean(window.localStorage.getItem(TOUR_KEY));
    } catch {
      /* no storage: no tour */
    }
    const id = window.setTimeout(() => {
      if (next) {
        setSheet(next);
        window.history.replaceState(null, "", window.location.pathname);
      } else if (!seen) setTour(true);
    }, 0);
    return () => window.clearTimeout(id);
  }, [ready]);

  const nameOf = (code: string) => {
    const c = world?.countries.find((x) => x.c === code);
    return countryName(c ?? { c: code }, ar);
  };

  const onSave = async (code: string, cities: Set<string>) => {
    const isNew = !visited.countries.has(code);
    const ok = await v.saveCountry(code, cities, isNew ? 0 : null);
    if (!ok) {
      showToast({ text: t.failed });
      return false;
    }
    if (isNew) showToast({ text: `🎉 ${t.savedToast.replace("{country}", nameOf(code))}` });
    setSelected(code);
    if (isNew) {
      setGlow(code);
      window.setTimeout(() => setGlow(null), 3400);
    }
    return true;
  };
  const onDream = async (code: string) => {
    const ok = visited.dreams.has(code) ? true : await v.toggleDream(code);
    if (!ok) showToast({ text: t.failed });
    return ok;
  };

  const share = async () => {
    if (!world || sharing) return;
    setSharing(true);
    try {
      await shareVisitedImage({ world, visited, stats: s, cities: points, badges: badgesOf(visited, s), locale, t, level: levelOf(t.levels, s.countries) });
    } catch {
      showToast({ text: t.shareFailed });
    }
    setSharing(false);
  };

  if (v.loading) return <div className="grid min-h-[60vh] place-items-center text-white/60">{t.loading}</div>;
  if (!v.signedIn) return <MapGate locale={locale} t={t} world={world} />;

  const badges = badgesOf(visited, s);
  const won = badges.filter((b) => b.now >= b.need).length;
  const viewLabel = { countries: t.viewCountries, cities: t.viewCities };
  const roundBtn = "grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/15 active:scale-95";
  const of = (n: number, total: number) => t.badgesOf.replace("{n}", String(n)).replace("{total}", String(total));

  const rows: { list: ListKind; icon: string; title: string; sub: string }[] = [
    { list: "countries", icon: "🏳️", title: t.rowCountries, sub: counted(t.countryForms, s.countries + s.regions) },
    { list: "cities", icon: "🏙️", title: t.rowCities, sub: counted(t.cityForms, s.cities) },
    { list: "continents", icon: "🌐", title: t.rowContinents, sub: of(s.continents, 6) },
    { list: "stats", icon: "📊", title: t.rowStats, sub: `${s.worldPct}${ar ? "٪" : "%"} ${t.statWorld}` },
    { list: "badges", icon: "🏅", title: t.rowBadges, sub: of(won, badges.length) },
    { list: "dreams", icon: "⭐", title: t.rowDreams, sub: String(visited.dreams.size) },
  ];

  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-extrabold text-[#f8b840] sm:text-4xl">{t.title}</h1>
          <p className="mt-0.5 text-xs font-bold text-white/55">{levelOf(t.levels, s.countries)}</p>
        </div>
        <button type="button" onClick={() => setTour(true)} aria-label={t.help} className={roundBtn}>
          <span className="text-lg font-black">؟</span>
        </button>
        <button type="button" data-tour="share" onClick={share} disabled={sharing || s.countries + s.regions === 0} aria-label={t.share} className={`${roundBtn} disabled:opacity-40`}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="2.6" />
            <circle cx="6" cy="12" r="2.6" />
            <circle cx="18" cy="19" r="2.6" />
            <path d="m8.3 10.7 7.4-4.3M8.3 13.3l7.4 4.3" />
          </svg>
        </button>
        <button
          type="button"
          data-tour="add"
          onClick={() => setSheet({ kind: "add" })}
          aria-label={t.add}
          className="grid h-12 w-12 place-items-center rounded-full bg-[#f8b840] text-3xl font-light leading-none text-[#061a33] shadow-[0_8px_26px_-6px_rgb(248_184_64/0.75)] transition active:scale-95"
        >
          +
        </button>
      </div>

      {/* The map */}
      <div data-tour="map" className="relative -mx-4 overflow-hidden bg-[#061a33] ring-1 ring-white/10 sm:mx-0 sm:rounded-[1.75rem]">
        <div className="h-[62vw] max-h-[560px] min-h-[260px] sm:h-[48vw]">
          {world ? (
            <WorldCanvas
              world={world}
              visited={visited}
              view={view}
              cities={points}
              selected={selected}
              glow={glow}
              ar={ar}
              labels={{ zoomIn: t.zoomIn, zoomOut: t.zoomOut, zoomWorld: t.zoomWorld, map: t.mapLabel }}
              onSelect={(code) => {
                setSelected(code);
                setSheet({ kind: "country", code });
              }}
              onReset={() => setSelected(null)}
              onSwipe={(dir) => setView((cur) => VIEWS[(VIEWS.indexOf(cur) + dir + VIEWS.length) % VIEWS.length])}
            />
          ) : (
            <p className="grid h-full place-items-center text-sm text-white/55">{failed ? t.loadFailed : t.loading}</p>
          )}
        </div>
        <div className="pointer-events-none absolute bottom-2 end-3 flex gap-3 text-[0.7rem] font-bold text-white/75">
          <Legend color={NIGHT.been} text={t.legendBeen} />
          {view === "countries" ? (
            <>
              <Legend color={NIGHT.wish} text={t.legendWish} />
              <Legend color={NIGHT.been} text={t.legendSmall} diamond />
            </>
          ) : (
            <>
              <Legend color="#ffffff" text={t.legendCity} round />
              {selected && <Legend color="#88b1e1" text={t.legendCityNot} round />}
            </>
          )}
        </div>
      </div>

      {/* Views: dots like Been's, with names */}
      <div data-tour="views" className="flex items-center justify-center gap-1.5" role="tablist">
        {VIEWS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={view === k}
            onClick={() => setView(k)}
            className={`flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-extrabold transition ${view === k ? "bg-white/12 text-white" : "text-white/45"}`}
          >
            <span className={`h-2 w-2 rounded-full ${view === k ? "bg-[#f8b840]" : "bg-white/35"}`} aria-hidden="true" />
            {viewLabel[k]}
          </button>
        ))}
      </div>

      {/* Totals */}
      <section data-tour="totals" className="rounded-[1.75rem] bg-white/[0.06] p-5 ring-1 ring-white/10 sm:p-6">
        <h2 className="text-lg font-extrabold text-white">{t.total}</h2>
        <div className="mt-4 grid grid-cols-3 items-center gap-2">
          <div className="text-center">
            <p className="font-display text-4xl font-extrabold leading-none text-[#f8b840] sm:text-5xl">
              {s.worldPct}
              <span className="text-2xl">{ar ? "٪" : "%"}</span>
            </p>
            <p className="mt-1.5 text-xs font-bold text-white/60">{t.statWorld}</p>
          </div>
          <Ring pct={s.worldPct} />
          <div className="text-center">
            <p className="font-display text-4xl font-extrabold leading-none text-[#f8b840] sm:text-5xl">{s.countries}</p>
            <p className="mt-1.5 text-xs font-bold text-white/60">{t.statCountries}</p>
          </div>
        </div>
        <p className="mt-3 text-center text-xs font-bold text-white/45">{t.ofTotal.replace("{total}", String(WORLD_TOTAL))}</p>
        <div className="mt-4 grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 pt-4 text-center rtl:divide-x-reverse">
          <Mini big={s.cities} label={t.statCities} />
          <Mini big={s.continents} label={t.statContinents} />
          <Mini big={won} label={t.statBadges} />
        </div>
        {s.regions > 0 && <p className="mt-3 text-center text-xs text-white/45">{t.regions.replace("{n}", String(s.regions))}</p>}
      </section>

      {/* Lists */}
      <ul className="overflow-hidden rounded-[1.75rem] bg-white/[0.06] ring-1 ring-white/10 sm:grid sm:grid-cols-2">
        {rows.map((r) => (
          <li key={r.list} className="border-b border-white/[0.07] last:border-0 sm:[&:nth-last-child(2)]:border-0">
            <button type="button" onClick={() => setSheet({ kind: "list", list: r.list })} className="flex min-h-16 w-full items-center gap-3 px-4 text-start transition hover:bg-white/[0.04]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-xl" aria-hidden="true">
                {r.icon}
              </span>
              <span className="min-w-0 flex-1 text-base font-extrabold text-white">{r.title}</span>
              <span className="text-sm font-bold text-white/55">{r.sub}</span>
              <span aria-hidden="true" className="text-white/35 rtl:rotate-180">›</span>
            </button>
          </li>
        ))}
      </ul>

      {s.countries + s.regions === 0 && (
        <button type="button" onClick={() => setSheet({ kind: "add" })} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#f8b840] text-base font-extrabold text-[#061a33]">
          ✈️ {t.add}
        </button>
      )}

      {sheet?.kind === "add" && (
        <AddSheet t={t} ar={ar} visited={visited} mode={sheet.mode} start={sheet.start} onSave={onSave} onDream={onDream} onClose={() => setSheet(null)} />
      )}
      {sheet?.kind === "country" && (
        <CountrySheet
          locale={locale}
          t={t}
          code={sheet.code}
          name={nameOf(sheet.code)}
          visited={visited}
          lists={cityLists}
          onBeen={() => setSheet({ kind: "add", start: { code: sheet.code } })}
          onDream={() => void onDream(sheet.code)}
          onRemoveCity={(id) => {
            const next = new Set(visited.cities.get(sheet.code) ?? []);
            next.delete(id);
            void v.saveCountry(sheet.code, next, null);
          }}
          onMoveToDream={() => void v.moveToDream(sheet.code)}
          onRemove={async () => {
            await v.removeCountry(sheet.code);
            setSheet(null);
            setSelected(null);
          }}
          onRemoveDream={() => void v.toggleDream(sheet.code)}
          onClose={() => {
            setSheet(null);
            setSelected(null);
          }}
        />
      )}
      {sheet?.kind === "list" && (
        <ListSheet
          kind={sheet.list}
          locale={locale}
          t={t}
          visited={visited}
          stats={s}
          lists={cityLists}
          onCountry={(code) => {
            setSelected(code);
            setSheet({ kind: "country", code });
          }}
          onAddDream={() => setSheet({ kind: "add", mode: "dream" })}
          onClose={() => setSheet(null)}
        />
      )}
      {tour && <Tour steps={t.tourSteps} labels={{ next: t.tourNext, done: t.tourDone, skip: t.tourSkip }} onDone={() => setTour(false)} />}
      <p className="sr-only">{counted(t.countryForms, s.countries)}</p>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 34, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 84 84" className="mx-auto h-20 w-20 -rotate-90 sm:h-24 sm:w-24" aria-hidden="true">
      <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="9" />
      <circle
        cx="42"
        cy="42"
        r={r}
        fill="none"
        stroke="#f8b840"
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${Math.max(pct > 0 ? 2 : 0, (Math.min(100, pct) / 100) * c)} ${c}`}
        className="transition-[stroke-dasharray] duration-700"
      />
    </svg>
  );
}

function Mini({ big, label }: { big: number; label: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-extrabold text-white">{big}</p>
      <p className="mt-0.5 text-[0.7rem] font-bold text-white/55">{label}</p>
    </div>
  );
}

function Legend({ color, text, round, diamond }: { color: string; text: string; round?: boolean; diamond?: boolean }) {
  return (
    <span className="flex items-center gap-1">
      <span
        className={`h-2.5 w-2.5 ${round ? "rounded-full ring-2 ring-[#061a33]" : diamond ? "rotate-45 rounded-[2px] ring-1 ring-[#061a33]" : "rounded-sm"}`}
        style={{ background: color }}
      />
      {text}
    </span>
  );
}
