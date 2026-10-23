import Link from "next/link";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import Logo from "@/components/ui/Logo";
import { CONTACT_EMAIL } from "@/lib/contact";
import FeedbackLink from "@/components/feedback/FeedbackLink";

/**
 * The footer closes the page the way the hero opened it — navy, an orange
 * rule, display type — so a visitor who scrolls the whole way lands
 * somewhere that clearly belongs to the same site.
 *
 * The disclaimer is given real weight rather than being buried in grey. On a
 * metasearch site the honest line ("we compare, they book") is not fine
 * print; it is the reason to trust the prices above it.
 */
import AppStoreButtons from "@/components/AppStoreButtons";
import { SOCIAL_PROFILES } from "@/lib/social";

export default function Footer({ locale }: { locale: Locale }) {
  const dict = getDictionary(locale);
  const year = new Date().getFullYear();

  const explore = [
    { href: `/${locale}/attractions`, label: dict.nav.attractions },
    { href: `/${locale}/seasons`, label: dict.nav.seasons },
  ];
  const tools = [
    { href: `/${locale}/itinerary`, label: dict.nav.itinerary },
    { href: `/${locale}/visa`, label: dict.nav.visa },
    { href: `/${locale}/currency`, label: dict.nav.currency },
    { href: `/${locale}/services`, label: dict.nav.services },
    { href: `/${locale}/budget`, label: dict.nav.budget },
  ];
  /**
   * The pages that say who is behind this.
   *
   * A travel site asking someone to trust a price, with no "about", no way
   * to write to it and no terms, reads as a site that might not be there
   * next week. These are cheap to provide and expensive to be missing.
   */
  const legal = [
    { href: `/${locale}/about`, label: dict.legal.aboutTitle },
    ...(CONTACT_EMAIL ? [{ href: `/${locale}/contact`, label: dict.legal.contactTitle }] : []),
    { href: `/${locale}/privacy`, label: dict.legal.privacyTitle },
    { href: `/${locale}/terms`, label: dict.legal.termsTitle },
  ];

  return (
    <footer className="web-only bg-navy-990">
      <div className="h-px bg-gradient-to-r from-transparent via-sun-400/60 to-transparent" />
      <div className="mx-auto max-w-6xl px-4 py-14 text-sm sm:px-6">
        <div className="grid grid-cols-3 gap-x-4 gap-y-10 border-b border-white/10 pb-10 sm:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] sm:gap-x-8">
          <div className="col-span-3 max-w-sm space-y-4 sm:col-span-1">
            <span className="inline-flex rounded-xl bg-white px-3 py-2 shadow-sm">
              <Logo variant="full" alt={`${dict.siteNameAr} ${dict.siteNameEn}`} className="h-16 w-auto" />
            </span>
            <p className="leading-relaxed text-white/45">{dict.footer.disclaimer}</p>
          </div>

          <div>
            <p className="mb-3.5 text-2xs font-bold uppercase tracking-[0.18em] text-sun-400/85">
              {dict.footer.exploreHeading}
            </p>
            <ul className="space-y-2.5">
              {explore.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-white/60 transition hover:text-sun-300">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-3.5 text-2xs font-bold uppercase tracking-[0.18em] text-sun-400/85">
              {dict.footer.toolsHeading}
            </p>
            <ul className="space-y-2.5">
              {tools.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-white/60 transition hover:text-sun-300">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="mb-3.5 text-2xs font-bold uppercase tracking-[0.18em] text-sun-400/85">
              {dict.footer.legalHeading}
            </p>
            <ul className="space-y-2.5">
              <li>
                <FeedbackLink source="footer" className="font-bold text-sun-300 transition hover:text-sun-200" />
              </li>
              {legal.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-white/60 transition hover:text-sun-300">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col gap-6 border-t border-white/10 pt-6 sm:flex-row sm:items-start sm:justify-between">
          <AppStoreButtons locale={locale} title={dict.footer.appsHeading} soon={dict.footer.appsSoon} />
          <div>
            <p className="mb-2.5 text-xs font-bold text-white/50">{dict.footer.followHeading}</p>
            <ul className="flex flex-wrap gap-2">
              {SOCIAL_PROFILES.map((p) => (
                <li key={p.id}>
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer me"
                    className="inline-flex min-h-10 items-center rounded-full px-4 text-sm font-semibold text-white/80 ring-1 ring-white/20 transition hover:text-sun-300 hover:ring-sun-300/60"
                  >
                    {p.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-7 text-white/35">
          <p>
            © {year} {dict.siteName} — {dict.footer.rights}
          </p>
          <p className="font-display font-bold text-sun-400/70">{dict.slogan}</p>
        </div>
      </div>
    </footer>
  );
}
