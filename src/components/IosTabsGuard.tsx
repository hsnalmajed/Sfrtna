"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@/lib/types";

/**
 * The iPhone app with its own native tabs (html.in-ios-tabs, UA
 * «SfrtnaTabs/», 16 Nov 2026) keeps the website as ONE tab: city guides,
 * the trip planner and the info pages. Flight / hotel / discover search and
 * results pages are not part of the app (App Review 4.3 / 4.2.6, PROJECT_NOTES
 * «Apple rejection — root-cause study»): a link to one opens our site in a
 * Safari sheet (?sfr_out=1, handled by the app), and the home page becomes
 * the planner. Renders nothing; does nothing in browsers or other apps.
 */
const OUTSIDE = new Set(["results", "hotel-results", "multicity-results", "discover-results", "budget", "services"]);

/** "/ar/results/…" → "results"; "/ar" → "". */
function section(path: string): string {
  return path.split("/")[2] ?? "";
}

function inTabs(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("in-ios-tabs");
}

function openOutside(href: string) {
  const u = new URL(href, window.location.origin);
  u.searchParams.set("sfr_out", "1");
  window.location.href = u.toString();
}

export default function IosTabsGuard({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();

  // Links to booking pages: straight to the Safari sheet.
  useEffect(() => {
    if (!inTabs()) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const u = new URL(a.href, window.location.origin);
      if (u.origin !== window.location.origin || !OUTSIDE.has(section(u.pathname))) return;
      e.preventDefault();
      e.stopPropagation();
      openOutside(u.toString());
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // Reached anyway (a search form, the address bar of history): same.
  useEffect(() => {
    if (!inTabs()) return;
    const part = section(pathname);
    if (part === "") {
      router.replace(`/${locale}/itinerary`);
      return;
    }
    if (!OUTSIDE.has(part)) return;
    openOutside(window.location.href);
    if (window.history.length > 1) router.back();
    else router.replace(`/${locale}/itinerary`);
  }, [pathname, locale, router]);

  return null;
}
