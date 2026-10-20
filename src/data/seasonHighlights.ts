// Collected by hand, not generated: each entry was read on its source page
// on 21 Oct 2026 — the city's or country's official tourism body, the event
// organiser, or (Khareef) the national newspaper quoting the official dates.
//
// What a month is *for*, beyond its weather (owner, 21 Oct 2026: "Norway in
// November–January is northern-lights season; December is Christmas; a snow
// country's snow months are its season"). A highlight month:
//   - shows its highlight on the season card («🌌 موسم الشفق القطبي»);
//   - is rated at least «وقت ممتاز للزيارة» unless a danger limit applies
//     (extreme heat, dangerous heat index, monsoon-scale rain);
//   - for a winter highlight (aurora, ski, Christmas markets, snow festival),
//     the cold limits do not lower it — the cold is the point — and the
//     weather line still says how cold it is.
//
// How dates became months: a month counts when the highlight runs through
// all or most of it on the source's own dates ("late August to early April"
// → September–March; markets from mid/late November to 24 December →
// December; "around the end of March" for blossoms → March and April).
// Events whose month moves from year to year (carnivals, Ramadan) are left
// out. No entry without a source.

export type HighlightKind = "aurora" | "christmas" | "ski" | "snowfest" | "blossom" | "foliage" | "flowers" | "festival" | "khareef";

/** Highlights during which the cold is the point: cold limits do not apply. */
export const WINTER_HIGHLIGHTS: HighlightKind[] = ["aurora", "christmas", "ski", "snowfest"];

export interface SeasonHighlight {
  kind: HighlightKind;
  /** City slugs (as in src/lib/cities.ts). */
  cities: string[];
  months: number[];
  source: { name: string; url: string };
}

export const HIGHLIGHT_LABEL: Record<HighlightKind, { ar: string; en: string; icon: string }> = {
  aurora: { ar: "موسم الشفق القطبي", en: "Northern lights season", icon: "🌌" },
  christmas: { ar: "أسواق الكريسماس", en: "Christmas markets", icon: "🎄" },
  ski: { ar: "موسم التزلج والثلج", en: "Ski and snow season", icon: "⛷️" },
  snowfest: { ar: "مهرجان الثلج", en: "Snow festival", icon: "❄️" },
  blossom: { ar: "تفتّح أزهار الكرز", en: "Cherry blossom season", icon: "🌸" },
  foliage: { ar: "ألوان الخريف", en: "Autumn colours", icon: "🍁" },
  flowers: { ar: "موسم الزهور والتوليب", en: "Tulip season", icon: "🌷" },
  festival: { ar: "موسم المهرجانات", en: "Festival season", icon: "🎭" },
  khareef: { ar: "موسم الخريف (الضباب والمطر الخفيف)", en: "Khareef season (mist and light rain)", icon: "🌫️" },
};

