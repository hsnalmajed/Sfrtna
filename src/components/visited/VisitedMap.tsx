"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { COUNTRIES, CONTINENTS, flagEmoji, type Continent } from "@/lib/countries";
import { COUNTRY_CITIES } from "@/lib/cities";
import { CITY_COORDS } from "@/data/cityCoords";
import { openJoin, showToast } from "@/components/member/events";
import {
  cityKey,
  continentOf,
  countryKey,
  project,
  useVisited,
  wishKey,
  WORLD_TOTAL,
  type WorldCountry,
  type WorldMapFile,
} from "@/lib/visitedMap";
import ScrollRow from "@/components/ui/ScrollRow";
import { searchMatches } from "@/lib/search";
import { shareVisitedImage } from "@/components/visited/visitedImage";

type T = ReturnType<typeof useDictionary>["visited"];
type Box = [number, number, number, number]; // x, y, w, h

/** Logo colours (owner: every new colour comes from the logo). */
export const MAP_COLORS = {
  ocean: "#eff5fc",
  none: "#dfe6f0",
  been: "#f8b840",
  beenSoft: "#fde3ad",
  wish: "#88b1e1",
  line: "#ffffff",
  navy: "#0b2d5b",
};

/** Our cities in a country, and how many of them are marked. */
function explored(code: string, keys: ReadonlySet<string>): { seen: number; total: number } {
  const list = COUNTRY_CITIES[code] ?? [];
  return { seen: list.filter((c) => keys.has(cityKey(code, c.slug))).length, total: list.length };
}

export function levelOf(levels: readonly string[], countries: number): string {
  const i = countries === 0 ? 0 : countries < 5 ? 1 : countries < 15 ? 2 : countries < 30 ? 3 : countries < 60 ? 4 : 5;
  return levels[i] ?? levels[levels.length - 1];
}

const TINY = 9; // bounds area (frame units²) under which a country also gets a dot

function nameOf(c: { c: string; ar?: string; en?: string }, ar: boolean): string {
  const known = COUNTRIES.find((x) => x.code === c.c);
  return (ar ? known?.nameAr ?? c.ar : known?.nameEn ?? c.en) ?? c.c;
}

function fitBox(b: [number, number, number, number], frame: { w: number; h: number }, aspect: number, minW = 36): Box {
  const pad = 0.18;
  let w = Math.max(minW, (b[2] - b[0]) * (1 + pad * 2));
  let h = Math.max(minW / aspect, (b[3] - b[1]) * (1 + pad * 2));
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  w = Math.min(w, frame.w);
  h = Math.min(h, frame.h * 1.4);
  const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  return [cx - w / 2, cy - h / 2, w, h];
}

