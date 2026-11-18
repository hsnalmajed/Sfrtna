"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES } from "@/lib/countries";
import type { Visited, WorldCountry, WorldMapFile } from "@/lib/visitedMap";

export type MapView = "countries" | "cities" | "years";
export interface CityPoint {
  code: string;
  id: string;
  name: string;
  x: number;
  y: number;
  been: boolean;
}

type Box = [number, number, number, number]; // x, y, w, h

/** Logo colours on the night map (owner: every colour comes from the logo). */
export const NIGHT = {
  ocean: "#061a33",
  sphere: "#0a2547",
  land: "#22426d",
  line: "#061a33",
  been: "#f8b840",
  wish: "#88b1e1",
  older: "#b97f1c",
  newer: "#ffd772",
  noYear: "#d9a441",
};

const TINY = 9;
const NAME = new Map(COUNTRIES.map((c) => [c.code, c]));
export function countryName(c: { c: string; ar?: string; en?: string }, ar: boolean): string {
  const k = NAME.get(c.c);
  return (ar ? k?.nameAr ?? c.ar : k?.nameEn ?? c.en) ?? c.c;
}

function mix(a: string, b: string, k: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((x, i) => Math.round(x + (pb[i] - x) * k).toString(16).padStart(2, "0")).join("")}`;
}

function fitBox(b: [number, number, number, number], frame: { w: number; h: number }, aspect: number, minW = 34): Box {
  const pad = 0.2;
  let w = Math.max(minW, (b[2] - b[0]) * (1 + pad * 2));
  let h = Math.max(minW / aspect, (b[3] - b[1]) * (1 + pad * 2));
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  w = Math.min(w, frame.w);
  h = Math.min(h, frame.h * 1.4);
  const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
  return [cx - w / 2, cy - h / 2, w, h];
}

/** A country's mainland box: France without Guiana, Norway without Svalbard… */
function mainBox(c: WorldCountry): [number, number, number, number] {
  return [Math.max(c.b[0], c.p[0] - 70), Math.max(c.b[1], c.p[1] - 50), Math.min(c.b[2], c.p[0] + 70), Math.min(c.b[3], c.p[1] + 50)];
}

export default function WorldCanvas({
  world,
  visited,
  view,
  cities,
  selected,
  glow,
  ar,
  labels,
  onSelect,
  onReset,
  onSwipe,
}: {
  world: WorldMapFile;
  visited: Visited;
  view: MapView;
  cities: CityPoint[];
  selected: string | null;
  glow: string | null;
  ar: boolean;
  labels: { zoomIn: string; zoomOut: string; zoomWorld: string; map: string };
  onSelect: (code: string) => void;
  onReset: () => void;
  onSwipe: (dir: 1 | -1) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<[number, number]>([360, 280]);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) setSize([r.width, r.height]);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const aspect = size[0] / size[1];
  const byCode = useMemo(() => new Map(world.countries.map((c) => [c.c, c])), [world]);

  // ── View box ──────────────────────────────────────────────────────────
  const worldBox = useMemo((): Box => {
    // Crop the empty poles a little: the land fills the frame like Been's.
    const y0 = world.h * 0.06, h0 = world.h * 0.86;
    if (world.w / h0 > aspect) {
      const nh = world.w / aspect;
      return [0, y0 - (nh - h0) / 2, world.w, nh];
    }
    const nw = h0 * aspect;
    return [(world.w - nw) / 2, y0, nw, h0];
  }, [world, aspect]);
  const target = useMemo((): Box => {
    const c = selected ? byCode.get(selected) : undefined;
    return c ? fitBox(mainBox(c), world, aspect) : worldBox;
  }, [selected, byCode, world, aspect, worldBox]);

  const [box, setBoxState] = useState<Box | null>(null);
  const boxRef = useRef<Box | null>(null);
  const setBox = (b: Box) => {
    boxRef.current = b;
    setBoxState(b);
  };
  const flyTo = (t: Box) => {
    const from = boxRef.current;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const ms = !from || reduce ? 0 : 520;
    const start = performance.now();
    const step = (now: number) => {
      const k = ms === 0 ? 1 : Math.min(1, (now - start) / ms);
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      setBox(from ? (from.map((a, i) => a + (t[i] - a) * e) as Box) : t);
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(step);
  };
  const raf = useRef(0);
  useEffect(() => {
    flyTo(target);
    return () => cancelAnimationFrame(raf.current);
    // flyTo reads refs only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const zoomBy = (factor: number, cx?: number, cy?: number) => {
    const b = boxRef.current;
    if (!b) return;
    const w = Math.min(world.w * 1.15, Math.max(6, b[2] * factor));
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
    // reads refs only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Gestures: pan / pinch when zoomed; swipe = next view at world scale ──
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const g = useRef({ moved: false, dist: 0, sx: 0, sy: 0 });
  const zoomed = Boolean(box && box[2] < worldBox[2] * 0.8);
  const onDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    g.current.moved = false;
    g.current.sx = e.clientX;
    g.current.sy = e.clientY;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      g.current.dist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    const svg = svgRef.current, b = boxRef.current;
    if (!prev || !svg || !b) return;
    if (pointers.current.size === 2) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [p, q] = [...pointers.current.values()];
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (g.current.dist > 0) {
        const at = toFrame((p.x + q.x) / 2, (p.y + q.y) / 2);
        zoomBy(g.current.dist / d, at?.[0], at?.[1]);
      }
      g.current.dist = d;
      g.current.moved = true;
      return;
    }
    const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
    if (!g.current.moved && Math.hypot(e.clientX - g.current.sx, e.clientY - g.current.sy) < 6) return;
    g.current.moved = true;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!zoomed) return; // world scale: the gesture is a swipe, judged on release
    const r = svg.getBoundingClientRect();
    const s = Math.max(b[2] / r.width, b[3] / r.height);
    setBox([b[0] - dx * s, b[1] - dy * s, b[2], b[3]]);
  };
  const onUp = (e: React.PointerEvent) => {
    const moved = g.current.moved;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size > 0) return;
    if (moved) {
      const dx = e.clientX - g.current.sx, dy = e.clientY - g.current.sy;
      if (!zoomed && Math.abs(dx) > 60 && Math.abs(dy) < 50) onSwipe(dx < 0 === ar ? -1 : 1);
      return;
    }
    const code = (e.target as Element).closest("[data-code]")?.getAttribute("data-code");
    if (code) onSelect(code);
  };

  // ── Colours ───────────────────────────────────────────────────────────
  const yearRange = useMemo(() => {
    const ys = [...visited.countries.values()].flat().filter((y) => y > 0);
    return ys.length ? [Math.min(...ys), Math.max(...ys)] : null;
  }, [visited]);
  const fill = (code: string): string => {
    const trips = visited.countries.get(code);
    if (trips) {
      if (view !== "years") return NIGHT.been;
      const ys = trips.filter((y) => y > 0);
      if (!ys.length || !yearRange) return NIGHT.noYear;
      const span = Math.max(1, yearRange[1] - yearRange[0]);
      return mix(NIGHT.older, NIGHT.newer, (Math.max(...ys) - yearRange[0]) / span);
    }
    if (view === "countries" && visited.dreams.has(code)) return NIGHT.wish;
    return NIGHT.land;
  };

  if (!box) return <div ref={wrapRef} className="h-full w-full" />;
  const px = Math.max(box[2] / size[0], box[3] / size[1]); // frame units per screen pixel
  const close = box[2] < 140;

  // Country names where they fit on screen.
  const nameFont = 11;
  const countryLabels = world.countries.flatMap((c) => {
    if (!c.d) return [];
    const name = countryName(c, ar);
    const mb = mainBox(c);
    const wPx = (mb[2] - mb[0]) / px, hPx = (mb[3] - mb[1]) / px;
    const need = name.length * nameFont * (ar ? 0.46 : 0.52);
    if (wPx < need * 0.85 || hPx < nameFont * 1.3) return [];
    if (c.p[0] < box[0] || c.p[0] > box[0] + box[2] || c.p[1] < box[1] || c.p[1] > box[1] + box[3]) return [];
    return [{ c: c.c, name, x: c.p[0], y: c.p[1] }];
  });
  const shownCities = cities.filter((c) => (view === "cities" ? true : c.code === selected) && (c.been || c.code === selected));
  const cityLabels = close ? shownCities.filter((c) => c.been || box[2] < 60) : [];

  return (
    <div ref={wrapRef} className="relative h-full w-full">
      <svg
        ref={svgRef}
        viewBox={box.join(" ")}
        className="h-full w-full touch-pan-y select-none"
        style={{ touchAction: zoomed ? "none" : "pan-y" }}
        role="img"
        aria-label={labels.map}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={(e) => pointers.current.delete(e.pointerId)}
      >
        <path d={world.sphere} fill={NIGHT.sphere} />
        <g stroke={NIGHT.line} strokeWidth={0.7} strokeLinejoin="round" style={{ cursor: "pointer" }}>
          {world.countries.map((c) =>
            c.d ? (
              <path
                key={c.c}
                data-code={c.c}
                d={c.d}
                fill={fill(c.c)}
                vectorEffect="non-scaling-stroke"
                className={`transition-[fill] duration-500 ${glow === c.c ? "sfr-glow" : ""}`}
              />
            ) : null
          )}
        </g>
        <g style={{ cursor: "pointer" }}>
          {world.countries
            .filter((c) => (c.b[2] - c.b[0]) * (c.b[3] - c.b[1]) < TINY && (close || fill(c.c) !== NIGHT.land))
            .map((c) => (
              <circle key={c.c} data-code={c.c} cx={c.p[0]} cy={c.p[1]} r={px * 5} fill={fill(c.c)} stroke="#ffffff" strokeOpacity={0.5} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
        </g>
        {selected && byCode.get(selected)?.d && (
          <path d={byCode.get(selected)!.d} fill="none" stroke="#ffffff" strokeWidth={1.8} vectorEffect="non-scaling-stroke" pointerEvents="none" />
        )}
        <g pointerEvents="none" fontFamily="inherit" textAnchor="middle" dominantBaseline="middle">
          {countryLabels.map((l) => (
            <text
              key={l.c}
              x={l.x}
              y={l.y}
              fontSize={nameFont * px}
              fontWeight={700}
              fill={visited.countries.has(l.c) ? "#061a33" : "#ffffff"}
              fillOpacity={visited.countries.has(l.c) ? 0.85 : 0.6}
            >
              {l.name}
            </text>
          ))}
        </g>
        <g pointerEvents="none">
          {shownCities.map((c) => (
            <circle
              key={`${c.code}/${c.id}`}
              cx={c.x}
              cy={c.y}
              r={px * (c.been ? 5.5 : 3.5)}
              fill={c.been ? "#ffffff" : "#88b1e1"}
              stroke={c.been ? "#061a33" : "#061a33"}
              strokeWidth={c.been ? 2.2 : 1}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>
        <g pointerEvents="none" fontFamily="inherit" dominantBaseline="middle">
          {cityLabels.map((c) => (
            <text
              key={`l-${c.code}/${c.id}`}
              x={c.x + px * 8 * (ar ? -1 : 1)}
              y={c.y}
              textAnchor={ar ? "end" : "start"}
              fontSize={(c.been ? 12 : 10.5) * px}
              fontWeight={c.been ? 800 : 600}
              fill="#ffffff"
              stroke="#061a33"
              strokeWidth={3 * px}
              paintOrder="stroke"
            >
              {c.name}
            </text>
          ))}
        </g>
      </svg>
      <div className="absolute start-2 top-2 flex flex-col gap-1.5">
        <button type="button" onClick={() => zoomBy(0.6)} aria-label={labels.zoomIn} className="grid h-10 w-10 place-items-center rounded-xl bg-white/12 text-lg font-bold text-white ring-1 ring-white/15 backdrop-blur active:scale-95">
          +
        </button>
        <button type="button" onClick={() => zoomBy(1.6)} aria-label={labels.zoomOut} className="grid h-10 w-10 place-items-center rounded-xl bg-white/12 text-lg font-bold text-white ring-1 ring-white/15 backdrop-blur active:scale-95">
          −
        </button>
        {zoomed && (
          <button type="button" onClick={() => (selected ? onReset() : flyTo(worldBox))} aria-label={labels.zoomWorld} className="grid h-10 w-10 place-items-center rounded-xl bg-white/12 text-base text-white ring-1 ring-white/15 backdrop-blur active:scale-95">
            🌍
          </button>
        )}
      </div>
    </div>
  );
}
