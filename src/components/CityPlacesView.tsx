"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Locale } from "@/lib/types";
import type { MapPin } from "@/lib/mapPins";
import type { PlaceListItem } from "@/components/CityPlacesExplorer";
import CityPlacesPlanner from "@/components/CityPlacesPlanner";
import AttractionsMap from "@/components/AttractionsMap";
import MapDownloads from "@/components/MapDownloads";

export type CityView = "list" | "map";

/**
 * A city's places as one page: the list (what each place is, how to get in,
 * the day planner) and the map (where they are), switched in place.
 *
 * They used to be two pages, and going from a place you had just read about
 * to the map meant losing your place in the list and finding the pin again
 * among hundreds. Now "📍 On the map" on any card opens the map on that pin,
 * and coming back puts you at the same card. The list stays mounted while
 * the map is shown, so a half-built day plan survives the trip.
 *
 * The map shows exactly the places the list shows — including the landmarks
 * the guide adds by hand — so the two can never disagree.
 */
export default function CityPlacesView({
  locale,
  initialView,
  places,
  countryCode,
  citySlug,
  cityName,
  countryName,
  mapTitle,
  fileBase,
  plannerDict,
  mapDict,
  downloadsDict,
  labels,
}: {
  locale: Locale;
  initialView: CityView;
  places: PlaceListItem[];
  countryCode: string;
  citySlug: string;
  cityName: string;
  countryName: string;
  mapTitle: string;
  fileBase: string;
  plannerDict: React.ComponentProps<typeof CityPlacesPlanner>["dict"];
  mapDict: React.ComponentProps<typeof AttractionsMap>["dict"];
  downloadsDict: React.ComponentProps<typeof MapDownloads>["dict"];
  labels: { viewList: string; viewMap: string; showOnMap: string };
}) {
  const [view, setView] = useState<CityView>(initialView);
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const top = useRef<HTMLDivElement | null>(null);

  const pins: MapPin[] = useMemo(
    () =>
      places
        .filter((p) => p.lat !== undefined && p.lon !== undefined)
        .map((p) => ({
          key: p.key,
          name: p.name,
          lat: p.lat as number,
          lon: p.lon as number,
          photo: p.photo,
          extract: p.description,
          category: p.category,
          englishOnly: p.englishOnly,
        })),
    [places]
  );

  // The address bar says which view is open, so a shared link opens the
  // same one; other query parameters (the way back to a search) are kept.
  const switchTo = useCallback((next: CityView) => {
    setView(next);
    const url = new URL(window.location.href);
    if (next === "map") url.searchParams.set("view", "map");
    else url.searchParams.delete("view");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const showOnMap = useCallback(
    (place: PlaceListItem) => {
      setFocusKey(place.key);
      switchTo("map");
      top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [switchTo]
  );

  const backToList = useCallback(() => {
    switchTo("list");
    // Back to the card they left from, once the list is visible again.
    const key = focusKey;
    requestAnimationFrame(() => {
      const el = key ? document.getElementById(`place-${key}`) : null;
      (el ?? top.current)?.scrollIntoView({ block: el ? "center" : "start" });
    });
  }, [focusKey, switchTo]);

  const tab = (v: CityView) =>
    `inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400 ${
      view === v ? "bg-navy-900 text-white shadow-sm" : "text-navy-600 hover:bg-mist-100"
    }`;

  return (
    <div ref={top} className="scroll-mt-24">
      <div role="tablist" aria-label={`${labels.viewList} / ${labels.viewMap}`} className="mb-5 inline-flex rounded-full bg-white p-1 shadow-sm ring-1 ring-mist-200">
        <button type="button" role="tab" aria-selected={view === "list"} onClick={backToList} className={tab("list")}>
          <span aria-hidden="true">📋</span>
          {labels.viewList}
          <span className={view === "list" ? "text-white/60" : "text-navy-400"}>{places.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "map"}
          onClick={() => {
            setFocusKey(null);
            switchTo("map");
          }}
          className={tab("map")}
        >
          <span aria-hidden="true">🗺️</span>
          {labels.viewMap}
        </button>
      </div>

      {/* The list stays mounted (only hidden) so the day planner keeps its picks. */}
      <div hidden={view !== "list"}>
        <CityPlacesPlanner
          locale={locale}
          places={places}
          cityName={cityName}
          countryCode={countryCode}
          countryName={countryName}
          dict={plannerDict}
          onShowOnMap={pins.length ? showOnMap : undefined}
          showOnMapLabel={labels.showOnMap}
        />
      </div>

      {/* The map is built when it is shown: Leaflet cannot size itself while hidden. */}
      {view === "map" && (
        <div>
          <AttractionsMap
            key={focusKey ?? "all"}
            locale={locale}
            countryCode={countryCode}
            citySlug={citySlug}
            pins={pins}
            dict={mapDict}
            focusKey={focusKey}
            onShowList={backToList}
          />
          <MapDownloads pins={pins} title={mapTitle} fileBase={fileBase} dict={downloadsDict} />
        </div>
      )}
    </div>
  );
}
