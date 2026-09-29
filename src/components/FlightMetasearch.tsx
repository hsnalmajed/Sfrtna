"use client";

import { useEffect } from "react";
import { preconnect, preloadModule } from "react-dom";
import type { Locale } from "@/lib/types";

/**
 * Real flight results, inside our own page.
 *
 * Travelpayouts' live Search API is gated behind 50,000 monthly users, which
 * a new site does not have and cannot get without something worth visiting.
 * Their White Label widget is the way out of that circle: the same live
 * search Aviasales runs — every airline and agency it covers, for the exact
 * dates asked — rendered into these two containers on our own domain, in our
 * own colours, with the booking click credited to us.
 *
 * So the site keeps the part that is ours (a budget, a destination, a plan)
 * and stops pretending to be a search engine it cannot yet be. When the
 * traffic clears their threshold we swap this for the API and draw the
 * results ourselves; nothing the traveller sees has to change.
 *
 * The script is loaded once, on the pages that actually show flights — it is
 * a third-party module and has no business on a page about visas.
 *
 * This block belongs on the results page and nowhere else. It was briefly on
 * the homepage too, back when a search in the widget navigated to the site
 * root and the tickets needed a container waiting there. The `flightSearch`
 * parameter made that unnecessary — the search now runs and renders in place
 * — and a front page whose job is to make someone want to travel does not
 * open with a second search form under the one it already has.
 *
 * `tone` survives from that experiment: "dark" boxes the widget in white on
 * a navy background. Nothing uses it today; it costs nothing and saves
 * rebuilding it if a dark section ever wants the widget.
 */

export const WIDGET_SRC = "https://tpwgt.com/wl_web/main.js?wl_id=22604";

/**
 * Warm the flight search before it is needed: connections to the widget's
 * hosts and its script, fetched while the traveller is still on the form,
 * so the results page starts searching the moment it opens.
 */
export function warmFlightSearch() {
  preconnect("https://tpwgt.com");
  preconnect("https://tickets-api.eu-north-1.apistp.com");
  // A module script: only a module preload is reused when it is added.
  preloadModule(WIDGET_SRC);
}

export default function FlightMetasearch({
  locale,
  heading,
  note,
  tone = "light",
  prefill,
  hideSearchForm = false,
}: {
  locale: Locale;
  heading?: string;
  note?: string;
  /**
   * Keep the widget's own search bar out of sight. On the results page it
   * repeated the trip we already show, with a second language switch and
   * links out to the partner's hotels and multi-city search; the page's
   * "Edit search" does that job. It still runs — only hidden.
   */
  hideSearchForm?: boolean;
  /** "dark" puts the block on a navy background and boxes it in white. */
  tone?: "light" | "dark";
  /** The trip, as flightSearchCode writes it — e.g. "RUH1611IST23112". */
  prefill?: string | null;
}) {
  warmFlightSearch();
  useEffect(() => {
    // The widget takes its starting trip from this one parameter, and reads
    // it when its script runs — so it goes on the address before the script
    // is added, never after. With it there the traveller's own dates are
    // already searched when the page opens; without it they would be asked
    // for the trip a second time, which is the thing this site exists not to
    // do.
    //
    // And it has to be the only thing in the query string. Given anything
    // else there, the widget reloads the page to an address of its own,
    // dropping the rest and moving both dates a day earlier. So the rest of
    // the query moves into the fragment, where the widget leaves it alone
    // and the results page reads it back (see results/page.tsx).
    if (prefill) {
      const url = new URL(window.location.href);
      const rest = new URLSearchParams(url.search);
      rest.delete("flightSearch");
      const trip = rest.toString() || url.hash.slice(1);
      const next = `${url.pathname}?flightSearch=${encodeURIComponent(prefill)}${trip ? `#${trip}` : ""}`;
      if (next !== `${url.pathname}${url.search}${url.hash}`) {
        window.history.replaceState(null, "", next);
      }
    }
    if (document.getElementById("tpwl-main")) return;
    const script = document.createElement("script");
    script.id = "tpwl-main";
    script.async = true;
    script.type = "module";
    script.src = WIDGET_SRC;
    document.head.appendChild(script);
  }, [prefill]);

  const dark = tone === "dark";
  return (
    <section className={dark || !heading ? "" : "mt-8"} dir={locale === "ar" ? "rtl" : "ltr"}>
      {heading && (
        <h2 className={`mb-1 font-display text-h3 font-extrabold ${dark ? "text-white" : "text-navy-900"}`}>
          {heading}
        </h2>
      )}
      {note && <p className={`mb-4 text-sm ${dark ? "text-white/70" : "text-navy-500"}`}>{note}</p>}
      {/* The widget fills these two. Keep the ids exactly as they are: the
          script looks them up by name and silently does nothing otherwise. */}
      <div className={dark ? "rounded-3xl bg-white p-3 shadow-sun sm:p-4" : ""}>
        <div id="tpwl-search" className={hideSearchForm ? "hidden" : undefined} />
        <div id="tpwl-tickets" className={hideSearchForm ? "" : "mt-4 empty:mt-0"} />
      </div>
    </section>
  );
}
