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
// did not name Saudi Arabia on 26 Sep 2026; list updated 13 Oct 2026):
// TN (no Tunisian government page names Saudi Arabia; MA, TZ, KW, KH, JO
// confirmed 14 Oct; 27 batch-2 countries added 14 Oct), and the
// countries being added (scripts/coverage/report.md lists them).
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
  /** Day the source was read, when later than VISA_CHECKED_AT. */
  checked?: string;
  /** Last day the stated arrangement is announced to run, when it has one. */
  until?: string;
  /** An announced change: from that day this status replaces the one above. */
  then?: Omit<VisaStatus, "then"> & { from: string };
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
  AE: { category: "free", checked: "2026-09-28", source: "https://u.ae/en/information-and-services/visa-and-emirates-id/Visa-information/do-you-need-an-entry-permit-or-a-visa-to-enter-the-uae", quote: "UAE Government official platform: \"GCC citizens do not need a visa to enter the UAE.\"" },
  BH: { category: "free", checked: "2026-09-28", source: "https://www.bahrainairport.bh/passports-visas", quote: "Bahrain Airport (official): \"All visitors entering the Kingdom of Bahrain need to obtain a visa, except for citizens of Gulf Cooperation Council (GCC) countries.\"" },
  AZ: { category: "free", checked: "2026-09-28", source: "https://evisa.gov.az/en/countries", quote: "Azerbaijan official e-visa portal: \"from February 15, 2026 to February 15, 2027, citizens of the Kingdom of Saudi Arabia ... are eligible to enter the territory of the Republic of Azerbaijan visa-free 3 times within 1 year.\"", until: "2027-02-15" },
  EG: { category: "eta", checked: "2026-09-28", source: "https://www.visa2egypt.gov.eg/eVisa/FAQ", quote: "Egypt e-Visa Portal (official): \"Nationals of the countries listed below may be issued with an e-Visa upon application\" — the list includes Saudi Arabia" },
  TH: { category: "free", checked: "2026-09-28", source: "https://www.mfa.go.th/en/content/pb-summary-03092026-en", quote: "Thai MFA, revision of visa exemption schemes effective 15 September 2026: \"30-day visa exemption\" list includes \"Saudi Arabia\" (image.mfa.go.th summary, 22 May 2026)" },
  // Added 13 Oct 2026 (coverage section), each read that day on the page named.
  BE: { category: "required", checked: "2026-10-13", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  FI: { category: "required", checked: "2026-10-13", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  HR: { category: "required", checked: "2026-10-13", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  PL: { category: "required", checked: "2026-10-13", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  SI: { category: "required", checked: "2026-10-13", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  RO: { category: "required", checked: "2026-10-13", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  IS: { category: "required", checked: "2026-10-13", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  CA: { category: "required", checked: "2026-10-13", source: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/entry-requirements-country.html", quote: "IRCC: \"Saudi Arabia, Kingdom of\" is listed among countries whose citizens need a visitor visa; it is not on the eTA lists" },
  ZA: { category: "free", checked: "2026-10-13", source: "https://www.dha.gov.za/index.php/immigration-services/exempt-countries", quote: "Department of Home Affairs exemption list: \"Saudi Arabia (Kingdom of) 90 Days\"" },
  UZ: { category: "free", checked: "2026-10-13", source: "https://uzbekistan.travel/en/o/uzbekistan-introduces-visa-free-regime-citizens-saudi-arabia", quote: "National Tourism Information Centre of Uzbekistan (state): visa-free regime for Saudi citizens \"for a period of 30 days\" from 1 January 2023, with a return or onward ticket" },
  MV: { category: "arrival", checked: "2026-10-13", source: "https://immigration.gov.mv/visa/tourist-visa/", quote: "Maldives Immigration: \"Tourist visa is granted on arrival to the Maldives.\" (return ticket, booking and funds required)" },
  NP: { category: "arrival", checked: "2026-10-13", source: "https://www.immigration.gov.np/en/page/visa-on-arrival", quote: "Department of Immigration, Nepal: tourist visa on arrival at Tribhuvan International Airport and land borders; Saudi Arabia is not among the nationalities excluded" },
  LK: { category: "eta", checked: "2026-10-13", source: "https://www.eta.gov.lk/slvisa/visainfo/center.jsp?locale=en_US", quote: "Sri Lanka Department of Immigration: foreign nationals \"are required to obtain an Electronic Travel Authorization (ETA) prior to their arrival in Sri Lanka\"" },
  MX: { category: "required", checked: "2026-10-13", source: "https://embamex.sre.gob.mx/arabiasaudita/index.php/en/services/visa?id=123", quote: "Embassy of Mexico in Saudi Arabia: Saudi nationals apply for a visitor visa in person; the nationality \"is not exempted from the visitor visa\" (holders of some US, Canada, UK, Japan or Schengen visas may enter on those)" },
  PH: { category: "free", checked: "2026-10-13", source: "https://jeddahpcg.dfa.gov.ph/consular-services/visa", quote: "Philippine Consulate General, Jeddah: nationals \"including Saudi Arabia, may avail themselves of visa-free entry\" for stays up to 30 days" },
  KG: { category: "free", checked: "2026-10-13", source: "https://invest.gov.kg/visa-free-regime/", quote: "Kyrgyz Republic (invest.gov.kg): \"Kingdom of Saudi Arabia\" is in the list exempted from visa requirements for up to 60 days" },
  EE: { category: "required", checked: "2026-10-13", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  LT: { category: "required", checked: "2026-10-13", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  LV: { category: "required", checked: "2026-10-13", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  LU: { category: "required", checked: "2026-10-13", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  SK: { category: "required", checked: "2026-10-13", source: "https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:02018R1806-20251230", quote: "Regulation (EU) 2018/1806 consolidated 30.12.2025, Annex I (visa required) lists \"Saudi Arabia\"" },
  RS: { category: "required", checked: "2026-10-13", source: "https://mfa.gov.rs/en/citizens/travel-serbia/visa-regime/saudijska-arabija", quote: "Serbian MFA, Saudi Arabia: holders of ordinary passports — \"Visas required.\"" },
  BA: { category: "required", checked: "2026-10-13", source: "https://fipa.vijeceministara.gov.ba/en/visasinformation-for-visitors", quote: "Council of Ministers (FIPA): Saudi Arabia is not on the standing visa-exempt lists; a summer exemption (1 June – 30 September in 2025) allowed up to 30 days, and holders of a valid multiple-entry Schengen or EU visa may enter without one" },
  AL: { category: "free", checked: "2026-10-13", source: "https://punetejashtme.gov.al/en/?p=553", quote: "Albanian MFA: \"Nationals of Saudi Arabia and Qatar may travel visa-free, for tourism purposes only, from 15 April 2026 to 31 December 2026\"", until: "2026-12-31" },
  RU: { category: "free", checked: "2026-10-13", source: "https://www.arabnews.com/node/2643134/amp", quote: "Saudi Press Agency (via Arab News): the Saudi–Russian mutual visa exemption in force from 11 May 2026; stays of up to 90 days within a calendar year for tourism, business and family visits" },
  AU: { category: "required", checked: "2026-10-13", source: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/electronic-travel-authority-601", quote: "Department of Home Affairs: ETA eligible passports are listed (Andorra … Vatican City); Saudi Arabia is not among them, so a Visitor visa (subclass 600) is needed" },
  BR: { category: "required", checked: "2026-10-13", source: "https://cop30.br/pt-br/servicos-da-cop30/visto/2025-04_quadrogeral-regime-de-vistos_pt.pdf/@@download/file", quote: "Government of Brazil, Quadro Geral de Regime de Vistos (updated 8 Apr 2025): \"Arábia Saudita\" — visit visa \"1. Visto exigido\" (a 5-year multiple-entry visit visa under the 2019 Brazil–Saudi agreement)" },
  IE: { category: "required", checked: "2026-10-13", source: "https://assets.ireland.ie/documents/List_of_Visa_Required_Non_Visa_Required_Nationalities_-_May_2025.pdf", quote: "Government of Ireland, list of May 2025: Saudi Arabia is under \"Visa Required Nationalities\"" },
  KZ: { category: "free", checked: "2026-10-13", source: "https://aifc.kz/news/kazakhstan-government-sets-visa-free-regime-for-12-more-countries/", quote: "Astana International Financial Centre (state): Government decree of 30.09.2019 adds Saudi Arabia to the visa-free list — stays that do \"not exceed 30 calendar days\"" },
  LB: { category: "free", checked: "2026-10-13", source: "https://www.general-security.gov.lb/en/posts/38", quote: "General Security: citizens of the Gulf Cooperation Council, incl. \"Saudi Arabia\", arriving as tourists \"are exempted from entry visas\"; 6 months stamped free of charge at the border" },
  MU: { category: "free", checked: "2026-10-13", source: "https://passport.govmu.org/passport/wp-content/uploads/2021/03/Visa-Requirement-Country-22062022.pdf", quote: "Passport and Immigration Office, Visa Requirement Country-wise: Saudi Arabia — \"No visa required.\"" },
  PK: { category: "eta", checked: "2026-10-13", source: "https://parepjeddah.org/visa/", quote: "Consulate General of Pakistan, Jeddah: \"Visa-on-arrival (VOA) for 50 countries including Saudi Arabia\" with an \"Electronic Travel Authorization to be issued within 72 hours\" (30 days, multiple entries); apply at visa.nadra.gov.pk" },
  AM: { category: "eta", checked: "2026-10-13", source: "https://www.mfa.am/en/visa", quote: "Armenian MFA: Saudi Arabia is not on the visa-free list nor the invitation-only list; other passports \"are required to obtain an entry visa\" — \"To apply for E-VISA please visit https://evisa.mfa.am\"" },
  ME: { category: "free", checked: "2026-10-13", source: "https://www.slobodnaevropa.org/a/vize-crna-gora-rusija-kina-turska-/33816126.html", quote: "Government of Montenegro decree (reported by RFE/RL, 27 Jul 2026): Saudi citizens enter visa-free until 31 October 2026; a visa is required from 1 November 2026", until: "2026-10-31",
    then: { from: "2026-11-01", category: "required", source: "https://europeanwesternbalkans.com/2026/07/28/montenegro-introduces-visas-for-citizens-of-belarus-china-russia-saudi-arabia-and-turkiye/", quote: "Government of Montenegro decree aligning with EU visa policy: nationals of Saudi Arabia \"will require a visa to enter Montenegro as of 1 November 2026\"" } },
  MA: { category: "free", checked: "2026-10-14", source: "https://www.consulat.ma/fr/liste-des-pays-dont-les-ressortissants-sont-dispenses-du-visa-dentree-au-maroc", quote: "Moroccan MFA (consulat.ma), list of countries whose nationals are exempt from an entry visa: \"Arabie Saoudite\" (read 14 Oct 2026)" },
  TZ: { category: "arrival", checked: "2026-10-14", source: "https://visa.immigration.go.tz/guidelines", quote: "Tanzania Immigration Services, eVisa guidelines: \"Nationals from the listed countries below are eligible for both Online as well as on arrival Visa facility\" — the list includes Saudi Arabia (spelt \"Saud Arabia\" on the page; read 14 Oct 2026)" },
  KW: { category: "free", checked: "2026-10-14", source: "https://www.spa.gov.sa/2349663", quote: "Saudi General Directorate of Passports (via SPA, 28 Apr 2022): citizens can travel to the GCC states using the national ID card, checking the entry conditions of the destination (read 14 Oct 2026)" },
  KH: { category: "eta", checked: "2026-10-14", source: "https://www.evisa.gov.kh/", quote: "Cambodia MFA visa-exemption list (mfaic.gov.kh, 2025) does not include Saudi Arabia; the MFA's official e-Visa (Visa T, USD 30, stay 1 month) is applied for online with no nationality restriction stated (read 14 Oct 2026)" },
  JO: { category: "free", checked: "2026-10-14", source: "https://www.rj.com/en/travel-requirements-and-restrictions", quote: "Royal Jordanian (Jordan's national carrier), entry requirements for Jordan: \"GCC Countries do not require entry visas\" (read 14 Oct 2026; Jordan MOI pages do not list exempt nationalities)" },
  // Added 14 Oct 2026 (coverage batch 2), each read that day on the page named.
  HK: { category: "free", checked: "2026-10-14", source: "https://www.info.gov.hk/gia/general/202501/14/P2025011400185.htm", quote: "HKSAR Government press release, 14 Jan 2025: \"with effect from January 15, 2025, the visa-free period for nationals of Saudi Arabia ... to visit the HKSAR will be extended from 30 to 90 days\" (read 14 Oct 2026)" },
  AR: { category: "required", checked: "2026-10-14", source: "https://www.argentina.gob.ar/noticias/migraciones-anuncio-la-eximicion-de-visacion-consular-para-nacionales-del-reino-de-arabia", quote: "Argentine Government (Migraciones), 28 Nov 2024: consular visa waived for Saudi ordinary passports only for holders of a valid US visa, with an Electronic Travel Authorization (AVE); otherwise a consular visa is needed (read 14 Oct 2026)" },
  CO: { category: "required", checked: "2026-10-14", source: "https://www.cancilleria.gov.co/sites/default/files/FOTOS2025/Lista-Paises-exigen-visa-mayo-2026.pdf", quote: "Colombian MFA list (May 2026), column \"¿Colombia les exige visa para visitas cortas?\": Arabia Saudita \"SI\" (read 14 Oct 2026)" },
  PE: { category: "required", checked: "2026-10-14", source: "https://www.consulado.pe/Documents/visas/Requerimientos_de_visa_para_ciudadanos_extranjeros.pdf", quote: "Peruvian MFA consular list \"Requerimientos y exoneración de visas ... pasaportes ordinarios\": \"Reino de la Arabia Saudita SI SI\" (tourist and business visa required; read 14 Oct 2026)" },
  EC: { category: "free", checked: "2026-10-14", source: "https://www.cancilleria.gob.ec/2020/06/30/lista-de-paises-que-deben-presentar-visa-al-ingresar-al-ecuador/", quote: "Ecuadorian MFA \"Lista de países que deben presentar visa al ingresar al Ecuador\" (45 countries) does not include Saudi Arabia (read 14 Oct 2026)" },
  UY: { category: "required", checked: "2026-10-14", source: "https://www.gub.uy/ministerio-interior/comunicacion/publicaciones/regimen-visas-admision", quote: "Uruguay Ministry of the Interior, \"Régimen de visas de admisión\" (19 Aug 2025): \"Arabia Saudita | Necesita Visa (5)\" for ordinary passports, (5) = prior authorization (read 14 Oct 2026)" },
  CL: { category: "required", checked: "2026-10-14", source: "https://www.consulado.gob.cl/informacion-sobre-visas-para-ingresar-a-chile", quote: "Chilean MFA consular site, visa checker for Arabia Saudita: \"¿Requiere visa? SI\" — single-entry visa US$28 (read 14 Oct 2026)" },
  BO: { category: "required", checked: "2026-10-14", source: "https://www.embolivia.se/wp-content/uploads/2022/12/lista-de-paises-Gripo-I-II-III.pdf", quote: "Embassy of Bolivia, \"Relación de países que requieren visa de turismo para ingresar a Bolivia (sin consulta previa ...) Grupo II\": \"ARABIA SAUDITA\" (read 14 Oct 2026)" },
  DO: { category: "required", checked: "2026-10-14", source: "https://nld.mirex.gob.do/consular/amsterdam/listado-de-paises-y-condiciones-de-visado/", quote: "Dominican MFA (Consulate General, The Hague), section D \"¿Quiénes requieren VISA para entrar a la República Dominicana?\" lists Arabia Saudita (read 14 Oct 2026)" },
  JM: { category: "required", checked: "2026-10-14", source: "https://www.embassyofjamaica.org/ja_citizens/visa_country_listing.pdf", quote: "Embassy of Jamaica, \"Visa Requirements for ... Foreigners ... Entering Jamaica\" (updated 19 Jul 2023): \"SAUDI ARABIA YES\" (visa needed before arrival; read 14 Oct 2026)" },
  BS: { category: "required", checked: "2026-10-14", source: "https://mofa.gov.bs/consular-services/needs-visas-enter-bahamas/", quote: "Bahamas Ministry of Foreign Affairs, \"Who needs visas to enter The Bahamas\": list includes \"Saudi Arabia\" (read 14 Oct 2026)" },
  BZ: { category: "required", checked: "2026-10-14", source: "https://immigration.gov.bz/visa/visa-who-qualify/", quote: "Belize Immigration Department visa table: \"Saudi Arabia | YES\" (read 14 Oct 2026)" },
  SV: { category: "free", checked: "2026-10-14", source: "https://rree.gob.sv/visas/", quote: "El Salvador MFA visa checker, Arabia Saudita + ordinary passport: \"Usted no requiere Visa para visitar nuestro país.\" (read 14 Oct 2026)" },
  RW: { category: "arrival", checked: "2026-10-14", source: "https://www.migration.gov.rw/visa-on-arrival", quote: "Rwanda Directorate General of Immigration: \"Citizens of all countries are allowed to get visa upon arrival without prior application.\" (read 14 Oct 2026)" },
  ZW: { category: "required", checked: "2026-10-14", source: "https://www.zimimmigration.gov.zw/?p=7196", quote: "Zimbabwe Department of Immigration, Category C countries (10 Jun 2025): \"require to apply, make payment online and obtain a visa prior to travelling\" — list includes Saudi Arabia (read 14 Oct 2026)" },
  MZ: { category: "eta", checked: "2026-10-14", source: "https://www.mozambiquehighcommission.org.uk/visa-section.html", quote: "Mozambique High Commission (UK): Saudi Arabia among visa-exempt nationalities for 30 days (tourism/business), but must \"apply for prior authorization on https://evisa.gov.mz before traveling\" (read 14 Oct 2026)" },
  NA: { category: "required", checked: "2026-10-14", source: "https://namibiaembassyusa.org/wp-content/uploads/2025/10/Namibia-Visa-On-Arrival.pdf", quote: "Namibia Ministry of International Relations and Trade memo (17 Sep 2025), visa-on-arrival list (current + 35 added): Saudi Arabia not included (read 14 Oct 2026)" },
  BW: { category: "free", checked: "2026-10-14", source: "https://www.spa.gov.sa/30a4ef12db", quote: "Saudi Ministry of Interior via SPA (5 Nov 2013): \"Botswana's government has abolished the requirement to obtain an entry visa for Saudi nationals\" (read 14 Oct 2026)" },
  ET: { category: "arrival", checked: "2026-10-14", source: "https://www.evisa.gov.et/information/touristOnArrivalVisa", quote: "Ethiopia official e-Visa site, Tourist Visa on Arrival table: \"Saudi Arabia — Visa on Arrival\" (read 14 Oct 2026)" },
  ZM: { category: "free", checked: "2026-10-14", source: "https://www.zambiaimmigration.gov.zm/nationals-who-dont-require-visa/", quote: "Zambia Department of Immigration, \"Nationals Who Do Not Require Visa\": list includes \"Saudi Arabia\" (read 14 Oct 2026)" },
  MO: { category: "free", checked: "2026-10-14", source: "https://www.gov.mo/en/services/ps-1474/ps-1474b/", quote: "Macao SAR Government portal, \"Visa\" and \"Entry Permit\" exemption, item 15 (nationals exempted by the Chief Executive's directive): list includes \"Kingdom of Saudi Arabia\"; stay up to 30 days (read 14 Oct 2026)" },
  TW: { category: "required", checked: "2026-10-14", source: "https://roc-taiwan.org/sa_en/post/111.html", quote: "Taipei Economic and Cultural Representative Office in Saudi Arabia (MOFA ROC), \"Visa Requirements to Enter Taiwan\" (updated 29 Jun 2021): \"Passport Holders of KSA, GCC Countries ...\" apply for a visa — visitor visa SR 190 (read 14 Oct 2026)" },
  BT: { category: "eta", checked: "2026-10-14", source: "https://www.mfa.gov.bt/pmbg/visa/", quote: "Bhutan Ministry of Foreign Affairs: tourists need a visa \"excluding nationals of India, Bangladesh and Maldives\"; \"visas are processed through an online system by a licensed Bhutanese tour operator\" (read 14 Oct 2026)" },
  BD: { category: "required", checked: "2026-10-14", source: "https://voa.specialbranch.gov.bd/public/voa-info.html", quote: "Bangladesh Special Branch (Immigration), Visa on Arrival: Saudi citizens qualify only when travelling from a country with no Bangladesh embassy or consulate — Saudi Arabia has one, so a visa is obtained in advance (read 14 Oct 2026)" },
  BN: { category: "arrival", checked: "2026-10-14", source: "https://www.mfa.gov.bn/usa-washington/SitePages/Visa%20Application.aspx", quote: "Brunei Ministry of Foreign Affairs (Embassy in Washington), visa arrangements: \"Saudi Arabia | 30 Days (Visa on Arrival)\" (read 14 Oct 2026)" },
  MC: { category: "required", checked: "2026-10-14", source: "https://monaco-consulate.com/?p=877", quote: "Consulate General of Monaco: foreigners entering Monaco \"must have the document ... required for entry into French territory\" — for a Saudi passport, a Schengen visa (France: EU Regulation 2018/1806, Annex I) (read 14 Oct 2026)" },
  SN: { category: "required", checked: "2026-10-14", source: "https://consulsen-lyon.gouv.sn/visa/", quote: "Consulate General of Senegal (Lyon, gouv.sn): Arabie Saoudite in \"Catégorie B : Pays dont les ressortissants doivent\" obtain an entry visa (free) from a Senegalese embassy or consulate (read 14 Oct 2026)" },
};

/** The day this status was read from its source. */
export function visaCheckedAt(s: VisaStatus): string {
  return s.checked ?? VISA_CHECKED_AT;
}

export function visaStatusFor(code: string): VisaStatus | undefined {
  const s = VISA_STATUS[code.toUpperCase()];
  if (s?.then && new Date().toISOString().slice(0, 10) >= s.then.from) {
    const { from: _from, ...next } = s.then;
    void _from;
    return next;
  }
  return s;
}
