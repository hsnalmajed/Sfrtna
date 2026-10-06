"use client";

import type { MapPin } from "@/lib/mapPins";
import { downloadText, safeFileName, toGPX, toKML, type ExportPlace } from "@/lib/mapExport";
import { track } from "@/lib/analytics";

interface DownloadsDict {
  downloadHeading: string;
  downloadHint: string;
  downloadGpx: string;
  downloadGpxHint: string;
  downloadKml: string;
  downloadKmlHint: string;
  legendHistoric: string;
  legendFood: string;
  legendCityActivity: string;
  legendPlace: string;
}

export default function MapDownloads({
  pins,
  title,
  fileBase,
  dict,
  compactLabel,
}: {
  pins: MapPin[];
  /** Shown inside the file — this is the name the maps app displays. */
  title: string;
  /**
   * Used for the filename only. Kept ASCII on purpose: some Android file
   * managers and map apps mangle right-to-left filenames, while the title
   * inside the file carries the Arabic name just fine.
   */
  fileBase: string;
  dict: DownloadsDict;
  /** One line of two buttons ("Download all locations: GPX · KML") instead of the panel. */
  compactLabel?: string;
}) {
  // The names were already resolved to the reader's language upstream, so the
  // pins read the same on their phone as they do here.
  const CATEGORY_LABELS = {
    historic: dict.legendHistoric,
    food: dict.legendFood,
    activity: dict.legendCityActivity,
    place: dict.legendPlace,
  };

  const places: ExportPlace[] = pins.map((p) => ({
    name: p.name,
    lat: p.lat,
    lon: p.lon,
    description: p.extract,
    category: CATEGORY_LABELS[p.category],
  }));

  function handleGpx() {
    track("map_download", { format: "gpx", places: places.length });
    downloadText(toGPX(places, title), safeFileName(fileBase, "gpx"), "application/gpx+xml");
  }

  function handleKml() {
    track("map_download", { format: "kml", places: places.length });
    downloadText(toKML(places, title), safeFileName(fileBase, "kml"), "application/vnd.google-earth.kml+xml");
  }

  if (compactLabel) {
    const pill =
      "inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-navy-800 ring-1 ring-mist-300 transition hover:ring-sun-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400";
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-navy-600">📥 {compactLabel}</span>
        <button type="button" onClick={handleGpx} className={pill} title={dict.downloadGpxHint}>
          🧭 GPX
        </button>
        <button type="button" onClick={handleKml} className={pill} title={dict.downloadKmlHint}>
          🌍 KML
        </button>
      </div>
    );
  }

  const buttonClass =
    "flex-1 min-w-[10rem] rounded-xl border border-gray-200 bg-white px-4 py-3 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400";

  return (
    <div className="mt-5 rounded-2xl bg-brand-50 p-4 sm:p-5 ring-1 ring-brand-100">
      <p className="font-bold text-brand-900">📥 {dict.downloadHeading}</p>
      <p className="mt-1 mb-3.5 text-sm text-brand-800 leading-relaxed">{dict.downloadHint}</p>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={handleGpx} className={buttonClass}>
          <span className="block text-sm font-bold text-gray-900">🧭 {dict.downloadGpx}</span>
          <span className="mt-0.5 block text-xs text-gray-500 leading-snug">{dict.downloadGpxHint}</span>
        </button>

        <button type="button" onClick={handleKml} className={buttonClass}>
          <span className="block text-sm font-bold text-gray-900">🌍 {dict.downloadKml}</span>
          <span className="mt-0.5 block text-xs text-gray-500 leading-snug">{dict.downloadKmlHint}</span>
        </button>
      </div>
    </div>
  );
}
