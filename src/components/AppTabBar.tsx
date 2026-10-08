"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getDictionary } from "@/lib/dictionaries";
import { openPlanner, HOME_TAB_EVENT, HOME_SEASON_EVENT } from "@/lib/planEvents";
import { track } from "@/lib/analytics";
import type { Locale } from "@/lib/types";
import { CONTACT_EMAIL } from "@/lib/contact";

/**
 * The phone app's own navigation: a tab bar at the bottom of the screen.
 *
 * Inside the app (mobile/ — the site in a Capacitor shell) a website's header
 * menu and footer make the screen read as "a web page stored on the phone".
 * Apps are driven by the thumb from the bottom edge, so there the site wears
 * this bar instead, and the header and footer step back (globals.css,
 * `.in-app`).
 *
 * It is rendered for every visitor and shown only under `html.in-app`, which
 * an inline script in the layout sets from the user agent before the first
 * paint. Deciding on the server would need the user agent in the edge HTML
 * cache key (edge-worker.js keys by URL); deciding after hydration would make
 * the page jump. CSS decides, so neither happens.
 *
 * "More" holds what the footer held: the remaining tools, the language, the
 * pages that say who runs the site and the partner note.
 */
export default function AppTabBar({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const pathname = usePathname() ?? `/${locale}`;
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);
  // Which part of the homepage is showing (HomeShowcase announces it): the
  // in-season cities belong to "Home", the search to "Book".
  const [homeTab, setHomeTab] = useState<string | null>(null);

  // The class is set before the first paint by the layout's inline script.
  // If React ever re-renders <html> from scratch (it does after a hydration
  // mismatch it cannot patch), the class would be lost with it and the app
  // would fall back to the website look mid-session. Re-apply it on every
  // render of the bar, and whenever something rewrites the attribute.
  useLayoutEffect(() => {
    if (navigator.userAgent.indexOf("SfrtnaApp/") === -1) return;
    const root = document.documentElement;
    const ensure = () => {
      if (!root.classList.contains("in-app")) root.classList.add("in-app");
    };
    ensure();
    const watch = new MutationObserver(ensure);
    watch.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => watch.disconnect();
  }, []);

  useEffect(() => {
    const onTab = (e: Event) => setHomeTab((e as CustomEvent<string | null>).detail);
    window.addEventListener(HOME_TAB_EVENT, onTab);
    return () => window.removeEventListener(HOME_TAB_EVENT, onTab);
  }, []);

  // The sheet is a layer over the page; the phone's back button closes it
  // through history, like any other app sheet. Opening it adds one history
  // entry (Next keeps its own state on entries pushed this way); back pops
  // it and closes the sheet, and a link chosen in the sheet *replaces* it, so
  // back from that page returns to the page underneath, not to the sheet.
  useEffect(() => {
    if (!moreOpen) return;
    history.pushState({ sfrtnaSheet: true }, "");
    const onPop = () => setMoreOpen(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [moreOpen]);

  const closeMore = () => {
    if (history.state?.sfrtnaSheet) history.back();
    else setMoreOpen(false);
  };

  const home = `/${locale}`;
  const isActive = (href: string) =>
    href === home ? pathname === home : pathname === href || pathname.startsWith(`${href}/`);

  const tools = [
    { href: `/${locale}/itinerary`, label: dict.nav.itinerary, icon: "🗺️" },
    { href: `/${locale}/visa`, label: dict.nav.visa, icon: "🛂" },
    { href: `/${locale}/currency`, label: dict.nav.currency, icon: "💱" },
  ];
  const sitePages = [
    { href: `/${locale}/about`, label: dict.legal.aboutTitle },
    ...(CONTACT_EMAIL ? [{ href: `/${locale}/contact`, label: dict.legal.contactTitle }] : []),
    { href: `/${locale}/privacy`, label: dict.legal.privacyTitle },
    { href: `/${locale}/terms`, label: dict.legal.termsTitle },
  ];
  const moreActive = !moreOpen && [...tools, ...sitePages].some((t) => isActive(t.href));

  // Booking lives in the homepage's "book your trip" tab. On the homepage the
  // tab is opened in place; elsewhere the link carries #plan there.
  const onBook = (e: React.MouseEvent) => {
    if (pathname !== home) return;
    e.preventDefault();
    openPlanner();
  };
  // "Home" on the homepage brings back the in-season cities, at the top.
  const onHome = (e: React.MouseEvent) => {
    if (pathname !== home) return;
    e.preventDefault();
    window.dispatchEvent(new Event(HOME_SEASON_EVENT));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const onHomePage = pathname === home;
  const bookActive = onHomePage && homeTab === "plan" && !moreOpen;

  const switchLanguage = (next: Locale) => {
    if (next === locale) return;
    track("language_switch", { from: locale, to: next });
    const segments = pathname.split("/");
    segments[1] = next;
    setMoreOpen(false);
    router.replace(segments.join("/") || `/${next}`);
  };

  const go = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    setMoreOpen(false);
    router.replace(href);
  };

  const tabClass = (active: boolean) =>
    `app-tab relative flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 pb-1 text-[0.68rem] leading-tight transition-colors ${
      active
        ? "font-extrabold text-navy-900 before:absolute before:top-0 before:h-[3px] before:w-7 before:rounded-b-full before:bg-sun-400"
        : "font-semibold text-[#7d8aa0] active:text-navy-900"
    }`;

  return (
    <>
      <nav aria-label={dict.nav.menu} className="app-only app-tabbar print:hidden">
        <Link href={home} onClick={onHome} className={tabClass(onHomePage && !bookActive && !moreOpen)} aria-current={onHomePage ? "page" : undefined}>
          <TabIcon d="M3 10.5 12 3l9 7.5M5.5 9v11h4.5v-6h4v6h4.5V9" />
          <span className="truncate">{dict.nav.home}</span>
        </Link>
        <Link
          href={`/${locale}/attractions`}
          className={tabClass(isActive(`/${locale}/attractions`) || isActive(`/${locale}/maps`))}
        >
          <TabIcon d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
          <span className="truncate">{dict.nav.destinations}</span>
        </Link>

        {/* The one action the site exists for, raised in the middle. */}
        <Link href={`${home}#plan`} onClick={onBook} className={`app-tab flex min-w-0 flex-1 flex-col items-center justify-end pb-1 text-[0.68rem] leading-tight ${bookActive ? "font-extrabold text-navy-900" : "font-semibold text-navy-900/80"}`}>
          <span className={`-mt-5 mb-0.5 flex h-12 w-12 items-center justify-center rounded-full bg-sun-400 text-navy-990 shadow-[0_8px_18px_-8px_rgba(255,140,0,0.9)] ring-4 ring-white transition ${bookActive ? "scale-105" : ""}`}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
            </svg>
          </span>
          <span className="truncate">{dict.nav.bookTab}</span>
        </Link>

        <Link href={`/${locale}/seasons`} className={tabClass(isActive(`/${locale}/seasons`))}>
          <TabIcon d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm3.5 8.5h.01m3.49 0h.01m3.49 0h.01M8.5 17h.01M12 17h.01" />
          <span className="truncate">{dict.nav.seasonsTab}</span>
        </Link>
        <button
          type="button"
          onClick={() => (moreOpen ? closeMore() : setMoreOpen(true))}
          aria-expanded={moreOpen}
          className={tabClass(moreOpen || moreActive)}
        >
          <TabIcon d="M4 5h6v6H4zM14 5h6v6h-6zM4 15h6v6H4zM14 15h6v6h-6z" />
          <span className="truncate">{dict.nav.more}</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-[55] flex flex-col justify-end print:hidden" role="dialog" aria-modal="true" aria-label={dict.nav.more}>
          <button type="button" aria-label={dict.nav.close} onClick={closeMore} className="absolute inset-0 bg-navy-990/60 backdrop-blur-[2px]" />
          <div className="app-sheet relative max-h-[80svh] overflow-y-auto rounded-t-3xl bg-white px-4 pt-2 text-navy-900 shadow-2xl">
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-navy-900/15" aria-hidden="true" />

            <p className="px-1 pb-2 text-xs font-bold text-navy-900/50">{dict.nav.tools}</p>
            <div className="grid grid-cols-3 gap-2">
              {tools.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  onClick={(e) => go(e, t.href)}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-center text-xs font-bold ring-1 transition active:scale-[0.98] ${
                    isActive(t.href) ? "bg-sun-50 text-navy-990 ring-sun-300" : "bg-mist-50 text-navy-900 ring-navy-900/5"
                  }`}
                >
                  <span className="text-2xl leading-none" aria-hidden="true">{t.icon}</span>
                  {t.label}
                </Link>
              ))}
            </div>

            <p className="mt-5 px-1 pb-2 text-xs font-bold text-navy-900/50">{dict.nav.language}</p>
            <div className="flex gap-2 rounded-2xl bg-mist-50 p-1 ring-1 ring-navy-900/5">
              {(["ar", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => switchLanguage(l)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
                    locale === l ? "bg-white text-navy-990 shadow-sm ring-1 ring-navy-900/10" : "text-navy-900/55"
                  }`}
                >
                  {l === "ar" ? "العربية" : "English"}
                </button>
              ))}
            </div>

            <div className="mt-5 divide-y divide-navy-900/5 overflow-hidden rounded-2xl bg-mist-50 ring-1 ring-navy-900/5">
              {sitePages.map((p) => (
                <Link
                  key={p.href}
                  href={p.href}
                  onClick={(e) => go(e, p.href)}
                  className="flex items-center justify-between px-4 py-3.5 text-sm font-semibold text-navy-900 active:bg-white"
                >
                  {p.label}
                  <span aria-hidden="true" className="text-navy-900/30 rtl:rotate-180">›</span>
                </Link>
              ))}
            </div>

            <p className="mt-4 px-1 text-2xs leading-relaxed text-navy-900/45">{dict.footer.disclaimer}</p>
            <p className="mt-2 px-1 pb-4 text-2xs text-navy-900/35">
              © {new Date().getFullYear()} {locale === "ar" ? dict.siteNameAr : dict.siteNameEn}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function TabIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.4rem] w-[1.4rem]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
