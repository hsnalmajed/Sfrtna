"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Locale } from "@/lib/types";
import type { MapPin } from "@/lib/mapPins";
import type { PlaceListItem } from "@/components/CityPlacesExplorer";
import CityPlacesPlanner, { type PlanRestaurant } from "@/components/CityPlacesPlanner";
import AttractionsMap from "@/components/AttractionsMap";
import MapDownloads from "@/components/MapDownloads";

export type CityView = "list" | "map" | "activities" | "services";

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
  activities,
  services,
  restaurants,
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
  labels: {
    viewList: string;
    viewMap: string;
    showOnMap: string;
    downloadAll: string;
    plan: string;
    activities: string;
    services: string;
  };
  /** «الأنشطة» tab: tours and every activity partner for the city. */
  activities?: React.ReactNode;
  /** «خدمات رحلتك» tab: eSIM, transfers, car, luggage — every partner. */
  services?: React.ReactNode;
  /** The city's stored restaurants, for the plan's meals. */
  restaurants?: PlanRestaurant[];
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
    [places],
  );

  // The address bar says which view is open, so a shared link opens the
  // same one; other query parameters (the way back to a search) are kept.
  const switchTo = useCallback((next: CityView) => {
    setView(next);
    const url = new URL(window.location.href);
    if (next !== "list") url.searchParams.set("view", next);
    else url.searchParams.delete("view");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const showOnMap = useCallback(
    (place: PlaceListItem) => {
      setFocusKey(place.key);
      switchTo("map");
      // After the list is hidden and the map is in: the page is much shorter
      // by then, and scrolling before that lands below the view switcher.
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          top.current?.scrollIntoView({ block: "start" }),
        ),
      );
    },
    [switchTo],
  );

  const backToList = useCallback(() => {
    switchTo("list");
    // Back to the card they left from, once the list is visible again.
    const key = focusKey;
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = key ? document.getElementById(`place-${key}`) : null;
        (el ?? top.current)?.scrollIntoView({ block: el ? "center" : "start" });
      }),
    );
  }, [focusKey, switchTo]);

  const tab = (v: CityView | "plan") =>
    `inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400 ${
      view === v
        ? "bg-navy-900 text-white shadow-sm"
        : "text-navy-600 hover:bg-mist-100"
    }`;

  // «خطة سياحية»: the planner sits at the top of the list.
  const openPlan = useCallback(() => {
    switchTo("list");
    requestAnimationFrame(() =>
      requestAnimationFrame(() => document.getElementById("trip-plan")?.scrollIntoView({ behavior: "smooth", block: "start" })),
    );
  }, [switchTo]);

  return (
    <div ref={top} className="scroll-mt-28">
      {/* One row for everything about the city (owner, 13 Oct): places,
          map, plan, activities, services, and the download of every
          location. On a phone it scrolls sideways instead of wrapping. */}
      <div className="sticky top-16 z-20 -mx-4 mb-5 bg-mist-50/95 px-4 py-2 backdrop-blur sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:py-0">
        <div className="rail flex items-center gap-2 overflow-x-auto">
          <div role="tablist" aria-label={cityName} className="inline-flex shrink-0 rounded-full bg-white p-1 shadow-sm ring-1 ring-mist-200">
            <button type="button" role="tab" aria-selected={view === "list"} onClick={backToList} className={tab("list")}>
              <span aria-hidden="true">📍</span>
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
            <button type="button" onClick={openPlan} className={tab("plan")}>
              <span aria-hidden="true">🗓️</span>
              {labels.plan}
            </button>
            {activities && (
              <button type="button" role="tab" aria-selected={view === "activities"} onClick={() => switchTo("activities")} className={tab("activities")}>
                <span aria-hidden="true">🎟️</span>
                {labels.activities}
              </button>
            )}
            {services && (
              <button type="button" role="tab" aria-selected={view === "services"} onClick={() => switchTo("services")} className={tab("services")}>
                <span aria-hidden="true">🧳</span>
                {labels.services}
              </button>
            )}
          </div>
          {pins.length > 0 && (
            <div className="shrink-0">
              <MapDownloads pins={pins} title={mapTitle} fileBase={fileBase} dict={downloadsDict} compactLabel={labels.downloadAll} />
            </div>
          )}
        </div>
      </div>

      {view === "activities" && activities}
      {view === "services" && services}

      {/* The list stays mounted (only hidden) so the day planner keeps its picks. */}
      <div hidden={view !== "list"}>
        <CityPlacesPlanner
          locale={locale}
          places={places}
          cityName={cityName}
          countryCode={countryCode}
          citySlug={citySlug}
          countryName={countryName}
          dict={plannerDict}
          onShowOnMap={pins.length ? showOnMap : undefined}
          restaurants={restaurants}
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
        </div>
      )}
    </div>
  );
}
