import VisaDetailsButton from "@/components/VisaDetailsButton";
import type { Locale } from "@/lib/types";
import { getDictionary } from "@/lib/dictionaries";
import { visaStatusFor } from "@/data/visaStatus";

/**
 * The visa line at the top of a destination: which kind of visa a Saudi
 * passport needs, and one button beside it — «متطلبات السفر». The button
 * opens the requirements over the page (VisaRequirementsDialog), and the
 * ways to apply — the country's official site, or through Direct — sit at
 * the bottom of that window, after the traveller has read what is needed.
 * (Owner's decision, 7 Oct 2026: no apply buttons before the requirements.)
 *
 * The kind is shown only when it is confirmed (src/data/visaStatus.ts);
 * otherwise the card says to check, and the window ends with the IATA check.
 */
export default function VisaQuickCard({ countryCode, locale }: { countryCode: string; locale: Locale }) {
  const dict = getDictionary(locale);
  const status = visaStatusFor(countryCode);
  const labels = {
    free: dict.visa.statusFree,
    arrival: dict.visa.statusArrival,
    eta: dict.visa.statusEta,
    required: dict.visa.statusRequired,
  } as const;
  const tone = status
    ? { free: "text-emerald-700", arrival: "text-sea-700", eta: "text-sun-700", required: "text-rose-700" }[status.category]
    : "text-navy-900";

  return (
    <div className="flex items-center gap-3 bg-white px-5 py-4 text-navy-900">
      <span
        className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sea-50 text-xl ring-1 ring-sea-100"
        aria-hidden="true"
      >
        🛂
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-navy-500">{dict.attractions.factVisa}</span>
        <span className={`mt-0.5 block text-base font-extrabold leading-snug ${tone}`}>
          {status ? labels[status.category] : dict.attractions.factVisaCheck}
        </span>
      </span>
      <VisaDetailsButton
        countryCode={countryCode}
        locale={locale}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-navy-900 px-3.5 py-2.5 text-xs font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-navy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400"
      >
        📋 {dict.attractions.factVisaRequirements}
      </VisaDetailsButton>
    </div>
  );
}
