/**
 * Our own hotel names: the part of the hotel-name search that never runs out.
 *
 * Most travellers type a hotel's name in Arabic, and the outside services
 * either do not understand Arabic (OpenStreetMap's search) or sell a monthly
 * allowance that can run dry (HERE, Google). So every hotel around our cities
 * is stored here — collected monthly from OpenStreetMap by
 * scripts/hotels/fetch-hotels.ts — and searched on our own server, with an
 * Arabic dictionary of hotel chains and words: «هيلتون إسطنبول» is read as
 * Hilton + Istanbul, «فندق ماريوت جدة» as Marriott + Jeddah.
 *
 * Shared by the collecting script (which writes the files) and the server
 * (which reads them), so both cut words and pick file names the same way.
 *
 * Files (served only to our own server through ASSETS; edge-worker.js answers
 * 404 to /data/* from outside):
 *   public/data/hotels/<city-slug>.json     the city's best hotels (city-only searches)
 *   public/data/hotel-words/<key>.json      every hotel, filed by the first two
 *                                           letters of each word in its names
 */

import { normalizeSearch } from "@/lib/search";

/**
 * One stored hotel: [city slug, name to show and search partners with (the
 * English one when there is one), Arabic name or "", stars or 0, the local
 * name when it differs from the shown one, or ""].
 */
export type StoredHotel = [string, string, string, number, string];

/** How many hotels a city file keeps (best first) for "a hotel in <city>". */
export const HOTELS_PER_CITY_FILE = 60;

/**
 * Words that say "a place to stay" rather than which one. Never used to pick
 * a file, and not required to match: «فندق هيلتون» finds "Hilton Istanbul
 * Bosphorus" although the word hotel is not in its name.
 */
const GENERIC = new Set(
  [
    "hotel", "hotels", "otel", "oteli", "hotell", "hostel", "inn", "motel", "suites", "suite",
    "resort", "resorts", "spa", "apartments", "apartment", "apart", "apts", "residence",
    "residences", "residency", "guest", "guesthouse", "house", "rooms", "room", "lodge",
    "the", "and", "by", "of", "at", "de", "la", "le", "el", "al", "&", "-", "–",
    "فندق", "فنادق", "الفندق", "اوتيل", "هوتيل", "منتجع", "المنتجع", "شقق", "شقه", "الشقق",
    "فندقيه", "اجنحه", "الاجنحه", "جناح", "نزل", "سكن", "مساكن", "استراحه", "بيت", "دار",
    "و", "في", "من",
  ].map((w) => normalizeSearch(w))
);

/**
 * Arabic words and hotel chains → how they are written in the hotel's own
 * (Latin) name. Keys are folded (normalizeSearch) when the map is built, so
 * «إنتركونتيننتال» and «انتركونتيننتال» are one key. Several Arabic spellings
 * of one chain are listed because travellers write them several ways.
 */
