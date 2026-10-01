import type { Metadata } from "next";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import LegalPage from "@/components/LegalPage";
import { pageMetadata } from "@/lib/seo";
import { SEASONS_META } from "@/lib/travelSeason/site";

export async function generateMetadata({ params }: PageProps<"/[locale]/methodology/travel-seasons">): Promise<Metadata> {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const t = getDictionary(loc).travelSeasons;
  // Internal reference: how the ratings are made and from which data. Not
  // linked from the site and kept out of search results.
  return {
    ...pageMetadata({ locale: loc, path: "/methodology/travel-seasons", title: t.methodTitle, description: t.methodLead }),
    robots: { index: false, follow: false },
  };
}

const SOURCES = [
  {
    nameAr: "المعدلات المناخية الرسمية 1991–2020 لمحطات الرصد (هيئات الأرصاد الوطنية عبر WMO) — NOAA NCEI",
    nameEn: "WMO Climatological Standard Normals 1991–2020 (national weather services) — NOAA NCEI",
    url: "https://www.ncei.noaa.gov/products/wmo-climate-normals",
  },
  {
    nameAr: "بيانات ERA5-Land (سلسلة ساعية) — خدمة كوبرنيكوس لتغيّر المناخ",
    nameEn: "ERA5-Land hourly time-series — Copernicus Climate Change Service",
    url: "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land-timeseries",
  },
  {
    nameAr: "المعدلات المناخية المعيارية — المنظمة العالمية للأرصاد الجوية",
    nameEn: "Climatological standard normals — World Meteorological Organization",
    url: "https://community.wmo.int/site/knowledge-hub/programmes-and-initiatives/climate-services/wmo-climatological-normals",
  },
  {
    nameAr: "Muñoz Sabater وآخرون (2021): ERA5-Land، مجلة Earth System Science Data",
    nameEn: "Muñoz Sabater et al. (2021): ERA5-Land, Earth System Science Data",
    url: "https://essd.copernicus.org/articles/13/4349/2021/",
  },
  {
    nameAr: "NASA POWER — بديل حين يتعذّر ERA5-Land",
    nameEn: "NASA POWER — fallback where ERA5-Land cannot serve a city",
    url: "https://power.larc.nasa.gov",
  },
  {
    nameAr: "معادلة مؤشر الحرارة (الحرارة المحسوسة) — هيئة الأرصاد الأمريكية NOAA",
    nameEn: "Heat index equation — US National Weather Service (NOAA)",
    url: "https://www.wpc.ncep.noaa.gov/html/heatindex_equation.shtml",
  },
  {
    nameAr: "ارتفاعات سطح الأرض — OpenTopoData (بيانات SRTM وASTER)",
    nameEn: "Ground elevations — OpenTopoData (SRTM and ASTER data)",
    url: "https://www.opentopodata.org",
  },
];

/** How the travel-season ratings are made, in plain words, with the sources. */
export default async function TravelSeasonsMethodologyPage({ params }: PageProps<"/[locale]/methodology/travel-seasons">) {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const t = getDictionary(loc).travelSeasons;
  const isAr = loc === "ar";
  const updated = new Date(SEASONS_META.generatedAt).toLocaleDateString(isAr ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <LegalPage
      locale={loc}
      title={t.methodTitle}
      lead={t.methodLead}
      sections={[...t.methodSections]}
      lastUpdated={`${t.lastUpdatedLabel}: ${updated} · ${isAr ? "إصدار المنهجية" : "Methodology version"} ${SEASONS_META.scoringVersion}`}
    >
      <section className="mb-8 rounded-2xl bg-white p-5 ring-1 ring-mist-200">
        <h2 className="font-display text-lg font-extrabold text-navy-900">{t.methodSourcesTitle}</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {SOURCES.map((s) => (
            <li key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-bold text-sea-700 underline decoration-sea-300 underline-offset-2">
                {isAr ? s.nameAr : s.nameEn} <span aria-hidden="true">↗</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-navy-500">
          {isAr
            ? "يحتوي على معلومات معدّلة من خدمة كوبرنيكوس لتغيّر المناخ (رخصة CC-BY 4.0). لا تتحمل المفوضية الأوروبية ولا ECMWF مسؤولية أي استخدام لهذه المعلومات."
            : "Contains modified Copernicus Climate Change Service information (CC-BY 4.0). Neither the European Commission nor ECMWF is responsible for any use that may be made of it."}
        </p>
      </section>
    </LegalPage>
  );
}
