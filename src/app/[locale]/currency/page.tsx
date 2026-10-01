import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import { pageMetadata } from "@/lib/seo";
import type { Locale } from "@/lib/types";
import { fetchRates } from "@/lib/rates";
import CurrencyConverter from "@/components/CurrencyConverter";
import PageHero from "@/components/ui/PageHero";
import { sectionHero } from "@/lib/sectionHero";

// Rates are fetched per request (behind an hourly cache in the fetch itself),
// so the page never serves a rate frozen at build time.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/[locale]/currency">): Promise<Metadata> {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  return pageMetadata({
    locale: loc,
    path: "/currency",
    title: dict.currency.title,
    description: dict.currency.subtitle,
  });
}

export default async function CurrencyPage({ params, searchParams }: PageProps<"/[locale]/currency">) {
  const { locale } = await params;
  // A pair can be handed in by whoever linked here — the results page sends
  // the trip's own two currencies, so a traveller arrives on their conversion
  // instead of on the default riyal-to-dollar one.
  const query = await searchParams;
  const pick = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : undefined;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);

  const [rates, hero] = await Promise.all([fetchRates(), sectionHero("currency", loc)]);

  // Shown in the reader's own calendar and language, from the feed's own
  // timestamp — not from when this page happened to render.
  const updated = rates
    ? new Intl.DateTimeFormat(
        // Gregorian with Latin digits in Arabic too: "ar-SA" alone defaults to
        // the Umm al-Qura calendar, and a Hijri date next to a flight booking
        // and a market rate is a date nobody can cross-check at a glance.
        loc === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB",
        { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }
      ).format(new Date(rates.updatedAt))
    : null;

  return (
    <div>
      <PageHero
        {...hero}
        size="sm"
        align="center"
        title={dict.currency.title}
        subtitle={dict.currency.subtitle}
      />

      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-10">
        <CurrencyConverter
          locale={loc}
          rates={rates}
          initialFrom={pick(query.from)}
          initialTo={pick(query.to)}
          dict={{
            amount: dict.currency.amount,
            from: dict.currency.from,
            to: dict.currency.to,
            swap: dict.currency.swap,
            searchPlaceholder: dict.currency.searchPlaceholder,
            noMatches: dict.currency.noMatches,
            rateLine: dict.currency.rateLine,
            inverseLine: dict.currency.inverseLine,
            checkOnGoogle: dict.currency.checkOnGoogle,
            googleHint: dict.currency.googleHint,
            unavailable: dict.currency.unavailable,
            pairUnavailable: dict.currency.pairUnavailable,
            disclaimer: dict.currency.disclaimer,
          }}
        />

        {rates && updated && (
          <p className="mt-3 text-center text-xs text-navy-400">
            🕒 {dict.currency.updatedAt.replace("{when}", `${updated} UTC`)}
          </p>
        )}
      </div>
    </div>
  );
}