export default function VisitedMap({ locale }: { locale: Locale }) {
  const dict = useDictionary();
  const t: T = dict.visited;
  const continentsT = dict.attractions.continents as Record<Continent, string>;
  const ar = locale === "ar";
  const v = useVisited();
  const [world, setWorld] = useState<WorldMapFile | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<"countries" | "cities">("countries");
  const [region, setRegion] = useState<Continent | "world">("world");
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

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

  const byCode = useMemo(() => new Map((world?.countries ?? []).map((c) => [c.c, c])), [world]);

  const cities = useMemo(() => {
    if (!world) return [];
    const out: { code: string; slug: string; nameAr: string; nameEn: string; x: number; y: number }[] = [];
    for (const [code, list] of Object.entries(COUNTRY_CITIES)) {
      for (const c of list) {
        const at = CITY_COORDS[c.slug];
        if (!at || at.code !== code) continue;
        const [x, y] = project(at.lat, at.lon, world.proj);
        out.push({ code, slug: c.slug, nameAr: c.nameAr, nameEn: c.nameEn, x, y });
      }
    }
    return out;
  }, [world]);

  // ── The view box: world, a continent, or the chosen country ──────────────
  const [aspect, setAspect] = useState(2);
  const [pxW, setPxW] = useState(360);
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) {
        setAspect(r.width / r.height);
        setPxW(r.width);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const target = useMemo((): Box | null => {
    if (!world) return null;
    if (selected) {
      const c = byCode.get(selected);
      if (c) return fitBox(c.b, world, aspect);
    }
    if (region !== "world") {
      const cs = world.countries.filter((c) => continentOf(c.c) === region && c.c !== "RU" && c.c !== "FJ" && c.c !== "KI");
      if (region === "europe") cs.push(...world.countries.filter((c) => c.c === "IS"));
      const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
      for (const c of cs) {
        // France, Norway, Netherlands, Spain… carry far-away islands; a continent is their mainland.
        const x0 = Math.max(c.b[0], c.p[0] - 60), x1 = Math.min(c.b[2], c.p[0] + 60);
        const y0 = Math.max(c.b[1], c.p[1] - 45), y1 = Math.min(c.b[3], c.p[1] + 45);
        b[0] = Math.min(b[0], x0); b[1] = Math.min(b[1], y0); b[2] = Math.max(b[2], x1); b[3] = Math.max(b[3], y1);
      }
      if (Number.isFinite(b[0])) return fitBox(b, world, aspect);
    }
    const [x, y, w, h] = [0, 0, world.w, world.h];
    // The whole world, centred in whatever shape the box has.
    if (w / h > aspect) {
      const nh = w / aspect;
      return [x, y - (nh - h) / 2, w, nh];
    }
    const nw = h * aspect;
    return [x - (nw - w) / 2, y, nw, h];
  }, [world, selected, region, aspect, byCode]);

  const [box, setBoxState] = useState<Box | null>(null);
  const boxRef = useRef<Box | null>(null);
  const setBox = (b: Box) => {
    boxRef.current = b;
    setBoxState(b);
  };
  useEffect(() => {
    if (!target) return;
    const from = boxRef.current;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const ms = !from || reduce ? 0 : 480;
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = ms === 0 ? 1 : Math.min(1, (now - start) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      setBox(from ? (from.map((a, i) => a + (target[i] - a) * e) as Box) : target);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  // ── Pan and pinch (zoomed in), tap to choose ─────────────────────────────
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; dist: number }>({ moved: false, dist: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const zoomBy = (factor: number, cx?: number, cy?: number) => {
    const b = boxRef.current;
    if (!b || !world) return;
    const w = Math.min(world.w * 1.2, Math.max(8, b[2] * factor));
    const h = (w / b[2]) * b[3];
    const px = cx ?? b[0] + b[2] / 2, py = cy ?? b[1] + b[3] / 2;
    setBox([px - ((px - b[0]) * w) / b[2], py - ((py - b[1]) * h) / b[3], w, h]);
  };

  const toFrame = (clientX: number, clientY: number): [number, number] | null => {
    const svg = svgRef.current, b = boxRef.current;
    if (!svg || !b) return null;
    const r = svg.getBoundingClientRect();
    const s = Math.max(b[2] / r.width, b[3] / r.height);
    const ox = (r.width * s - b[2]) / 2, oy = (r.height * s - b[3]) / 2;
    return [b[0] - ox + (clientX - r.left) * s, b[1] - oy + (clientY - r.top) * s];
  };

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // trackpad pinch; a plain wheel scrolls the page
      e.preventDefault();
      const at = toFrame(e.clientX, e.clientY);
      zoomBy(Math.exp(e.deltaY * 0.01), at?.[0], at?.[1]);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world]);

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current.moved = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current.dist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const svg = svgRef.current, b = boxRef.current;
    if (!svg || !b) return;
    const r = svg.getBoundingClientRect();
    const s = Math.max(b[2] / r.width, b[3] / r.height);
    if (pointers.current.size === 2) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [p, q] = [...pointers.current.values()];
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (gesture.current.dist > 0) {
        const at = toFrame((p.x + q.x) / 2, (p.y + q.y) / 2);
        zoomBy(gesture.current.dist / d, at?.[0], at?.[1]);
      }
      gesture.current.dist = d;
      gesture.current.moved = true;
      return;
    }
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    if (!gesture.current.moved && Math.hypot(dx, dy) < 6) return;
    gesture.current.moved = true;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setBox([b[0] - dx * s, b[1] - dy * s, b[2], b[3]]);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const wasDrag = gesture.current.moved;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0 || wasDrag) return;
    const el = (e.target as Element).closest("[data-code]");
    const code = el?.getAttribute("data-code");
    if (code) choose(code);
  };

  const choose = (code: string) => {
    setSelected((s) => (s === code ? null : code));
  };

  const run = async (fn: () => Promise<boolean>) => {
    if (busy) return;
    setBusy(true);
    const ok = await fn();
    setBusy(false);
    if (!ok) showToast({ text: t.failed });
  };

  const fill = (code: string): string => {
    const been = v.keys.has(countryKey(code));
    if (view === "cities") {
      if (!been) return MAP_COLORS.none;
      const { seen, total } = explored(code, v.keys);
      if (total === 0 || seen === 0) return MAP_COLORS.beenSoft;
      const k = Math.min(1, 0.35 + (0.65 * seen) / total);
      return mix(MAP_COLORS.beenSoft, MAP_COLORS.been, k);
    }
    if (been) return MAP_COLORS.been;
    if (v.keys.has(wishKey(code))) return MAP_COLORS.wish;
    return MAP_COLORS.none;
  };

  const s = v.stats;
  const zoomed = Boolean(box && world && box[2] < world.w * 0.8);
  // Frame units per screen pixel: dots keep their size on screen at any zoom.
  const px = box ? Math.max(box[2] / pxW, box[3] / (pxW / aspect)) : 1;
  // At world or continent scale only marked dots show; every dot once zoomed in.
  const close = Boolean(box && box[2] < 260);
  const sel = selected ? byCode.get(selected) : undefined;
  const selName = sel ? nameOf(sel, ar) : "";
  const dreams = [...v.keys].filter((k) => k.startsWith("w:")).map((k) => k.slice(2));

  const share = async () => {
    if (!world || sharing) return;
    setSharing(true);
    try {
      await shareVisitedImage({ world, keys: v.keys, cities, locale, t, level: levelOf(t.levels, s.countries) });
    } catch {
      showToast({ text: t.shareFailed });
    }
    setSharing(false);
  };

  const q = query.trim().toLowerCase();
  // «عمان» finds «عُمان»: tashkeel, hamza forms, ة/ى ignored (lib/search.ts).
  const listed = COUNTRIES.filter((c) => searchMatches([c.nameAr, c.nameEn, c.code], query));

  return (
    <div className="space-y-5">
      {/* The numbers */}
      <section className="overflow-hidden rounded-3xl bg-navy-990 p-5 text-white shadow-lg sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-sun-300">{levelOf(t.levels, s.countries)}</span>
          <button
            type="button"
            onClick={share}
            disabled={!world || sharing || s.countries + s.regions === 0}
            className="rounded-full bg-[#f8b840] px-4 py-2 text-sm font-extrabold text-navy-990 shadow-sm transition active:scale-95 disabled:opacity-40"
          >
            {sharing ? "…" : `📤 ${t.share}`}
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat big={String(s.countries)} label={t.statCountries} sub={t.ofTotal.replace("{total}", String(WORLD_TOTAL))} />
          <div className="flex items-center gap-3">
            <Ring pct={s.worldPct} />
            <div>
              <p className="font-display text-3xl font-extrabold leading-none">{`${s.worldPct}${ar ? "٪" : "%"}`}</p>
              <p className="mt-1 text-xs text-white/65">{t.statWorld}</p>
            </div>
          </div>
          <Stat big={String(s.cities)} label={t.statCities} />
          <Stat big={String(s.continents)} label={t.statContinents} />
        </div>
        {s.regions > 0 && <p className="mt-3 text-xs text-white/55">{t.regions.replace("{n}", String(s.regions))}</p>}
      </section>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-2xl bg-mist-100 p-1 ring-1 ring-navy-900/5" role="tablist">
          {(["countries", "cities"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={view === k}
              onClick={() => setView(k)}
              className={`min-h-10 rounded-xl px-4 text-sm font-bold transition ${view === k ? "bg-white text-navy-900 shadow-sm" : "text-navy-900/55"}`}
            >
              {k === "countries" ? t.viewCountries : t.viewCities}
            </button>
          ))}
        </div>
        <ScrollRow outerClassName="min-w-0 flex-1" className="flex gap-1.5 pb-1">
          {(["world", ...CONTINENTS] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setSelected(null);
                setRegion(c);
              }}
              className={`min-h-11 shrink-0 rounded-full px-3.5 text-xs font-bold ring-1 transition ${
                region === c && !selected ? "bg-navy-900 text-white ring-navy-900" : "bg-white text-navy-900/70 ring-navy-900/10"
              }`}
            >
              {c === "world" ? `🌍 ${t.world}` : continentsT[c]}
            </button>
          ))}
        </ScrollRow>
      </div>

      {/* The map */}
      <div ref={mapRef} className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-[#eff5fc] ring-1 ring-navy-900/10 sm:aspect-[2/1]">
        {!world && (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-navy-900/50">{failed ? t.failed : t.loading}</p>
        )}
        {world && box && (
          <svg
            ref={svgRef}
            viewBox={box.join(" ")}
            className="h-full w-full select-none"
            style={{ touchAction: zoomed ? "none" : "pan-y" }}
            role="img"
            aria-label={t.mapLabel}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
          >
            <path d={world.sphere} fill={MAP_COLORS.ocean} />
            <g stroke={MAP_COLORS.line} strokeWidth={0.6} strokeLinejoin="round" style={{ cursor: "pointer" }}>
              {world.countries.map((c) =>
                c.d ? (
                  <path key={c.c} data-code={c.c} d={c.d} fill={fill(c.c)} vectorEffect="non-scaling-stroke" className="transition-[fill] duration-300">
                    <title>{nameOf(c, ar)}</title>
                  </path>
                ) : null
              )}
            </g>
            {/* Small countries: a dot you can see and tap. */}
            <g style={{ cursor: "pointer" }}>
              {world.countries
                .filter((c) => (c.b[2] - c.b[0]) * (c.b[3] - c.b[1]) < TINY && (close || fill(c.c) !== MAP_COLORS.none))
                .map((c) => (
                  <circle
                    key={c.c}
                    data-code={c.c}
                    cx={c.p[0]}
                    cy={c.p[1]}
                    r={px * 5}
                    fill={fill(c.c)}
                    stroke={fill(c.c) === MAP_COLORS.none ? "#9aa9c0" : MAP_COLORS.navy}
                    strokeWidth={0.8}
                    vectorEffect="non-scaling-stroke"
                  >
                    <title>{nameOf(c, ar)}</title>
                  </circle>
                ))}
            </g>
            {sel?.d && <path d={sel.d} fill="none" stroke={MAP_COLORS.navy} strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" />}
            {(view === "cities" || selected) && (
              <g pointerEvents="none">
                {cities
                  .filter((c) => view === "cities" || c.code === selected)
                  .filter((c) => close || c.code === selected || v.keys.has(cityKey(c.code, c.slug)))
                  .map((c) => {
                    const on = v.keys.has(cityKey(c.code, c.slug));
                    return (
                      <circle
                        key={`${c.code}/${c.slug}`}
                        cx={c.x}
                        cy={c.y}
                        r={px * (on ? 6 : 4)}
                        fill={on ? MAP_COLORS.navy : "#ffffff"}
                        stroke={on ? "#ffffff" : "#538cd0"}
                        strokeWidth={on ? 2 : 1}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
              </g>
            )}
          </svg>
        )}
        {world && (
          <div className="absolute top-2 end-2 flex flex-col gap-1.5">
            <button type="button" onClick={() => zoomBy(0.6)} aria-label="+" className="h-9 w-9 rounded-xl bg-white text-lg font-bold text-navy-900 shadow ring-1 ring-navy-900/10">+</button>
            <button type="button" onClick={() => zoomBy(1.6)} aria-label="−" className="h-9 w-9 rounded-xl bg-white text-lg font-bold text-navy-900 shadow ring-1 ring-navy-900/10">−</button>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-2 start-2 flex flex-wrap gap-x-3 gap-y-1 rounded-xl bg-white/85 px-2.5 py-1.5 text-[0.7rem] font-bold text-navy-900/75 backdrop-blur">
          <Legend color={MAP_COLORS.been} text={t.legendBeen} />
          {view === "countries" && <Legend color={MAP_COLORS.wish} text={t.legendWish} />}
          <Legend color={MAP_COLORS.none} text={t.legendNone} />
        </div>
      </div>

      {/* The chosen country */}
      {sel && (
        <CountryCard
          key={sel.c}
          locale={locale}
          t={t}
          country={sel}
          name={selName}
          continent={continentOf(sel.c) ? continentsT[continentOf(sel.c)!] : ""}
          keys={v.keys}
          busy={busy}
          onCountry={() => run(() => v.toggleCountry(sel.c))}
          onWish={() => run(() => v.toggleWish(sel.c))}
          onCity={(slug) => run(() => v.toggleCity(sel.c, slug))}
          onClose={() => setSelected(null)}
        />
      )}

      {!sel && s.countries + s.regions === 0 && !v.loading && (
        <div className="rounded-3xl bg-sun-50 p-5 ring-1 ring-sun-200">
          <p className="font-display text-base font-extrabold text-navy-950">{t.emptyTitle}</p>
          <p className="mt-1 text-sm leading-7 text-navy-900/70">{t.emptyBody}</p>
        </div>
      )}

      {/* Keep it: signed out with marks */}
      {!v.signedIn && v.keys.size > 0 && (
        <div className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-navy-900/10 sm:flex-row sm:items-center">
          <span className="text-3xl" aria-hidden="true">🔒</span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-extrabold text-navy-950">{t.saveTitle}</p>
            <p className="mt-1 text-sm leading-7 text-navy-900/70">{t.saveBody}</p>
          </div>
          <button type="button" onClick={() => openJoin("map")} className="rounded-2xl bg-navy-900 px-5 py-3 text-sm font-extrabold text-white active:scale-95">
            {t.saveCta}
          </button>
        </div>
      )}
      {v.signedIn && v.keys.size > 0 && <p className="text-center text-xs font-bold text-navy-900/50">{t.saved}</p>}

      {dreams.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-base font-extrabold text-navy-950">⭐ {t.dreams}</h2>
          <div className="flex flex-wrap gap-2">
            {dreams.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => {
                  setSelected(code);
                  mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="rounded-full bg-navy-50 px-3 py-1.5 text-sm font-bold text-navy-900 ring-1 ring-navy-200"
              >
                {flagEmoji(code)} {nameOf({ c: code, ...byCode.get(code) }, ar)}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Quick marking */}
      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-navy-900/10 sm:p-5">
        <h2 className="font-display text-base font-extrabold text-navy-950">{t.listTitle}</h2>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.search}
          className="mt-3 w-full rounded-2xl bg-mist-50 px-4 py-2.5 text-sm text-navy-900 ring-1 ring-navy-900/10 outline-none focus:ring-2 focus:ring-navy-400"
        />
        {listed.length === 0 && <p className="mt-3 text-sm text-navy-900/60">{t.noMatch}</p>}
        <div className="mt-3 space-y-2">
          {CONTINENTS.map((cont) => {
            const rows = listed.filter((c) => c.continent === cont);
            if (rows.length === 0) return null;
            const all = COUNTRIES.filter((c) => c.continent === cont);
            const seen = all.filter((c) => v.keys.has(countryKey(c.code))).length;
            return (
              <details key={cont} open={Boolean(q)} className="group rounded-2xl bg-mist-50 ring-1 ring-navy-900/5">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-extrabold text-navy-900">
                  <span className="flex-1">{continentsT[cont]}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs text-navy-900/70 ring-1 ring-navy-900/10">
                    {seen} / {all.length}
                  </span>
                  <span aria-hidden="true" className="text-navy-900/40 transition group-open:rotate-90 rtl:rotate-180 rtl:group-open:rotate-90">›</span>
                </summary>
                <ul className="grid gap-1 px-2 pb-2 sm:grid-cols-2">
                  {rows.map((c) => {
                    const on = v.keys.has(countryKey(c.code));
                    return (
                      <li key={c.code} className="flex items-center gap-1 rounded-xl bg-white ps-3 ring-1 ring-navy-900/5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(c.code);
                            mapRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                          }}
                          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-start text-sm font-bold text-navy-900"
                        >
                          <span aria-hidden="true">{flagEmoji(c.code)}</span>
                          <span className="truncate">{ar ? c.nameAr : c.nameEn}</span>
                          {v.keys.has(wishKey(c.code)) && <span aria-hidden="true">⭐</span>}
                        </button>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          aria-label={`${t.been}: ${ar ? c.nameAr : c.nameEn}`}
                          onClick={() => run(() => v.toggleCountry(c.code))}
                          className="flex h-11 w-11 shrink-0 items-center justify-center active:scale-90"
                        >
                          <span
                            aria-hidden="true"
                            className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-black ring-1 transition ${
                              on ? "bg-[#f8b840] text-navy-990 ring-[#e0a030]" : "bg-white text-transparent ring-navy-900/20"
                            }`}
                          >
                            ✓
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function mix(a: string, b: string, k: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((x, i) => Math.round(x + (pb[i] - x) * k).toString(16).padStart(2, "0")).join("")}`;
}

function Stat({ big, label, sub }: { big: string; label: string; sub?: string }) {
  return (
    <div>
      <p className="font-display text-3xl font-extrabold leading-none">{big}</p>
      <p className="mt-1 text-xs text-white/65">{label}</p>
      {sub && <p className="text-[0.7rem] text-white/45">{sub}</p>}
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const r = 18, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 shrink-0 -rotate-90" aria-hidden="true">
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,.15)" strokeWidth="5" />
      <circle cx="22" cy="22" r={r} fill="none" stroke="#f8b840" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(Math.min(100, pct) / 100) * c} ${c}`} />
    </svg>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className="h-2.5 w-2.5 rounded-sm ring-1 ring-navy-900/15" style={{ background: color }} />
      {text}
    </span>
  );
}

function CountryCard({
  locale,
  t,
  country,
  name,
  continent,
  keys,
  busy,
  onCountry,
  onWish,
  onCity,
  onClose,
}: {
  locale: Locale;
  t: T;
  country: WorldCountry;
  name: string;
  continent: string;
  keys: ReadonlySet<string>;
  busy: boolean;
  onCountry: () => void;
  onWish: () => void;
  onCity: (slug: string) => void;
  onClose: () => void;
}) {
  const ar = locale === "ar";
  const code = country.c;
  const been = keys.has(countryKey(code));
  const wish = keys.has(wishKey(code));
  const list = COUNTRY_CITIES[code] ?? [];
  const { seen, total } = explored(code, keys);
  const known = COUNTRIES.some((c) => c.code === code);
  return (
    <section className="rounded-3xl bg-white p-5 shadow-md ring-1 ring-navy-900/10">
      <div className="flex items-start gap-3">
        <span className="text-4xl leading-none" aria-hidden="true">{flagEmoji(code)}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-extrabold text-navy-950">{name}</h2>
          {continent && <p className="text-xs font-bold text-navy-900/50">{continent}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label={t.close} className="rounded-full px-2 text-xl leading-none text-navy-900/40">
          ×
        </button>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onCountry}
          className={`rounded-2xl px-5 py-2.5 text-sm font-extrabold transition active:scale-95 ${
            been ? "bg-[#f8b840] text-navy-990" : "bg-navy-900 text-white"
          }`}
        >
          {been ? t.beenOn : `✈️ ${t.been}`}
        </button>
        {!been && (
          <button
            type="button"
            disabled={busy}
            onClick={onWish}
            className={`rounded-2xl px-4 py-2.5 text-sm font-bold ring-1 transition active:scale-95 ${
              wish ? "bg-navy-100 text-navy-900 ring-navy-300" : "bg-white text-navy-900 ring-navy-900/15"
            }`}
          >
            {wish ? t.wishOn : `⭐ ${t.wish}`}
          </button>
        )}
      </div>
      {total > 0 ? (
        <div className="mt-5">
          <div className="flex items-center justify-between text-xs font-bold text-navy-900/70">
            <span>{t.explored.replace("{seen}", String(seen)).replace("{total}", String(total))}</span>
            <span>{Math.round((seen / total) * 100)}{ar ? "٪" : "%"}</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-mist-100">
            <div className="h-full rounded-full bg-[#f8b840] transition-[width] duration-500" style={{ width: `${(seen / total) * 100}%` }} />
          </div>
          {seen === 0 && <p className="mt-2 text-xs text-navy-900/55">{t.exploredHint.replace("{country}", name)}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {list.map((c) => {
              const on = keys.has(cityKey(code, c.slug));
              return (
                <button
                  key={c.slug}
                  type="button"
                  disabled={busy}
                  aria-pressed={on}
                  onClick={() => onCity(c.slug)}
                  className={`rounded-full px-3 py-1.5 text-sm font-bold ring-1 transition active:scale-95 ${
                    on ? "bg-sun-50 text-navy-900 ring-[#f8b840]" : "bg-mist-50 text-navy-900/70 ring-navy-900/10"
                  }`}
                >
                  {on ? "✓ " : ""}
                  {ar ? c.nameAr : c.nameEn}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs text-navy-900/55">{t.noCities}</p>
      )}
      {known && (
        <Link href={`/${locale}/attractions/${code}`} className="mt-4 inline-block text-sm font-bold text-navy-600 underline-offset-4 hover:underline">
          {t.guide.replace("{country}", name)} {ar ? "‹" : "›"}
        </Link>
      )}
    </section>
  );
}