const DICTIONARY_SOURCE: Record<string, string[]> = {
  // Chains
  "هيلتون": ["hilton"],
  "هلتون": ["hilton"],
  "ماريوت": ["marriott"],
  "مريوت": ["marriott"],
  "ريتز": ["ritz"],
  "كارلتون": ["carlton"],
  "شيراتون": ["sheraton"],
  "ويستن": ["westin"],
  "وستن": ["westin"],
  "موفنبيك": ["movenpick", "mövenpick"],
  "موڤنبيك": ["movenpick"],
  "روتانا": ["rotana"],
  "انتركونتيننتال": ["intercontinental"],
  "انتركونتينتال": ["intercontinental"],
  "انتركونتننتال": ["intercontinental"],
  "كراون": ["crowne"],
  "بلازا": ["plaza"],
  "هوليداي": ["holiday"],
  "هوليدي": ["holiday"],
  "ان": ["inn"],
  "اكسبرس": ["express"],
  "حياه": ["hyatt"],
  "حيات": ["hyatt"],
  "ريجنسي": ["regency"],
  "جراند": ["grand"],
  "غراند": ["grand"],
  "بارك": ["park"],
  "فيرمونت": ["fairmont"],
  "فورسيزونز": ["four seasons"],
  "فورسيزون": ["four seasons"],
  "فور": ["four"],
  "سيزونز": ["seasons"],
  "رافلز": ["raffles"],
  "سويس": ["swiss", "swissotel", "swissôtel"],
  "سويسوتيل": ["swissotel", "swissôtel"],
  "سويس اوتيل": ["swissotel"],
  "نوفوتيل": ["novotel"],
  "ايبيس": ["ibis"],
  "ابيس": ["ibis"],
  "سوفيتيل": ["sofitel"],
  "بولمان": ["pullman"],
  "ميركيور": ["mercure"],
  "مركيور": ["mercure"],
  "راديسون": ["radisson"],
  "بلو": ["blu"],
  "ريد": ["red"],
  "جميرا": ["jumeirah"],
  "جميره": ["jumeirah"],
  "اتلانتس": ["atlantis"],
  "اتلانتيس": ["atlantis"],
  "اعمار": ["emaar"],
  "العنوان": ["address"],
  "فيدا": ["vida"],
  "روف": ["rove"],
  "كمبينسكي": ["kempinski"],
  "كمبنسكي": ["kempinski"],
  "شانغريلا": ["shangri-la", "shangri"],
  "شنغريلا": ["shangri-la", "shangri"],
  "ماندارين": ["mandarin"],
  "اورينتال": ["oriental"],
  "ريكسوس": ["rixos"],
  "ريكسس": ["rixos"],
  "دبل تري": ["doubletree"],
  "دبلتري": ["doubletree"],
  "كونراد": ["conrad"],
  "والدورف": ["waldorf"],
  "استوريا": ["astoria"],
  "سانت": ["st", "saint"],
  "ريجيس": ["regis"],
  "لو": ["le"],
  "ميريديان": ["meridien", "méridien"],
  "ميرديان": ["meridien"],
  "رينيسانس": ["renaissance"],
  "كورتيارد": ["courtyard"],
  "ريزيدنس": ["residence"],
  "فوربوينتس": ["four points"],
  "بوينتس": ["points"],
  "الوفت": ["aloft"],
  "ألوفت": ["aloft"],
  "دبليو": ["w"],
  "انديجو": ["indigo"],
  "ستايبريدج": ["staybridge"],
  "كانديوود": ["candlewood"],
  "بست": ["best"],
  "ويسترن": ["western"],
  "كوالتي": ["quality"],
  "كمفورت": ["comfort"],
  "رمادا": ["ramada"],
  "ويندام": ["wyndham"],
  "ديز": ["days"],
  "هوارد": ["howard"],
  "جونسون": ["johnson"],
  "ميلينيوم": ["millennium"],
  "ميلينيم": ["millennium"],
  "كوبثورن": ["copthorne"],
  "ليوناردو": ["leonardo"],
  "ميليا": ["melia", "meliá"],
  "باركرويال": ["parkroyal"],
  "بانيان": ["banyan"],
  "تري": ["tree"],
  "امان": ["aman"],
  "مينور": ["minor"],
  "انانتارا": ["anantara"],
  "اونانتارا": ["anantara"],
  "اوبروي": ["oberoi"],
  "تاج": ["taj"],
  "ليلا": ["leela"],
  "بيننسولا": ["peninsula"],
  "بنينسولا": ["peninsula"],
  "مكارم": ["makarem"],
  "دار التوحيد": ["dar al tawhid"],
  "التوحيد": ["tawhid"],
  "ايلاف": ["elaf"],
  "إيلاف": ["elaf"],
  "زمزم": ["zamzam"],
  "ابراج": ["towers", "tower"],
  "برج": ["tower", "burj"],
  "البيت": ["bait", "bayt"],
  "ساعه": ["clock"],
  "الساعه": ["clock"],
  "الصفا": ["safa"],
  "المروه": ["marwa", "marwah"],
  "الحرم": ["haram"],
  "دار الهجره": ["dar al hijra"],
  "الهجره": ["hijra"],
  "الانصار": ["ansar"],
  "المدينه": ["madinah", "medina"],
  "مكه": ["makkah", "mecca"],
  "رافال": ["rafal"],
  "نارسس": ["narcissus"],
  "نارسيس": ["narcissus"],
  "الفيصليه": ["al faisaliah", "faisaliah"],
  "المملكه": ["kingdom"],
  "بودل": ["boudl"],
  "الخزامى": ["khozama"],
  "الخزامي": ["khozama"],
  "ديار": ["diyar"],
  "مساكن": ["masakin"],
  "وندام": ["wyndham"],
  "جولدن": ["golden"],
  "قولدن": ["golden"],
  "توليب": ["tulip"],
  "سما": ["sama", "samaa"],
  "سماء": ["sama", "samaa"],
  "سفير": ["safir"],
  "قصر": ["palace", "qasr", "kasr"],
  "القصر": ["palace"],
  "الشاطئ": ["beach"],
  "شاطئ": ["beach"],
  "بحر": ["sea"],
  "البحر": ["sea"],
  "مارينا": ["marina"],
  "داون تاون": ["downtown"],
  "داونتاون": ["downtown"],
  "سيتي": ["city"],
  "سنتر": ["centre", "center"],
  "رويال": ["royal"],
  "رويل": ["royal"],
  "ملكي": ["royal"],
  "امبريال": ["imperial"],
  "كونتيننتال": ["continental"],
  "انترناشيونال": ["international"],
  "بوتيك": ["boutique"],
  "ريزورت": ["resort"],
  "سبا": ["spa"],
  "فيو": ["view"],
  "فيلا": ["villa"],
  "فلل": ["villas"],
  "تاور": ["tower"],
  "تاورز": ["towers"],
  "بلس": ["plus"],
  "سويتس": ["suites"],
  "هايتس": ["heights"],
  "ستي": ["city"],
};

