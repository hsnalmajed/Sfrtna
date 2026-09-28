// Entry status for a Saudi passport, country by country — from each
// country's own official source, never from an encyclopedia or a blog.
//
// This replaces the table that used to be parsed live from Wikipedia (removed
// on 25 Sep 2026 along with every status on the site). Each entry below was
// read on 26 Sep 2026 from the government page or official body named in
// `source`, and `quote` is what that page says — the page's own words, or,
// where the page is a list, what the list shows. Nothing is inferred from a
// neighbouring country or from general knowledge.
//
// A country we could not confirm from an official source is simply absent,
// and the visa directory leaves it out rather than show a status we cannot
// back. Still to confirm (their official pages blocked automated reading or
// did not name Saudi Arabia on 26 Sep 2026): IE, AU, JO, MA, BH, EG, ET, TZ,
// UG, CL, CU, KH, DZ, RU, TH.
//
// The four categories, easiest first — what a traveller has to do before
// flying:
//   free      no visa
//   arrival   visa issued on arrival (sometimes also online)
//   eta       an electronic visa or travel authorisation, applied for online
//   required  a visa applied for in advance
//
// Rules change without notice. Every page that shows a status also shows its
// source and the date it was checked, and still points to IATA's Travel
// Centre — the database airlines check at boarding.

export type VisaCategory = "free" | "arrival" | "eta" | "required";

export interface VisaStatus {
  category: VisaCategory;
  /** The official page the status was read from. */
  source: string;
  /** What that page says. */
  quote: string;
  /** Last day the stated arrangement is announced to run, when it has one. */
  until?: string;
}

export const VISA_CHECKED_AT = "2026-09-26";

export const VISA_ORDER: VisaCategory[] = ["free", "arrival", "eta", "required"];

