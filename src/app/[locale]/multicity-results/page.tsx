"use client";

import { Suspense, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";

/**
 * Old address of the multi-city results (links shared before 13 Oct).
 *
 * A multi-city trip now opens on the flight results page itself, one tab
 * per flight with its own live search (MultiCityTabs). This forwards any
 * old link there, on its first flight, keeping every answer it carried.
 */
export default function MultiCityResultsPage() {
  return (
    <Suspense fallback={null}>
      <Forward />
    </Suspense>
  );
}

function Forward() {
  const params = useParams();
  const locale = params.locale === "en" ? "en" : "ar";
  const sp = useSearchParams();
  useEffect(() => {
    const p = new URLSearchParams(sp.toString());
    let first: { origin?: string; destination?: string; date?: string } = {};
    try {
      const legs = JSON.parse(p.get("legs") || "[]");
      if (Array.isArray(legs) && legs[0]) first = legs[0];
    } catch {}
    if (first.origin && first.destination && first.date) {
      p.set("origin", first.origin);
      p.set("destination", first.destination);
      p.set("departDate", first.date);
    }
    p.set("tripRoute", "multicity");
    p.set("returnDate", "");
    p.set("leg", "0");
    window.location.replace(`/${locale}/results?${p.toString()}`);
  }, [sp, locale]);
  return <div className="min-h-[60vh] bg-mist-50" />;
}
