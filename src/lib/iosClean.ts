import { useSyncExternalStore } from "react";

/**
 * «iOS clean mode» — the one place that decides it (owner, 18 Nov 2026:
 * «حل جذري»).
 *
 * Apple rejected the iPhone app on 18 Nov 2026 (guideline 5.1.2(i)): the app
 * shows our website, the website asked for cookie consent for Google
 * Analytics and ran partners' scripts (the flight widget, Stay22), and to
 * Apple that is tracking without App Tracking Transparency. The iPhone app
 * therefore runs NOTHING that is not ours:
 *
 *  - no Google Analytics and no cookie banner (Analytics.tsx);
 *  - no partner script or frame in the page: the flight widget
 *    (FlightMetasearch.tsx), Stay22's link swap and hotel map;
 *  - flights and hotels from partners open OUTSIDE the app, in the Safari
 *    sheet, on the partner's own site (owner's decision, 18 Nov 18:18).
 *
 * The app shell backs this up natively (AppDelegate.swift, «no tracking»
 * content rules: third-party scripts and frames blocked, third-party cookies
 * dropped), and the iOS guard in CI (scripts/ios-clean-check.mjs) fails the
 * release if any of it comes back.
 *
 * Decided in the browser only: the edge HTML cache is keyed by URL, so the
 * server sends the app and the web the same page (see [locale]/layout.tsx).
 * Anything third-party must therefore never be in the server HTML either —
 * it is added after hydration, and only when this says «not the iPhone app».
 */

const IOS_APP_UA = /SfrtnaApp\/iOS/;

/** True inside the iPhone app (user agent «SfrtnaApp/iOS»). Browser only. */
export function isIosApp(): boolean {
  return typeof navigator !== "undefined" && IOS_APP_UA.test(navigator.userAgent);
}

/**
 * ATT decision injected by AppDelegate.swift (ATTBridge) into window.__sfrAtt.
 * "authorized" = user allowed tracking → we may load GA and partner scripts.
 * Everything else (denied / restricted / not_determined / missing) = clean mode.
 * Browser only.
 */
export function attAllowed(): boolean {
  if (typeof window === "undefined") return false;
  return (window as unknown as { __sfrAtt?: string }).__sfrAtt === "authorized";
}

/**
 * True when third-party scripts must be suppressed:
 * - always inside the iPhone app unless ATT was explicitly authorized.
 * Browser only.
 */
export function isIosClean(): boolean {
  return isIosApp() && !attAllowed();
}

const noop = () => () => {};

/**
 * For components: `null` while not known yet (on the server and in the first
 * render, so hydration matches), then true or false. Render third-party
 * things only on `false`.
 */
export function useIosApp(): boolean | null {
  return useSyncExternalStore(noop, isIosApp, () => null);
}

/**
 * Like useIosApp but honours ATT: returns true only when in the app AND
 * tracking is not authorized. Render third-party things only on `false`.
 */
export function useIosClean(): boolean | null {
  return useSyncExternalStore(noop, isIosClean, () => null);
}
