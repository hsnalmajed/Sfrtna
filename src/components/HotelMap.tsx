"use client";

import { MapContainer, Marker, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/**
 * One hotel on a small map (its own lat/lng from the price answer), and the
 * city centre when we know it. Loaded only on the hotel page, in the
 * browser (leaflet needs `window`).
 */
export default function HotelMap({
  lat,
  lng,
  centre,
  attribution,
  small = false,
}: {
  /** The card beside the photos: shorter, no outer frame. */
  small?: boolean;
  lat: number;
  lng: number;
  centre?: { lat: number; lon: number };
  attribution: string;
}) {
  const pin = L.divIcon({
    className: "",
    html: `<span style="display:grid;place-items:center;width:34px;height:34px;border-radius:999px 999px 999px 0;transform:rotate(-45deg);background:#f5b301;border:3px solid #fff;box-shadow:0 4px 12px rgba(10,30,60,.35)"><span style="transform:rotate(45deg);font-size:16px">🏨</span></span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
  });
  const dot = L.divIcon({
    className: "",
    html: `<span style="display:block;width:14px;height:14px;border-radius:999px;background:#0b2545;border:3px solid #fff;box-shadow:0 0 0 3px rgba(11,37,69,.25)"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
  // Both in view when the centre is near (a hotel 40 km out shows alone).
  const near = centre && Math.abs(centre.lat - lat) < 0.2 && Math.abs(centre.lon - lng) < 0.2;
  const view = near
    ? { bounds: L.latLngBounds([lat, lng], [centre.lat, centre.lon]).pad(0.25) }
    : { center: [lat, lng] as [number, number], zoom: 15 };
  return (
    // `isolate`: leaflet's controls (z-index 800) stay under the site header.
    <div className={`isolate overflow-hidden ${small ? "" : "rounded-xl ring-1 ring-mist-200"}`}>
      <MapContainer {...view} scrollWheelZoom={false} className={small ? "h-44 w-full" : "h-64 w-full sm:h-80"}>
        <TileLayer attribution={attribution} url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        <Marker position={[lat, lng]} icon={pin} />
        {near && <Marker position={[centre.lat, centre.lon]} icon={dot} />}
      </MapContainer>
    </div>
  );
}
