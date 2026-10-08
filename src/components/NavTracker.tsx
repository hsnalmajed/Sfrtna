"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { recordVisit } from "@/lib/navHistory";
import { LANG_COOKIE } from "@/lib/langCookie";

/** Keeps the in-site history that back buttons use (see navHistory.ts). Renders nothing. */
export default function NavTracker() {
  const pathname = usePathname();
  const first = useRef(true);

  // The language last read in is the one the site opens in next time —
  // in the app (which always starts at sfrtna.com/) and in a browser
  // alike. The root page reads this cookie before the browser's language.
  useEffect(() => {
    const lang = pathname?.split("/")[1];
    if (lang !== "ar" && lang !== "en") return;
    document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax; secure`;
  }, [pathname]);

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
