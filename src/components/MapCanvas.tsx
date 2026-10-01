"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import type { Locale } from "@/lib/types";
import { PIN_STYLES, type PinCategory } from "@/lib/pinStyles";
import type { MapPin } from "@/lib/mapPins";
import { searchMatches } from "@/lib/search";
import { placeCountLabel } from "@/lib/format";

export type { PinCategory } from "@/lib/pinStyles";
export type { MapPin } from "@/lib/mapPins";

interface MapDict {
  activitiesHeading: string;
  nearbyHeading: string;
  foodHeading: string;
  historicHeading: string;
  directions: string;
  englishOnly: string;
  viewTours: string;
  mapAttribution: string;
  legendHistoric: string;
  legendFood: string;
  legendCityActivity: string;
  legendPlace: string;
  placeSearchPlaceholder: string;
  nearMe: string;
  nearMeDenied: string;
  showAll: string;
  hideAll: string;
  noMatches: string;
  placesCount: string;
  placeOne: string;
  placeTwo: string;
  placeFew: string;
  listHeading: string;
}

// Leaflet's default marker icons are resolved from relative image paths that
// don't survive bundling, so we draw the pin ourselves.
function pinIcon(category: PinCategory, active: boolean) {
  const { color, glyph } = PIN_STYLES[category];
  const size = active ? 34 : 26;
  return L.divIcon({
    className: "",
    // The glyph is counter-rotated so it sits upright inside the teardrop.
    html: `<span style="
      display:flex;align-items:center;justify-content:center;
      width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;
      background:${color};transform:rotate(-45deg);
      border:${active ? 3 : 2.5}px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,.35)${active ? ",0 0 0 4px rgba(255,166,48,.55)" : ""};
    "><span style="transform:rotate(45deg);font-size:${active ? 15 : 12}px;line-height:1">${glyph}</span></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
}

/**
 * Frames the map on the pins it actually has, rather than a hard-coded centre
 * that would sit in the sea for some countries.
 *
 * The breathing room is a fraction of how far the pins actually spread, not a
 * fixed number of degrees: a country map spans hundreds of kilometres and
 * wants a wide margin, while a city map spans a few kilometres and would be
 * squeezed into an unreadable dot by that same margin.
 */
function boundsOf(pins: MapPin[]): [[number, number], [number, number]] | null {
  if (pins.length === 0) return null;
  const lats = pins.map((p) => p.lat);
  const lons = pins.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  // A floor keeps a single pin (or several almost on top of each other) from
  // collapsing to a zero-size box, which Leaflet would zoom to maximum on.
  const padLat = Math.max((maxLat - minLat) * 0.12, 0.01);
  const padLon = Math.max((maxLon - minLon) * 0.12, 0.01);

  return [
    [minLat - padLat, minLon - padLon],
    [maxLat + padLat, maxLon + padLon],
  ];
}

const CATEGORY_ORDER: PinCategory[] = ["historic", "activity", "food", "place"];

/**
 * The markers, in a cluster group.
 *
 * Riyadh returns about 130 places inside a 10 km circle, and at the zoom
 * level where the whole city fits they land on top of each other — a single
 * brown smear you cannot click a single pin out of. Clustering turns that
 * into a handful of counted discs that split apart as you zoom, which is the
 * only way a map of this density is usable at all.
 *
 * This is a plain Leaflet layer rather than a React child because
 * markercluster manages its own DOM: react-leaflet would fight it over who
 * owns each marker element.
 */
function ClusteredMarkers({
  pins,
  activeKey,
  openKey,
  onSelect,
  renderPopup,
}: {
  pins: MapPin[];
  activeKey: string | null;
  /** A pin to bring into view and open — "show this place on the map" from the list. */
  openKey?: string | null;
  onSelect: (key: string) => void;
  renderPopup: (pin: MapPin) => string;
}) {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    const markers = new Map<string, L.Marker>();

    const group = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 55,
      spiderfyOnMaxZoom: true,
      // Past this zoom every pin stands alone — a traveller who has zoomed
      // into one street wants the individual places, not a disc.
      disableClusteringAtZoom: 17,
      iconCreateFunction: (cluster) => {
        const n = cluster.getChildCount();
        const size = n < 10 ? 34 : n < 50 ? 42 : 50;
        return L.divIcon({
          className: "",
          html: `<span style="
            display:flex;align-items:center;justify-content:center;
            width:${size}px;height:${size}px;border-radius:999px;
            background:#0b2d5b;color:#fff;font-weight:800;
            font-size:${n < 100 ? 13 : 12}px;
            border:3px solid #fff;box-shadow:0 2px 10px rgba(4,24,47,.45);
          ">${n}</span>`,
          iconSize: [size, size],
        });
      },
    });

    for (const pin of pins) {
      const marker = L.marker([pin.lat, pin.lon], {
        icon: pinIcon(pin.category, pin.key === activeKey),
        title: pin.name,
      });
      marker.bindPopup(renderPopup(pin), { minWidth: 210 });
      // The popup is built when it opens, not before: a city can carry three
      // hundred pins and almost none of them are ever tapped.
      marker.on("click", () => onSelect(pin.key));
      markers.set(pin.key, marker);
      group.addLayer(marker);
    }

    map.addLayer(group);
    groupRef.current = group;

    // Zooms in until the pin is out of its cluster, then opens it.
    const target = openKey ? markers.get(openKey) : undefined;
    if (target) group.zoomToShowLayer(target, () => target.openPopup());

    return () => {
      map.removeLayer(group);
      group.clearLayers();
      markers.clear();
      groupRef.current = null;
    };
  }, [map, pins, activeKey, openKey, onSelect, renderPopup]);

  return null;
}

