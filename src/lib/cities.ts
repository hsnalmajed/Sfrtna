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
    { slug: "dammam", nameAr: "الدمام", nameEn: "Dammam", wikiTitle: "Dammam" },
    { slug: "taif", nameAr: "الطائف", nameEn: "Taif", wikiTitle: "Taif" },
  ],
  TR: [
    { slug: "istanbul", nameAr: "إسطنبول", nameEn: "Istanbul", wikiTitle: "Istanbul" },
    { slug: "antalya", nameAr: "أنطاليا", nameEn: "Antalya", wikiTitle: "Antalya" },
    { slug: "cappadocia", nameAr: "كابادوكيا", nameEn: "Cappadocia", wikiTitle: "Cappadocia" },
    { slug: "trabzon", nameAr: "طرابزون", nameEn: "Trabzon", wikiTitle: "Trabzon" },
    { slug: "izmir", nameAr: "إزمير", nameEn: "İzmir", wikiTitle: "İzmir" },
    { slug: "bursa", nameAr: "بورصة", nameEn: "Bursa", wikiTitle: "Bursa" },
    { slug: "bodrum", nameAr: "بودروم", nameEn: "Bodrum", wikiTitle: "Bodrum" },
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
    { slug: "giza", nameAr: "الجيزة", nameEn: "Giza", wikiTitle: "Giza" },
    { slug: "hurghada", nameAr: "الغردقة", nameEn: "Hurghada", wikiTitle: "Hurghada" },
  ],
  MA: [
    { slug: "marrakesh", nameAr: "مراكش", nameEn: "Marrakesh", wikiTitle: "Marrakesh" },
    { slug: "casablanca", nameAr: "الدار البيضاء", nameEn: "Casablanca", wikiTitle: "Casablanca" },
    { slug: "fes", nameAr: "فاس", nameEn: "Fez", wikiTitle: "Fez, Morocco" },
    { slug: "chefchaouen", nameAr: "شفشاون", nameEn: "Chefchaouen", wikiTitle: "Chefchaouen" },
    { slug: "tangier", nameAr: "طنجة", nameEn: "Tangier", wikiTitle: "Tangier" },
    { slug: "agadir", nameAr: "أغادير", nameEn: "Agadir", wikiTitle: "Agadir" },
    { slug: "rabat", nameAr: "الرباط", nameEn: "Rabat", wikiTitle: "Rabat" },
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
    { slug: "glasgow", nameAr: "غلاسكو", nameEn: "Glasgow", wikiTitle: "Glasgow" },
    { slug: "belfast", nameAr: "بلفاست", nameEn: "Belfast", wikiTitle: "Belfast" },
    { slug: "birmingham", nameAr: "برمنغهام", nameEn: "Birmingham", wikiTitle: "Birmingham" },
  ],
  FR: [
    { slug: "paris", nameAr: "باريس", nameEn: "Paris", wikiTitle: "Paris" },
    { slug: "nice", nameAr: "نيس", nameEn: "Nice", wikiTitle: "Nice" },
    { slug: "lyon", nameAr: "ليون", nameEn: "Lyon", wikiTitle: "Lyon" },
    { slug: "marseille", nameAr: "مرسيليا", nameEn: "Marseille", wikiTitle: "Marseille" },
    { slug: "bordeaux", nameAr: "بوردو", nameEn: "Bordeaux", wikiTitle: "Bordeaux" },
    { slug: "strasbourg", nameAr: "ستراسبورغ", nameEn: "Strasbourg", wikiTitle: "Strasbourg" },
  ],
  ES: [
    { slug: "barcelona", nameAr: "برشلونة", nameEn: "Barcelona", wikiTitle: "Barcelona" },
    { slug: "madrid", nameAr: "مدريد", nameEn: "Madrid", wikiTitle: "Madrid" },
    { slug: "granada", nameAr: "غرناطة", nameEn: "Granada", wikiTitle: "Granada" },
    { slug: "seville", nameAr: "إشبيلية", nameEn: "Seville", wikiTitle: "Seville" },
    { slug: "cordoba", nameAr: "قرطبة", nameEn: "Córdoba", wikiTitle: "Córdoba, Spain" },
    { slug: "malaga", nameAr: "ملقة", nameEn: "Málaga", wikiTitle: "Málaga" },
    { slug: "ibiza", nameAr: "إيبيزا", nameEn: "Ibiza", wikiTitle: "Ibiza (town)" },
    { slug: "palma", nameAr: "بالما دي مايوركا", nameEn: "Palma de Mallorca", wikiTitle: "Palma de Mallorca" },
    { slug: "valencia", nameAr: "فالنسيا", nameEn: "Valencia", wikiTitle: "Valencia" },
  ],
  IT: [
    { slug: "rome", nameAr: "روما", nameEn: "Rome", wikiTitle: "Rome" },
    { slug: "venice", nameAr: "البندقية", nameEn: "Venice", wikiTitle: "Venice" },
    { slug: "florence", nameAr: "فلورنسا", nameEn: "Florence", wikiTitle: "Florence" },
    { slug: "milan", nameAr: "ميلانو", nameEn: "Milan", wikiTitle: "Milan" },
    { slug: "naples", nameAr: "نابولي", nameEn: "Naples", wikiTitle: "Naples" },
    { slug: "pisa", nameAr: "بيزا", nameEn: "Pisa", wikiTitle: "Pisa" },
    { slug: "bologna", nameAr: "بولونيا", nameEn: "Bologna", wikiTitle: "Bologna" },
    { slug: "palermo", nameAr: "باليرمو", nameEn: "Palermo", wikiTitle: "Palermo" },
  ],
  GR: [
    { slug: "athens", nameAr: "أثينا", nameEn: "Athens", wikiTitle: "Athens" },
    { slug: "santorini", nameAr: "سانتوريني", nameEn: "Santorini", wikiTitle: "Santorini" },
    { slug: "mykonos", nameAr: "ميكونوس", nameEn: "Mykonos", wikiTitle: "Mykonos" },
    { slug: "thessaloniki", nameAr: "سالونيك", nameEn: "Thessaloniki", wikiTitle: "Thessaloniki" },
    { slug: "heraklion", nameAr: "هيراكليون (كريت)", nameEn: "Heraklion (Crete)", wikiTitle: "Heraklion" },
    { slug: "rhodes", nameAr: "رودس", nameEn: "Rhodes", wikiTitle: "Rhodes (city)" },
    { slug: "corfu", nameAr: "كورفو", nameEn: "Corfu", wikiTitle: "Corfu (city)" },
  ],
  CH: [
    { slug: "zurich", nameAr: "زيورخ", nameEn: "Zurich", wikiTitle: "Zürich" },
    { slug: "geneva", nameAr: "جنيف", nameEn: "Geneva", wikiTitle: "Geneva" },
    { slug: "interlaken", nameAr: "إنترلاكن", nameEn: "Interlaken", wikiTitle: "Interlaken" },
    { slug: "lucerne", nameAr: "لوسيرن", nameEn: "Lucerne", wikiTitle: "Lucerne" },
    { slug: "lausanne", nameAr: "لوزان", nameEn: "Lausanne", wikiTitle: "Lausanne" },
    { slug: "zermatt", nameAr: "زيرمات", nameEn: "Zermatt", wikiTitle: "Zermatt" },
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
    { slug: "dusseldorf", nameAr: "دوسلدورف", nameEn: "Düsseldorf", wikiTitle: "Düsseldorf" },
    { slug: "cologne", nameAr: "كولونيا", nameEn: "Cologne", wikiTitle: "Cologne" },
  ],
  PT: [
    { slug: "lisbon", nameAr: "لشبونة", nameEn: "Lisbon", wikiTitle: "Lisbon" },
    { slug: "porto", nameAr: "بورتو", nameEn: "Porto", wikiTitle: "Porto" },
    { slug: "madeira", nameAr: "ماديرا", nameEn: "Madeira", wikiTitle: "Funchal" },
    { slug: "faro", nameAr: "فارو", nameEn: "Faro", wikiTitle: "Faro, Portugal" },
  ],
  MV: [
    { slug: "male", nameAr: "ماليه", nameEn: "Malé", wikiTitle: "Malé" },
    { slug: "maafushi", nameAr: "مافوشي", nameEn: "Maafushi", wikiTitle: "Maafushi" },
  ],
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
    { slug: "lombok", nameAr: "لومبوك", nameEn: "Lombok", wikiTitle: "Mataram (city)" },
    { slug: "labuan-bajo", nameAr: "لابوان باجو", nameEn: "Labuan Bajo", wikiTitle: "Labuan Bajo" },
  ],
  TH: [
    { slug: "bangkok", nameAr: "بانكوك", nameEn: "Bangkok", wikiTitle: "Bangkok" },
    { slug: "phuket", nameAr: "بوكيت", nameEn: "Phuket", wikiTitle: "Phuket City" },
    { slug: "chiang-mai", nameAr: "شيانغ ماي", nameEn: "Chiang Mai", wikiTitle: "Chiang Mai" },
    { slug: "pattaya", nameAr: "باتايا", nameEn: "Pattaya", wikiTitle: "Pattaya" },
    { slug: "krabi", nameAr: "كرابي", nameEn: "Krabi", wikiTitle: "Krabi (town)" },
    { slug: "koh-samui", nameAr: "كوه ساموي", nameEn: "Ko Samui", wikiTitle: "Ko Samui" },
  ],
  MY: [
    { slug: "kuala-lumpur", nameAr: "كوالالمبور", nameEn: "Kuala Lumpur", wikiTitle: "Kuala Lumpur" },
    { slug: "penang", nameAr: "بينانغ", nameEn: "Penang", wikiTitle: "George Town, Penang" },
    { slug: "langkawi", nameAr: "لنكاوي", nameEn: "Langkawi", wikiTitle: "Langkawi" },
    { slug: "malacca", nameAr: "ملقا", nameEn: "Malacca", wikiTitle: "Malacca City" },
    { slug: "kota-kinabalu", nameAr: "كوتا كينابالو", nameEn: "Kota Kinabalu", wikiTitle: "Kota Kinabalu" },
  ],
  SG: [{ slug: "singapore", nameAr: "سنغافورة", nameEn: "Singapore", wikiTitle: "Singapore" }],
  JP: [
    { slug: "tokyo", nameAr: "طوكيو", nameEn: "Tokyo", wikiTitle: "Tokyo" },
    { slug: "kyoto", nameAr: "كيوتو", nameEn: "Kyoto", wikiTitle: "Kyoto" },
    { slug: "osaka", nameAr: "أوساكا", nameEn: "Osaka", wikiTitle: "Osaka" },
    { slug: "hiroshima", nameAr: "هيروشيما", nameEn: "Hiroshima", wikiTitle: "Hiroshima" },
    { slug: "fukuoka", nameAr: "فوكوكا", nameEn: "Fukuoka", wikiTitle: "Fukuoka" },
    { slug: "okinawa", nameAr: "أوكيناوا", nameEn: "Okinawa", wikiTitle: "Naha" },
    { slug: "sapporo", nameAr: "سابورو", nameEn: "Sapporo", wikiTitle: "Sapporo" },
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
    { slug: "chengdu", nameAr: "تشنغدو", nameEn: "Chengdu", wikiTitle: "Chengdu" },
    { slug: "shenzhen", nameAr: "شينزن", nameEn: "Shenzhen", wikiTitle: "Shenzhen" },
  ],
  VN: [
    { slug: "hanoi", nameAr: "هانوي", nameEn: "Hanoi", wikiTitle: "Hanoi" },
    { slug: "ho-chi-minh-city", nameAr: "هو تشي منه", nameEn: "Ho Chi Minh City", wikiTitle: "Ho Chi Minh City" },
    { slug: "da-nang", nameAr: "دا نانغ", nameEn: "Da Nang", wikiTitle: "Da Nang" },
    { slug: "hoi-an", nameAr: "هوي آن", nameEn: "Hoi An", wikiTitle: "Hội An" },
    { slug: "nha-trang", nameAr: "نها ترانغ", nameEn: "Nha Trang", wikiTitle: "Nha Trang" },
    { slug: "phu-quoc", nameAr: "فو كوك", nameEn: "Phu Quoc", wikiTitle: "Phú Quốc" },
  ],
  IN: [
    { slug: "delhi", nameAr: "دلهي", nameEn: "Delhi", wikiTitle: "New Delhi" },
    { slug: "agra", nameAr: "أغرا", nameEn: "Agra", wikiTitle: "Agra" },
    { slug: "jaipur", nameAr: "جايبور", nameEn: "Jaipur", wikiTitle: "Jaipur" },
    { slug: "mumbai", nameAr: "مومباي", nameEn: "Mumbai", wikiTitle: "Mumbai" },
    { slug: "goa", nameAr: "غوا", nameEn: "Goa", wikiTitle: "Panaji" },
    { slug: "kochi", nameAr: "كوتشي", nameEn: "Kochi", wikiTitle: "Kochi" },
    { slug: "bengaluru", nameAr: "بنغالورو", nameEn: "Bengaluru", wikiTitle: "Bengaluru" },
  ],
  US: [
    { slug: "new-york", nameAr: "نيويورك", nameEn: "New York City", wikiTitle: "New York City" },
    { slug: "los-angeles", nameAr: "لوس أنجلوس", nameEn: "Los Angeles", wikiTitle: "Los Angeles" },
    { slug: "las-vegas", nameAr: "لاس فيغاس", nameEn: "Las Vegas", wikiTitle: "Las Vegas" },
    { slug: "san-francisco", nameAr: "سان فرانسيسكو", nameEn: "San Francisco", wikiTitle: "San Francisco" },
    { slug: "miami", nameAr: "ميامي", nameEn: "Miami", wikiTitle: "Miami" },
    { slug: "orlando", nameAr: "أورلاندو", nameEn: "Orlando", wikiTitle: "Orlando, Florida" },
    { slug: "chicago", nameAr: "شيكاغو", nameEn: "Chicago", wikiTitle: "Chicago" },
    { slug: "honolulu", nameAr: "هونولولو", nameEn: "Honolulu", wikiTitle: "Honolulu" },
    { slug: "boston", nameAr: "بوسطن", nameEn: "Boston", wikiTitle: "Boston" },
    { slug: "washington-dc", nameAr: "واشنطن العاصمة", nameEn: "Washington, D.C.", wikiTitle: "Washington, D.C." },
    { slug: "seattle", nameAr: "سياتل", nameEn: "Seattle", wikiTitle: "Seattle" },
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
    { slug: "kutaisi", nameAr: "كوتايسي", nameEn: "Kutaisi", wikiTitle: "Kutaisi" },
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
    { slug: "puerto-vallarta", nameAr: "بويرتو فالارتا", nameEn: "Puerto Vallarta", wikiTitle: "Puerto Vallarta" },
    { slug: "los-cabos", nameAr: "لوس كابوس", nameEn: "Los Cabos", wikiTitle: "Cabo San Lucas" },
  ],
  BR: [
    { slug: "rio-de-janeiro", nameAr: "ريو دي جانيرو", nameEn: "Rio de Janeiro", wikiTitle: "Rio de Janeiro" },
    { slug: "sao-paulo", nameAr: "ساو باولو", nameEn: "São Paulo", wikiTitle: "São Paulo" },
    { slug: "salvador", nameAr: "سلفادور", nameEn: "Salvador", wikiTitle: "Salvador, Bahia" },
    { slug: "foz-do-iguacu", nameAr: "فوز دو إيغواسو", nameEn: "Foz do Iguaçu", wikiTitle: "Foz do Iguaçu" },
    { slug: "florianopolis", nameAr: "فلوريانوبوليس", nameEn: "Florianópolis", wikiTitle: "Florianópolis" },
  ],
  AU: [
    { slug: "sydney", nameAr: "سيدني", nameEn: "Sydney", wikiTitle: "Sydney" },
    { slug: "melbourne", nameAr: "ملبورن", nameEn: "Melbourne", wikiTitle: "Melbourne" },
    { slug: "brisbane", nameAr: "بريزبان", nameEn: "Brisbane", wikiTitle: "Brisbane" },
    { slug: "gold-coast", nameAr: "جولد كوست", nameEn: "Gold Coast", wikiTitle: "Gold Coast, Queensland" },
    { slug: "perth", nameAr: "بيرث", nameEn: "Perth", wikiTitle: "Perth" },
    { slug: "adelaide", nameAr: "أديلايد", nameEn: "Adelaide", wikiTitle: "Adelaide" },
    { slug: "cairns", nameAr: "كيرنز", nameEn: "Cairns", wikiTitle: "Cairns" },
  ],
  TN: [
    { slug: "tunis", nameAr: "تونس العاصمة", nameEn: "Tunis", wikiTitle: "Tunis" },
    { slug: "sousse", nameAr: "سوسة", nameEn: "Sousse", wikiTitle: "Sousse" },
    { slug: "djerba", nameAr: "جربة", nameEn: "Djerba", wikiTitle: "Djerba" },
    { slug: "hammamet", nameAr: "الحمامات", nameEn: "Hammamet", wikiTitle: "Hammamet" },
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
    { slug: "brno", nameAr: "برنو", nameEn: "Brno", wikiTitle: "Brno" },
  ],
  HU: [
    { slug: "budapest", nameAr: "بودابست", nameEn: "Budapest", wikiTitle: "Budapest" },
  ],
  PL: [
    { slug: "warsaw", nameAr: "وارسو", nameEn: "Warsaw", wikiTitle: "Warsaw" },
    { slug: "krakow", nameAr: "كراكوف", nameEn: "Kraków", wikiTitle: "Kraków" },
    { slug: "zakopane", nameAr: "زاكوباني", nameEn: "Zakopane", wikiTitle: "Zakopane" },
    { slug: "gdansk", nameAr: "غدانسك", nameEn: "Gdańsk", wikiTitle: "Gdańsk" },
  ],
  IE: [
    { slug: "dublin", nameAr: "دبلن", nameEn: "Dublin", wikiTitle: "Dublin" },
    { slug: "galway", nameAr: "غالواي", nameEn: "Galway", wikiTitle: "Galway" },
    { slug: "cork", nameAr: "كورك", nameEn: "Cork", wikiTitle: "Cork (city)" },
  ],
  BE: [
    { slug: "brussels", nameAr: "بروكسل", nameEn: "Brussels", wikiTitle: "Brussels" },
    { slug: "bruges", nameAr: "بروج", nameEn: "Bruges", wikiTitle: "Bruges" },
  ],
  SE: [
    { slug: "stockholm", nameAr: "ستوكهولم", nameEn: "Stockholm", wikiTitle: "Stockholm" },
    { slug: "gothenburg", nameAr: "غوتنبرغ", nameEn: "Gothenburg", wikiTitle: "Gothenburg" },
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
    { slug: "osh", nameAr: "أوش", nameEn: "Osh", wikiTitle: "Osh" },
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
    { slug: "puerto-princesa", nameAr: "بويرتو برنسيسا", nameEn: "Puerto Princesa", wikiTitle: "Puerto Princesa" },
  ],
  KH: [
    { slug: "siem-reap", nameAr: "سييم ريب", nameEn: "Siem Reap", wikiTitle: "Siem Reap" },
    { slug: "phnom-penh", nameAr: "بنوم بنه", nameEn: "Phnom Penh", wikiTitle: "Phnom Penh" },
  ],
  TZ: [
    { slug: "zanzibar", nameAr: "زنجبار", nameEn: "Zanzibar", wikiTitle: "Zanzibar City" },
    { slug: "arusha", nameAr: "أروشا", nameEn: "Arusha", wikiTitle: "Arusha" },
    { slug: "dar-es-salaam", nameAr: "دار السلام", nameEn: "Dar es Salaam", wikiTitle: "Dar es Salaam" },
  ],
  MU: [
    { slug: "port-louis", nameAr: "بورت لويس", nameEn: "Port Louis", wikiTitle: "Port Louis" },
    { slug: "grand-baie", nameAr: "غراند باي", nameEn: "Grand Baie", wikiTitle: "Grand Baie" },
  ],
  SC: [
    { slug: "mahe", nameAr: "ماهي", nameEn: "Mahé", wikiTitle: "Mahé, Seychelles" },
    { slug: "praslin", nameAr: "براسلين", nameEn: "Praslin", wikiTitle: "Praslin" },
  ],
  CA: [
    { slug: "toronto", nameAr: "تورونتو", nameEn: "Toronto", wikiTitle: "Toronto" },
    { slug: "vancouver", nameAr: "فانكوفر", nameEn: "Vancouver", wikiTitle: "Vancouver" },
    { slug: "montreal", nameAr: "مونتريال", nameEn: "Montreal", wikiTitle: "Montreal" },
    { slug: "banff", nameAr: "بانف", nameEn: "Banff", wikiTitle: "Banff, Alberta" },
    { slug: "calgary", nameAr: "كالغاري", nameEn: "Calgary", wikiTitle: "Calgary" },
    { slug: "quebec-city", nameAr: "كيبيك", nameEn: "Quebec City", wikiTitle: "Quebec City" },
    { slug: "ottawa", nameAr: "أوتاوا", nameEn: "Ottawa", wikiTitle: "Ottawa" },
  ],
  BD: [
    { slug: "dhaka", nameAr: "دكا", nameEn: "Dhaka", wikiTitle: "Dhaka" },
  ],
  HK: [
    { slug: "hong-kong", nameAr: "هونغ كونغ", nameEn: "Hong Kong", wikiTitle: "Hong Kong" },
  ],
  MO: [
    { slug: "macau", nameAr: "ماكاو", nameEn: "Macau", wikiTitle: "Macau" },
  ],
  LA: [
    { slug: "luang-prabang", nameAr: "لوانغ برابانغ", nameEn: "Luang Prabang", wikiTitle: "Luang Prabang" },
    { slug: "vientiane", nameAr: "فينتيان", nameEn: "Vientiane", wikiTitle: "Vientiane" },
  ],
  BN: [
    { slug: "bandar-seri-begawan", nameAr: "بندر سري بيغاوان", nameEn: "Bandar Seri Begawan", wikiTitle: "Bandar Seri Begawan" },
  ],
  SK: [
    { slug: "bratislava", nameAr: "براتيسلافا", nameEn: "Bratislava", wikiTitle: "Bratislava" },
  ],
  LV: [
    { slug: "riga", nameAr: "ريغا", nameEn: "Riga", wikiTitle: "Riga" },
  ],
  LU: [
    { slug: "luxembourg", nameAr: "لوكسمبورغ", nameEn: "Luxembourg", wikiTitle: "Luxembourg City" },
  ],
  MC: [
    { slug: "monte-carlo", nameAr: "مونت كارلو", nameEn: "Monte Carlo", wikiTitle: "Monte Carlo" },
  ],
  ET: [
    { slug: "addis-ababa", nameAr: "أديس أبابا", nameEn: "Addis Ababa", wikiTitle: "Addis Ababa" },
  ],
  UG: [
    { slug: "entebbe", nameAr: "عنتيبي", nameEn: "Entebbe", wikiTitle: "Entebbe" },
  ],
  RW: [
    { slug: "kigali", nameAr: "كيغالي", nameEn: "Kigali", wikiTitle: "Kigali" },
  ],
  SN: [
    { slug: "dakar", nameAr: "داكار", nameEn: "Dakar", wikiTitle: "Dakar" },
  ],
  BW: [
    { slug: "gaborone", nameAr: "غابورون", nameEn: "Gaborone", wikiTitle: "Gaborone" },
  ],
  ZM: [
    { slug: "livingstone", nameAr: "ليفينغستون", nameEn: "Livingstone", wikiTitle: "Livingstone, Zambia" },
  ],
  MZ: [
    { slug: "maputo", nameAr: "مابوتو", nameEn: "Maputo", wikiTitle: "Maputo" },
  ],
  DO: [
    { slug: "punta-cana", nameAr: "بونتا كانا", nameEn: "Punta Cana", wikiTitle: "Punta Cana" },
    { slug: "santo-domingo", nameAr: "سانتو دومينغو", nameEn: "Santo Domingo", wikiTitle: "Santo Domingo" },
  ],
  JM: [
    { slug: "montego-bay", nameAr: "مونتيغو باي", nameEn: "Montego Bay", wikiTitle: "Montego Bay" },
    { slug: "kingston", nameAr: "كينغستون", nameEn: "Kingston", wikiTitle: "Kingston, Jamaica" },
  ],
  SV: [
    { slug: "san-salvador", nameAr: "سان سلفادور", nameEn: "San Salvador", wikiTitle: "San Salvador" },
  ],
  BZ: [
    { slug: "belize-city", nameAr: "مدينة بليز", nameEn: "Belize City", wikiTitle: "Belize City" },
  ],
  BS: [
    { slug: "nassau", nameAr: "ناساو", nameEn: "Nassau", wikiTitle: "Nassau, Bahamas" },
  ],
  AR: [
    { slug: "buenos-aires", nameAr: "بوينس آيرس", nameEn: "Buenos Aires", wikiTitle: "Buenos Aires" },
    { slug: "mendoza", nameAr: "مندوزا", nameEn: "Mendoza", wikiTitle: "Mendoza, Argentina" },
    { slug: "bariloche", nameAr: "باريلوتشي", nameEn: "Bariloche", wikiTitle: "San Carlos de Bariloche" },
    { slug: "el-calafate", nameAr: "إل كالافاتي", nameEn: "El Calafate", wikiTitle: "El Calafate" },
  ],
  CL: [
    { slug: "santiago", nameAr: "سانتياغو", nameEn: "Santiago", wikiTitle: "Santiago" },
    { slug: "easter-island", nameAr: "جزيرة القيامة", nameEn: "Easter Island", wikiTitle: "Hanga Roa" },
    { slug: "punta-arenas", nameAr: "بونتا أريناس", nameEn: "Punta Arenas", wikiTitle: "Punta Arenas" },
  ],
  PE: [
    { slug: "lima", nameAr: "ليما", nameEn: "Lima", wikiTitle: "Lima" },
    { slug: "arequipa", nameAr: "أريكيبا", nameEn: "Arequipa", wikiTitle: "Arequipa" },
  ],
  CO: [
    { slug: "bogota", nameAr: "بوغوتا", nameEn: "Bogotá", wikiTitle: "Bogotá" },
    { slug: "medellin", nameAr: "ميديلين", nameEn: "Medellín", wikiTitle: "Medellín" },
    { slug: "cartagena", nameAr: "قرطاجنة", nameEn: "Cartagena", wikiTitle: "Cartagena, Colombia" },
  ],
  EC: [
    { slug: "quito", nameAr: "كيتو", nameEn: "Quito", wikiTitle: "Quito" },
    { slug: "guayaquil", nameAr: "غواياكيل", nameEn: "Guayaquil", wikiTitle: "Guayaquil" },
    { slug: "galapagos", nameAr: "غالاباغوس", nameEn: "Galápagos", wikiTitle: "Puerto Ayora" },
  ],
  UY: [
    { slug: "montevideo", nameAr: "مونتيفيديو", nameEn: "Montevideo", wikiTitle: "Montevideo" },
    { slug: "punta-del-este", nameAr: "بونتا دل إستي", nameEn: "Punta del Este", wikiTitle: "Punta del Este" },
  ],
  BO: [
    { slug: "la-paz", nameAr: "لاباز", nameEn: "La Paz", wikiTitle: "La Paz" },
    { slug: "santa-cruz", nameAr: "سانتا كروز", nameEn: "Santa Cruz de la Sierra", wikiTitle: "Santa Cruz de la Sierra" },
  ],
  NZ: [
    { slug: "auckland", nameAr: "أوكلاند", nameEn: "Auckland", wikiTitle: "Auckland" },
    { slug: "christchurch", nameAr: "كرايستشيرش", nameEn: "Christchurch", wikiTitle: "Christchurch" },
    { slug: "queenstown", nameAr: "كوينزتاون", nameEn: "Queenstown", wikiTitle: "Queenstown, New Zealand" },
    { slug: "wellington", nameAr: "ويلينغتون", nameEn: "Wellington", wikiTitle: "Wellington" },
  ],
  FJ: [
    { slug: "nadi", nameAr: "نادي", nameEn: "Nadi", wikiTitle: "Nadi" },
    { slug: "suva", nameAr: "سوفا", nameEn: "Suva", wikiTitle: "Suva" },
  ],
  SB: [
    { slug: "honiara", nameAr: "هونيارا", nameEn: "Honiara", wikiTitle: "Honiara" },
  ],
  TW: [
    { slug: "taipei", nameAr: "تايبيه", nameEn: "Taipei", wikiTitle: "Taipei" },
  ],
  EE: [
    { slug: "tallinn", nameAr: "تالين", nameEn: "Tallinn", wikiTitle: "Tallinn" },
  ],
  LT: [
    { slug: "vilnius", nameAr: "فيلنيوس", nameEn: "Vilnius", wikiTitle: "Vilnius" },
  ],
  BG: [
    { slug: "sofia", nameAr: "صوفيا", nameEn: "Sofia", wikiTitle: "Sofia" },
    { slug: "varna", nameAr: "فارنا", nameEn: "Varna", wikiTitle: "Varna, Bulgaria" },
  ],
  NA: [
    { slug: "windhoek", nameAr: "ويندهوك", nameEn: "Windhoek", wikiTitle: "Windhoek" },
  ],
  ZW: [
    { slug: "victoria-falls", nameAr: "شلالات فيكتوريا", nameEn: "Victoria Falls", wikiTitle: "Victoria Falls (city)" },
  ],
  MK: [
    { slug: "skopje", nameAr: "سكوبيه", nameEn: "Skopje", wikiTitle: "Skopje" },
  ],
  SM: [
    { slug: "san-marino", nameAr: "سان مارينو", nameEn: "San Marino", wikiTitle: "City of San Marino" },
  ],
  VA: [
    { slug: "vatican-city", nameAr: "الفاتيكان", nameEn: "Vatican City", wikiTitle: "Vatican City" },
  ],
  AD: [
    { slug: "andorra-la-vella", nameAr: "أندورا لا فيلا", nameEn: "Andorra la Vella", wikiTitle: "Andorra la Vella" },
  ],
  DZ: [
    { slug: "algiers", nameAr: "الجزائر العاصمة", nameEn: "Algiers", wikiTitle: "Algiers" },
    { slug: "oran", nameAr: "وهران", nameEn: "Oran", wikiTitle: "Oran" },
  ],
  GH: [
    { slug: "accra", nameAr: "أكرا", nameEn: "Accra", wikiTitle: "Accra" },
  ],
  NG: [
    { slug: "lagos", nameAr: "لاغوس", nameEn: "Lagos", wikiTitle: "Lagos" },
  ],
  CV: [
    { slug: "sal", nameAr: "سال", nameEn: "Sal", wikiTitle: "Santa Maria, Cape Verde" },
  ],
  CU: [
    { slug: "havana", nameAr: "هافانا", nameEn: "Havana", wikiTitle: "Havana" },
    { slug: "varadero", nameAr: "فاراديرو", nameEn: "Varadero", wikiTitle: "Varadero" },
  ],
  CR: [
    { slug: "san-jose", nameAr: "سان خوسيه", nameEn: "San José", wikiTitle: "San José, Costa Rica" },
    { slug: "liberia", nameAr: "ليبيريا", nameEn: "Liberia", wikiTitle: "Liberia, Costa Rica" },
  ],
  PA: [
    { slug: "panama-city", nameAr: "مدينة بنما", nameEn: "Panama City", wikiTitle: "Panama City" },
  ],
  GT: [
    { slug: "guatemala-city", nameAr: "مدينة غواتيمالا", nameEn: "Guatemala City", wikiTitle: "Guatemala City" },
  ],
  HN: [
    { slug: "roatan", nameAr: "رواتان", nameEn: "Roatán", wikiTitle: "Roatán" },
  ],
  BB: [
    { slug: "bridgetown", nameAr: "بريدجتاون", nameEn: "Bridgetown", wikiTitle: "Bridgetown" },
  ],
  TT: [
    { slug: "port-of-spain", nameAr: "بورت أوف سبين", nameEn: "Port of Spain", wikiTitle: "Port of Spain" },
  ],
  PY: [
    { slug: "asuncion", nameAr: "أسونسيون", nameEn: "Asunción", wikiTitle: "Asunción" },
  ],
  PG: [
    { slug: "port-moresby", nameAr: "بورت مورسبي", nameEn: "Port Moresby", wikiTitle: "Port Moresby" },
  ],
  WS: [
    { slug: "apia", nameAr: "أبيا", nameEn: "Apia", wikiTitle: "Apia" },
  ],
  TO: [
    { slug: "nukualofa", nameAr: "نوكوالوفا", nameEn: "Nukuʻalofa", wikiTitle: "Nukuʻalofa" },
  ],
  VU: [
    { slug: "port-vila", nameAr: "بورت فيلا", nameEn: "Port Vila", wikiTitle: "Port Vila" },
  ],
  PW: [
    { slug: "koror", nameAr: "كورور", nameEn: "Koror", wikiTitle: "Koror" },
  ],
  GY: [
    { slug: "georgetown", nameAr: "جورج تاون", nameEn: "Georgetown", wikiTitle: "Georgetown, Guyana" },
  ],
  SR: [
    { slug: "paramaribo", nameAr: "باراماريبو", nameEn: "Paramaribo", wikiTitle: "Paramaribo" },
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
