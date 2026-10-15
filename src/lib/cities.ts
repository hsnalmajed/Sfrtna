// The main tourist cities of each country we have a guide for.
//
// This list is deliberately short and hand-checked: these are well-known
// cities, not an attempt at a complete gazetteer. Each one carries the exact
// English Wikipedia article title, which is what we resolve the city's real
// coordinates from — and those coordinates are then the centre of the
// GeoSearch that fills the city's map with hundreds of documented places.
//
// A wrong wikiTitle would put a city map in the wrong place, so the titles
// here are the canonical article names rather than colloquial spellings.

import { searchEquals } from "@/lib/search";

export interface CityEntry {
  /** URL segment — lowercase, hyphenated, unique within its country. */
  slug: string;
  nameAr: string;
  nameEn: string;
  /** Exact English Wikipedia article title, used to resolve coordinates. */
  wikiTitle: string;
}

export const COUNTRY_CITIES: Record<string, CityEntry[]> = {
  SA: [
    { slug: "riyadh", nameAr: "الرياض", nameEn: "Riyadh", wikiTitle: "Riyadh" },
    { slug: "jeddah", nameAr: "جدة", nameEn: "Jeddah", wikiTitle: "Jeddah" },
    { slug: "makkah", nameAr: "مكة المكرمة", nameEn: "Mecca", wikiTitle: "Mecca" },
    { slug: "madinah", nameAr: "المدينة المنورة", nameEn: "Medina", wikiTitle: "Medina" },
    { slug: "alula", nameAr: "العُلا", nameEn: "AlUla", wikiTitle: "Al-'Ula" },
    { slug: "abha", nameAr: "أبها", nameEn: "Abha", wikiTitle: "Abha" },
  ],
  TR: [
    { slug: "istanbul", nameAr: "إسطنبول", nameEn: "Istanbul", wikiTitle: "Istanbul" },
    { slug: "antalya", nameAr: "أنطاليا", nameEn: "Antalya", wikiTitle: "Antalya" },
    { slug: "cappadocia", nameAr: "كابادوكيا", nameEn: "Cappadocia", wikiTitle: "Cappadocia" },
    { slug: "trabzon", nameAr: "طرابزون", nameEn: "Trabzon", wikiTitle: "Trabzon" },
    { slug: "izmir", nameAr: "إزمير", nameEn: "İzmir", wikiTitle: "İzmir" },
    { slug: "bursa", nameAr: "بورصة", nameEn: "Bursa", wikiTitle: "Bursa" },
  ],
  AE: [
    { slug: "dubai", nameAr: "دبي", nameEn: "Dubai", wikiTitle: "Dubai" },
    { slug: "abu-dhabi", nameAr: "أبوظبي", nameEn: "Abu Dhabi", wikiTitle: "Abu Dhabi" },
    { slug: "sharjah", nameAr: "الشارقة", nameEn: "Sharjah", wikiTitle: "Sharjah" },
    { slug: "ras-al-khaimah", nameAr: "رأس الخيمة", nameEn: "Ras Al Khaimah", wikiTitle: "Ras Al Khaimah" },
  ],
  QA: [
    { slug: "doha", nameAr: "الدوحة", nameEn: "Doha", wikiTitle: "Doha" },
    { slug: "al-wakrah", nameAr: "الوكرة", nameEn: "Al Wakrah", wikiTitle: "Al Wakrah" },
  ],
  KW: [{ slug: "kuwait-city", nameAr: "مدينة الكويت", nameEn: "Kuwait City", wikiTitle: "Kuwait City" }],
  BH: [{ slug: "manama", nameAr: "المنامة", nameEn: "Manama", wikiTitle: "Manama" }],
  OM: [
    { slug: "muscat", nameAr: "مسقط", nameEn: "Muscat", wikiTitle: "Muscat" },
    { slug: "salalah", nameAr: "صلالة", nameEn: "Salalah", wikiTitle: "Salalah" },
    { slug: "nizwa", nameAr: "نزوى", nameEn: "Nizwa", wikiTitle: "Nizwa" },
  ],
  EG: [
    { slug: "cairo", nameAr: "القاهرة", nameEn: "Cairo", wikiTitle: "Cairo" },
    { slug: "luxor", nameAr: "الأقصر", nameEn: "Luxor", wikiTitle: "Luxor" },
    { slug: "aswan", nameAr: "أسوان", nameEn: "Aswan", wikiTitle: "Aswan" },
    { slug: "alexandria", nameAr: "الإسكندرية", nameEn: "Alexandria", wikiTitle: "Alexandria" },
    { slug: "sharm-el-sheikh", nameAr: "شرم الشيخ", nameEn: "Sharm El Sheikh", wikiTitle: "Sharm El Sheikh" },
  ],
  MA: [
    { slug: "marrakesh", nameAr: "مراكش", nameEn: "Marrakesh", wikiTitle: "Marrakesh" },
    { slug: "casablanca", nameAr: "الدار البيضاء", nameEn: "Casablanca", wikiTitle: "Casablanca" },
    { slug: "fes", nameAr: "فاس", nameEn: "Fez", wikiTitle: "Fez, Morocco" },
    { slug: "chefchaouen", nameAr: "شفشاون", nameEn: "Chefchaouen", wikiTitle: "Chefchaouen" },
    { slug: "tangier", nameAr: "طنجة", nameEn: "Tangier", wikiTitle: "Tangier" },
  ],
  JO: [
    { slug: "amman", nameAr: "عمّان", nameEn: "Amman", wikiTitle: "Amman" },
    { slug: "petra", nameAr: "البتراء", nameEn: "Petra", wikiTitle: "Petra" },
    { slug: "aqaba", nameAr: "العقبة", nameEn: "Aqaba", wikiTitle: "Aqaba" },
  ],
  GB: [
    { slug: "london", nameAr: "لندن", nameEn: "London", wikiTitle: "London" },
    { slug: "edinburgh", nameAr: "إدنبرة", nameEn: "Edinburgh", wikiTitle: "Edinburgh" },
    { slug: "manchester", nameAr: "مانشستر", nameEn: "Manchester", wikiTitle: "Manchester" },
    { slug: "oxford", nameAr: "أكسفورد", nameEn: "Oxford", wikiTitle: "Oxford" },
  ],
  FR: [
    { slug: "paris", nameAr: "باريس", nameEn: "Paris", wikiTitle: "Paris" },
    { slug: "nice", nameAr: "نيس", nameEn: "Nice", wikiTitle: "Nice" },
    { slug: "lyon", nameAr: "ليون", nameEn: "Lyon", wikiTitle: "Lyon" },
    { slug: "marseille", nameAr: "مرسيليا", nameEn: "Marseille", wikiTitle: "Marseille" },
  ],
  ES: [
    { slug: "barcelona", nameAr: "برشلونة", nameEn: "Barcelona", wikiTitle: "Barcelona" },
    { slug: "madrid", nameAr: "مدريد", nameEn: "Madrid", wikiTitle: "Madrid" },
    { slug: "granada", nameAr: "غرناطة", nameEn: "Granada", wikiTitle: "Granada" },
    { slug: "seville", nameAr: "إشبيلية", nameEn: "Seville", wikiTitle: "Seville" },
    { slug: "cordoba", nameAr: "قرطبة", nameEn: "Córdoba", wikiTitle: "Córdoba, Spain" },
  ],
  IT: [
    { slug: "rome", nameAr: "روما", nameEn: "Rome", wikiTitle: "Rome" },
    { slug: "venice", nameAr: "البندقية", nameEn: "Venice", wikiTitle: "Venice" },
    { slug: "florence", nameAr: "فلورنسا", nameEn: "Florence", wikiTitle: "Florence" },
    { slug: "milan", nameAr: "ميلانو", nameEn: "Milan", wikiTitle: "Milan" },
    { slug: "naples", nameAr: "نابولي", nameEn: "Naples", wikiTitle: "Naples" },
  ],
  GR: [
    { slug: "athens", nameAr: "أثينا", nameEn: "Athens", wikiTitle: "Athens" },
    { slug: "santorini", nameAr: "سانتوريني", nameEn: "Santorini", wikiTitle: "Santorini" },
    { slug: "mykonos", nameAr: "ميكونوس", nameEn: "Mykonos", wikiTitle: "Mykonos" },
    { slug: "thessaloniki", nameAr: "سالونيك", nameEn: "Thessaloniki", wikiTitle: "Thessaloniki" },
  ],
  CH: [
    { slug: "zurich", nameAr: "زيورخ", nameEn: "Zurich", wikiTitle: "Zürich" },
    { slug: "geneva", nameAr: "جنيف", nameEn: "Geneva", wikiTitle: "Geneva" },
    { slug: "interlaken", nameAr: "إنترلاكن", nameEn: "Interlaken", wikiTitle: "Interlaken" },
    { slug: "lucerne", nameAr: "لوسيرن", nameEn: "Lucerne", wikiTitle: "Lucerne" },
  ],
  AT: [
    { slug: "vienna", nameAr: "فيينا", nameEn: "Vienna", wikiTitle: "Vienna" },
    { slug: "salzburg", nameAr: "سالزبورغ", nameEn: "Salzburg", wikiTitle: "Salzburg" },
    { slug: "innsbruck", nameAr: "إنسبروك", nameEn: "Innsbruck", wikiTitle: "Innsbruck" },
  ],
  NL: [
    { slug: "amsterdam", nameAr: "أمستردام", nameEn: "Amsterdam", wikiTitle: "Amsterdam" },
    { slug: "rotterdam", nameAr: "روتردام", nameEn: "Rotterdam", wikiTitle: "Rotterdam" },
    { slug: "the-hague", nameAr: "لاهاي", nameEn: "The Hague", wikiTitle: "The Hague" },
  ],
  DE: [
    { slug: "berlin", nameAr: "برلين", nameEn: "Berlin", wikiTitle: "Berlin" },
    { slug: "munich", nameAr: "ميونخ", nameEn: "Munich", wikiTitle: "Munich" },
    { slug: "hamburg", nameAr: "هامبورغ", nameEn: "Hamburg", wikiTitle: "Hamburg" },
    { slug: "frankfurt", nameAr: "فرانكفورت", nameEn: "Frankfurt", wikiTitle: "Frankfurt" },
  ],
  PT: [
    { slug: "lisbon", nameAr: "لشبونة", nameEn: "Lisbon", wikiTitle: "Lisbon" },
    { slug: "porto", nameAr: "بورتو", nameEn: "Porto", wikiTitle: "Porto" },
    { slug: "madeira", nameAr: "ماديرا", nameEn: "Madeira", wikiTitle: "Funchal" },
  ],
  MV: [{ slug: "male", nameAr: "ماليه", nameEn: "Malé", wikiTitle: "Malé" }],
  LK: [
    { slug: "colombo", nameAr: "كولومبو", nameEn: "Colombo", wikiTitle: "Colombo" },
    { slug: "kandy", nameAr: "كاندي", nameEn: "Kandy", wikiTitle: "Kandy" },
    { slug: "galle", nameAr: "غالي", nameEn: "Galle", wikiTitle: "Galle" },
    { slug: "ella", nameAr: "إيلا", nameEn: "Ella", wikiTitle: "Ella, Sri Lanka" },
  ],
  ID: [
    { slug: "bali", nameAr: "بالي", nameEn: "Bali", wikiTitle: "Denpasar" },
    { slug: "ubud", nameAr: "أوبود", nameEn: "Ubud", wikiTitle: "Ubud" },
    { slug: "jakarta", nameAr: "جاكرتا", nameEn: "Jakarta", wikiTitle: "Jakarta" },
    { slug: "yogyakarta", nameAr: "يوغياكرتا", nameEn: "Yogyakarta", wikiTitle: "Yogyakarta" },
  ],
  TH: [
    { slug: "bangkok", nameAr: "بانكوك", nameEn: "Bangkok", wikiTitle: "Bangkok" },
    { slug: "phuket", nameAr: "بوكيت", nameEn: "Phuket", wikiTitle: "Phuket City" },
    { slug: "chiang-mai", nameAr: "شيانغ ماي", nameEn: "Chiang Mai", wikiTitle: "Chiang Mai" },
    { slug: "pattaya", nameAr: "باتايا", nameEn: "Pattaya", wikiTitle: "Pattaya" },
  ],
  MY: [
    { slug: "kuala-lumpur", nameAr: "كوالالمبور", nameEn: "Kuala Lumpur", wikiTitle: "Kuala Lumpur" },
    { slug: "penang", nameAr: "بينانغ", nameEn: "Penang", wikiTitle: "George Town, Penang" },
    { slug: "langkawi", nameAr: "لنكاوي", nameEn: "Langkawi", wikiTitle: "Langkawi" },
    { slug: "malacca", nameAr: "ملقا", nameEn: "Malacca", wikiTitle: "Malacca City" },
  ],
  SG: [{ slug: "singapore", nameAr: "سنغافورة", nameEn: "Singapore", wikiTitle: "Singapore" }],
  JP: [
    { slug: "tokyo", nameAr: "طوكيو", nameEn: "Tokyo", wikiTitle: "Tokyo" },
    { slug: "kyoto", nameAr: "كيوتو", nameEn: "Kyoto", wikiTitle: "Kyoto" },
    { slug: "osaka", nameAr: "أوساكا", nameEn: "Osaka", wikiTitle: "Osaka" },
    { slug: "hiroshima", nameAr: "هيروشيما", nameEn: "Hiroshima", wikiTitle: "Hiroshima" },
  ],
  KR: [
    { slug: "seoul", nameAr: "سيول", nameEn: "Seoul", wikiTitle: "Seoul" },
    { slug: "busan", nameAr: "بوسان", nameEn: "Busan", wikiTitle: "Busan" },
    { slug: "jeju", nameAr: "جيجو", nameEn: "Jeju", wikiTitle: "Jeju City" },
  ],
  CN: [
    { slug: "beijing", nameAr: "بكين", nameEn: "Beijing", wikiTitle: "Beijing" },
    { slug: "shanghai", nameAr: "شنغهاي", nameEn: "Shanghai", wikiTitle: "Shanghai" },
    { slug: "xian", nameAr: "شيان", nameEn: "Xi'an", wikiTitle: "Xi'an" },
    { slug: "guangzhou", nameAr: "قوانغتشو", nameEn: "Guangzhou", wikiTitle: "Guangzhou" },
  ],
  VN: [
    { slug: "hanoi", nameAr: "هانوي", nameEn: "Hanoi", wikiTitle: "Hanoi" },
    { slug: "ho-chi-minh-city", nameAr: "هو تشي منه", nameEn: "Ho Chi Minh City", wikiTitle: "Ho Chi Minh City" },
    { slug: "da-nang", nameAr: "دا نانغ", nameEn: "Da Nang", wikiTitle: "Da Nang" },
    { slug: "hoi-an", nameAr: "هوي آن", nameEn: "Hoi An", wikiTitle: "Hội An" },
  ],
  IN: [
    { slug: "delhi", nameAr: "دلهي", nameEn: "Delhi", wikiTitle: "New Delhi" },
    { slug: "agra", nameAr: "أغرا", nameEn: "Agra", wikiTitle: "Agra" },
    { slug: "jaipur", nameAr: "جايبور", nameEn: "Jaipur", wikiTitle: "Jaipur" },
    { slug: "mumbai", nameAr: "مومباي", nameEn: "Mumbai", wikiTitle: "Mumbai" },
    { slug: "goa", nameAr: "غوا", nameEn: "Goa", wikiTitle: "Panaji" },
  ],
  US: [
    { slug: "new-york", nameAr: "نيويورك", nameEn: "New York City", wikiTitle: "New York City" },
    { slug: "los-angeles", nameAr: "لوس أنجلوس", nameEn: "Los Angeles", wikiTitle: "Los Angeles" },
    { slug: "las-vegas", nameAr: "لاس فيغاس", nameEn: "Las Vegas", wikiTitle: "Las Vegas" },
    { slug: "san-francisco", nameAr: "سان فرانسيسكو", nameEn: "San Francisco", wikiTitle: "San Francisco" },
    { slug: "miami", nameAr: "ميامي", nameEn: "Miami", wikiTitle: "Miami" },
  ],
  AZ: [
    { slug: "baku", nameAr: "باكو", nameEn: "Baku", wikiTitle: "Baku" },
    { slug: "gabala", nameAr: "قبلة", nameEn: "Gabala", wikiTitle: "Qabala" },
    { slug: "guba", nameAr: "قوبا", nameEn: "Quba", wikiTitle: "Quba, Azerbaijan" },
  ],
  GE: [
    { slug: "tbilisi", nameAr: "تبليسي", nameEn: "Tbilisi", wikiTitle: "Tbilisi" },
    { slug: "batumi", nameAr: "باتومي", nameEn: "Batumi", wikiTitle: "Batumi" },
    { slug: "kazbegi", nameAr: "كازبيغي", nameEn: "Stepantsminda", wikiTitle: "Stepantsminda" },
  ],
  ZA: [
    { slug: "cape-town", nameAr: "كيب تاون", nameEn: "Cape Town", wikiTitle: "Cape Town" },
    { slug: "johannesburg", nameAr: "جوهانسبرغ", nameEn: "Johannesburg", wikiTitle: "Johannesburg" },
    { slug: "durban", nameAr: "ديربان", nameEn: "Durban", wikiTitle: "Durban" },
  ],
  KE: [
    { slug: "nairobi", nameAr: "نيروبي", nameEn: "Nairobi", wikiTitle: "Nairobi" },
    { slug: "mombasa", nameAr: "مومباسا", nameEn: "Mombasa", wikiTitle: "Mombasa" },
  ],
  MX: [
    { slug: "mexico-city", nameAr: "مكسيكو سيتي", nameEn: "Mexico City", wikiTitle: "Mexico City" },
    { slug: "cancun", nameAr: "كانكون", nameEn: "Cancún", wikiTitle: "Cancún" },
    { slug: "guadalajara", nameAr: "غوادالاخارا", nameEn: "Guadalajara", wikiTitle: "Guadalajara" },
  ],
  BR: [
    { slug: "rio-de-janeiro", nameAr: "ريو دي جانيرو", nameEn: "Rio de Janeiro", wikiTitle: "Rio de Janeiro" },
    { slug: "sao-paulo", nameAr: "ساو باولو", nameEn: "São Paulo", wikiTitle: "São Paulo" },
    { slug: "salvador", nameAr: "سلفادور", nameEn: "Salvador", wikiTitle: "Salvador, Bahia" },
  ],
  AU: [
    { slug: "sydney", nameAr: "سيدني", nameEn: "Sydney", wikiTitle: "Sydney" },
    { slug: "melbourne", nameAr: "ملبورن", nameEn: "Melbourne", wikiTitle: "Melbourne" },
    { slug: "brisbane", nameAr: "بريزبان", nameEn: "Brisbane", wikiTitle: "Brisbane" },
    { slug: "gold-coast", nameAr: "جولد كوست", nameEn: "Gold Coast", wikiTitle: "Gold Coast, Queensland" },
  ],
  TN: [
    { slug: "tunis", nameAr: "تونس العاصمة", nameEn: "Tunis", wikiTitle: "Tunis" },
    { slug: "sousse", nameAr: "سوسة", nameEn: "Sousse", wikiTitle: "Sousse" },
    { slug: "djerba", nameAr: "جربة", nameEn: "Djerba", wikiTitle: "Djerba" },
  ],
  LB: [
    { slug: "beirut", nameAr: "بيروت", nameEn: "Beirut", wikiTitle: "Beirut" },
    { slug: "byblos", nameAr: "جبيل", nameEn: "Byblos", wikiTitle: "Byblos" },
    { slug: "baalbek", nameAr: "بعلبك", nameEn: "Baalbek", wikiTitle: "Baalbek" },
  ],
  RU: [
    { slug: "moscow", nameAr: "موسكو", nameEn: "Moscow", wikiTitle: "Moscow" },
    { slug: "saint-petersburg", nameAr: "سانت بطرسبرغ", nameEn: "Saint Petersburg", wikiTitle: "Saint Petersburg" },
    { slug: "kazan", nameAr: "قازان", nameEn: "Kazan", wikiTitle: "Kazan" },
    { slug: "sochi", nameAr: "سوتشي", nameEn: "Sochi", wikiTitle: "Sochi" },
  ],
  BA: [
    { slug: "sarajevo", nameAr: "سراييفو", nameEn: "Sarajevo", wikiTitle: "Sarajevo" },
    { slug: "mostar", nameAr: "موستار", nameEn: "Mostar", wikiTitle: "Mostar" },
  ],
  AL: [
    { slug: "tirana", nameAr: "تيرانا", nameEn: "Tirana", wikiTitle: "Tirana" },
    { slug: "durres", nameAr: "دوريس", nameEn: "Durrës", wikiTitle: "Durrës" },
    { slug: "saranda", nameAr: "ساراندا", nameEn: "Sarandë", wikiTitle: "Sarandë" },
  ],
  ME: [
    { slug: "kotor", nameAr: "كوتور", nameEn: "Kotor", wikiTitle: "Kotor" },
    { slug: "budva", nameAr: "بودفا", nameEn: "Budva", wikiTitle: "Budva" },
    { slug: "podgorica", nameAr: "بودغوريتسا", nameEn: "Podgorica", wikiTitle: "Podgorica" },
  ],
  RS: [
    { slug: "belgrade", nameAr: "بلغراد", nameEn: "Belgrade", wikiTitle: "Belgrade" },
    { slug: "novi-sad", nameAr: "نوفي ساد", nameEn: "Novi Sad", wikiTitle: "Novi Sad" },
  ],
  HR: [
    { slug: "zagreb", nameAr: "زغرب", nameEn: "Zagreb", wikiTitle: "Zagreb" },
    { slug: "split", nameAr: "سبليت", nameEn: "Split", wikiTitle: "Split, Croatia" },
    { slug: "dubrovnik", nameAr: "دوبروفنيك", nameEn: "Dubrovnik", wikiTitle: "Dubrovnik" },
  ],
  CZ: [
    { slug: "prague", nameAr: "براغ", nameEn: "Prague", wikiTitle: "Prague" },
    { slug: "karlovy-vary", nameAr: "كارلوفي فاري", nameEn: "Karlovy Vary", wikiTitle: "Karlovy Vary" },
  ],
  HU: [
    { slug: "budapest", nameAr: "بودابست", nameEn: "Budapest", wikiTitle: "Budapest" },
  ],
  PL: [
    { slug: "warsaw", nameAr: "وارسو", nameEn: "Warsaw", wikiTitle: "Warsaw" },
    { slug: "krakow", nameAr: "كراكوف", nameEn: "Kraków", wikiTitle: "Kraków" },
    { slug: "zakopane", nameAr: "زاكوباني", nameEn: "Zakopane", wikiTitle: "Zakopane" },
  ],
  IE: [
    { slug: "dublin", nameAr: "دبلن", nameEn: "Dublin", wikiTitle: "Dublin" },
    { slug: "galway", nameAr: "غالواي", nameEn: "Galway", wikiTitle: "Galway" },
  ],
  BE: [
    { slug: "brussels", nameAr: "بروكسل", nameEn: "Brussels", wikiTitle: "Brussels" },
    { slug: "bruges", nameAr: "بروج", nameEn: "Bruges", wikiTitle: "Bruges" },
  ],
  SE: [
    { slug: "stockholm", nameAr: "ستوكهولم", nameEn: "Stockholm", wikiTitle: "Stockholm" },
  ],
  NO: [
    { slug: "oslo", nameAr: "أوسلو", nameEn: "Oslo", wikiTitle: "Oslo" },
    { slug: "bergen", nameAr: "بيرغن", nameEn: "Bergen", wikiTitle: "Bergen" },
    { slug: "tromso", nameAr: "ترومسو", nameEn: "Tromsø", wikiTitle: "Tromsø" },
  ],
  DK: [
    { slug: "copenhagen", nameAr: "كوبنهاغن", nameEn: "Copenhagen", wikiTitle: "Copenhagen" },
  ],
  FI: [
    { slug: "helsinki", nameAr: "هلسنكي", nameEn: "Helsinki", wikiTitle: "Helsinki" },
    { slug: "rovaniemi", nameAr: "روفانيمي", nameEn: "Rovaniemi", wikiTitle: "Rovaniemi" },
  ],
  SI: [
    { slug: "ljubljana", nameAr: "ليوبليانا", nameEn: "Ljubljana", wikiTitle: "Ljubljana" },
    { slug: "bled", nameAr: "بليد", nameEn: "Bled", wikiTitle: "Bled" },
  ],
  CY: [
    { slug: "larnaca", nameAr: "لارنكا", nameEn: "Larnaca", wikiTitle: "Larnaca" },
    { slug: "limassol", nameAr: "ليماسول", nameEn: "Limassol", wikiTitle: "Limassol" },
    { slug: "paphos", nameAr: "بافوس", nameEn: "Paphos", wikiTitle: "Paphos" },
  ],
  MT: [
    { slug: "valletta", nameAr: "فاليتا", nameEn: "Valletta", wikiTitle: "Valletta" },
  ],
  RO: [
    { slug: "bucharest", nameAr: "بوخارست", nameEn: "Bucharest", wikiTitle: "Bucharest" },
    { slug: "brasov", nameAr: "براشوف", nameEn: "Brașov", wikiTitle: "Brașov" },
  ],
  IS: [
    { slug: "reykjavik", nameAr: "ريكيافيك", nameEn: "Reykjavík", wikiTitle: "Reykjavík" },
  ],
  AM: [
    { slug: "yerevan", nameAr: "يريفان", nameEn: "Yerevan", wikiTitle: "Yerevan" },
  ],
  KZ: [
    { slug: "almaty", nameAr: "ألماتي", nameEn: "Almaty", wikiTitle: "Almaty" },
    { slug: "astana", nameAr: "أستانا", nameEn: "Astana", wikiTitle: "Astana" },
  ],
  UZ: [
    { slug: "tashkent", nameAr: "طشقند", nameEn: "Tashkent", wikiTitle: "Tashkent" },
    { slug: "samarkand", nameAr: "سمرقند", nameEn: "Samarkand", wikiTitle: "Samarkand" },
    { slug: "bukhara", nameAr: "بخارى", nameEn: "Bukhara", wikiTitle: "Bukhara" },
  ],
  KG: [
    { slug: "bishkek", nameAr: "بشكيك", nameEn: "Bishkek", wikiTitle: "Bishkek" },
    { slug: "karakol", nameAr: "كاراكول", nameEn: "Karakol", wikiTitle: "Karakol" },
  ],
  PK: [
    { slug: "islamabad", nameAr: "إسلام آباد", nameEn: "Islamabad", wikiTitle: "Islamabad" },
    { slug: "lahore", nameAr: "لاهور", nameEn: "Lahore", wikiTitle: "Lahore" },
  ],
  NP: [
    { slug: "kathmandu", nameAr: "كاتماندو", nameEn: "Kathmandu", wikiTitle: "Kathmandu" },
    { slug: "pokhara", nameAr: "بوكهارا", nameEn: "Pokhara", wikiTitle: "Pokhara" },
  ],
  PH: [
    { slug: "manila", nameAr: "مانيلا", nameEn: "Manila", wikiTitle: "Manila" },
    { slug: "cebu", nameAr: "سيبو", nameEn: "Cebu City", wikiTitle: "Cebu City" },
    { slug: "boracay", nameAr: "بوراكاي", nameEn: "Boracay", wikiTitle: "Boracay" },
  ],
  KH: [
    { slug: "siem-reap", nameAr: "سييم ريب", nameEn: "Siem Reap", wikiTitle: "Siem Reap" },
    { slug: "phnom-penh", nameAr: "بنوم بنه", nameEn: "Phnom Penh", wikiTitle: "Phnom Penh" },
  ],
  TZ: [
    { slug: "zanzibar", nameAr: "زنجبار", nameEn: "Zanzibar", wikiTitle: "Zanzibar City" },
    { slug: "arusha", nameAr: "أروشا", nameEn: "Arusha", wikiTitle: "Arusha" },
  ],
  MU: [
    { slug: "port-louis", nameAr: "بورت لويس", nameEn: "Port Louis", wikiTitle: "Port Louis" },
    { slug: "grand-baie", nameAr: "غراند باي", nameEn: "Grand Baie", wikiTitle: "Grand Baie" },
  ],
  SC: [
    { slug: "mahe", nameAr: "ماهي", nameEn: "Mahé", wikiTitle: "Mahé, Seychelles" },
  ],
  CA: [
    { slug: "toronto", nameAr: "تورونتو", nameEn: "Toronto", wikiTitle: "Toronto" },
    { slug: "vancouver", nameAr: "فانكوفر", nameEn: "Vancouver", wikiTitle: "Vancouver" },
    { slug: "montreal", nameAr: "مونتريال", nameEn: "Montreal", wikiTitle: "Montreal" },
    { slug: "banff", nameAr: "بانف", nameEn: "Banff", wikiTitle: "Banff, Alberta" },
  ],
};

