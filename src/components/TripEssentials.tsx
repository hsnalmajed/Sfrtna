import PartnerLink from "@/components/PartnerLink";
import { essentialsFor, type EssentialKind } from "@/lib/tripEssentials";
import type { Locale } from "@/lib/types";

/**
 * "Get ready for <city>": mobile data, an airport driver, a rental car — one
 * card per need, with the partners we found a real page for in this city
 * (see tripEssentials.ts). Nothing shows for a need with no checked page.
 */
export default function TripEssentials({
  locale,
  countryCode,
  citySlug,
  cityName,
  countryName,
  t,
}: {
  locale: Locale;
  countryCode: string;
  citySlug: string;
  cityName: string;
  countryName: string;
  t: {
    essentialsTitle: string;
    essentialsSub: string;
    essentialEsimTitle: string;
    essentialEsimBody: string;
    essentialTransferTitle: string;
    essentialTransferBody: string;
    essentialCarTitle: string;
    essentialCarBody: string;
  };
}) {
  const groups = essentialsFor(countryCode, citySlug);
  if (!groups.length) return null;
  const copy: Record<EssentialKind, { icon: string; title: string; body: string }> = {
    esim: { icon: "📶", title: t.essentialEsimTitle.replace("{country}", countryName), body: t.essentialEsimBody },
    transfer: { icon: "🚖", title: t.essentialTransferTitle.replace("{city}", cityName), body: t.essentialTransferBody },
    car: { icon: "🚗", title: t.essentialCarTitle.replace("{city}", cityName), body: t.essentialCarBody },
  };
  return (
    <section className="mb-10" aria-labelledby="trip-essentials">
      <h2 id="trip-essentials" className="font-display text-xl font-extrabold text-navy-950 sm:text-2xl">
        {t.essentialsTitle.replace("{city}", cityName)}
      </h2>
      <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-navy-600">{t.essentialsSub}</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {groups.map((g) => (
          <div key={g.kind} className="flex flex-col rounded-2xl bg-white p-4 ring-1 ring-black/5 shadow-sm">
            <span className="text-2xl" aria-hidden="true">
              {copy[g.kind].icon}
            </span>
            <h3 className="mt-1 text-base font-extrabold text-navy-950">{copy[g.kind].title}</h3>
            <p className="mt-1 flex-1 text-sm leading-relaxed text-navy-600">{copy[g.kind].body}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {g.links.map((l) => (
                <PartnerLink
                  key={l.brand}
                  partner={l.brand}
                  href={l.href}
                  data-product={g.kind}
                  data-placement="trip_essentials"
                  className="inline-flex items-center gap-1 rounded-full bg-sea-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-sea-700"
                >
                  <span dir="ltr">{l.name}</span>
                  <span aria-hidden="true">{locale === "ar" ? "↖" : "↗"}</span>
                </PartnerLink>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