export const SEASON_HIGHLIGHTS: SeasonHighlight[] = [
  // "The northern lights can normally be seen in the Tromsø region from late August to early April."
  { kind: "aurora", cities: ["tromso"], months: [9, 10, 11, 12, 1, 2, 3], source: { name: "Visit Tromsø", url: "https://www.visittromso.no/northern-lights/faq" } },
  // "In Rovaniemi, the lights can be spotted in and around the city from late August until early April."
  { kind: "aurora", cities: ["rovaniemi"], months: [9, 10, 11, 12, 1, 2, 3], source: { name: "Visit Rovaniemi", url: "https://www.visitrovaniemi.fi/seasons/northern-lights-season/" } },
  // "during the winter time, especially on those clear, crisp nights" — winter months only.
  { kind: "aurora", cities: ["reykjavik"], months: [12, 1, 2], source: { name: "Visit Reykjavík", url: "https://www.visitreykjavik.is/northern-lights" } },

  // Christmas markets — December on every source's own dates.
  { kind: "christmas", cities: ["vienna"], months: [12], source: { name: "Austrian National Tourist Office", url: "https://www.austria.info/en-gb/highlights/christmas-markets-in-vienna/" } },
  { kind: "christmas", cities: ["prague"], months: [12], source: { name: "CzechTourism", url: "https://www.visitczechia.com/en-us/things-to-do/events/2026/11/e-christmas-markets-prague" } },
  { kind: "christmas", cities: ["munich"], months: [12], source: { name: "City of Munich", url: "https://christkindlmarkt-muenchen.de/en/home" } },
  { kind: "christmas", cities: ["cologne"], months: [12], source: { name: "Tourism NRW", url: "https://www.nrw-tourism.com/christmas-markets/christmas-market-at-cologne-cathedral" } },
  { kind: "christmas", cities: ["salzburg"], months: [12], source: { name: "Tourismus Salzburg", url: "https://www.salzburg.info/en/events/events-calendar/salzburg-christkindlmarket-on-dom-and-residenzplatz-square_event_42164399" } },
  { kind: "christmas", cities: ["strasbourg"], months: [12], source: { name: "Strasbourg Capitale de Noël", url: "https://noel.strasbourg.eu/en" } },

  // Ski seasons — whole months inside the resorts' published season.
  // Zermatt: "starts on 01 November 2026" and "ends on 03 May 2027".
  { kind: "ski", cities: ["zermatt"], months: [12, 1, 2, 3, 4], source: { name: "Matterhorn Glacier Paradise (Zermatt Bergbahnen)", url: "https://matterhornparadise.ch/en/information/tickets-prices/ski-passes" } },
  // Innsbruck region: resorts open late November; snow "until well into spring".
  { kind: "ski", cities: ["innsbruck"], months: [12, 1, 2, 3], source: { name: "Innsbruck Tourismus", url: "https://www.innsbruck.info/blog/en/food-drink/off-to-the-slopes-ski-winter-in-the-innsbruck-region/" } },
  // Banff: resorts "are open from November into May".
  { kind: "ski", cities: ["banff"], months: [12, 1, 2, 3, 4], source: { name: "Banff & Lake Louise Tourism", url: "https://www.banfflakelouise.com/blog/planning-guide-to-the-best-time-to-visit-banff-national-park" } },
  // Queenstown: "typically runs from mid-June to early October".
  { kind: "ski", cities: ["queenstown"], months: [7, 8, 9], source: { name: "Destination Queenstown", url: "https://www.queenstownnz.co.nz/things-to-do/skiing-and-snowboarding/" } },

  // Sapporo Snow Festival — early February (75th edition: 4–11 Feb 2025).
  { kind: "snowfest", cities: ["sapporo"], months: [2], source: { name: "Sapporo Snow Festival", url: "https://www.snowfes.com/en/" } },

  // "you can generally count on seeing them in Tokyo around the end of March";
  // Kyoto, Osaka and Fukuoka "follow a similar timeline".
  { kind: "blossom", cities: ["tokyo", "kyoto", "osaka", "fukuoka"], months: [3, 4], source: { name: "Japan National Tourism Organization", url: "https://www.japan.travel/en/guide/march/" } },
  // Kyoto: "the season starting in mid-November"; Tokyo ginkgo "from mid-November to early December".
  { kind: "foliage", cities: ["kyoto", "tokyo"], months: [11], source: { name: "Japan National Tourism Organization", url: "https://www.japan.travel/en/guide/november/" } },

  // Keukenhof: "In 2027, Keukenhof is open from Thursday, March 18 to Sunday, May 9."
  { kind: "flowers", cities: ["amsterdam"], months: [4], source: { name: "I amsterdam", url: "https://www.iamsterdam.com/en/see-and-do/things-to-do/attractions-and-sights/overview-of-attractions/keukenhof" } },
  // Oktoberfest 2027: 18 September – 3 October.
  { kind: "festival", cities: ["munich"], months: [9], source: { name: "City of Munich", url: "https://www.muenchen.de/veranstaltungen/oktoberfest/willkommen.html" } },
  // Fringe 7–31 Aug, International Festival 7–30 Aug, Tattoo 7–29 Aug 2026.
  { kind: "festival", cities: ["edinburgh"], months: [8], source: { name: "VisitScotland", url: "https://www.visitscotland.com/see-do/events/edinburgh-festivals-fringe/" } },

  // "The season officially starts on June 21 and continues until September 21."
  { kind: "khareef", cities: ["salalah"], months: [7, 8, 9], source: { name: "Oman Observer", url: "https://www.omanobserver.om/article/1121185/oman/dhofar-gears-up-to-receive-visitors-as-khareef-begins" } },
];

/** The highlights of one city, by month. */
export function highlightsFor(slug: string): Map<number, SeasonHighlight[]> {
  const out = new Map<number, SeasonHighlight[]>();
  for (const h of SEASON_HIGHLIGHTS) {
    if (!h.cities.includes(slug)) continue;
    for (const m of h.months) out.set(m, [...(out.get(m) ?? []), h]);
  }
  return out;
}