/** Folded Arabic word or phrase → Latin forms. */
const DICTIONARY: Map<string, string[]> = new Map(
  Object.entries(DICTIONARY_SOURCE)
    .filter(([k]) => /[؀-ۿ]/.test(k))
    .map(([k, v]) => [normalizeSearch(k), v.map((x) => normalizeSearch(x))])
);

/** The folded words of a text: lowercase, no accents, punctuation as spaces. */
export function words(text: string): string[] {
  return normalizeSearch(text)
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** «الهيلتون» is filed as «هيلتون»: the article is not part of the word. */
export function stem(word: string): string {
  return /^ال[؀-ۿ]{3,}$/.test(word) ? word.slice(2) : word;
}

export function isGeneric(word: string): boolean {
  if (GENERIC.has(word) || GENERIC.has(stem(word))) return true;
  // «وأجنحة», «والسبا»: the joined «و» (and) in front of a generic word.
  return word.startsWith("و") && word.length > 3 && (GENERIC.has(word.slice(1)) || GENERIC.has(stem(word.slice(1))));
}

/**
 * The file a word is kept in: its first two letters, written as code points
 * so Arabic and Latin both make plain file names ("68-69" for "hi…").
 */
export function shardKey(word: string): string | null {
  const w = stem(word);
  if (w.length < 2) return null;
  return [...w.slice(0, 2)].map((c) => c.codePointAt(0)!.toString(16)).join("-");
}

/** The words a hotel is filed under: every non-generic word of its names. */
export function indexWords(...names: string[]): string[] {
  const out = new Set<string>();
  for (const n of names) for (const w of words(n)) if (!isGeneric(w) && stem(w).length >= 2) out.add(stem(w));
  return [...out];
}

/**
 * What one typed word can mean in a hotel's name: as typed, without the
 * Arabic article, and its dictionary forms. Phrases in the dictionary
 * («دبل تري») are joined by the caller.
 */
export function wordForms(word: string): string[] {
  const forms = new Set<string>([word, stem(word)]);
  for (const v of DICTIONARY.get(word) ?? DICTIONARY.get(stem(word)) ?? []) {
    for (const part of [v, v.replace(/\s+/g, "")]) forms.add(part);
  }
  return [...forms].filter((f) => f.length > 0);
}

/** Two-word dictionary phrases («دبل تري» → doubletree), joined before matching. */
export function joinPhrases(ws: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < ws.length; i++) {
    const pair = i + 1 < ws.length ? `${ws[i]} ${ws[i + 1]}` : "";
    if (pair && DICTIONARY.has(pair)) {
      out.push(pair);
      i++;
    } else out.push(ws[i]);
  }
  return out;
}

export function dictionaryForms(phrase: string): string[] {
  return DICTIONARY.get(phrase) ?? [];
}