/** Flies to whatever the side list selected, and opens its popup. */
function FlyToSelection({ pin }: { pin: MapPin | null }) {
  const map = useMap();
  useEffect(() => {
    if (!pin) return;
    map.flyTo([pin.lat, pin.lon], Math.max(map.getZoom(), 16), { duration: 0.6 });
  }, [map, pin]);
  return null;
}

export default function MapCanvas({
  locale,
  countryCode,
  citySlug,
  pins,
  dict,
  focusKey,
  onShowList,
}: {
  locale: Locale;
  countryCode: string;
  citySlug?: string;
  pins: MapPin[];
  dict: MapDict;
  /** Open on this place: its pin shown, selected and its card open. */
  focusKey?: string | null;
  /**
   * When the map shares a page with the city's list, "back to the list"
   * switches the view instead of linking to another page.
   */
  onShowList?: () => void;
}) {
  const isAr = locale === "ar";

  const categoryLabels: Record<PinCategory, string> = useMemo(
    () => ({
      historic: dict.legendHistoric,
      food: dict.legendFood,
      activity: dict.legendCityActivity,
      place: dict.legendPlace,
    }),
    [dict]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of pins) c[p.category] = (c[p.category] ?? 0) + 1;
    return c;
  }, [pins]);

  /**
   * "Other places" starts switched off.
   *
   * It is the honest catch-all for anything OpenStreetMap's own tags did not
   * put in a category, and on a big city it is most of the map. Leaving it on means the first thing a traveller sees is
   * mostly noise burying the landmarks they came for. It is one tap away,
   * with its count on the button, so nothing is hidden, only deferred.
   */
  const focusPin = focusKey ? pins.find((p) => p.key === focusKey) : undefined;
  const [enabled, setEnabled] = useState<Record<PinCategory, boolean>>({
    historic: true,
    activity: true,
    food: true,
    // A place opened from the list is shown even when it is an "other place".
    place: focusPin?.category === "place",
  });

  const [query, setQuery] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(focusPin ? focusPin.key : null);
  // Opened once, on arrival; any later choice of the traveller's takes over.
  const [openKey, setOpenKey] = useState<string | null>(focusPin ? focusPin.key : null);
  const [flyTo, setFlyTo] = useState<MapPin | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [me, setMe] = useState<{ lat: number; lon: number } | null>(null);

  const visible = useMemo(() => {
    const q = query.trim();
    return pins.filter(
      (p) => enabled[p.category] && (!q || searchMatches([p.name], q))
    );
  }, [pins, enabled, query]);

  // The frame is computed once from every pin, not from what survives the
  // filters — otherwise toggling a category would jump the map somewhere else
  // and lose the traveller's place.
  const bounds = useMemo(() => boundsOf(pins), [pins]);

  const renderPopup = useCallback(
    (pin: MapPin) => {
      const href = citySlug
        ? `/${locale}/attractions/${countryCode}/${citySlug}`
        : `/${locale}/attractions/${countryCode}`;
      const esc = (t: string) =>
        t.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
      return `<div dir="${isAr ? "rtl" : "ltr"}" style="min-width:190px">
        <p style="margin:0 0 4px;font-weight:800;font-size:13px">${esc(pin.name)}</p>
        <p style="margin:0 0 8px;font-size:11px;color:#6a7890">${esc(pin.extract ?? categoryLabels[pin.category])}</p>
        <a href="https://www.google.com/maps/search/?api=1&amp;query=${pin.lat},${pin.lon}" target="_blank" rel="noopener noreferrer" style="display:block;margin-bottom:6px;border-radius:8px;border:1px solid #c9d3e3;color:#0b2d5b;padding:5px 10px;text-align:center;font-size:11px;font-weight:700;text-decoration:none">${esc(dict.directions)} ↗</a>
        ${onShowList ? "" : `<a href="${href}" style="display:block;border-radius:8px;background:#0b2d5b;color:#fff;padding:6px 10px;text-align:center;font-size:11px;font-weight:700;text-decoration:none">${esc(dict.viewTours)}</a>`}
      </div>`;
    },
    [citySlug, locale, countryCode, categoryLabels, dict.viewTours, dict.directions, isAr, onShowList]
  );

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError(true);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoError(false);
        setMe({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setFlyTo({
          key: "__me",
          name: "",
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          category: "place",
        } as MapPin);
      },
      () => setGeoError(true),
      { timeout: 8000 }
    );
  }, []);

  const select = useCallback((key: string) => {
    setOpenKey(null);
    setActiveKey(key);
  }, []);

  if (!bounds) {
    return <div className="h-[70vh] w-full rounded-2xl bg-mist-100" aria-hidden="true" />;
  }

  const chip = (on: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
      on ? "bg-navy-900 text-white" : "bg-white text-navy-500 ring-1 ring-mist-300 hover:ring-navy-300"
    }`;

  return (
    <div className="space-y-3">
      {/* ── Controls ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        {CATEGORY_ORDER.filter((c) => counts[c]).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={enabled[c]}
            onClick={() => setEnabled((prev) => ({ ...prev, [c]: !prev[c] }))}
            className={chip(enabled[c])}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: PIN_STYLES[c].color }}
              aria-hidden="true"
            />
            {categoryLabels[c]}
            <span className={enabled[c] ? "text-white/60" : "text-navy-400"}>{counts[c]}</span>
          </button>
        ))}

        <div className="ms-auto flex items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={dict.placeSearchPlaceholder}
            aria-label={dict.placeSearchPlaceholder}
            className="w-40 rounded-full border border-mist-300 bg-white px-3.5 py-1.5 text-xs text-navy-900 outline-none transition focus:border-sun-400 focus:ring-2 focus:ring-sun-400/25 sm:w-52"
          />
          <button
            type="button"
            onClick={locate}
            className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-navy-600 ring-1 ring-mist-300 transition hover:ring-navy-300"
          >
            <span aria-hidden="true">📍</span>
            {dict.nearMe}
          </button>
        </div>
      </div>

      {geoError && (
        <p role="alert" className="text-xs font-semibold text-amber-700">
          {dict.nearMeDenied}
        </p>
      )}

      {/* ── Map beside its list ───────────────────────────────────────────
          On a wide screen the list is 40% and the map 60%: a pin you cannot
          name is not information, and scanning a list is far faster than
          clicking pins one at a time to find out what they are. Selecting
          either side drives the other.

          `isolate` on the wrapper is load-bearing. Leaflet's own stylesheet
          puts popups at z-index 700 and controls at 800, while the site
          header is at 50 — so without a stacking context of its own, an open
          popup and the zoom buttons paint straight over the navy header bar.
          One class confines all of it. */}
      <div className="isolate grid gap-3 lg:grid-cols-[1fr_22rem]">
        <div className="relative z-0 overflow-hidden rounded-2xl shadow-sm ring-1 ring-navy-950/5">
          <MapContainer bounds={bounds} scrollWheelZoom className="h-[65vh] w-full lg:h-[70vh]">
            <TileLayer
              attribution={dict.mapAttribution}
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
            <ClusteredMarkers
              pins={visible}
              activeKey={activeKey}
              openKey={openKey}
              onSelect={select}
              renderPopup={renderPopup}
            />
            <FlyToSelection pin={flyTo} />
            {me && (
              <Marker
                position={[me.lat, me.lon]}
                icon={L.divIcon({
                  className: "",
                  html: `<span style="display:block;width:16px;height:16px;border-radius:999px;background:#1976d2;border:3px solid #fff;box-shadow:0 0 0 4px rgba(25,118,210,.25)"></span>`,
                  iconSize: [16, 16],
                  iconAnchor: [8, 8],
                })}
              />
            )}
          </MapContainer>
        </div>

        {/* The list. On a phone it sits under the map rather than over it —
            a sheet that covers the map is a sheet you have to dismiss before
            you can look at what you just selected. */}
        <div className="flex max-h-[28rem] flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-navy-950/5 lg:max-h-[70vh]">
          <div className="flex items-baseline justify-between gap-2 border-b border-mist-200 px-4 py-3">
            <p className="text-sm font-bold text-navy-900">{dict.listHeading}</p>
            <p className="text-2xs font-semibold text-navy-400">
              {placeCountLabel(visible.length, dict)}
            </p>
          </div>

          {visible.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-navy-500">{dict.noMatches}</p>
          ) : (
            <ul className="rail flex-1 overflow-y-auto">
              {visible.map((p) => (
                <li key={p.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpenKey(null);
                      setActiveKey(p.key);
                      setFlyTo(p);
                    }}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-start text-sm transition ${
                      p.key === activeKey ? "bg-sun-50 font-bold text-navy-900" : "text-navy-700 hover:bg-mist-50"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: PIN_STYLES[p.category].color }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate" dir={p.englishOnly ? "ltr" : undefined}>
                      {p.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {onShowList ? (
            <button
              type="button"
              onClick={onShowList}
              className="border-t border-mist-200 px-4 py-3 text-center text-sm font-bold text-navy-800 transition hover:bg-mist-50"
            >
              {dict.viewTours}
            </button>
          ) : (
            <Link
              href={
                citySlug
                  ? `/${locale}/attractions/${countryCode}/${citySlug}`
                  : `/${locale}/attractions/${countryCode}`
              }
              className="border-t border-mist-200 px-4 py-3 text-center text-sm font-bold text-navy-800 transition hover:bg-mist-50"
            >
              {dict.viewTours}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
