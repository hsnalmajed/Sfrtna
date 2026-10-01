"use client";

import dynamic from "next/dynamic";
import type { Locale } from "@/lib/types";
import type { MapPin } from "@/lib/mapPins";

export type { MapPin } from "@/lib/mapPins";

// Leaflet reaches for `window` the moment it's imported, so the real map is
// pulled in only in the browser. This wrapper is a client component purely
// so `ssr: false` is legal here — the pages that use it stay server
// components and keep doing their data fetching on the server.
const MapCanvas = dynamic(() => import("@/components/MapCanvas"), {
  ssr: false,
  // The skeleton mirrors the real layout — map beside list — so nothing
  // jumps when Leaflet arrives.
  loading: () => (
    <div className="grid gap-3 lg:grid-cols-[1fr_22rem]" aria-hidden="true">
      <div className="h-[65vh] w-full animate-pulse rounded-2xl bg-mist-100 lg:h-[70vh]" />
      <div className="hidden h-[70vh] animate-pulse rounded-2xl bg-mist-100 lg:block" />
    </div>
  ),
});

export default function AttractionsMap(props: {
  locale: Locale;
  countryCode: string;
  /** Links the popup's "see the full guide" button at this city's list. */
  citySlug?: string;
  pins: MapPin[];
  dict: {
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
  };
  /** Open on this place (its key in `pins`). */
  focusKey?: string | null;
  /** Shown instead of the link to the list page when the list is on the same page. */
  onShowList?: () => void;
}) {
  return <MapCanvas {...props} />;
}
