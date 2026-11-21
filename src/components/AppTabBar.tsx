"use client";

import { quickTools } from "@/lib/quickTools";
import AccountLink from "@/components/AccountLink";
import Icon, { type IconName } from "@/components/ui/Icon";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useDictionary } from "@/lib/dict/context";
import { openPlanner, HOME_TAB_EVENT, HOME_SEASON_EVENT } from "@/lib/planEvents";
import { track } from "@/lib/analytics";
import { saveLanguage } from "@/lib/langCookie";
import type { Locale } from "@/lib/types";
import { CONTACT_EMAIL } from "@/lib/contact";
import { openFeedback } from "@/components/feedback/events";
import { replayTips } from "@/components/FirstTips";
import SocialLinks from "@/components/SocialLinks";
import { useMyTrip } from "@/lib/myTrip";
import { tripCityName } from "@/components/member/tripLinks";
import { openTripModeInApp, tripModeInApp } from "@/lib/nativeApp";

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
const MORE_RETURN_KEY = "sfr-more-return";

export default function AppTabBar({ locale }: { locale: Locale }) {
  const dict = useDictionary();
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

  // Back from a page chosen in «المزيد» returns to the «المزيد» list (owner,
  // 29 Oct: "I opened Contact from More and could not get back to the
  // list"): the sheet opens again over the page underneath.
  const popped = useRef(false);
  const prevPath = useRef<string | null>(null);
  useEffect(() => {
    const onPop = () => {
      popped.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    const prev = prevPath.current;
    prevPath.current = pathname;
    let from: string | null = null;
    try {
      from = sessionStorage.getItem(MORE_RETURN_KEY);
    } catch {}
    const wasBack = popped.current;
    popped.current = false;
    if (!from || prev === null || prev === pathname) return;
    if (prev === from) {
      try {
        sessionStorage.removeItem(MORE_RETURN_KEY);
      } catch {}
      if (wasBack) setMoreOpen(true);
    }
  }, [pathname]);

  const closeMore = () => {
    if (history.state?.sfrtnaSheet) history.back();
    else setMoreOpen(false);
  };

  // «وضع الرحلة»: iPhone builds that have it (kept plans offline, qibla…).
  const [tripMode, setTripMode] = useState(false);
  useEffect(() => {
    void tripModeInApp().then(setTripMode);
  }, []);

  const myTrip = useMyTrip();
  const home = `/${locale}`;
  const isActive = (href: string) =>
    href === home ? pathname === home : pathname === href || pathname.startsWith(`${href}/`);

  const tools = quickTools(locale, dict);
  const sitePages = [
    { href: `/${locale}/about`, label: dict.legal.aboutTitle },
    ...(CONTACT_EMAIL ? [{ href: `/${locale}/contact`, label: dict.legal.contactTitle }] : []),
    { href: `/${locale}/privacy`, label: dict.legal.privacyTitle },
    { href: `/${locale}/terms`, label: dict.legal.termsTitle },
  ];
  const contactPage = CONTACT_EMAIL ? { href: `/${locale}/contact`, label: dict.legal.contactTitle } : null;
  const aboutPages = [
    { href: `/${locale}/about`, label: dict.legal.aboutTitle, glyph: INFO },
    { href: `/${locale}/privacy`, label: dict.legal.privacyTitle, glyph: LOCK },
    { href: `/${locale}/terms`, label: dict.legal.termsTitle, glyph: DOC },
  ];
  const card = "overflow-hidden rounded-[1.25rem] bg-white shadow-[0_1px_2px_rgba(11,45,91,0.06)]";
  const row = "flex min-h-[3.4rem] items-center gap-3 px-3.5 py-2.5 active:bg-mist-50";
  const label = "mb-2 mt-5 px-1.5 text-xs font-extrabold text-navy-900/50";
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
    // A fresh load of the page in the other language, not an in-app
    // navigation: switching swaps the page's direction (rtl ↔ ltr) and its
    // whole text, and on a phone re-rendering all of that in place left the
    // app hanging (owner, 8 Oct). A new page from the edge cache is quicker
    // and always clean. The cookie is set first so the next launch opens in
    // this language even if the app is closed straight away.
    saveLanguage(next);
    window.location.replace((segments.join("/") || `/${next}`) + window.location.search);
  };

  const go = (e: React.MouseEvent, href: string) => {
    e.preventDefault();
    setMoreOpen(false);
    try {
      sessionStorage.setItem(MORE_RETURN_KEY, href.split("?")[0].split("#")[0]);
    } catch {}
    router.replace(href);
  };

  const tabClass = (active: boolean) =>
    `app-tab flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 pb-1 text-[0.68rem] font-bold leading-tight transition-colors ${
      active ? "text-sun-400" : "text-white/65 active:text-white"
    }`;

  // The tabs' pages are fetched in full ahead of the tap (prefetch): from
  // the edge cache that costs little, and the tap then shows the page at
  // once instead of a loading screen.
  return (
    <>
      <nav aria-label={dict.nav.menu} className="app-only app-tabbar print:hidden">
        <Link href={home} prefetch onClick={onHome} className={tabClass(onHomePage && !bookActive && !moreOpen)} aria-current={onHomePage ? "page" : undefined}>
          <TabIcon d="M3 10.5 12 3l9 7.5M5.5 9v11h4.5v-6h4v6h4.5V9" />
          <span className="truncate">{dict.nav.home}</span>
        </Link>
        <Link
          prefetch
          href={`/${locale}/attractions`}
          className={tabClass(isActive(`/${locale}/attractions`) || isActive(`/${locale}/maps`))}
        >
          <TabIcon d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
          <span className="truncate">{dict.nav.destinations}</span>
        </Link>

        {/* The one action the site exists for, raised in the middle. */}
        <Link href={`${home}#plan`} onClick={onBook} className={`app-tab flex min-w-0 flex-1 flex-col items-center justify-end pb-1 text-[0.68rem] font-bold leading-tight ${bookActive ? "text-sun-400" : "text-white/80"}`}>
          <span className={`-mt-5 mb-0.5 flex h-12 w-12 items-center justify-center rounded-full bg-sun-400 text-navy-900 shadow-[0_6px_18px_-6px_rgba(255,166,48,0.8)] ring-4 transition ${bookActive ? "ring-sea-400/80" : "ring-navy-990"}`}>
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
            </svg>
          </span>
          <span className="truncate">{dict.nav.bookTab}</span>
        </Link>

        <Link href={`/${locale}/seasons`} prefetch className={tabClass(isActive(`/${locale}/seasons`))}>
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
          {/* «المزيد» (owner, 21 Nov 2026): one look for everything — a
              title and close, the language first, then the account (sign in
              right here), «رحلتي», the tools with the home page's navy and
              gold icons, and plain grouped rows, settings-style. */}
          <div className="app-sheet relative max-h-[82svh] overflow-y-auto rounded-t-[1.75rem] bg-mist-50 px-3.5 pt-2 text-navy-900 shadow-2xl">
            <div className="mx-auto h-1 w-10 rounded-full bg-navy-900/15" aria-hidden="true" />
            <div className="sticky -top-2 z-[1] -mx-3.5 flex items-center justify-between bg-mist-50 px-4 pb-3 pt-3">
              <h2 className="font-display text-xl font-black">{dict.nav.more}</h2>
              <button
                type="button"
                onClick={closeMore}
                aria-label={dict.nav.close}
                className="grid h-9 w-9 place-items-center rounded-full bg-white text-navy-900 shadow-[0_1px_3px_rgba(11,45,91,0.12)]"
              >
                <RowGlyph d="M6 6l12 12M18 6 6 18" />
              </button>
            </div>

            <div className={`${card} flex items-center gap-3 py-2 pe-2 ps-3`}>
              <RowIcon d={GLOBE} />
              <span className="flex-1 text-[0.95rem] font-bold">{dict.nav.language}</span>
              <span className="flex rounded-full bg-mist-100 p-[3px] text-[0.8rem] font-extrabold">
                {(["ar", "en"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => switchLanguage(l)}
                    aria-pressed={locale === l}
                    className={`rounded-full px-3 py-1.5 transition ${locale === l ? "bg-white text-navy-900 shadow-sm" : "text-navy-900/55"}`}
                  >
                    {l === "ar" ? "العربية" : "English"}
                  </button>
                ))}
              </span>
            </div>

            <div className="mt-2.5">
              <AccountLink locale={locale} variant="sheet" onNavigate={go} />
            </div>

            <Link
              href={`/${locale}/my-trip`}
              onClick={(e) => go(e, `/${locale}/my-trip`)}
              className="mt-2.5 flex w-full items-center gap-3 rounded-[1.25rem] bg-gradient-to-l from-navy-990 to-navy-900 p-3.5 text-start text-white active:scale-[0.99]"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[0.9rem] bg-[#f8b840]/15 text-[#f8b840]">
                <Icon name="luggage" className="h-6 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-base font-black">{dict.myTrip.title}</span>
                <span className="block truncate text-xs text-white/70">{myTrip ? tripCityName(myTrip, locale === "ar") : dict.myTrip.navSub}</span>
              </span>
              <span className="rounded-full bg-sun-400 px-3 py-1.5 text-xs font-extrabold text-navy-950">{dict.nav.moreOpen}</span>
            </Link>
            {tripMode && (
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  void openTripModeInApp();
                }}
                className={`${card} ${row} mt-2.5 w-full text-start`}
              >
                <RowIcon icon="compass" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.95rem] font-bold">{dict.tripMode.title}</span>
                  <span className="block truncate text-xs text-navy-900/55">{dict.tripMode.menuSub}</span>
                </span>
                <Chevron />
              </button>
            )}

            <p className={label}>{dict.nav.tools}</p>
            <div className="grid grid-cols-3 gap-2">
              {tools.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  onClick={(e) => go(e, t.href)}
                  className={`flex flex-col items-center gap-2 rounded-[1.1rem] px-1 py-3 text-center font-display text-[0.8rem] font-extrabold leading-tight shadow-[0_1px_2px_rgba(11,45,91,0.06)] transition active:scale-[0.98] ${
                    isActive(t.href) ? "bg-sun-50 ring-1 ring-sun-300" : "bg-white"
                  }`}
                >
                  <span className="grid h-11 w-11 place-items-center rounded-[0.9rem] bg-navy-900 text-[#f8b840]">
                    <Icon name={t.glyph} className="h-6 w-6" />
                  </span>
                  {t.label}
                </Link>
              ))}
            </div>

            <p className={label}>{dict.nav.moreSettings}</p>
            <div className={card}>
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  replayTips();
                }}
                className={`${row} w-full text-start`}
              >
                <RowIcon d={BULB} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.95rem] font-bold">{dict.tips.replay}</span>
                  <span className="block text-xs text-navy-900/55">{dict.tips.replaySub}</span>
                </span>
                <Chevron />
              </button>
            </div>

            <p className={label}>{dict.nav.moreContact}</p>
            <div className={`${card} divide-y divide-mist-100`}>
              <button
                type="button"
                onClick={() => {
                  setMoreOpen(false);
                  openFeedback({ source: "app_menu" });
                }}
                className={`${row} w-full text-start`}
              >
                <RowIcon d={CHAT} warm />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.95rem] font-bold">{dict.feedback.open}</span>
                  <span className="block text-xs text-navy-900/55">{dict.feedback.subtitle}</span>
                </span>
                <Chevron />
              </button>
              {contactPage && (
                <Link href={contactPage.href} onClick={(e) => go(e, contactPage.href)} className={row}>
                  <RowIcon d={MAIL} />
                  <span className="flex-1 text-[0.95rem] font-bold">{contactPage.label}</span>
                  <Chevron />
                </Link>
              )}
            </div>

            <p className={label}>{dict.nav.moreAbout}</p>
            <div className={`${card} divide-y divide-mist-100`}>
              {aboutPages.map((p) => (
                <Link key={p.href} href={p.href} onClick={(e) => go(e, p.href)} className={row}>
                  <RowIcon d={p.glyph} />
                  <span className="flex-1 text-[0.95rem] font-bold">{p.label}</span>
                  <Chevron />
                </Link>
              ))}
            </div>

            <div className="mt-5 flex justify-center">
              <SocialLinks tone="light" />
            </div>
            <p className="mt-3 px-2 text-center text-2xs leading-relaxed text-navy-900/50">{dict.footer.disclaimer}</p>
            <p className="mt-1.5 px-2 pb-5 text-center text-2xs text-navy-900/40">
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

const GLOBE = "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z";
const BULB = "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z";
const CHAT = "M5 5h14v10H9l-4 4z";
const MAIL = "M3 5h18v14H3zM3 7l9 6 9-6";
const INFO = "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01";
const LOCK = "M5 11h14v10H5zM8 11V8a4 4 0 0 1 8 0v3";
const DOC = "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6";

function RowGlyph({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.15rem] w-[1.15rem]" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/** The small square at the start of every «المزيد» row. */
function RowIcon({ d, icon, warm }: { d?: string; icon?: IconName; warm?: boolean }) {
  return (
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[0.7rem] ${warm ? "bg-sun-50 text-sun-600" : "bg-mist-100 text-navy-900"}`}>
      {icon ? <Icon name={icon} className="h-[1.15rem] w-[1.15rem]" /> : d ? <RowGlyph d={d} /> : null}
    </span>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-[1.05rem] w-[1.05rem] shrink-0 text-navy-900/30 ltr:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}
