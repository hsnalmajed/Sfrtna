// Collected by hand, not generated: each line was read on its source page.
//
// When each city is at its best, as the people who know it say — its
// tourism board where the board names months, and otherwise a travel guide
// with a named editorial team (Lonely Planet, Rough Guides). Each entry is
// the months the page names, its source, and the page itself, so anyone can
// open it and check. Read on 29 Sep 2026.
//
// How a page's words became months:
//   - Months named on the page are used as named ("March to May and
//     September to November" → 3,4,5,9,10,11).
//   - A season named without months ("spring and fall") takes the months the
//     source itself gives that season, or else the meteorological ones for
//     the city's hemisphere (spring March–May in the north, September–
//     November in the south).
//   - Where a page lists several "best for …" periods and no single overall
//     one, the period chosen is the one given for the weather or for general
//     sightseeing — not the one for festivals, budget, diving or skiing.
//   - `broad: true` marks a statement about a wider area than the city —
//     the country ("the best time to visit Indonesia"), a coast or a
//     region — that the city sits in. The page shows it as such.
//
// These months are not the last word on their own: citySeasons.ts drops any
// month whose recent weather contradicts it outright (see WEATHER_LIMITS
// there), and says so on the page.
//
// No entry is written without a source. These cities have none yet — no
// tourism board or guide we could find names months for them — and so show
// no season:
//   makkah, madinah, trabzon, bursa, sharjah, kuwait-city, manama,
//   nizwa, alexandria, fes, chefchaouen, lyon, marseille, granada,
//   cordoba, thessaloniki, salzburg, innsbruck, madeira, singapore,
//   tokyo, kyoto, osaka, hiroshima, guangzhou, guba, tbilisi,
//   johannesburg, durban, beirut, byblos, baalbek.

export type SeasonSourceKey =
  | "experienceOman"
  | "visitSaudi"
  | "rcu"
  | "goTurkiye"
  | "visitAbuDhabi"
  | "visitRak"
  | "visitQatar"
  | "visitJordan"
  | "visitKorea"
  | "tourismAustralia"
  | "queensland"
  | "georgiaTravel"
  | "lonelyPlanet"
  | "roughGuides";

export interface SeasonSource {
  nameAr: string;
  nameEn: string;
  /** A government tourism body, as against an independent guide. */
  official: boolean;
}

export const SEASON_SOURCES: Record<SeasonSourceKey, SeasonSource> = {
  experienceOman: { nameAr: "وزارة التراث والسياحة العُمانية (Experience Oman)", nameEn: "Oman Ministry of Heritage and Tourism (Experience Oman)", official: true },
  visitSaudi: { nameAr: "الهيئة السعودية للسياحة (روح السعودية)", nameEn: "Saudi Tourism Authority (Visit Saudi)", official: true },
  rcu: { nameAr: "الهيئة الملكية لمحافظة العُلا", nameEn: "Royal Commission for AlUla", official: true },
  goTurkiye: { nameAr: "وكالة الترويج السياحي التركية (GoTürkiye)", nameEn: "Türkiye Tourism Promotion Agency (GoTürkiye)", official: true },
  visitAbuDhabi: { nameAr: "دائرة الثقافة والسياحة – أبوظبي", nameEn: "Department of Culture and Tourism – Abu Dhabi", official: true },
  visitRak: { nameAr: "هيئة رأس الخيمة لتنمية السياحة", nameEn: "Ras Al Khaimah Tourism Development Authority", official: true },
  visitQatar: { nameAr: "قطر للسياحة (Visit Qatar)", nameEn: "Qatar Tourism (Visit Qatar)", official: true },
  visitJordan: { nameAr: "هيئة تنشيط السياحة الأردنية", nameEn: "Jordan Tourism Board", official: true },
  visitKorea: { nameAr: "منظمة السياحة الكورية (VisitKorea)", nameEn: "Korea Tourism Organization (VisitKorea)", official: true },
  tourismAustralia: { nameAr: "هيئة السياحة الأسترالية", nameEn: "Tourism Australia", official: true },
  queensland: { nameAr: "هيئة السياحة والفعاليات في كوينزلاند", nameEn: "Tourism and Events Queensland", official: true },
  georgiaTravel: { nameAr: "الإدارة الوطنية للسياحة في جورجيا", nameEn: "Georgian National Tourism Administration", official: true },
  lonelyPlanet: { nameAr: "دليل لونلي بلانيت", nameEn: "Lonely Planet", official: false },
  roughGuides: { nameAr: "دليل رف قايدز", nameEn: "Rough Guides", official: false },
};

