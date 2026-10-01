import VisaDetailsButton from "@/components/VisaDetailsButton";
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
    <div className="flex flex-col gap-4 bg-white px-5 py-4 text-navy-900 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3.5 md:shrink-0">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sea-50 text-xl ring-1 ring-sea-100"
          aria-hidden="true"
        >
          🛂
        </span>
        <span>
          <span className="block text-xs font-semibold text-navy-500">{dict.attractions.factVisa}</span>
          <span className={`mt-0.5 block text-base font-extrabold leading-snug ${tone}`}>
            {status ? labels[status.category] : dict.attractions.factVisaCheck}
          </span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
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
        <VisaDetailsButton countryCode={countryCode} locale={locale} className={`${btn} text-brand-700 hover:underline`}>
          {dict.visa.openDetails} {locale === "ar" ? "←" : "→"}
        </VisaDetailsButton>
      </div>
    </div>
  );
}
