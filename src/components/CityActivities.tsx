import PartnerLink from "@/components/PartnerLink";
import { activityLinks, type ActivityPartner } from "@/lib/activityLinks";
import type { Locale } from "@/lib/types";

/**
 * "Tours and tickets in <city>": one card per activity partner, each opening
 * that partner's own search for the city. No prices here — we have none of
 * our own, and the partner's page shows the live one.
 */
export default function CityActivities({
  locale,
  cityName,
  cityNameEn,
  t,
}: {
  locale: Locale;
  cityName: string;
  cityNameEn: string;
  t: {
    activitiesTitle: string;
    activitiesSub: string;
    activitiesBrowse: string;
    partnerGetyourguide: string;
    partnerTiqets: string;
    partnerKlook: string;
  };
}) {
  const blurb: Record<ActivityPartner, string> = {
    getyourguide: t.partnerGetyourguide,
    tiqets: t.partnerTiqets,
    klook: t.partnerKlook,
  };
  return (
    <section className="mb-10" aria-labelledby="city-activities">
      <h2 id="city-activities" className="font-display text-xl font-extrabold text-navy-950 sm:text-2xl">
        {t.activitiesTitle.replace("{city}", cityName)}
      </h2>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-navy-600">{t.activitiesSub}</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {activityLinks(cityNameEn).map((l) => (
          <PartnerLink
            key={l.partner}
            partner={l.partner}
            href={l.href}
            data-product="activity"
            data-placement="city_activities"
            className="group flex flex-col rounded-2xl bg-white p-4 ring-1 ring-black/5 shadow-sm transition hover:shadow-md hover:ring-sea-300"
          >
            <span className="text-base font-extrabold text-navy-950" dir="ltr">
              {l.name}
            </span>
            <span className="mt-1 flex-1 text-sm leading-relaxed text-navy-600">{blurb[l.partner]}</span>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-sea-700 group-hover:underline">
              {t.activitiesBrowse.replace("{partner}", l.name)}
              <span aria-hidden="true">{locale === "ar" ? "↖" : "↗"}</span>
            </span>
          </PartnerLink>
        ))}
      </div>
    </section>
  );
}