export interface CitySeasonSource {
  /** The months the source names, 1–12. */
  months: number[];
  source: SeasonSourceKey;
  /** The page the months were read from. */
  url: string;
  /** The page speaks of the country or region, not the city by name. */
  broad?: boolean;
}

export const CITY_SEASON_SOURCES: Record<string, CitySeasonSource> = {
  "riyadh": { months: [1, 2, 3, 4, 5, 6, 12], source: "visitSaudi", url: "https://www.visitsaudi.com/en/stories/climate-and-seasons" },
  "jeddah": { months: [1, 2, 3, 9, 10, 11, 12], source: "visitSaudi", url: "https://www.visitsaudi.com/en/stories/climate-and-seasons" },
  "alula": { months: [1, 2, 3, 4, 10, 11, 12], source: "rcu", url: "https://www.rcu.gov.sa/en/visiting-alula" },
  "abha": { months: [6, 7, 8, 9], source: "visitSaudi", url: "https://www.visitsaudi.com/en/stories/climate-and-seasons", broad: true },
  "istanbul": { months: [3, 4, 5, 9, 10, 11], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-istanbul" },
  "antalya": { months: [3, 4, 5, 9, 10, 11], source: "roughGuides", url: "https://www.roughguides.com/turkey/when-to-go/", broad: true },
  "cappadocia": { months: [9, 10], source: "goTurkiye", url: "https://goturkiye.com/branding/press-releases/autumn-brings-out-the-best-of-cappadocia" },
  "izmir": { months: [3, 4, 5, 9, 10, 11], source: "roughGuides", url: "https://www.roughguides.com/turkey/when-to-go/", broad: true },
  "dubai": { months: [1, 2, 3, 4, 11, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-dubai" },
  "abu-dhabi": { months: [1, 2, 3, 4, 10, 11, 12], source: "visitAbuDhabi", url: "https://visitabudhabi.ae/en/plan-your-trip/article-hub/best-time-to-travel" },
  "ras-al-khaimah": { months: [1, 2, 3, 12], source: "visitRak", url: "https://visitrasalkhaimah.com/blog/ras-al-khaimah-weather/" },
  "doha": { months: [1, 2, 11, 12], source: "visitQatar", url: "https://visitqatar.com/intl-en/about-qatar/climate", broad: true },
  "al-wakrah": { months: [1, 2, 11, 12], source: "visitQatar", url: "https://visitqatar.com/intl-en/about-qatar/climate", broad: true },
  "muscat": { months: [1, 2, 3, 11, 12], source: "experienceOman", url: "https://experienceoman.om/weather" },
  "salalah": { months: [6, 7, 8, 9], source: "experienceOman", url: "https://experienceoman.om/weather" },
  "cairo": { months: [4, 5, 10, 11, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-cairo" },
  "luxor": { months: [1, 2, 10, 11, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-egypt" },
  "aswan": { months: [1, 2, 10, 11, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-egypt", broad: true },
  "sharm-el-sheikh": { months: [1, 2, 10, 11, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-egypt" },
  "marrakesh": { months: [3, 4, 5, 9, 10], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-marrakesh" },
  "casablanca": { months: [9], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-morocco" },
  "tangier": { months: [9], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-morocco" },
  "amman": { months: [3, 4, 5, 9, 10, 11], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-jordan", broad: true },
  "petra": { months: [3, 4, 5, 9, 10, 11], source: "visitJordan", url: "https://international.visitjordan.com/blog/external/7625/best-time-to-go-to-petra-jordan/" },
  "aqaba": { months: [9, 10, 11], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-jordan" },
  "london": { months: [6, 7, 8], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-london" },
  "edinburgh": { months: [6, 7, 8], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-edinburgh" },
  "manchester": { months: [6, 7, 8], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-the-uk", broad: true },
  "oxford": { months: [6, 7, 8], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-the-uk", broad: true },
  "paris": { months: [3, 4, 5, 9, 10], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-paris" },
  "nice": { months: [3, 4, 5, 9, 10, 11], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-nice" },
  "barcelona": { months: [3, 4, 5, 9, 10, 11], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-go-barcelona" },
  "madrid": { months: [2, 3, 4, 5], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-madrid" },
  "seville": { months: [5, 6, 9], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-seville" },
  "rome": { months: [3, 4, 5, 9, 10], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-rome" },
  "venice": { months: [3, 4], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-venice" },
  "florence": { months: [3, 4, 5], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-florence" },
  "milan": { months: [5, 6, 7, 8, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-milan" },
  "naples": { months: [4, 5, 9, 10], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-southern-italy", broad: true },
  "athens": { months: [4, 5, 9, 10], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-athens" },
  "santorini": { months: [5, 6, 9, 10], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-santorini" },
  "mykonos": { months: [5, 6, 9, 10], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-mykonos" },
  "zurich": { months: [6, 7, 8, 9], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/the-best-time-to-go-to-switzerland" },
  "geneva": { months: [6, 7, 8, 9], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/the-best-time-to-go-to-switzerland" },
  "interlaken": { months: [7, 8], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/the-best-time-to-go-to-switzerland" },
  "lucerne": { months: [6, 7, 8, 9], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/the-best-time-to-go-to-switzerland" },
  "vienna": { months: [9, 10, 11], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-vienna" },
  "amsterdam": { months: [6, 7, 8, 9], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-amsterdam" },
  "rotterdam": { months: [6, 7, 8], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-the-netherlands", broad: true },
  "the-hague": { months: [6, 7, 8], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-the-netherlands", broad: true },
  "berlin": { months: [3, 4, 5], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-berlin" },
  "munich": { months: [5, 6, 7, 8, 9], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-germany", broad: true },
  "hamburg": { months: [5, 6, 7, 8, 9], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-germany", broad: true },
  "frankfurt": { months: [5, 6, 7, 8, 9], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-germany", broad: true },
  "lisbon": { months: [4, 5, 9, 10], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-lisbon" },
  "porto": { months: [6, 7, 8, 9], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-porto" },
  "male": { months: [1, 2, 3], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-travel-to-maldives" },
  "colombo": { months: [1, 2, 3, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-sri-lanka", broad: true },
  "kandy": { months: [4, 9, 10], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-sri-lanka", broad: true },
  "galle": { months: [1, 2, 3, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-sri-lanka", broad: true },
  "ella": { months: [4, 9, 10], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-sri-lanka", broad: true },
  "bali": { months: [4, 5, 6, 7, 8, 9, 10], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-indonesia", broad: true },
  "ubud": { months: [4, 5, 6, 7, 8, 9, 10], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-indonesia", broad: true },
  "jakarta": { months: [4, 5, 6, 7, 8, 9, 10], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-indonesia", broad: true },
  "yogyakarta": { months: [4, 5, 6, 7, 8, 9, 10], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-indonesia", broad: true },
  "bangkok": { months: [1, 2, 11, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-bangkok" },
  "phuket": { months: [1, 2, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-thailand" },
  "chiang-mai": { months: [1, 11, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-chiang-mai" },
  "pattaya": { months: [1, 2, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-thailand", broad: true },
  "kuala-lumpur": { months: [6, 7, 8, 9], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-malaysia" },
  "penang": { months: [1, 2, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-malaysia" },
  "langkawi": { months: [1, 2, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-malaysia" },
  "malacca": { months: [10, 11], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-malaysia" },
  "seoul": { months: [3, 4, 5, 9, 10, 11], source: "visitKorea", url: "https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=140636", broad: true },
  "busan": { months: [3, 4, 5, 9, 10, 11], source: "visitKorea", url: "https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=140636", broad: true },
  "jeju": { months: [3, 4, 5, 9, 10, 11], source: "visitKorea", url: "https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=140636", broad: true },
  "beijing": { months: [3, 4, 5, 9, 10], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-china" },
  "shanghai": { months: [3, 4, 5], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-china" },
  "xian": { months: [3, 4, 5], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-china" },
  "hanoi": { months: [1, 2, 3, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-vietnam" },
  "ho-chi-minh-city": { months: [1, 2, 3, 4, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-hcmc" },
  "da-nang": { months: [2, 3, 4, 5, 6], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-vietnam" },
  "hoi-an": { months: [1, 2, 3], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-vietnam" },
  "delhi": { months: [1, 2, 3, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-india" },
  "agra": { months: [1, 2, 3, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-india", broad: true },
  "jaipur": { months: [1, 2, 3, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-india", broad: true },
  "mumbai": { months: [1, 2, 3, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-india" },
  "goa": { months: [1, 2, 3, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-india", broad: true },
  "new-york": { months: [6, 7, 8], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-new-york-city" },
  "los-angeles": { months: [9, 10, 11], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/when-to-visit-los-angeles" },
  "las-vegas": { months: [3, 4, 5, 9, 10, 11], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-las-vegas" },
  "san-francisco": { months: [8, 9, 10], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/when-to-visit-san-francisco" },
  "miami": { months: [1, 2, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-miami" },
  "baku": { months: [9, 10], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-azerbaijan" },
  "gabala": { months: [9, 10], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-azerbaijan" },
  "batumi": { months: [9, 10], source: "georgiaTravel", url: "https://georgia.travel/en_US/article/why-its-worth-to-travel-to-georgia-in-autumn" },
  "kazbegi": { months: [7, 8], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/caucasus-seasons-georgia-round-year", broad: true },
  "cape-town": { months: [1, 2, 3, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-cape-town" },
  "nairobi": { months: [1, 2], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-kenya" },
  "mombasa": { months: [1, 2], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-kenya" },
  "mexico-city": { months: [3, 4, 5], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-mexico-city" },
  "cancun": { months: [1, 2, 3, 4, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-cancun" },
  "guadalajara": { months: [10, 11, 12], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-guadalajara" },
  "rio-de-janeiro": { months: [10, 11], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-brazil", broad: true },
  "sao-paulo": { months: [10, 11], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-brazil", broad: true },
  "salvador": { months: [10, 11], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-brazil", broad: true },
  "sydney": { months: [3, 4, 5, 9, 10, 11], source: "tourismAustralia", url: "https://www.australia.com/en-us/facts-and-planning/when-to-go/best-time-to-visit.html", broad: true },
  "melbourne": { months: [3, 4, 5, 9, 10, 11], source: "tourismAustralia", url: "https://www.australia.com/en-us/facts-and-planning/when-to-go/best-time-to-visit.html", broad: true },
  "brisbane": { months: [3, 4, 5, 9, 10, 11], source: "tourismAustralia", url: "https://www.australia.com/en-us/facts-and-planning/when-to-go/best-time-to-visit.html", broad: true },
  "gold-coast": { months: [3, 4, 5], source: "queensland", url: "https://www.queensland.com/au/en/places-to-see/destinations/gold-coast/autumn-on-the-gold-coast" },
  "tunis": { months: [3, 4, 5], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-tunisia" },
  "sousse": { months: [3, 4, 5], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-tunisia" },
  "djerba": { months: [6, 7, 8], source: "lonelyPlanet", url: "https://www.lonelyplanet.com/articles/best-time-to-visit-tunisia" },
};
