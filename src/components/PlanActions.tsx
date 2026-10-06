"use client";

import { useEffect, useState } from "react";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import { downloadText, safeFileName, toKML } from "@/lib/mapExport";
import { printPage } from "@/lib/nativeApp";
import {
  fetchCountryPlaces,
  matchPlacesInLines,
  toExportPlaces,
  GOOGLE_MY_MAPS_URL,
  type CountryPlace,
} from "@/lib/tripPlaces";

/**
 * What a traveller does with a finished plan: keep it, and carry it.
 *
 * Keeping it is the browser's own print-to-PDF. That is a deliberate choice
 * over a JavaScript PDF library: those render Arabic as disconnected letters
 * in the wrong order unless you ship a shaping engine with them, and a plan
 * nobody can read is worse than no button. The print stylesheet strips the
 * site down to the plan itself, so the page that comes out is a document.
 *
 * Carrying it is a KML file. No website can add places to someone's Google
 * account — Google publishes no API for it — so the honest version is the one
 * Google itself supports: download the file, import it into My Maps. The
 * button says exactly that instead of implying a one-tap sync that doesn't
 * exist.
 */
export default function PlanActions({
  locale,
  countryCode,
  countryName,
  planLines,
  fileBase,
  title,
  showPrint = true,
}: {
  locale: Locale;
  /** The destination country, for looking up its mapped places. */
  countryCode?: string;
  countryName?: string;
  /** Every line of the plan — what we search for place names in. */
  planLines: string[];
  /** ASCII base for the downloaded filename; RTL filenames confuse phones. */
  fileBase: string;
  /** Shown inside the file — the name the map app displays. */
  title: string;
  /** False where there is no document on the page worth printing. */
  showPrint?: boolean;
}) {
  const dict = getDictionary(locale);
  const [places, setPlaces] = useState<CountryPlace[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!countryCode) return;
    let cancelled = false;
    fetchCountryPlaces(countryCode, locale).then((list) => {
      if (!cancelled) setPlaces(list);
    });
    return () => {
      cancelled = true;
    };
  }, [countryCode, locale]);

  // Derived rather than a second piece of state: "still null" is exactly what
  // "still loading" means here, and an effect that also flips a busy flag is
  // a cascading render for no extra information.
  const busy = Boolean(countryCode) && places === null;

  const matched = places ? matchPlacesInLines(planLines, places) : [];

  function exportKml(list: CountryPlace[], nameSuffix: string, mapTitle: string) {
    if (!list.length) return;
    downloadText(
      toKML(toExportPlaces(list), mapTitle),
      safeFileName(`${fileBase}-${nameSuffix}`, "kml"),
      "application/vnd.google-earth.kml+xml"
    );
    setNotice(dict.plan.exportDone.replace("{count}", String(list.length)));
  }

  return (
    <section className="print:hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/5 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{dict.plan.actionsHeading}</p>

      <div className="mt-3 flex flex-wrap gap-2">
        {showPrint && (
        <button
          type="button"
          onClick={() => printPage(title)}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-800"
        >
          <span aria-hidden="true">🖨️</span>
          {dict.plan.savePdf}
        </button>
        )}

        {planLines.length > 0 && (
        <button
          type="button"
          disabled={busy || matched.length === 0}
          onClick={() => exportKml(matched, "plan", title)}
          className="inline-flex items-center gap-2 rounded-xl border border-brand-200 px-4 py-2.5 text-sm font-bold text-brand-800 transition hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span aria-hidden="true">📍</span>
          {dict.plan.exportPlan}
          {matched.length > 0 && <span className="text-xs font-semibold text-brand-500">({matched.length})</span>}
        </button>
        )}

        {countryCode && (
          <button
            type="button"
            disabled={busy || !places?.length}
            onClick={() =>
              exportKml(
                places ?? [],
                "all",
                dict.plan.allPlacesTitle.replace("{country}", countryName ?? countryCode)
              )
            }
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:border-brand-200 hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden="true">🗺️</span>
            {dict.plan.exportAll.replace("{country}", countryName ?? countryCode)}
            {places?.length ? <span className="text-xs font-semibold text-gray-400">({places.length})</span> : null}
          </button>
        )}
      </div>

      {busy && <p className="mt-3 text-xs text-gray-400">{dict.plan.loadingPlaces}</p>}

      {!busy && places && matched.length === 0 && planLines.length > 0 && (
        <p className="mt-3 text-xs text-amber-700">{dict.plan.noPlanMatches}</p>
      )}

      {notice && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800">
          {notice}
        </p>
      )}

      <p className="mt-3 text-xs leading-relaxed text-gray-500">
        {dict.plan.mapsHowTo}{" "}
        <a
          href={GOOGLE_MY_MAPS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-brand-800 underline underline-offset-2"
        >
          {dict.plan.openMyMaps}
        </a>
      </p>
    </section>
  );
}
