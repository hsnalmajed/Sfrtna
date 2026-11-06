"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapHotel {
  key: string;
  lat: number;
  lng: number;
  /** The price shown on the pin ("540 SAR"). */
  price: string;
  name: string;
  /** Stars and rating line in the popup. */
  sub: string;
  href: string;
  thumb?: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** The list's hotels on a map, each pin its price (Booking's map view). */
export default function HotelsMap({
  hotels,
  centre,
  attribution,
  compact = false,
  choose,
  onChoose,
}: {
  hotels: MapHotel[];
  centre?: { lat: number; lon: number };
  attribution: string;
  /** The small card beside the filters: a picture of the map, not a map to use. */
  compact?: boolean;
  /** «اختر» in a pin's popup. */
  choose: string;
  onChoose?: (key: string) => void;
}) {
  const bounds = useMemo(() => {
    const pts = hotels.map((h) => [h.lat, h.lng] as [number, number]);
    if (centre) pts.push([centre.lat, centre.lon]);
    return pts.length ? L.latLngBounds(pts).pad(0.08) : undefined;
  }, [hotels, centre]);
  return (
    <div className="isolate h-full w-full">
      <MapContainer
        bounds={bounds}
        center={bounds ? undefined : [24.7, 46.7]}
        zoom={bounds ? undefined : 11}
        scrollWheelZoom={!compact}
        dragging={!compact}
        zoomControl={!compact}
        doubleClickZoom={!compact}
        touchZoom={!compact}
        keyboard={!compact}
        attributionControl={!compact}
        className="h-full w-full"
      >
        <TileLayer attribution={attribution} url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        <Refit bounds={bounds} />
        {hotels.map((h) => (
          <Marker
            key={h.key}
            position={[h.lat, h.lng]}
            interactive={!compact}
            icon={L.divIcon({
              className: "",
              html: compact
                ? `<span style="display:block;width:10px;height:10px;border-radius:999px;background:#0b2545;border:2px solid #fff"></span>`
                : `<span style="display:inline-block;transform:translate(-50%,-100%);white-space:nowrap;padding:3px 8px;border-radius:999px;background:#0b2545;color:#fff;font:800 12px/1.4 system-ui,sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.35);border:2px solid #fff">${esc(h.price)}</span>`,
              iconSize: compact ? [10, 10] : [0, 0],
              iconAnchor: compact ? [5, 5] : [0, 0],
            })}
          >
            {!compact && (
              <Popup>
                <div style={{ width: 200 }} dir="auto">
                  {h.thumb && (
                    // eslint-disable-next-line @next/next/no-img-element -- remote hotel photo
                    <img src={h.thumb} alt="" style={{ width: "100%", height: 96, objectFit: "cover", borderRadius: 8 }} />
                  )}
                  <p style={{ margin: "6px 0 0", fontWeight: 800, color: "#0b2545" }}>{h.name}</p>
                  {h.sub && <p style={{ margin: "2px 0 0", fontSize: 12, color: "#475569" }}>{h.sub}</p>}
                  <p style={{ margin: "4px 0 6px", fontWeight: 800 }}>{h.price}</p>
                  <a
                    href={h.href}
                    onClick={() => onChoose?.(h.key)}
                    style={{ display: "block", textAlign: "center", background: "#f5b301", color: "#0b2545", fontWeight: 800, borderRadius: 10, padding: "8px 0", textDecoration: "none" }}
                  >
                    {choose}
                  </a>
                </div>
              </Popup>
            )}
          </Marker>
        ))}
        {centre && (
          <Marker
            position={[centre.lat, centre.lon]}
            interactive={false}
            icon={L.divIcon({ className: "", html: `<span style="display:block;width:14px;height:14px;border-radius:999px;background:#f5b301;border:3px solid #fff;box-shadow:0 0 0 3px rgba(245,179,1,.35)"></span>`, iconSize: [14, 14], iconAnchor: [7, 7] })}
          />
        )}
      </MapContainer>
    </div>
  );
}

/** The map opens in a box that only gets its size after it shows: fit again then. */
function Refit({ bounds }: { bounds?: L.LatLngBounds }) {
  const map = useMap();
  useEffect(() => {
    const id = window.setTimeout(() => {
      map.invalidateSize();
      if (bounds) map.fitBounds(bounds);
    }, 60);
    return () => window.clearTimeout(id);
  }, [map, bounds]);
  return null;
}
