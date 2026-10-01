import Link from "next/link";
import type { Locale } from "@/lib/types";
import { getDictionary } from "@/lib/dictionaries";
import { visaStatusFor } from "@/data/visaStatus";
import { IATA_TRAVEL_CENTRE_URL, directVisaUrl, officialVisaUrl } from "@/lib/visaProviders";

/**
 * The visa line at the top of a destination: which kind of visa a Saudi
 * passport needs, and the buttons to apply — where the traveller is
 * deciding, not at the bottom of the page.
 *
 * The kind is shown only when it is confirmed (src/data/visaStatus.ts);
 * otherwise the card says to check, and the IATA button is the check.
 */
export default function VisaQuickCard({ countryCode, locale }: { countryCode: string; locale: Locale }) {
  const dict = getDictionary(locale);
  const status = visaStatusFor(countryCode);
  // Nothing to apply for when no visa is needed.
  const needsApplying = status?.category !== "free";
  const official = needsApplying ? officialVisaUrl(countryCode) : undefined;
  const direct = needsApplying ? directVisaUrl(countryCode, locale) : undefined;
  const labels = {
    free: dict.visa.statusFree,
    arrival: dict.visa.statusArrival,
    eta: dict.visa.statusEta,
    required: dict.visa.statusRequired,
  } as const;
  const tone = status
    ? { free: "text-emerald-700", arrival: "text-sea-700", eta: "text-sun-700", required: "text-rose-700" }[status.category]
    : "text-navy-900";

  const btn =
    "inline-flex items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-extrabold transition hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400";

  return (
    <div className="card col-span-2 bg-white px-4 py-3.5 text-navy-900 sm:col-span-3 lg:col-span-2">
      <span className="text-lg leading-none" aria-hidden="true">
        🛂
      </span>
      <span className="mt-2 block text-2xs font-bold uppercase tracking-wide text-navy-400">{dict.attractions.factVisa}</span>
      <span className={`mt-1 block text-sm font-extrabold leading-snug ${tone}`}>
        {status ? labels[status.category] : dict.attractions.factVisaCheck}
      </span>
      <div className="mt-3 flex flex-wrap gap-2">
        {official && (
          <a href={official} target="_blank" rel="noopener noreferrer" className={`${btn} bg-navy-900 text-white hover:bg-navy-800`}>
            🏛 {dict.visa.applyOfficial} ↗
          </a>
        )}
        {direct && (
          <a href={direct} target="_blank" rel="noopener noreferrer" className={`${btn} bg-sun-400 text-navy-950 hover:bg-sun-300`}>
            📄 {dict.visa.applyDirect} ↗
          </a>
        )}
        <a
          href={IATA_TRAVEL_CENTRE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btn} bg-white text-navy-800 ring-1 ring-mist-300 hover:ring-navy-300`}
        >
          ✈️ {dict.attractions.factVisaIata} ↗
        </a>
        <Link href={`/${locale}/visa/${countryCode}`} className={`${btn} text-brand-700 hover:underline`}>
          {dict.visa.openDetails} {locale === "ar" ? "←" : "→"}
        </Link>
      </div>
    </div>
  );
}
