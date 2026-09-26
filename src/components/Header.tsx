"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getDictionary } from "@/lib/dictionaries";
import { openPlanner } from "@/lib/planEvents";
import type { Locale } from "@/lib/types";
import LanguageSwitcher from "./LanguageSwitcher";
import Logo from "@/components/ui/Logo";

/**
 * The header sits *on* the photograph, not above it.
 *
 * At the top of any page it is transparent with only a scrim behind it, so
 * the hero image runs edge to edge and full height — the single change that
 * does the most to stop the site looking like a template. Once you scroll it
 * condenses into a solid navy bar so it never competes with the content
 * underneath.
 *
 * The scrim matters for safety as much as for looks: it guarantees the white
 * nav stays legible even over a bright sky, which a plain transparent header
 * could not promise.
 */
export default function Header({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);

  // "Book your trip" is the homepage's booking tab. Already on the
  // homepage, a #plan link would only scroll (and not at all if the hash is
  // already #plan), so it asks the tab to open instead — see planEvents.ts.
  const onBook = (e: React.MouseEvent) => {
    if (pathname !== `/${locale}`) return;
    e.preventDefault();
    setMenuOpen(false);
    openPlanner();
  };

  // Subscribe only — no synchronous setState in the effect body. The bar
  // always starts transparent because every page starts at the top of a
  // hero; if the browser restores a scroll position, its own scroll event
  // arrives and corrects this on the next frame.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /**
   * Four items, not seven.
   *
   * "Home" went first: the logo has always gone there, and a nav item that
   * duplicates the logo spends a slot on nothing. "Attractions" and "Maps"
   * were two views of the same places under two names, which made a visitor
   * choose between them before knowing they were the same thing — they
   * share one heading now. The two reference tools sit together under one,
   * because nobody arrives wanting "currency"; they arrive wanting to know
   * what a trip costs, and find it there.
   *
   * A seven-item bar on a phone is a scroll; four fit.
   */
  const navLinks = [
    { href: `/${locale}/attractions`, label: dict.nav.destinations },
    { href: `/${locale}/seasons`, label: dict.nav.whenToTravel },
  ];

  const toolLinks = [
    { href: `/${locale}/maps`, label: dict.nav.maps },
    { href: `/${locale}/visa`, label: dict.nav.visa },
    { href: `/${locale}/currency`, label: dict.nav.currency },
    { href: `/${locale}/itinerary`, label: dict.nav.itinerary },
  ];

  const isActive = (href: string) =>
    // The home link is the locale root, and every other path starts with it —
    // so it only counts as active on an exact match.
    href === `/${locale}` ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const solid = scrolled || menuOpen;

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      {/* Scrim: only visible while the bar itself is transparent. */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-navy-990/85 via-navy-990/45 to-transparent transition-opacity duration-300 ${
          solid ? "opacity-0" : "opacity-100"
        }`}
      />

      <div
        className={`relative transition-all duration-300 ${
          solid
            ? "bg-navy-990/94 shadow-[0_1px_0_0_rgba(255,255,255,0.07),0_10px_30px_-18px_rgba(4,24,47,0.9)] backdrop-blur-xl"
            : "bg-transparent"
        }`}
      >
        <div
          className={`mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 transition-all duration-300 sm:px-6 ${
            solid ? "py-2" : "py-3.5"
          }`}
        >
          {/* The full logo on a white card — see the note in Logo.tsx for why
              it is not recoloured for the dark bar. */}
          <Link
            href={`/${locale}`}
            className="flex shrink-0 items-center rounded-xl bg-white px-2.5 py-1 shadow-[0_2px_10px_-4px_rgba(4,24,47,0.5)] ring-1 ring-white/70 transition hover:shadow-[0_4px_16px_-4px_rgba(4,24,47,0.6)]"
          >
            <Logo variant="full" alt={`${dict.siteNameAr} ${dict.siteNameEn}`} priority className="h-10 w-auto sm:h-12" />
          </Link>

          <nav className="hidden items-center gap-0.5 text-sm font-semibold lg:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-lg px-3 py-2 transition ${
                  isActive(link.href) ? "text-sun-400" : "text-white/80 hover:text-white"
                }`}
              >
                {link.label}
                {isActive(link.href) && (
                  <span className="absolute inset-x-3 -bottom-0.5 h-[2px] rounded-full bg-sun-400" />
                )}
              </Link>
            ))}

            {/* Opens on hover *and* on click: hover alone is unreachable by
                keyboard and unusable on a touchscreen that happens to be
                wide. */}
            <div
              className="relative"
              onMouseEnter={() => setToolsOpen(true)}
              onMouseLeave={() => setToolsOpen(false)}
            >
              <button
                type="button"
                onClick={() => setToolsOpen((v) => !v)}
                aria-expanded={toolsOpen}
                aria-label={dict.nav.toolsAria}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 transition ${
                  toolLinks.some((t) => isActive(t.href))
                    ? "text-sun-400"
                    : "text-white/80 hover:text-white"
                }`}
              >
                {dict.nav.tools}
                <span aria-hidden="true" className="text-[0.6em]">
                  ▼
                </span>
              </button>

              {toolsOpen && (
                <div className="absolute end-0 top-full w-52 overflow-hidden rounded-xl border border-white/10 bg-navy-990/97 py-1.5 shadow-[0_18px_40px_-18px_rgba(4,24,47,0.9)] backdrop-blur-xl">
                  {toolLinks.map((t) => (
                    <Link
                      key={t.href}
                      href={t.href}
                      onClick={() => setToolsOpen(false)}
                      className={`block px-4 py-2.5 text-sm transition hover:bg-white/10 ${
                        isActive(t.href) ? "text-sun-400" : "text-white/80"
                      }`}
                    >
                      {t.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href={`/${locale}#plan`}
              onClick={onBook}
              className="hidden rounded-full bg-sun-400 px-4 py-2 text-sm font-bold text-navy-950 shadow-[var(--shadow-sun)] transition hover:-translate-y-0.5 hover:bg-sun-300 md:inline-flex"
            >
              {dict.nav.planCta}
            </Link>
            <LanguageSwitcher locale={locale} />
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={dict.nav.menu}
              aria-expanded={menuOpen}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/85 transition hover:bg-white/10 lg:hidden"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                {menuOpen ? (
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {menuOpen && (
          // Closing happens on the click that navigates, not in an effect on
          // pathname: tapping a link to the page you are already on still has
          // to dismiss the drawer, and that never changes the path.
          <nav
            onClick={() => setMenuOpen(false)}
            className="border-t border-white/10 bg-navy-990/97 px-4 pb-4 pt-2 backdrop-blur-xl lg:hidden"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`block rounded-xl px-3 py-3 text-sm font-semibold transition hover:bg-white/5 ${
                  isActive(link.href) ? "text-sun-400" : "text-white/80"
                }`}
              >
                {link.label}
              </Link>
            ))}

            <p className="eyebrow eyebrow-light mt-3 px-3 pb-1">{dict.nav.tools}</p>
            {toolLinks.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`block rounded-xl px-3 py-3 text-sm font-semibold transition hover:bg-white/5 ${
                  isActive(t.href) ? "text-sun-400" : "text-white/80"
                }`}
              >
                {t.label}
              </Link>
            ))}
            <Link
              href={`/${locale}#plan`}
              onClick={onBook}
              className="mt-2 block rounded-xl bg-sun-400 px-3 py-3 text-center text-sm font-bold text-navy-950"
            >
              {dict.nav.planCta}
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