export function findCity(countryCode: string, slug: string): CityEntry | undefined {
  return (COUNTRY_CITIES[countryCode.toUpperCase()] ?? []).find((c) => c.slug === slug);
}

/**
 * The guide entry for a city named in words rather than by slug.
 *
 * This is what turns a search into a place. Someone who searched for a flight
 * picked an airport, and an airport knows its city only as a name — "Istanbul",
 * "إسطنبول" — so linking them to that city's attractions means matching that
 * name against this list.
 *
 * Both spellings are compared under the site's own folding, because the
 * airport list and the city list were written by different hands: one says
 * "İzmir" with a dotted capital, the other may not, and a traveller should not
 * lose their city guide to a diacritic.
 *
 * Returns undefined rather than a near match. A wrong city here would show
 * someone Ankara's restaurants for a trip to Istanbul, which is worse than
 * falling back to the country.
 */
export function findCityByName(
  countryCode: string,
  ...names: (string | undefined | null)[]
): CityEntry | undefined {
  const cities = COUNTRY_CITIES[countryCode.toUpperCase()] ?? [];
  for (const name of names) {
    if (!name) continue;
    const match = cities.find(
      (c) => searchEquals(c.nameEn, name) || searchEquals(c.nameAr, name)
    );
    if (match) return match;
  }
  return undefined;
}