export const VISA_STATUS: Record<string, VisaStatus> = {
  IT: { category: "required", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  DE: { category: "required", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  FR: { category: "required", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  ES: { category: "required", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  NL: { category: "required", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  CH: { category: "required", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  SE: { category: "required", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  AT: { category: "required", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  CZ: { category: "required", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  PT: { category: "required", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  GR: { category: "required", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  DK: { category: "required", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  HU: { category: "required", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  NO: { category: "required", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  BG: { category: "required", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  CY: { category: "required", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  MT: { category: "required", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  GB: { category: "eta", source: "https://homeofficemedia.blog.gov.uk/2024/02/01/electronic-travel-authorisation-eta-scheme-factsheet-february-2024/", quote: "\"Nationals of Qatar, Jordan, Saudi Arabia, Oman, Bahrain, Kuwait and the United Arab Emirates need an ETA to travel to the UK.\"" },
  TR: { category: "free", source: "https://www.mfa.gov.tr/visa-information-for-foreigners.en.mfa", quote: "\"Saudi Arabia: Ordinary and official passport holders are exempted from visa up to 90 days in any 180-day period.\"" },
  GE: { category: "free", source: "https://georgia.travel/coming-to-georgia/georgia-travel-visa-application", quote: "Georgian National Tourism Administration list \"Countries citizens which do not require a visa\" includes \"Saudi Arabia\"" },
  CN: { category: "free", source: "https://sa.china-embassy.gov.cn/eng/lsfw/202511/t20251104_11746345.htm", quote: "Chinese Embassy in KSA: unilateral visa exemption extended \"to 24:00 on December 31, 2026\"; list includes \"Saudi Arabia\"; stay \"no more than 30 days\"", until: "2026-12-31" },
  MY: { category: "free", source: "https://www.imi.gov.my/index.php/en/main-services/visa/visa-requirement-by-country/", quote: "Saudi Arabia is not on the Immigration Department's list \"Countries required to apply for a visa to enter Malaysia\"" },
  US: { category: "required", source: "https://travel.state.gov/content/travel/en/us-visas/tourism-visit/visa-waiver-program.html", quote: "Saudi Arabia is not among the Visa Waiver Program countries (list from travel.state.gov)" },
  JP: { category: "eta", source: "https://www.mofa.go.jp/j_info/visit/visa/visaonline.html", quote: "MOFA Japan: JAPAN eVISA eligible nationalities include \"Saudi Arabia\" (single-entry tourism, up to 90 days); Saudi Arabia is not on the visa-exemption list" },
  IN: { category: "eta", source: "https://indianvisaonline.gov.in/evisa/tvoa.html", quote: "Indian e-Visa eligible countries list: \"120. Saudi Arabia\"" },
  KR: { category: "eta", source: "https://www.k-eta.go.kr/portal/guide/viewetaalification.do", quote: "K-ETA eligible countries (visa-free with K-ETA): \"SAUDI ARABIA — Allowed Period of Stay : 30 Days\"" },
  ID: { category: "arrival", source: "https://evisa.imigrasi.go.id/front/info/evoa", quote: "Indonesian Immigration e-VoA/VoA eligible countries list includes \"Saudi Arabia\"" },
  VN: { category: "eta", source: "https://evisa.xuatnhapcanh.gov.vn/trang-chu-ttdt", quote: "Vietnam Immigration Department: E-visa \"valid for maximum of 90 days\"; conditions: \"Outside Vietnam foreigners; Holding valid passport\" (no nationality restriction)" },
  SG: { category: "free", source: "https://www.ica.gov.sg/enter-transit-depart/entering-singapore/visa_requirements", quote: "Saudi Arabia is not on ICA's list of nationalities that require a visa to enter Singapore (list runs \"Russia, Somalia\")" },
  NZ: { category: "eta", source: "https://www.immigration.govt.nz/visit/what-you-need-to-visit-new-zealand/visa-waiver-countries-and-territories/", quote: "Immigration New Zealand visa waiver list: \"San Marino, Saudi Arabia, Seychelles\" (visa waiver travellers need an NZeTA)" },
  QA: { category: "free", source: "https://www.visitqatar.com/intl-en/practical-info/visas", quote: "Visit Qatar (Qatar Tourism): \"Nationals of the Gulf Cooperation Council countries (Bahrain, Kuwait, Oman, Saudi Arabia and United Arab Emirates) do not require a visa to enter Qatar.\"" },
  OM: { category: "free", source: "https://www.fm.gov.om/en/visitors/entry-visas/", quote: "Oman MFA: \"Citizens of GCC countries (the Kingdom of Bahrain, the State of Kuwait, the State of Qatar, the Kingdom of Saudi Arabia and the United Arab Emirates) do not require visas to enter Oman.\"" },
  KE: { category: "eta", source: "https://www.etakenya.go.ke/", quote: "eTA Kenya (official): \"All travelers to Kenya are required to submit information prior to departure.\"" },
  SC: { category: "eta", source: "https://seychelles.govtas.com/", quote: "Seychelles Travel Authorisation (official): \"All travelers to the Seychelles are required to complete [a travel authorisation] prior to departure.\"" },
  // Added 28 Sep 2026 for the suggest-a-destination list.
  AE: { category: "free", source: "https://u.ae/en/information-and-services/visa-and-emirates-id/Visa-information/do-you-need-an-entry-permit-or-a-visa-to-enter-the-uae", quote: "UAE Government official platform: \"GCC citizens do not need a visa to enter the UAE.\"" },
  BH: { category: "free", source: "https://www.bahrainairport.bh/passports-visas", quote: "Bahrain Airport (official): \"All visitors entering the Kingdom of Bahrain need to obtain a visa, except for citizens of Gulf Cooperation Council (GCC) countries.\"" },
  AZ: { category: "free", source: "https://evisa.gov.az/en/countries", quote: "Azerbaijan official e-visa portal: \"from February 15, 2026 to February 15, 2027, citizens of the Kingdom of Saudi Arabia ... are eligible to enter the territory of the Republic of Azerbaijan visa-free 3 times within 1 year.\"", until: "2027-02-15" },
  EG: { category: "eta", source: "https://www.visa2egypt.gov.eg/eVisa/FAQ", quote: "Egypt e-Visa Portal (official): \"Nationals of the countries listed below may be issued with an e-Visa upon application\" — the list includes Saudi Arabia" },
  TH: { category: "free", source: "https://www.mfa.go.th/en/content/pb-summary-03092026-en", quote: "Thai MFA, revision of visa exemption schemes effective 15 September 2026: \"30-day visa exemption\" list includes \"Saudi Arabia\" (image.mfa.go.th summary, 22 May 2026)" },
};

export function visaStatusFor(code: string): VisaStatus | undefined {
  return VISA_STATUS[code.toUpperCase()];
}
