// Where a traveller actually goes to get the visa.
//
// Two kinds of destination, and the difference matters:
//
//   1. The country's own government portal. Always the cheapest and the only
//      one that issues the visa itself. Every URL here is on a government-
//      controlled domain (.gov.xx / .go.xx / .govt.xx / a national portal),
//      because those cannot be registered by anyone else — which is the whole
//      defence against the fake-eVisa sites that charge people triple for a
//      form they could have filled in themselves.
//
//   2. Direct (visa.directksa.com), a Saudi agency that handles the paperwork
//      for a fee. Useful for the countries that need a full embassy
//      application with documents, appointments and biometrics.
//
// Every entry in both tables was checked to resolve before being added. An
// unverified visa link is worse than no link: a traveller who lands on the
// wrong "official" site pays a scammer. Countries whose portal we could not
// verify simply have no official link here, and fall back to the IATA and
// ministry links the interface always shows.
//
// This file is the whole of the site's visa data. We deliberately publish no
// status table ("visa-free", "on arrival", allowed stay): those rules change
// without notice and only the airline and the embassy decide them, so every
// country page sends the traveller to the two places that do know — IATA's
// Timatic database and the Saudi foreign ministry — plus the portal below
// where we have a verified one.

/** IATA Travel Centre — the Timatic database airlines check at boarding. */
export const IATA_TRAVEL_CENTRE_URL = "https://www.iatatravelcentre.com/";

/** The Saudi Ministry of Foreign Affairs. */
export const SAUDI_MOFA_URL = "https://www.mofa.gov.sa/";

/**
 * Official government visa portals, verified reachable.
 *
 * Deliberately roots, not deep paths — a government site reorganises its
 * pages far more often than it changes its domain, so a root link stays
 * correct for years while `/visas/getting-a-visa/visa-listing/601` rots.
 */
export const OFFICIAL_VISA_PORTALS: Record<string, string> = {
  TR: "https://www.evisa.gov.tr/",
  IN: "https://indianvisaonline.gov.in/evisa/",
  GB: "https://www.gov.uk/eta",
  GE: "https://www.evisa.gov.ge/",
  OM: "https://evisa.rop.gov.om/",
  VN: "https://evisa.gov.vn/",
  KR: "https://www.k-eta.go.kr/",
  EG: "https://visa2egypt.gov.eg/",
  KE: "https://www.etakenya.go.ke/",
  ET: "https://www.evisa.gov.et/",
  TZ: "https://visa.immigration.go.tz/",
  UG: "https://visas.immigration.go.ug/",
  JP: "https://www.evisa.mofa.go.jp/",
  ID: "https://evisa.imigrasi.go.id/",
  BH: "https://www.evisa.gov.bh/",
  QA: "https://hayya.qa/",
  NZ: "https://www.immigration.govt.nz/",
  AU: "https://immi.homeaffairs.gov.au/",
  TH: "https://www.thaievisa.go.th/",
  MY: "https://imigresen-online.imi.gov.my/",
  JO: "https://www.jordanpass.jo/",
  MA: "https://www.acces-maroc.ma/",
};

const DIRECT_BASE = "https://visa.directksa.com";

/**
 * Direct's own per-country requirement pages.
 *
 * The slugs come from their published sitemap rather than being guessed, so
 * every one of these is a page that exists. Their catalogue is the set of
 * visas they sell — around forty countries — not every country on earth,
 * which is why it sits beside the IATA and ministry links rather than
 * replacing them.
 */
export const DIRECT_VISA_SLUGS: Record<string, string> = {
  US: "US-Visa-Requirements",
  GB: "UK-Visa-Requirements",
  IT: "Italy-Visa-Requirements",
  IN: "India-Visa-Requirements",
  IE: "Ireland-Visa-Requirements",
  DE: "Germany-Visa-Requirements",
  FR: "France-Visa-Requirements",
  ES: "Spain-Visa-Requirements",
  NL: "Netherlands-Visa-Requirements",
  CH: "Switzerland-Visa-Requirements",
  SE: "Sweden-Visa-Requirements",
  AT: "Austria-Visa-Requirements",
  CZ: "Czech-Visa-Requirements",
  PT: "Portugal-Visa-Requirements",
  GR: "Greece-Visa-Requirements",
  DK: "Denmark-Visa-Requirements",
  AU: "Australia-Visa-Requirements",
  JP: "Japan-Online-Visa-Requirements",
  CN: "China-Visa-Requirements",
  NZ: "New-Zealand-Visa-Requirements",
  HU: "Hungary-Visa-Requirements",
  EG: "Egypt-Visa-Requirements",
  VN: "Vietnam-Visa-Requirements",
  KR: "South-Korea-Visa-Requirements",
  SG: "Singapore-Online-Visa-Requirements",
  NO: "Norway-Visa-Requirements",
  ID: "Indonesia-Visa-Requirements",
  MY: "Malaysia-Online-Visa-Requirements",
  TR: "Turkey-Resident-Visa-Requirements",
  TH: "Thailand-Visa-Requirements",
  KE: "Kenya-Online-Visa-Requirements",
  BG: "Bulgaria-Visa-Requirements",
  TZ: "Tanzania-Online-Visa-Requirements",
  UG: "Uganda-Online-Visa-Requirements",
  SC: "Seychelles-Visa-Requirements",
  CL: "Chile-Visa-Requirements",
  CU: "CU-Online-Visa-Requirements",
  KH: "CAM-Online-Visa-Requirements",
  DZ: "Algeria-Visa-Requirements",
  CY: "Cyprus-Visa-Requirements",
  MT: "Malta-Visa-Requirements",
  RU: "Russia-Visa-Requirements",
};

export function directVisaUrl(countryCode: string, locale: "ar" | "en"): string | undefined {
  const slug = DIRECT_VISA_SLUGS[countryCode];
  if (!slug) return undefined;
  return `${DIRECT_BASE}/${locale}/website/requirement/${slug}`;
}

export function officialVisaUrl(countryCode: string): string | undefined {
  return OFFICIAL_VISA_PORTALS[countryCode];
}

/**
 * A flag image, from a CDN that serves nothing but flags.
 *
 * Not the flag emoji: Windows ships no flag glyphs at all, so an emoji flag
 * renders there as two bare letters — and this grid is built around the flag
 * being the thing you recognise.
 */
export function flagImageUrl(countryCode: string, width: 80 | 160 = 160): string {
  return `https://flagcdn.com/w${width}/${countryCode.toLowerCase()}.png`;
}
