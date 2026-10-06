"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import {
  CONSENT_KEY,
  CONSENT_OPEN_EVENT,
  GA_ID,
  isMeasuredHost,
  lastSearchContext,
  pageType,
  readConsent,
  saveConsent,
  track,
  type ConsentChoice,
} from "@/lib/analytics";
import type { Locale } from "@/lib/types";
import { getDictionary } from "@/lib/dictionaries";

/**
 * GA4 tag, the site-wide click listener and the consent banner.
 *
 * The tag is loaded on sfrtna.com only. Consent defaults to "denied" for
 * analytics storage before the tag reads anything, so until a visitor
 * accepts, GA4 runs cookieless (Consent Mode v2) — no identifier is stored
 * on their device. A stored "granted" from an earlier visit is applied in
 * the same first breath, before the config call, so returning visitors are
 * not counted as new.
 */

/** Booking partners by host, for links that do not carry data-partner. */
const PARTNER_HOSTS: [RegExp, string][] = [
  [/(^|\.)stay22\.com$/, "stay22"],
  [/(^|\.)booking\.com$/, "booking"],
  [/(^|\.)expedia\./, "expedia"],
  [/(^|\.)agoda\.com$/, "agoda"],
  [/(^|\.)hotels\.com$/, "hotels.com"],
  [/(^|\.)trip\.com$/, "trip.com"],
  [/(^|\.)(zenhotels|ratehawk)\.com$/, "zenhotels"],
  [/(^|\.)viator\.com$/, "viator"],
  [/(^|\.)(aviasales\.[a-z]+|tp\.media|tpwgt\.com|travelpayouts\.com|jetradar\.com)$/, "aviasales"],
  [/(^|\.)almosafer\.com$/, "almosafer"],
  [/(^|\.)skyscanner\./, "skyscanner"],
];

const RESULTS_PAGES = new Set(["results", "discover-results", "multicity-results", "hotel-results"]);

function partnerOf(a: HTMLAnchorElement): string | null {
  if (a.dataset.partner) return a.dataset.partner;
  let url: URL;
  try {
    url = new URL(a.href, window.location.href);
  } catch {
    return null;
  }
  if (url.origin === window.location.origin) {
    const go = url.pathname.match(/^\/api\/go\/([a-z0-9-]+)/);
    return go ? go[1] : null;
  }
  for (const [re, name] of PARTNER_HOSTS) if (re.test(url.hostname)) return name;
  return null;
}

function onClick(e: MouseEvent) {
  // composedPath reaches inside the flight widget's open shadow root, where
  // a plain e.target would only show the widget's host element.
  const path = e.composedPath();
  const page = pageType(window.location.pathname);

  for (const node of path) {
    if (!(node instanceof Element)) continue;

    // Declarative events: <button data-track="map_download" data-track-format="gpx">
    const named = node.getAttribute("data-track");
    if (named) {
      const params: Record<string, string> = { page_type: page };
      for (const attr of Array.from(node.attributes)) {
        if (attr.name.startsWith("data-track-")) params[attr.name.slice(11).replace(/-/g, "_")] = attr.value;
      }
      track(named, params);
      return;
    }

    if (node instanceof HTMLAnchorElement && node.href) {
      const partner = partnerOf(node);
      if (!partner) return;
      let host = "";
      try {
        host = new URL(node.href, window.location.href).hostname;
      } catch {
        /* keep empty */
      }
      track("partner_click", {
        partner,
        product: node.dataset.product,
        placement: node.dataset.placement,
        link_domain: host,
        page_type: page,
        in_widget: path.some((n) => n instanceof Element && n.id === "tpwl-tickets") || undefined,
        // Only a click on the results page belongs to the search behind it.
        ...(RESULTS_PAGES.has(page) ? lastSearchContext() : {}),
      });
      return;
    }
  }
}

export default function Analytics({ locale }: { locale: Locale }) {
  const [measured, setMeasured] = useState(false);
  const [askConsent, setAskConsent] = useState(false);
  const t = getDictionary(locale).consent;

  useEffect(() => {
    if (!isMeasuredHost()) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- host is only known in the browser
    setMeasured(true);
    setAskConsent(readConsent() === null);
    document.addEventListener("click", onClick, { capture: true });
    // Middle-click / ctrl-click on a partner link opens it too.
    document.addEventListener("auxclick", onClick, { capture: true });
    const reopen = () => setAskConsent(true);
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("auxclick", onClick, { capture: true });
      window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
    };
  }, []);

  function choose(choice: ConsentChoice) {
    saveConsent(choice);
    setAskConsent(false);
  }

  if (!measured) return null;

  return (
    <>
      <Script id="ga4-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;
var c=null;try{c=localStorage.getItem('${CONSENT_KEY}');}catch(e){}
gtag('consent','default',{analytics_storage:c==='granted'?'granted':'denied',ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied'});
gtag('set','ads_data_redaction',true);
gtag('js',new Date());gtag('config','${GA_ID}');`}
      </Script>
      <Script id="ga4" src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />

      {askConsent && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label={t.title}
          className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-xl rounded-2xl bg-navy-990 p-4 text-sm text-white shadow-2xl ring-1 ring-white/10 sm:p-5"
        >
          <p className="font-bold">{t.title}</p>
          <p className="mt-1.5 leading-relaxed text-white/70">
            {t.body}{" "}
            <a href={`/${locale}/privacy`} className="font-semibold text-sun-300 underline underline-offset-2">
              {t.more}
            </a>
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => choose("granted")}
              className="flex-1 rounded-xl bg-sun-400 px-4 py-2.5 font-bold text-navy-990 transition hover:bg-sun-300"
            >
              {t.accept}
            </button>
            <button
              type="button"
              onClick={() => choose("denied")}
              className="flex-1 rounded-xl bg-white/10 px-4 py-2.5 font-bold text-white ring-1 ring-white/20 transition hover:bg-white/15"
            >
              {t.reject}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Footer link that reopens the banner so a visitor can change their mind. */
export function ConsentSettingsButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}
      className="text-white/60 transition hover:text-sun-300"
    >
      {label}
    </button>
  );
}
