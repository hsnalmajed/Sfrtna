"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { dayColor } from "@/lib/dayColors";

/** One stop of the plan with a position. */
export interface MapStop {
  id: string;
  lat: number;
  lon: number;
  /** Day index (0-based) and the stop's order inside that day (1-based). */
  day: number;
  order: number;
  city: string;
  name: string;
  time: string;
  meal: boolean;
  href: string;
}

/** One city of a route, numbered in order. */
export interface MapCity {
  slug: string;
  name: string;
  lat: number;
  lon: number;
  n: number;
}

export interface PlanMapText {
  day: string;
  onMap: string;
  goDay: string;
  attribution: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function cityIcon(c: MapCity, active: boolean) {
  // Zero-size icon: the number sits on the point, its name beside it, whatever its length.
  return L.divIcon({
    className: "",
    iconSize: [0, 0],
    html: `<span style="position:absolute;top:-17px;inset-inline-start:-17px;display:flex;align-items:center;gap:6px;white-space:nowrap;cursor:pointer">
      <span style="display:grid;place-items:center;width:34px;height:34px;border-radius:999px;background:${active ? "#fbbf24" : "#0b1b33"};color:${active ? "#0b1b33" : "#fbbf24"};border:3px solid #fff;box-shadow:0 3px 10px rgba(11,27,51,.4);font:900 15px/1 Tajawal,system-ui,sans-serif">${c.n}</span>
      <span style="padding:3px 9px;border-radius:999px;background:#fff;color:#0b1b33;box-shadow:0 2px 6px rgba(11,27,51,.25);font:800 13px/1.3 Tajawal,system-ui,sans-serif">${esc(c.name)}</span>
    </span>`,
  });
}

function stopIcon(s: MapStop, label: number) {
  const color = dayColor(s.day);
  return L.divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
    html: `<span style="display:grid;place-items:center;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)"><span style="transform:rotate(45deg);color:#fff;font:900 13px/1 Tajawal,system-ui,sans-serif">${s.meal ? "🍽" : label}</span></span>`,
  });
}

function dotIcon(day: number) {
  return L.divIcon({
    className: "",
    iconSize: [10, 10],
    iconAnchor: [5, 5],
    html: `<span style="display:block;width:10px;height:10px;border-radius:999px;background:${dayColor(day)};border:1.5px solid #fff;opacity:.85"></span>`,
  });
}

/** Frames the map on what is shown each time the choice changes. */
function Frame({ points, keyOf }: { points: [number, number][]; keyOf: string }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    if (points.length === 1) {
      map.flyTo(points[0], 14, { duration: 0.6 });
      return;
    }
    map.flyToBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 15, duration: 0.6 });
    // Only when the choice changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyOf, map]);
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    return () => ro.disconnect();
  }, [map]);
  return null;
}

/**
 * The plan's live map (owner, 16 Nov: «tap a city's number → that city with
 * ALL the plan's places»). Whole route: numbered cities joined in order, the
 * places as small dots. A city (or a one-city plan): every place as a pin in
 * its day's colour, numbered by day — or, with one day chosen, by its order
 * that day and joined in that order. A pin opens its name, day, time,
 * «على الخريطة» and a jump to that day in the plan.
 */
export default function PlanMapCanvas({
  stops,
  cities,
  city,
  day,
  onCity,
  onDay,
  t,
}: {
  stops: MapStop[];
  /** Empty for a one-city plan. */
  cities: MapCity[];
  /** The city in focus (route), or null for the whole route. */
  city: string | null;
  /** The day in focus, or null for every day. */
  day: number | null;
  onCity: (slug: string) => void;
  onDay: (day: number) => void;
  t: PlanMapText;
}) {
  const whole = cities.length > 1 && !city;
  const shown = useMemo(
    () => stops.filter((s) => (whole || !city || s.city === city) && (day === null || s.day === day)),
    [stops, whole, city, day],
  );
  const points = useMemo<[number, number][]>(() => {
    if (whole) return cities.map((c) => [c.lat, c.lon]);
    const p = shown.map((s) => [s.lat, s.lon] as [number, number]);
    if (p.length) return p;
    const c = cities.find((x) => x.slug === city);
    return c ? [[c.lat, c.lon]] : [];
  }, [whole, cities, shown, city]);
  const first = points[0] ?? [0, 0];

  return (
    // `isolate`: leaflet's own layers (z-index up to 800) stay under the sticky day strip.
    <div className="isolate overflow-hidden rounded-2xl ring-1 ring-mist-200">
      <MapContainer center={first} zoom={12} scrollWheelZoom={false} className="h-72 w-full sm:h-96">
        <Frame points={points} keyOf={`${whole ? "all" : (city ?? "one")}|${day ?? "all"}|${stops.length}`} />
        <TileLayer attribution={t.attribution} url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />

        {whole && cities.length > 1 && (
          <Polyline positions={cities.map((c) => [c.lat, c.lon] as [number, number])} pathOptions={{ color: "#0b1b33", weight: 3, dashArray: "8 8", opacity: 0.75 }} />
        )}
        {whole && shown.map((s) => <Marker key={s.id} position={[s.lat, s.lon]} icon={dotIcon(s.day)} interactive={false} />)}

        {!whole && day !== null && shown.length > 1 && (
          <Polyline positions={shown.map((s) => [s.lat, s.lon] as [number, number])} pathOptions={{ color: dayColor(day), weight: 3, opacity: 0.8 }} />
        )}
        {!whole &&
          shown.map((s) => (
            <Marker key={s.id} position={[s.lat, s.lon]} icon={stopIcon(s, day === null ? s.day + 1 : s.order)}>
              <Popup>
                <div className="min-w-52 font-sans" dir="auto">
                  {/* Divs, not p: leaflet gives popup paragraphs wide margins. */}
                  <div className="text-sm font-extrabold leading-snug text-navy-950">{s.name}</div>
                  <div className="mt-1 text-xs font-bold" style={{ color: dayColor(s.day) }}>
                    {t.day.replace("{n}", String(s.day + 1))}
                    {s.time ? ` · ${s.time}` : ""}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <a
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-sun-400 px-3 py-1.5 text-xs font-extrabold !text-navy-950 no-underline"
                    >
                      📍 {t.onMap}
                    </a>
                    <button type="button" onClick={() => onDay(s.day)} className="rounded-full bg-mist-100 px-3 py-1.5 text-xs font-bold text-navy-800">
                      {t.goDay}
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}

        {/* The other cities stay tappable; the one in focus gives way to its places. */}
        {cities.length > 1 &&
          cities
            .filter((c) => whole || c.slug !== city)
            .map((c) => (
            <Marker
              key={c.slug}
              position={[c.lat, c.lon]}
              icon={cityIcon(c, c.slug === city)}
              zIndexOffset={1000}
              eventHandlers={{ click: () => onCity(c.slug) }}
            />
          ))}
      </MapContainer>
    </div>
  );
}
