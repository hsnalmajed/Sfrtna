import PartnerLink from "@/components/PartnerLink";
import { COMPENSATION_LINK, servicesFor, type ServiceKind } from "@/lib/tripEssentials";
import type { Locale } from "@/lib/types";

/**
 * Everything around the trip in one compact panel — tours and tickets, mobile
 * data, airport transfers, car rental, luggage storage — one row per need,
 * with every partner for it as a button (see tripEssentials.ts). On a phone
 * each row is one line that scrolls sideways, so the panel stays short.
 */
export default function TripServices({
  locale,
  countryCode,
  citySlug,
  cityName,
  cityNameEn,
  withCompensation = false,
  t,
}: {
  locale: Locale;
  countryCode: string;
  citySlug: string;
  cityName: string;
  cityNameEn: string;
  /** Flight results: a row for claiming compensation on a late flight. */
  withCompensation?: boolean;
  t: {
    servicesTitle: string;
    servicesSub: string;
    serviceActivity: string;
    serviceEsim: string;
    serviceTransfer: string;
    serviceCar: string;
    serviceLuggage: string;
    serviceCompensation: string;
  };
}) {
  const groups = servicesFor(countryCode, citySlug, cityNameEn);
  const rows: { key: string; icon: string; title: string; links: { partner: string; name: string; href: string }[] }[] =
    groups.map((g) => ({ key: g.kind, ...LABEL(g.kind, t), links: g.links }));
  if (withCompensation) rows.push({ key: "compensation", icon: "🛬", title: t.serviceCompensation, links: [COMPENSATION_LINK] });
  if (!rows.length) return null;

  return (
    <section className="mb-8" aria-labelledby="trip-services">
      <h2 id="trip-services" className="font-display text-lg font-extrabold text-navy-950 sm:text-xl">
        {t.servicesTitle.replace("{city}", cityName)}
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-navy-500 sm:text-sm">{t.servicesSub}</p>
      <div className="mt-3 divide-y divide-mist-100 overflow-hidden rounded-2xl bg-white ring-1 ring-black/5 shadow-sm">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
            <div className="flex w-[6.5rem] shrink-0 items-center gap-1.5 sm:w-44">
              <span className="text-base" aria-hidden="true">
                {r.icon}
              </span>
              <span className="text-xs font-bold leading-tight text-navy-900 sm:text-sm">{r.title}</span>
            </div>
            <div className="rail flex min-w-0 flex-1 gap-1.5 overflow-x-auto sm:flex-wrap sm:overflow-visible">
              {r.links.map((l) => (
                <PartnerLink
                  key={l.partner}
                  partner={l.partner}
                  href={l.href}
                  data-product={r.key}
                  data-placement="trip_services"
                  className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-mist-50 px-3 py-1.5 text-xs font-bold text-navy-900 ring-1 ring-mist-200 transition hover:bg-white hover:ring-sea-300"
                >
                  <span dir="ltr">{l.name}</span>
                  <span aria-hidden="true" className="text-sea-600">
                    {locale === "ar" ? "↖" : "↗"}
                  </span>
                </PartnerLink>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LABEL(kind: ServiceKind, t: Record<string, string>): { icon: string; title: string } {
  switch (kind) {
    case "activity":
      return { icon: "🎟️", title: t.serviceActivity };
    case "esim":
      return { icon: "📶", title: t.serviceEsim };
    case "transfer":
      return { icon: "🚖", title: t.serviceTransfer };
    case "car":
      return { icon: "🚗", title: t.serviceCar };
    case "luggage":
      return { icon: "🧳", title: t.serviceLuggage };
  }
}
