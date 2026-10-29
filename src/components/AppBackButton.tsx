"use client";

import { useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDictionary } from "@/lib/dict/context";
import { hasPreviousPage } from "@/lib/navHistory";
import type { Locale } from "@/lib/types";

/**
 * A back arrow in the app's top bar, on the iPhone only.
 *
 * An iPhone has no back button: once a page was opened (a «المزيد» page, a
 * city, a result) the only way back was the edge swipe, which most people
 * never find, so they started over (owner, 29 Oct). Android keeps its own
 * back button and gets nothing extra here.
 *
 * Back is the browser's own history when this visit came from another page
 * of ours (navHistory, kept by NavTracker); otherwise (the app opened
 * straight on a deep page) it goes home. A page opened from «المزيد» comes
 * back to the «المزيد» list — AppTabBar reopens it.
 */
const noop = () => () => {};

export default function AppBackButton({ locale }: { locale: Locale }) {
  const dict = useDictionary();
  const pathname = usePathname() ?? `/${locale}`;
  const router = useRouter();
  const ios = useSyncExternalStore(noop, () => /SfrtnaApp\/iOS/.test(navigator.userAgent), () => false);

  const home = `/${locale}`;
  if (!ios || pathname === home) return null;

  const back = () => {
    if (hasPreviousPage(window.location.pathname + window.location.search)) window.history.back();
    else router.replace(home);
  };

  return (
    <button
      type="button"
      onClick={back}
      aria-label={dict.back}
      className="app-back absolute inset-y-0 start-2 z-10 my-auto flex h-10 w-10 items-center justify-center rounded-full text-white active:bg-white/10"
    >
      {/* Points to where "back" is: right in Arabic, left in English. */}
      <svg viewBox="0 0 24 24" className="h-6 w-6 ltr:rotate-180" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
