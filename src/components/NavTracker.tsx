"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { recordVisit } from "@/lib/navHistory";

/** Keeps the in-site history that back buttons use (see navHistory.ts). Renders nothing. */
export default function NavTracker() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    const path = window.location.pathname + window.location.search;
    if (first.current) {
      first.current = false;
      // A full page load: arriving from another site (or none) starts afresh;
      // a reload or a plain link inside the site carries on.
      let fromSite = false;
      try {
        fromSite = Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin;
      } catch {
        fromSite = false;
      }
      recordVisit(path, !fromSite);
      return;
    }
    recordVisit(path, false);
  }, [pathname]);

  return null;
}
