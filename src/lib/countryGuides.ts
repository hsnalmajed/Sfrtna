// Deeper, hand-curated content for a first tier of well-known tourist
// countries, styled after a TripAdvisor-style destination guide: a country
// hero photo, then three browsable categories (attractions / activities /
// restaurants). Every entry that carries a `wikiTitle` gets its photo and
// short description fetched live from Wikipedia at request time — real and
// verifiable, never invented. Entries without a confident `wikiTitle` match
// simply render with their emoji instead of a photo (the same honest
// fallback used everywhere else on this page when a live fetch comes back
// empty) rather than risk a made-up image.
//
// We do not list specific restaurant businesses — there's no reliable live
// source to confirm a given restaurant is still open, well-rated, or
// bookable. The "restaurants" category instead surfaces the dishes and food
// experiences the country is actually known for, each with a real,
// verifiable photo where a matching Wikipedia article exists.
//
// Countries not listed here still appear in the full country directory and
// get a live country-level photo/summary — they just don't have this
// deeper breakdown yet. See src/app/[locale]/attractions/[code]/page.tsx.

export type BookingKind = "official" | "guide" | "phone" | "free";

// A one-line booking hint, for the terse badge shown on each ranked list card (TripAdvisor's cards say "From $45" / "Free entry",
// not a full sentence — the full sentence still appears on the detail view).
export const BOOKING_SHORT_LABELS: Record<BookingKind, { ar: string; en: string }> = {
  official: { ar: "الحجز عبر الموقع الرسمي", en: "Book on official site" },
  guide: { ar: "الحجز عبر مشغّل جولات", en: "Book via tour operator" },
  phone: { ar: "بالاتصال أو عند الوصول", en: "By phone or on arrival" },
  free: { ar: "دخول مجاني", en: "Free entry" },
};

// Deliberately qualitative ($ / $$ / $$$) rather than a specific currency
// figure — actual prices move with season, operator, and group size, and a
// precise number we can't keep current would mislead more than it helps.
export type CostTier = "free" | "$" | "$$" | "$$$";

export interface LandmarkEntry {
  wikiTitle: string;
  nameAr: string;
  nameEn: string;
  booking: BookingKind;
}

export interface ActivityEntry {
  wikiTitle?: string;
  emoji: string;
  nameAr: string;
  nameEn: string;
  costTier: CostTier;
  booking: BookingKind;
}

export interface CuisineEntry {
  wikiTitle?: string;
  emoji: string;
  nameAr: string;
  nameEn: string;
}

export interface CountryGuide {
  bestMonthsAr: string;
  bestMonthsEn: string;
  attractions: LandmarkEntry[];
  activities: ActivityEntry[];
  cuisine: CuisineEntry[];
}

export const COUNTRY_GUIDES: Record<string, CountryGuide> = {
  SA: {
    bestMonthsAr: "نوفمبر – مارس",
    bestMonthsEn: "November – March",
    attractions: [
      { wikiTitle: "Masjid al-Haram", nameAr: "المسجد الحرام", nameEn: "Masjid al-Haram", booking: "free" },
      { wikiTitle: "Al-Ula", nameAr: "العُلا ومدائن صالح", nameEn: "AlUla & Hegra", booking: "official" },
      { wikiTitle: "Kingdom Centre", nameAr: "برج المملكة", nameEn: "Kingdom Centre Tower", booking: "official" },
      { wikiTitle: "Diriyah", nameAr: "الدرعية التاريخية", nameEn: "Historic Diriyah", booking: "official" },
    ],
    activities: [
      { wikiTitle: "Desert safari", emoji: "🏜️", nameAr: "رحلات السفاري الصحراوية", nameEn: "Desert safari trips", costTier: "$$", booking: "guide" },
      { wikiTitle: "Scuba diving", emoji: "🤿", nameAr: "الغوص في البحر الأحمر", nameEn: "Red Sea diving", costTier: "$$", booking: "guide" },
      { emoji: "🎡", nameAr: "فعاليات موسم الرياض", nameEn: "Riyadh Season events", costTier: "$", booking: "official" },
    ],
    cuisine: [
      { wikiTitle: "Kabsa", emoji: "🍛", nameAr: "الكبسة", nameEn: "Kabsa" },
      { wikiTitle: "Jareesh", emoji: "🥙", nameAr: "الجريش والمرقوق", nameEn: "Jareesh & Margooq" },
      { emoji: "☕", nameAr: "القهوة السعودية والتمر", nameEn: "Saudi coffee & dates" },
    ],
  },
  TR: {
    bestMonthsAr: "أبريل – يونيو، سبتمبر – أكتوبر",
    bestMonthsEn: "April – June, September – October",
    attractions: [
      { wikiTitle: "Hagia Sophia", nameAr: "آيا صوفيا", nameEn: "Hagia Sophia", booking: "official" },
      { wikiTitle: "Topkapı Palace", nameAr: "قصر توبكابي", nameEn: "Topkapı Palace", booking: "official" },
      { wikiTitle: "Cappadocia", nameAr: "كابادوكيا", nameEn: "Cappadocia", booking: "guide" },
      { wikiTitle: "Grand Bazaar, Istanbul", nameAr: "البازار الكبير", nameEn: "Grand Bazaar", booking: "free" },
    ],
    activities: [
      { wikiTitle: "Hot air balloon", emoji: "🎈", nameAr: "رحلة منطاد في كابادوكيا", nameEn: "Hot air balloon ride in Cappadocia", costTier: "$$$", booking: "guide" },
      { emoji: "🛥️", nameAr: "جولة بحرية في البوسفور", nameEn: "Bosphorus boat cruise", costTier: "$$", booking: "guide" },
      { wikiTitle: "Hamam", emoji: "♨️", nameAr: "حمّام تركي تقليدي", nameEn: "Traditional Turkish hammam", costTier: "$$", booking: "phone" },
    ],
    cuisine: [
      { wikiTitle: "Kebab", emoji: "🥙", nameAr: "الكباب التركي", nameEn: "Turkish kebab" },
      { wikiTitle: "Baklava", emoji: "🍰", nameAr: "البقلاوة", nameEn: "Baklava" },
      { wikiTitle: "Simit", emoji: "🫓", nameAr: "الفطور التركي والسيميت", nameEn: "Turkish breakfast & simit" },
    ],
  },
  AE: {
    bestMonthsAr: "نوفمبر – مارس",
    bestMonthsEn: "November – March",
    attractions: [
      { wikiTitle: "Burj Khalifa", nameAr: "برج خليفة", nameEn: "Burj Khalifa", booking: "official" },
      { wikiTitle: "Sheikh Zayed Grand Mosque", nameAr: "جامع الشيخ زايد الكبير", nameEn: "Sheikh Zayed Grand Mosque", booking: "free" },
      { wikiTitle: "Dubai Mall", nameAr: "دبي مول", nameEn: "The Dubai Mall", booking: "free" },
      { wikiTitle: "Louvre Abu Dhabi", nameAr: "متحف اللوفر أبوظبي", nameEn: "Louvre Abu Dhabi", booking: "official" },
    ],
    activities: [
      { wikiTitle: "Desert safari", emoji: "🏜️", nameAr: "سفاري صحراوي وتزلج على الرمال", nameEn: "Desert safari & sandboarding", costTier: "$$", booking: "guide" },
      { wikiTitle: "Ski Dubai", emoji: "🎿", nameAr: "التزلج الداخلي في سكي دبي", nameEn: "Indoor skiing at Ski Dubai", costTier: "$$$", booking: "official" },
      { wikiTitle: "Gold Souk", emoji: "🛍️", nameAr: "التسوق وسوق الذهب", nameEn: "Shopping & the Gold Souk", costTier: "free", booking: "free" },
    ],
    cuisine: [
      { wikiTitle: "Machboos", emoji: "🍚", nameAr: "المجبوس", nameEn: "Machboos" },
      { wikiTitle: "Harees", emoji: "🥘", nameAr: "الهريس والثريد", nameEn: "Harees & Thareed" },
      { wikiTitle: "Luqaimat", emoji: "🍡", nameAr: "اللقيمات", nameEn: "Luqaimat" },
    ],
  },
  QA: {
    bestMonthsAr: "نوفمبر – مارس",
    bestMonthsEn: "November – March",
    attractions: [
      { wikiTitle: "Museum of Islamic Art, Doha", nameAr: "متحف الفن الإسلامي", nameEn: "Museum of Islamic Art", booking: "free" },
      { wikiTitle: "Souq Waqif", nameAr: "سوق واقف", nameEn: "Souq Waqif", booking: "free" },
      { wikiTitle: "The Pearl-Qatar", nameAr: "جزيرة اللؤلؤة", nameEn: "The Pearl-Qatar", booking: "free" },
    ],
    activities: [
      { emoji: "🏜️", nameAr: "رحلة الكثبان الداخلية", nameEn: "Inland Sea desert trip", costTier: "$$", booking: "guide" },
      { wikiTitle: "Camel", emoji: "🐫", nameAr: "ركوب الهجن", nameEn: "Camel riding", costTier: "$", booking: "phone" },
      { emoji: "🛍️", nameAr: "جولة تسوق في سوق واقف", nameEn: "Shopping at Souq Waqif", costTier: "free", booking: "free" },
    ],
    cuisine: [
      { wikiTitle: "Machboos", emoji: "🍚", nameAr: "المجبوس القطري", nameEn: "Qatari Machboos" },
      { emoji: "🥟", nameAr: "الثريد", nameEn: "Thareed" },
      { wikiTitle: "Karak chai", emoji: "☕", nameAr: "القهوة العربية والكرك", nameEn: "Arabic coffee & karak tea" },
    ],
  },
  KW: {
    bestMonthsAr: "نوفمبر – مارس",
    bestMonthsEn: "November – March",
    attractions: [
      { wikiTitle: "Kuwait Towers", nameAr: "أبراج الكويت", nameEn: "Kuwait Towers", booking: "official" },
      { wikiTitle: "Grand Mosque, Kuwait", nameAr: "المسجد الكبير", nameEn: "Grand Mosque", booking: "free" },
      { wikiTitle: "The Avenues Mall", nameAr: "مجمع الأفنيوز", nameEn: "The Avenues Mall", booking: "free" },
    ],
    activities: [
      { emoji: "🛥️", nameAr: "جولة بحرية على الخليج", nameEn: "Gulf waterfront cruise", costTier: "$$", booking: "phone" },
      { wikiTitle: "Failaka Island", emoji: "🏝️", nameAr: "رحلة إلى جزيرة فيلكا", nameEn: "Day trip to Failaka Island", costTier: "$$", booking: "guide" },
      { emoji: "🛍️", nameAr: "التسوق في الأسواق التقليدية", nameEn: "Shopping the old souqs", costTier: "free", booking: "free" },
    ],
    cuisine: [
      { wikiTitle: "Machboos", emoji: "🍚", nameAr: "المجبوس الكويتي", nameEn: "Kuwaiti Machboos" },
      { emoji: "🍲", nameAr: "المرقوق", nameEn: "Margooga" },
      { wikiTitle: "Jareesh", emoji: "🥐", nameAr: "الجريش", nameEn: "Jireesh" },
    ],
  },
  BH: {
    bestMonthsAr: "نوفمبر – مارس",
    bestMonthsEn: "November – March",
    attractions: [
      { wikiTitle: "Bahrain Fort", nameAr: "قلعة البحرين", nameEn: "Bahrain Fort", booking: "free" },
      { wikiTitle: "Bahrain National Museum", nameAr: "متحف البحرين الوطني", nameEn: "Bahrain National Museum", booking: "official" },
      { wikiTitle: "Al Fateh Grand Mosque", nameAr: "مسجد الفاتح الكبير", nameEn: "Al Fateh Grand Mosque", booking: "free" },
    ],
    activities: [
      { wikiTitle: "Bahrain International Circuit", emoji: "🏎️", nameAr: "حلبة البحرين الدولية", nameEn: "Bahrain International Circuit", costTier: "$$$", booking: "official" },
      { wikiTitle: "Pearl hunting", emoji: "🦪", nameAr: "رحلة الغوص عن اللؤلؤ", nameEn: "Pearl diving excursion", costTier: "$$", booking: "phone" },
      { emoji: "🛍️", nameAr: "سوق المنامة القديم", nameEn: "Manama old souq", costTier: "free", booking: "free" },
    ],
    cuisine: [
      { wikiTitle: "Machboos", emoji: "🍚", nameAr: "المجبوس البحريني", nameEn: "Bahraini Machboos" },
      { wikiTitle: "Hammour", emoji: "🐟", nameAr: "سمك الهامور المشوي", nameEn: "Grilled hammour fish" },
      { emoji: "🍮", nameAr: "حلوى البحرين", nameEn: "Bahraini halwa" },
    ],
  },
  OM: {
    bestMonthsAr: "أكتوبر – أبريل",
    bestMonthsEn: "October – April",
    attractions: [
      { wikiTitle: "Sultan Qaboos Grand Mosque", nameAr: "جامع السلطان قابوس الأكبر", nameEn: "Sultan Qaboos Grand Mosque", booking: "free" },
      { wikiTitle: "Royal Opera House Muscat", nameAr: "دار الأوبرا السلطانية", nameEn: "Royal Opera House Muscat", booking: "official" },
      { wikiTitle: "Wadi Shab", nameAr: "وادي شاب", nameEn: "Wadi Shab", booking: "free" },
    ],
    activities: [
      { wikiTitle: "Hiking", emoji: "🏔️", nameAr: "التنزه في الأودية الجبلية", nameEn: "Wadi hiking", costTier: "free", booking: "free" },
      { wikiTitle: "Dolphin watching", emoji: "🐬", nameAr: "مشاهدة الدلافين", nameEn: "Dolphin watching trip", costTier: "$$", booking: "guide" },
      { emoji: "🏜️", nameAr: "التخييم في صحراء الشرقية", nameEn: "Camping in the Sharqiya desert", costTier: "$$", booking: "guide" },
    ],
    cuisine: [
      { emoji: "🍚", nameAr: "قبولي عماني", nameEn: "Omani Qabooli" },
      { emoji: "🍯", nameAr: "الحلوى العمانية والقهوة", nameEn: "Omani halwa & coffee" },
      { emoji: "🐟", nameAr: "السمك المشوي على الطريقة العمانية", nameEn: "Omani-style grilled fish" },
    ],
  },
  EG: {
    bestMonthsAr: "أكتوبر – أبريل",
    bestMonthsEn: "October – April",
    attractions: [
      { wikiTitle: "Great Pyramid of Giza", nameAr: "أهرامات الجيزة", nameEn: "Pyramids of Giza", booking: "official" },
      { wikiTitle: "Egyptian Museum", nameAr: "المتحف المصري", nameEn: "Egyptian Museum", booking: "official" },
      { wikiTitle: "Karnak Temple", nameAr: "معبد الكرنك", nameEn: "Karnak Temple", booking: "official" },
      { wikiTitle: "Abu Simbel temples", nameAr: "معابد أبو سمبل", nameEn: "Abu Simbel", booking: "guide" },
    ],
    activities: [
      { wikiTitle: "Scuba diving", emoji: "🤿", nameAr: "الغوص في البحر الأحمر", nameEn: "Red Sea diving in Hurghada", costTier: "$$", booking: "guide" },
      { wikiTitle: "Felucca", emoji: "🚤", nameAr: "رحلة نيلية بالفلوكة", nameEn: "Felucca ride on the Nile", costTier: "$", booking: "phone" },
      { wikiTitle: "Camel", emoji: "🐫", nameAr: "ركوب الجمال عند الأهرامات", nameEn: "Camel ride at the pyramids", costTier: "$", booking: "phone" },
    ],
    cuisine: [
      { wikiTitle: "Kushari", emoji: "🍲", nameAr: "الكشري", nameEn: "Koshari" },
      { wikiTitle: "Ful medames", emoji: "🫘", nameAr: "الفول والطعمية", nameEn: "Ful medames & taameya" },
      { wikiTitle: "Om Ali", emoji: "🍬", nameAr: "أم علي", nameEn: "Om Ali" },
    ],
  },
  MA: {
    bestMonthsAr: "مارس – مايو، سبتمبر – نوفمبر",
    bestMonthsEn: "March – May, September – November",
    attractions: [
      { wikiTitle: "Jemaa el-Fnaa", nameAr: "ساحة جامع الفنا", nameEn: "Jemaa el-Fnaa", booking: "free" },
      { wikiTitle: "Hassan II Mosque", nameAr: "مسجد الحسن الثاني", nameEn: "Hassan II Mosque", booking: "official" },
      { wikiTitle: "Chefchaouen", nameAr: "شفشاون الزرقاء", nameEn: "Chefchaouen", booking: "free" },
    ],
    activities: [
      { wikiTitle: "Camel", emoji: "🐪", nameAr: "رحلة الجمال في الصحراء الكبرى", nameEn: "Camel trek in the Sahara", costTier: "$$", booking: "guide" },
      { emoji: "🛍️", nameAr: "التسوق في أسواق مراكش", nameEn: "Shopping the Marrakesh souks", costTier: "free", booking: "free" },
      { wikiTitle: "Hammam", emoji: "🧖", nameAr: "الحمام المغربي التقليدي", nameEn: "Traditional Moroccan hammam", costTier: "$$", booking: "phone" },
    ],
    cuisine: [
      { wikiTitle: "Tajine", emoji: "🍲", nameAr: "الطاجين المغربي", nameEn: "Moroccan tagine" },
      { wikiTitle: "Couscous", emoji: "🍝", nameAr: "الكسكس", nameEn: "Couscous" },
      { wikiTitle: "Maghrebi mint tea", emoji: "🍵", nameAr: "أتاي (الشاي بالنعناع)", nameEn: "Mint tea (Atay)" },
    ],
  },
  JO: {
    bestMonthsAr: "مارس – مايو، سبتمبر – نوفمبر",
    bestMonthsEn: "March – May, September – November",
    attractions: [
      { wikiTitle: "Petra", nameAr: "البتراء", nameEn: "Petra", booking: "official" },
      { wikiTitle: "Wadi Rum", nameAr: "وادي رم", nameEn: "Wadi Rum", booking: "guide" },
      { wikiTitle: "Dead Sea", nameAr: "البحر الميت", nameEn: "Dead Sea", booking: "free" },
    ],
    activities: [
      { wikiTitle: "Wadi Rum", emoji: "🐫", nameAr: "سفاري في وادي رم", nameEn: "Wadi Rum jeep safari", costTier: "$$", booking: "guide" },
      { wikiTitle: "Dead Sea", emoji: "🧴", nameAr: "الطفو والاستجمام في البحر الميت", nameEn: "Floating & spa at the Dead Sea", costTier: "free", booking: "free" },
      { wikiTitle: "Petra", emoji: "🚶", nameAr: "المشي الطويل داخل البتراء", nameEn: "Long hike through Petra", costTier: "free", booking: "free" },
    ],
    cuisine: [
      { wikiTitle: "Mansaf", emoji: "🍚", nameAr: "المنسف الأردني", nameEn: "Jordanian Mansaf" },
      { wikiTitle: "Falafel", emoji: "🥙", nameAr: "الفلافل والحمص", nameEn: "Falafel & hummus" },
      { wikiTitle: "Kanafeh", emoji: "🍮", nameAr: "الكنافة النابلسية", nameEn: "Nabulsi kunafa" },
    ],
  },
  GB: {
    bestMonthsAr: "مايو – سبتمبر",
    bestMonthsEn: "May – September",
    attractions: [
      { wikiTitle: "Big Ben", nameAr: "بيغ بن", nameEn: "Big Ben", booking: "free" },
      { wikiTitle: "British Museum", nameAr: "المتحف البريطاني", nameEn: "British Museum", booking: "free" },
      { wikiTitle: "Tower of London", nameAr: "برج لندن", nameEn: "Tower of London", booking: "official" },
      { wikiTitle: "London Eye", nameAr: "عين لندن", nameEn: "London Eye", booking: "official" },
    ],
    activities: [
      { wikiTitle: "London Underground", emoji: "🚇", nameAr: "جولة بالمترو التاريخي والحافلات ذات الطابقين", nameEn: "Double-decker bus & Tube tour", costTier: "$", booking: "free" },
      { wikiTitle: "West End theatre", emoji: "🎭", nameAr: "مشاهدة عرض مسرحي في ويست إند", nameEn: "West End theatre show", costTier: "$$$", booking: "official" },
      { emoji: "🛍️", nameAr: "التسوق في أكسفورد ستريت", nameEn: "Shopping on Oxford Street", costTier: "free", booking: "free" },
    ],
    cuisine: [
      { wikiTitle: "Fish and chips", emoji: "🍟", nameAr: "فيش آند تشيبس", nameEn: "Fish and chips" },
      { wikiTitle: "Afternoon tea", emoji: "🫖", nameAr: "الشاي الإنجليزي بعد الظهر", nameEn: "Afternoon tea" },
      { wikiTitle: "Meat pie", emoji: "🥧", nameAr: "فطيرة اللحم", nameEn: "Meat pie" },
    ],
  },
  FR: {
    bestMonthsAr: "أبريل – يونيو، سبتمبر – أكتوبر",
    bestMonthsEn: "April – June, September – October",
    attractions: [
      { wikiTitle: "Eiffel Tower", nameAr: "برج إيفل", nameEn: "Eiffel Tower", booking: "official" },
      { wikiTitle: "Louvre", nameAr: "متحف اللوفر", nameEn: "The Louvre", booking: "official" },
      { wikiTitle: "Palace of Versailles", nameAr: "قصر فرساي", nameEn: "Palace of Versailles", booking: "official" },
      { wikiTitle: "Notre-Dame de Paris", nameAr: "كاتدرائية نوتردام", nameEn: "Notre-Dame de Paris", booking: "free" },
    ],
    activities: [
      { wikiTitle: "Seine", emoji: "🛳️", nameAr: "جولة نهرية على السين", nameEn: "Seine river cruise", costTier: "$$", booking: "official" },
      { emoji: "🚲", nameAr: "استكشاف باريس بالدراجة", nameEn: "Cycling around Paris", costTier: "$", booking: "guide" },
      { wikiTitle: "Wine tasting", emoji: "🍷", nameAr: "جولة تذوق النبيذ", nameEn: "Wine tasting tour", costTier: "$$", booking: "guide" },
    ],
    cuisine: [
      { wikiTitle: "Croissant", emoji: "🥐", nameAr: "الكرواسون والمعجنات الفرنسية", nameEn: "Croissants & French pastries" },
      { wikiTitle: "French cheese", emoji: "🧀", nameAr: "الجبن الفرنسي", nameEn: "French cheese" },
      { wikiTitle: "Ratatouille", emoji: "🍲", nameAr: "الراتاتوي", nameEn: "Ratatouille" },
    ],
  },
  ES: {
    bestMonthsAr: "أبريل – يونيو، سبتمبر – أكتوبر",
    bestMonthsEn: "April – June, September – October",
    attractions: [
      { wikiTitle: "Sagrada Família", nameAr: "ساغرادا فاميليا", nameEn: "Sagrada Família", booking: "official" },
      { wikiTitle: "Alhambra", nameAr: "قصر الحمراء", nameEn: "Alhambra", booking: "official" },
      { wikiTitle: "Park Güell", nameAr: "حديقة غويل", nameEn: "Park Güell", booking: "official" },
    ],
    activities: [
      { wikiTitle: "Flamenco", emoji: "💃", nameAr: "مشاهدة عرض فلامنكو", nameEn: "Flamenco show", costTier: "$$", booking: "official" },
      { emoji: "🏖️", nameAr: "الاسترخاء في شواطئ برشلونة", nameEn: "Relaxing on Barcelona's beaches", costTier: "free", booking: "free" },
      { wikiTitle: "Tapas", emoji: "🍽️", nameAr: "جولة تباس مسائية", nameEn: "Evening tapas crawl", costTier: "$$", booking: "guide" },
    ],
    cuisine: [
      { wikiTitle: "Paella", emoji: "🥘", nameAr: "الباييا", nameEn: "Paella" },
      { wikiTitle: "Tapas", emoji: "🍢", nameAr: "التاباس الإسبانية", nameEn: "Spanish tapas" },
      { wikiTitle: "Crema catalana", emoji: "🍮", nameAr: "الكريمة الكاتالانية", nameEn: "Crema Catalana" },
    ],
  },
  IT: {
    bestMonthsAr: "أبريل – يونيو، سبتمبر – أكتوبر",
    bestMonthsEn: "April – June, September – October",
    attractions: [
      { wikiTitle: "Colosseum", nameAr: "الكولوسيوم", nameEn: "Colosseum", booking: "official" },
      { wikiTitle: "Leaning Tower of Pisa", nameAr: "برج بيزا المائل", nameEn: "Leaning Tower of Pisa", booking: "official" },
      { wikiTitle: "Venice", nameAr: "مدينة البندقية", nameEn: "Venice", booking: "guide" },
      { wikiTitle: "Vatican Museums", nameAr: "متاحف الفاتيكان", nameEn: "Vatican Museums", booking: "official" },
    ],
    activities: [
      { wikiTitle: "Gondola", emoji: "🚣", nameAr: "جولة بالغندول في البندقية", nameEn: "Gondola ride in Venice", costTier: "$$$", booking: "phone" },
      { wikiTitle: "Italian cuisine", emoji: "🍝", nameAr: "دورة طبخ إيطالية", nameEn: "Italian cooking class", costTier: "$$", booking: "guide" },
      { wikiTitle: "Amalfi Coast", emoji: "🚗", nameAr: "قيادة ساحل أمالفي", nameEn: "Drive along the Amalfi Coast", costTier: "$$", booking: "guide" },
    ],
    cuisine: [
      { wikiTitle: "Neapolitan pizza", emoji: "🍕", nameAr: "البيتزا النابولية", nameEn: "Neapolitan pizza" },
      { wikiTitle: "Pasta", emoji: "🍝", nameAr: "الباستا الإيطالية", nameEn: "Italian pasta" },
      { wikiTitle: "Gelato", emoji: "🍦", nameAr: "الجيلاتو", nameEn: "Gelato" },
    ],
  },
  GR: {
    bestMonthsAr: "أبريل – يونيو، سبتمبر – أكتوبر",
    bestMonthsEn: "April – June, September – October",
    attractions: [
      { wikiTitle: "Acropolis of Athens", nameAr: "أكروبوليس أثينا", nameEn: "Acropolis of Athens", booking: "official" },
      { wikiTitle: "Santorini", nameAr: "سانتوريني", nameEn: "Santorini", booking: "guide" },
      { wikiTitle: "Meteora", nameAr: "ميتيورا", nameEn: "Meteora", booking: "guide" },
    ],
    activities: [
      { emoji: "⛵", nameAr: "جولة بحرية بين الجزر اليونانية", nameEn: "Greek islands boat tour", costTier: "$$$", booking: "guide" },
      { wikiTitle: "Oia", emoji: "🌅", nameAr: "مشاهدة الغروب في أويا", nameEn: "Sunset watching in Oia", costTier: "free", booking: "free" },
      { emoji: "🏛️", nameAr: "استكشاف المواقع الأثرية", nameEn: "Exploring ancient ruins", costTier: "$", booking: "official" },
    ],
    cuisine: [
      { wikiTitle: "Gyro", emoji: "🥙", nameAr: "الجيروس اليوناني", nameEn: "Greek gyros" },
      { wikiTitle: "Greek salad", emoji: "🥗", nameAr: "السلطة اليونانية", nameEn: "Greek salad" },
      { wikiTitle: "Baklava", emoji: "🍯", nameAr: "البقلاوة اليونانية", nameEn: "Greek baklava" },
    ],
  },
  CH: {
    bestMonthsAr: "يونيو – سبتمبر، ديسمبر – مارس (للتزلج)",
    bestMonthsEn: "June – September, December – March (skiing)",
    attractions: [
      { wikiTitle: "Matterhorn", nameAr: "جبل ماترهورن", nameEn: "Matterhorn", booking: "guide" },
      { wikiTitle: "Jungfraujoch", nameAr: "يونغفراوجوخ", nameEn: "Jungfraujoch", booking: "official" },
      { wikiTitle: "Lake Lucerne", nameAr: "بحيرة لوسيرن", nameEn: "Lake Lucerne", booking: "free" },
    ],
    activities: [
      { wikiTitle: "Jungfraubahn", emoji: "🚡", nameAr: "ركوب القطار الجبلي", nameEn: "Scenic mountain train ride", costTier: "$$$", booking: "official" },
      { wikiTitle: "Skiing", emoji: "⛷️", nameAr: "التزلج في جبال الألب", nameEn: "Skiing in the Alps", costTier: "$$$", booking: "official" },
      { wikiTitle: "Fondue", emoji: "🧀", nameAr: "تذوق الفوندو السويسري", nameEn: "Swiss fondue tasting", costTier: "$$", booking: "phone" },
    ],
    cuisine: [
      { wikiTitle: "Fondue", emoji: "🧀", nameAr: "الفوندو السويسري", nameEn: "Swiss fondue" },
      { wikiTitle: "Swiss chocolate", emoji: "🍫", nameAr: "الشوكولاتة السويسرية", nameEn: "Swiss chocolate" },
      { wikiTitle: "Rösti", emoji: "🥔", nameAr: "الروستي", nameEn: "Rösti" },
    ],
  },
  AT: {
    bestMonthsAr: "أبريل – يونيو، سبتمبر – أكتوبر",
    bestMonthsEn: "April – June, September – October",
    attractions: [
      { wikiTitle: "Schönbrunn Palace", nameAr: "قصر شونبرون", nameEn: "Schönbrunn Palace", booking: "official" },
      { wikiTitle: "Hallstatt", nameAr: "هالشتات", nameEn: "Hallstatt", booking: "free" },
      { wikiTitle: "Vienna State Opera", nameAr: "دار أوبرا فيينا", nameEn: "Vienna State Opera", booking: "official" },
    ],
    activities: [
      { wikiTitle: "Vienna State Opera", emoji: "🎻", nameAr: "حضور حفل موسيقى كلاسيكية", nameEn: "Classical music concert", costTier: "$$$", booking: "official" },
      { wikiTitle: "Hiking", emoji: "🚶", nameAr: "التنزه في جبال الألب النمساوية", nameEn: "Hiking the Austrian Alps", costTier: "free", booking: "free" },
      { wikiTitle: "Viennese coffee house", emoji: "☕", nameAr: "زيارة مقهى فيينا التقليدي", nameEn: "Traditional Vienna coffeehouse", costTier: "$", booking: "free" },
    ],
    cuisine: [
      { wikiTitle: "Wiener schnitzel", emoji: "🍖", nameAr: "شنيتزل فيينا", nameEn: "Wiener schnitzel" },
      { wikiTitle: "Sachertorte", emoji: "🍰", nameAr: "كعكة زاخر", nameEn: "Sachertorte" },
      { emoji: "🥨", nameAr: "المخبوزات النمساوية", nameEn: "Austrian pastries" },
    ],
  },
  NL: {
    bestMonthsAr: "أبريل – مايو (موسم التوليب)، يونيو – أغسطس",
    bestMonthsEn: "April – May (tulip season), June – August",
    attractions: [
      { wikiTitle: "Rijksmuseum", nameAr: "متحف رايكس", nameEn: "Rijksmuseum", booking: "official" },
      { wikiTitle: "Keukenhof", nameAr: "حديقة كيوكنهوف", nameEn: "Keukenhof", booking: "official" },
      { wikiTitle: "Anne Frank House", nameAr: "بيت آن فرانك", nameEn: "Anne Frank House", booking: "official" },
    ],
    activities: [
      { wikiTitle: "Cycling", emoji: "🚴", nameAr: "استكشاف أمستردام بالدراجة", nameEn: "Cycling around Amsterdam", costTier: "$", booking: "guide" },
      { emoji: "🛶", nameAr: "جولة بالقارب في القنوات", nameEn: "Canal boat tour", costTier: "$$", booking: "official" },
      { wikiTitle: "Keukenhof", emoji: "🌷", nameAr: "زيارة حقول التوليب", nameEn: "Tulip fields visit", costTier: "$$", booking: "official" },
    ],
    cuisine: [
      { wikiTitle: "Dutch cheese", emoji: "🧀", nameAr: "الجبن الهولندي", nameEn: "Dutch cheese" },
      { wikiTitle: "Frites", emoji: "🍟", nameAr: "البطاطا الهولندية (فريتس)", nameEn: "Dutch fries (frites)" },
      { wikiTitle: "Stroopwafel", emoji: "🥞", nameAr: "الستروبوافل", nameEn: "Stroopwafel" },
    ],
  },
  DE: {
    bestMonthsAr: "مايو – سبتمبر",
    bestMonthsEn: "May – September",
    attractions: [
      { wikiTitle: "Neuschwanstein Castle", nameAr: "قلعة نويشفانشتاين", nameEn: "Neuschwanstein Castle", booking: "official" },
      { wikiTitle: "Brandenburg Gate", nameAr: "بوابة براندنبورغ", nameEn: "Brandenburg Gate", booking: "free" },
      { wikiTitle: "Cologne Cathedral", nameAr: "كاتدرائية كولونيا", nameEn: "Cologne Cathedral", booking: "free" },
    ],
    activities: [
      { wikiTitle: "Oktoberfest", emoji: "🍺", nameAr: "زيارة مهرجان أوكتوبرفست", nameEn: "Oktoberfest visit", costTier: "$$", booking: "free" },
      { wikiTitle: "Neuschwanstein Castle", emoji: "🏰", nameAr: "جولة قلاع بافاريا", nameEn: "Bavarian castle tour", costTier: "$$", booking: "guide" },
      { emoji: "🚄", nameAr: "التنقل بالقطارات السريعة", nameEn: "High-speed train travel", costTier: "$$", booking: "official" },
    ],
    cuisine: [
      { wikiTitle: "Sausage", emoji: "🌭", nameAr: "النقانق الألمانية", nameEn: "German sausages" },
      { wikiTitle: "Beer in Germany", emoji: "🍺", nameAr: "البيرة الألمانية", nameEn: "German beer" },
      { wikiTitle: "Pretzel", emoji: "🥨", nameAr: "البريتزل", nameEn: "Pretzel" },
    ],
  },
  PT: {
    bestMonthsAr: "مارس – مايو، سبتمبر – أكتوبر",
    bestMonthsEn: "March – May, September – October",
    attractions: [
      { wikiTitle: "Belém Tower", nameAr: "برج بيليم", nameEn: "Belém Tower", booking: "official" },
      { wikiTitle: "Pena Palace", nameAr: "قصر بينا", nameEn: "Pena Palace", booking: "official" },
      { wikiTitle: "Porto", nameAr: "مدينة بورتو", nameEn: "Porto", booking: "free" },
    ],
    activities: [
      { wikiTitle: "Trams in Lisbon", emoji: "🚋", nameAr: "ركوب الترام التاريخي في لشبونة", nameEn: "Historic tram ride in Lisbon", costTier: "$", booking: "free" },
      { wikiTitle: "Port wine", emoji: "🍷", nameAr: "جولة تذوق نبيذ البورتو", nameEn: "Port wine tasting tour", costTier: "$$", booking: "guide" },
      { wikiTitle: "Surfing", emoji: "🏄", nameAr: "ركوب الأمواج في نازاريه", nameEn: "Surfing in Nazaré", costTier: "$$", booking: "guide" },
    ],
    cuisine: [
      { wikiTitle: "Bacalhau", emoji: "🐟", nameAr: "سمك القدّ (باكالياو)", nameEn: "Bacalhau (codfish)" },
      { wikiTitle: "Pastel de nata", emoji: "🥧", nameAr: "حلوى الباستيل دي ناتا", nameEn: "Pastel de nata" },
      { emoji: "🐙", nameAr: "الأخطبوط البرتغالي", nameEn: "Portuguese octopus dishes" },
    ],
  },
  MV: {
    bestMonthsAr: "نوفمبر – أبريل",
    bestMonthsEn: "November – April",
    attractions: [
      { wikiTitle: "Malé", nameAr: "مالِه العاصمة", nameEn: "Malé", booking: "free" },
      { wikiTitle: "Maldives", nameAr: "المنتجعات الجزرية", nameEn: "Overwater villas & atolls", booking: "guide" },
    ],
    activities: [
      { wikiTitle: "Snorkeling", emoji: "🤿", nameAr: "الغطس ومشاهدة الشعاب المرجانية", nameEn: "Snorkeling the coral reefs", costTier: "$$", booking: "guide" },
      { wikiTitle: "Dolphin watching", emoji: "🛥️", nameAr: "رحلة بحرية لمشاهدة الدلافين", nameEn: "Dolphin-watching cruise", costTier: "$$", booking: "guide" },
      { emoji: "🏝️", nameAr: "الاسترخاء على جزيرة خاصة", nameEn: "Private island relaxation", costTier: "$$$", booking: "official" },
    ],
    cuisine: [
      { emoji: "🐟", nameAr: "التونة المالديفية", nameEn: "Maldivian tuna dishes" },
      { emoji: "🥥", nameAr: "أطباق جوز الهند", nameEn: "Coconut-based curries" },
      { emoji: "🍚", nameAr: "أرز الكاري المالديفي", nameEn: "Maldivian curry & rice" },
    ],
  },
  LK: {
    bestMonthsAr: "ديسمبر – مارس",
    bestMonthsEn: "December – March",
    attractions: [
      { wikiTitle: "Sigiriya", nameAr: "صخرة سيجيريا", nameEn: "Sigiriya Rock", booking: "official" },
      { wikiTitle: "Temple of the Sacred Tooth Relic", nameAr: "معبد سن بوذا المقدس", nameEn: "Temple of the Tooth", booking: "free" },
      { wikiTitle: "Nuwara Eliya", nameAr: "نوارا إليا ومزارع الشاي", nameEn: "Nuwara Eliya tea country", booking: "guide" },
    ],
    activities: [
      { wikiTitle: "Sri Lanka Railways", emoji: "🚂", nameAr: "رحلة القطار عبر مزارع الشاي", nameEn: "Scenic train ride through tea country", costTier: "$", booking: "official" },
      { emoji: "🐘", nameAr: "زيارة محمية الفيلة", nameEn: "Elephant sanctuary visit", costTier: "$$", booking: "official" },
      { wikiTitle: "Surfing", emoji: "🏄", nameAr: "ركوب الأمواج على الساحل الجنوبي", nameEn: "Surfing on the south coast", costTier: "$$", booking: "guide" },
    ],
    cuisine: [
      { emoji: "🍛", nameAr: "الكاري السريلانكي", nameEn: "Sri Lankan curry" },
      { wikiTitle: "Hopper (food)", emoji: "🥞", nameAr: "الهوبرز", nameEn: "Hoppers" },
      { wikiTitle: "Ceylon tea", emoji: "🍵", nameAr: "شاي سيلان", nameEn: "Ceylon tea" },
    ],
  },
  ID: {
    bestMonthsAr: "أبريل – أكتوبر",
    bestMonthsEn: "April – October",
    attractions: [
      { wikiTitle: "Borobudur", nameAr: "معبد بوروبودور", nameEn: "Borobudur", booking: "official" },
      { wikiTitle: "Ubud", nameAr: "أوبود", nameEn: "Ubud", booking: "free" },
      { wikiTitle: "Tanah Lot", nameAr: "معبد تانه لوت", nameEn: "Tanah Lot", booking: "free" },
    ],
    activities: [
      { wikiTitle: "Surfing", emoji: "🏄", nameAr: "ركوب الأمواج في بالي", nameEn: "Surfing in Bali", costTier: "$$", booking: "guide" },
      { wikiTitle: "Yoga", emoji: "🧘", nameAr: "دورة يوغا واسترخاء", nameEn: "Yoga & wellness retreat", costTier: "$$", booking: "guide" },
      { wikiTitle: "Mount Bromo", emoji: "🌋", nameAr: "تسلق بركان برومو", nameEn: "Mount Bromo sunrise trek", costTier: "$$", booking: "guide" },
    ],
    cuisine: [
      { wikiTitle: "Satay", emoji: "🍢", nameAr: "الساتيه الإندونيسي", nameEn: "Indonesian satay" },
      { wikiTitle: "Nasi goreng", emoji: "🍛", nameAr: "الناسي غورينغ", nameEn: "Nasi goreng" },
      { wikiTitle: "Rendang", emoji: "🥥", nameAr: "الرندانغ", nameEn: "Rendang" },
    ],
  },
  TH: {
    bestMonthsAr: "نوفمبر – فبراير",
    bestMonthsEn: "November – February",
    attractions: [
      { wikiTitle: "Grand Palace, Bangkok", nameAr: "القصر الكبير في بانكوك", nameEn: "Grand Palace", booking: "official" },
      { wikiTitle: "Wat Arun", nameAr: "معبد وات آرون", nameEn: "Wat Arun", booking: "official" },
      { wikiTitle: "Phi Phi Islands", nameAr: "جزر بي بي", nameEn: "Phi Phi Islands", booking: "guide" },
    ],
    activities: [
      { emoji: "🛶", nameAr: "جولة بالقارب بين الجزر", nameEn: "Island-hopping boat tour", costTier: "$$", booking: "guide" },
      { emoji: "🐘", nameAr: "زيارة ملاذ الأفيال الأخلاقي", nameEn: "Ethical elephant sanctuary visit", costTier: "$$", booking: "official" },
      { emoji: "🌃", nameAr: "التسوق في أسواق بانكوك الليلية", nameEn: "Bangkok night markets", costTier: "free", booking: "free" },
    ],
    cuisine: [
      { wikiTitle: "Tom yum", emoji: "🍜", nameAr: "التوم يام", nameEn: "Tom yum soup" },
      { wikiTitle: "Pad thai", emoji: "🍝", nameAr: "الباد تاي", nameEn: "Pad Thai" },
      { wikiTitle: "Mango sticky rice", emoji: "🥭", nameAr: "الأرز اللزج بالمانجو", nameEn: "Mango sticky rice" },
    ],
  },
  MY: {
    bestMonthsAr: "مارس – أكتوبر",
    bestMonthsEn: "March – October",
    attractions: [
      { wikiTitle: "Petronas Towers", nameAr: "برجا بتروناس", nameEn: "Petronas Towers", booking: "official" },
      { wikiTitle: "Batu Caves", nameAr: "كهوف باتو", nameEn: "Batu Caves", booking: "free" },
      { wikiTitle: "Langkawi", nameAr: "لنكاوي", nameEn: "Langkawi", booking: "guide" },
    ],
    activities: [
      { wikiTitle: "Langkawi Sky Cab", emoji: "🚡", nameAr: "التلفريك في لنكاوي", nameEn: "Langkawi Sky Cable", costTier: "$$", booking: "official" },
      { emoji: "🛍️", nameAr: "التسوق في كوالالمبور", nameEn: "Shopping in Kuala Lumpur", costTier: "free", booking: "free" },
      { emoji: "🌴", nameAr: "استكشاف الغابات المطيرة", nameEn: "Rainforest exploration", costTier: "$$", booking: "guide" },
    ],
    cuisine: [
      { wikiTitle: "Nasi lemak", emoji: "🍛", nameAr: "ناسي ليماك", nameEn: "Nasi lemak" },
      { wikiTitle: "Satay", emoji: "🍢", nameAr: "الساتيه الماليزي", nameEn: "Malaysian satay" },
      { wikiTitle: "Laksa", emoji: "🍜", nameAr: "لاكسا", nameEn: "Laksa" },
    ],
  },
  SG: {
    bestMonthsAr: "فبراير – أبريل",
    bestMonthsEn: "February – April",
    attractions: [
      { wikiTitle: "Gardens by the Bay", nameAr: "حدائق الخليج", nameEn: "Gardens by the Bay", booking: "official" },
      { wikiTitle: "Marina Bay Sands", nameAr: "مارينا باي ساندز", nameEn: "Marina Bay Sands", booking: "official" },
      { wikiTitle: "Sentosa Island", nameAr: "جزيرة سنتوسا", nameEn: "Sentosa Island", booking: "official" },
    ],
    activities: [
      { wikiTitle: "Singapore Flyer", emoji: "🎡", nameAr: "ركوب عجلة سنغافورة الطائرة", nameEn: "Singapore Flyer ride", costTier: "$$", booking: "official" },
      { wikiTitle: "Night Safari", emoji: "🦁", nameAr: "زيارة حديقة الحيوان الليلية", nameEn: "Night Safari zoo visit", costTier: "$$", booking: "official" },
      { wikiTitle: "Hawker centre", emoji: "🍜", nameAr: "جولة طعام الشارع في هوكر سنتر", nameEn: "Hawker centre food tour", costTier: "$", booking: "free" },
    ],
    cuisine: [
      { wikiTitle: "Chilli crab", emoji: "🦀", nameAr: "سلطعون الفلفل الأسود والحار", nameEn: "Chilli & pepper crab" },
      { wikiTitle: "Hainanese chicken rice", emoji: "🍚", nameAr: "أرز الدجاج الهاييني", nameEn: "Hainanese chicken rice" },
      { wikiTitle: "Ice kacang", emoji: "🍧", nameAr: "حلوى الآيس كاتشانغ", nameEn: "Ice kacang dessert" },
    ],
  },
  JP: {
    bestMonthsAr: "مارس – مايو (الكرز)، أكتوبر – نوفمبر (الخريف)",
    bestMonthsEn: "March – May (cherry blossoms), October – November (autumn)",
    attractions: [
      { wikiTitle: "Fushimi Inari-taisha", nameAr: "معبد فوشيمي إيناري", nameEn: "Fushimi Inari Shrine", booking: "free" },
      { wikiTitle: "Mount Fuji", nameAr: "جبل فوجي", nameEn: "Mount Fuji", booking: "guide" },
      { wikiTitle: "Tokyo Skytree", nameAr: "برج طوكيو سكاي تري", nameEn: "Tokyo Skytree", booking: "official" },
    ],
    activities: [
      { wikiTitle: "Cherry blossom", emoji: "🌸", nameAr: "مشاهدة أزهار الكرز", nameEn: "Cherry blossom viewing", costTier: "free", booking: "free" },
      { wikiTitle: "Onsen", emoji: "♨️", nameAr: "الاستحمام في الينابيع الحارة", nameEn: "Onsen hot spring bathing", costTier: "$$", booking: "phone" },
      { wikiTitle: "Shinkansen", emoji: "🚄", nameAr: "ركوب قطار الشينكانسن السريع", nameEn: "Shinkansen bullet train ride", costTier: "$$", booking: "official" },
    ],
    cuisine: [
      { wikiTitle: "Sushi", emoji: "🍣", nameAr: "السوشي الياباني", nameEn: "Japanese sushi" },
      { wikiTitle: "Ramen", emoji: "🍜", nameAr: "الرامن", nameEn: "Ramen" },
      { wikiTitle: "Tempura", emoji: "🍢", nameAr: "التيمبورا", nameEn: "Tempura" },
    ],
  },
  KR: {
    bestMonthsAr: "مارس – مايو، سبتمبر – نوفمبر",
    bestMonthsEn: "March – May, September – November",
    attractions: [
      { wikiTitle: "Gyeongbokgung", nameAr: "قصر كيونغبوكغونغ", nameEn: "Gyeongbokgung Palace", booking: "official" },
      { wikiTitle: "N Seoul Tower", nameAr: "برج سول إن", nameEn: "N Seoul Tower", booking: "official" },
      { wikiTitle: "Jeju Island", nameAr: "جزيرة جيجو", nameEn: "Jeju Island", booking: "guide" },
    ],
    activities: [
      { wikiTitle: "Hanbok", emoji: "👘", nameAr: "تجربة ارتداء الهانبوك", nameEn: "Hanbok traditional dress experience", costTier: "$", booking: "phone" },
      { emoji: "🛍️", nameAr: "التسوق في ميونغدونغ", nameEn: "Shopping in Myeongdong", costTier: "free", booking: "free" },
      { wikiTitle: "K-pop", emoji: "🎤", nameAr: "جولة ثقافة الكي بوب", nameEn: "K-pop culture tour", costTier: "$$", booking: "guide" },
    ],
    cuisine: [
      { wikiTitle: "Korean fried chicken", emoji: "🍗", nameAr: "الدجاج الكوري المقلي", nameEn: "Korean fried chicken" },
      { wikiTitle: "Bibimbap", emoji: "🥘", nameAr: "البيبيمباب", nameEn: "Bibimbap" },
      { wikiTitle: "Kimchi", emoji: "🥬", nameAr: "الكيمتشي", nameEn: "Kimchi" },
    ],
  },
  CN: {
    bestMonthsAr: "مارس – مايو، سبتمبر – نوفمبر",
    bestMonthsEn: "March – May, September – November",
    attractions: [
      { wikiTitle: "Great Wall of China", nameAr: "سور الصين العظيم", nameEn: "Great Wall of China", booking: "official" },
      { wikiTitle: "Forbidden City", nameAr: "المدينة المحرمة", nameEn: "Forbidden City", booking: "official" },
      { wikiTitle: "Terracotta Army", nameAr: "جيش الطين", nameEn: "Terracotta Army", booking: "official" },
    ],
    activities: [
      { wikiTitle: "Great Wall of China", emoji: "🚶", nameAr: "المشي على سور الصين", nameEn: "Walking the Great Wall", costTier: "$", booking: "official" },
      { wikiTitle: "Giant panda", emoji: "🐼", nameAr: "زيارة محمية الباندا", nameEn: "Panda reserve visit", costTier: "$$", booking: "official" },
      { wikiTitle: "Chinese tea ceremony", emoji: "🍵", nameAr: "حفل شاي تقليدي", nameEn: "Traditional tea ceremony", costTier: "$", booking: "phone" },
    ],
    cuisine: [
      { wikiTitle: "Peking duck", emoji: "🦆", nameAr: "بط بكين", nameEn: "Peking duck" },
      { wikiTitle: "Dumpling", emoji: "🥟", nameAr: "الدمبلينغ الصيني", nameEn: "Chinese dumplings" },
      { wikiTitle: "Lamian", emoji: "🍜", nameAr: "نودلز يد السحب", nameEn: "Hand-pulled noodles" },
    ],
  },
  VN: {
    bestMonthsAr: "نوفمبر – أبريل",
    bestMonthsEn: "November – April",
    attractions: [
      { wikiTitle: "Ha Long Bay", nameAr: "خليج هالونغ", nameEn: "Ha Long Bay", booking: "guide" },
      { wikiTitle: "Hoi An", nameAr: "هوي آن", nameEn: "Hoi An", booking: "free" },
      { wikiTitle: "Cu Chi tunnels", nameAr: "أنفاق كوتشي", nameEn: "Cu Chi Tunnels", booking: "official" },
    ],
    activities: [
      { wikiTitle: "Ha Long Bay", emoji: "🛥️", nameAr: "رحلة بحرية في خليج هالونغ", nameEn: "Ha Long Bay cruise", costTier: "$$", booking: "guide" },
      { emoji: "🚴", nameAr: "جولة دراجة في الريف", nameEn: "Countryside cycling tour", costTier: "$", booking: "guide" },
      { wikiTitle: "Hoi An", emoji: "🏮", nameAr: "التجول بين فوانيس هوي آن", nameEn: "Hoi An lantern old town walk", costTier: "free", booking: "free" },
    ],
    cuisine: [
      { wikiTitle: "Pho", emoji: "🍜", nameAr: "الفو (شوربة الفيتنامية)", nameEn: "Phở noodle soup" },
      { wikiTitle: "Banh mi", emoji: "🥖", nameAr: "بان مي", nameEn: "Bánh mì" },
      { wikiTitle: "Vietnamese coffee", emoji: "☕", nameAr: "القهوة الفيتنامية", nameEn: "Vietnamese coffee" },
    ],
  },
  IN: {
    bestMonthsAr: "أكتوبر – مارس",
    bestMonthsEn: "October – March",
    attractions: [
      { wikiTitle: "Taj Mahal", nameAr: "تاج محل", nameEn: "Taj Mahal", booking: "official" },
      { wikiTitle: "Amber Fort", nameAr: "قلعة أمبر", nameEn: "Amber Fort", booking: "official" },
      { wikiTitle: "Kerala backwaters", nameAr: "برك كيرلا المائية", nameEn: "Kerala backwaters", booking: "guide" },
    ],
    activities: [
      { wikiTitle: "Kerala backwaters", emoji: "🛶", nameAr: "رحلة بيت عائم في كيرلا", nameEn: "Kerala houseboat cruise", costTier: "$$", booking: "guide" },
      { emoji: "🐘", nameAr: "زيارة محمية النمور", nameEn: "Tiger reserve safari", costTier: "$$", booking: "official" },
      { wikiTitle: "Golden Triangle (India)", emoji: "🕌", nameAr: "جولة معالم المثلث الذهبي", nameEn: "Golden Triangle heritage tour", costTier: "$$", booking: "guide" },
    ],
    cuisine: [
      { wikiTitle: "Curry", emoji: "🍛", nameAr: "الكاري الهندي", nameEn: "Indian curry" },
      { wikiTitle: "Naan", emoji: "🫓", nameAr: "خبز النان", nameEn: "Naan bread" },
      { wikiTitle: "Biryani", emoji: "🍚", nameAr: "البرياني", nameEn: "Biryani" },
    ],
  },
  US: {
    bestMonthsAr: "أبريل – يونيو، سبتمبر – أكتوبر",
    bestMonthsEn: "April – June, September – October",
    attractions: [
      { wikiTitle: "Statue of Liberty", nameAr: "تمثال الحرية", nameEn: "Statue of Liberty", booking: "official" },
      { wikiTitle: "Grand Canyon", nameAr: "الوادي الكبير (غراند كانيون)", nameEn: "Grand Canyon", booking: "official" },
      { wikiTitle: "Walt Disney World", nameAr: "والت ديزني وورلد", nameEn: "Walt Disney World", booking: "official" },
    ],
    activities: [
      { wikiTitle: "Walt Disney World", emoji: "🎢", nameAr: "زيارة مدن الملاهي", nameEn: "Theme park day", costTier: "$$$", booking: "official" },
      { emoji: "🚕", nameAr: "استكشاف مدينة نيويورك", nameEn: "Exploring New York City", costTier: "$", booking: "free" },
      { wikiTitle: "Grand Canyon", emoji: "🏞️", nameAr: "زيارة الحدائق الوطنية", nameEn: "National park road trip", costTier: "$$", booking: "official" },
    ],
    cuisine: [
      { wikiTitle: "Hamburger", emoji: "🍔", nameAr: "البرغر الأمريكي", nameEn: "American burger" },
      { wikiTitle: "New York-style pizza", emoji: "🍕", nameAr: "بيتزا نيويورك", nameEn: "New York-style pizza" },
      { wikiTitle: "Pancake", emoji: "🥞", nameAr: "فطور البانكيك الأمريكي", nameEn: "American pancake breakfast" },
    ],
  },
  AZ: {
    bestMonthsAr: "أبريل – يونيو، سبتمبر – أكتوبر",
    bestMonthsEn: "April – June, September – October",
    attractions: [
      { wikiTitle: "Flame Towers", nameAr: "أبراج اللهب", nameEn: "Flame Towers", booking: "free" },
      { wikiTitle: "Old City (Baku)", nameAr: "المدينة القديمة في باكو", nameEn: "Old City (Icherisheher)", booking: "free" },
      { wikiTitle: "Gobustan National Park", nameAr: "حديقة غوبوستان الوطنية", nameEn: "Gobustan National Park", booking: "guide" },
    ],
    activities: [
      { emoji: "🚡", nameAr: "التلفريك في منتجع شاهدغ", nameEn: "Shahdag ski resort cable car", costTier: "$$", booking: "official" },
      { wikiTitle: "Mud volcano", emoji: "🌋", nameAr: "زيارة براكين الطين", nameEn: "Mud volcano visit", costTier: "$", booking: "guide" },
      { emoji: "🚶", nameAr: "التجول في المدينة القديمة", nameEn: "Old City walking tour", costTier: "free", booking: "free" },
    ],
    cuisine: [
      { emoji: "🍢", nameAr: "الكباب الأذربيجاني", nameEn: "Azerbaijani kebab" },
      { wikiTitle: "Pilaf", emoji: "🍚", nameAr: "البلوف (بيلاف)", nameEn: "Plov (pilaf)" },
      { emoji: "🍵", nameAr: "الشاي الأذربيجاني", nameEn: "Azerbaijani tea culture" },
    ],
  },
  GE: {
    bestMonthsAr: "مايو – يونيو، سبتمبر – أكتوبر",
    bestMonthsEn: "May – June, September – October",
    attractions: [
      { wikiTitle: "Narikala", nameAr: "قلعة ناريكالا", nameEn: "Narikala Fortress", booking: "free" },
      { wikiTitle: "Tbilisi", nameAr: "البلدة القديمة في تبليسي", nameEn: "Tbilisi Old Town", booking: "free" },
      { wikiTitle: "Kazbegi District", nameAr: "منطقة كازبيغي", nameEn: "Kazbegi (Stepantsminda)", booking: "guide" },
    ],
    activities: [
      { emoji: "♨️", nameAr: "الحمامات الكبريتية التقليدية", nameEn: "Traditional sulfur baths", costTier: "$$", booking: "phone" },
      { wikiTitle: "Caucasus Mountains", emoji: "🏔️", nameAr: "التنزه في جبال القوقاز", nameEn: "Caucasus mountain hiking", costTier: "free", booking: "free" },
      { wikiTitle: "Kakheti", emoji: "🍷", nameAr: "جولة تذوق نبيذ كاخيتي", nameEn: "Kakheti wine tasting tour", costTier: "$$", booking: "guide" },
    ],
    cuisine: [
      { wikiTitle: "Khinkali", emoji: "🥟", nameAr: "الخينكالي", nameEn: "Khinkali dumplings" },
      { wikiTitle: "Khachapuri", emoji: "🧀", nameAr: "خبز الخاتشابوري بالجبن", nameEn: "Khachapuri cheese bread" },
      { wikiTitle: "Georgian wine", emoji: "🍷", nameAr: "النبيذ الجورجي", nameEn: "Georgian wine" },
    ],
  },
  ZA: {
    bestMonthsAr: "مايو – سبتمبر",
    bestMonthsEn: "May – September",
    attractions: [
      { wikiTitle: "Table Mountain", nameAr: "جبل الطاولة", nameEn: "Table Mountain", booking: "official" },
      { wikiTitle: "Robben Island", nameAr: "جزيرة روبن", nameEn: "Robben Island", booking: "official" },
      { wikiTitle: "Kruger National Park", nameAr: "حديقة كروجر الوطنية", nameEn: "Kruger National Park", booking: "guide" },
    ],
    activities: [
      { wikiTitle: "Safari", emoji: "🦁", nameAr: "رحلة سفاري لمشاهدة الحياة البرية", nameEn: "Wildlife safari", costTier: "$$$", booking: "guide" },
      { wikiTitle: "Table Mountain Aerial Cableway", emoji: "🚡", nameAr: "التلفريك إلى قمة جبل الطاولة", nameEn: "Table Mountain cable car", costTier: "$$", booking: "official" },
      { wikiTitle: "Stellenbosch", emoji: "🍷", nameAr: "جولة تذوق نبيذ ستيلينبوش", nameEn: "Stellenbosch wine tasting", costTier: "$$", booking: "guide" },
    ],
    cuisine: [
      { wikiTitle: "Braai", emoji: "🍖", nameAr: "شواء البرايي الجنوب أفريقي", nameEn: "South African braai (BBQ)" },
      { wikiTitle: "Bobotie", emoji: "🥟", nameAr: "البوبوتي", nameEn: "Bobotie" },
      { wikiTitle: "Stellenbosch", emoji: "🍷", nameAr: "نبيذ ستيلينبوش", nameEn: "Stellenbosch wine" },
    ],
  },
  KE: {
    bestMonthsAr: "يونيو – أكتوبر",
    bestMonthsEn: "June – October",
    attractions: [
      { wikiTitle: "Maasai Mara", nameAr: "محمية ماساي مارا", nameEn: "Maasai Mara", booking: "guide" },
      { wikiTitle: "Nairobi National Park", nameAr: "حديقة نيروبي الوطنية", nameEn: "Nairobi National Park", booking: "official" },
    ],
    activities: [
      { wikiTitle: "Wildebeest migration", emoji: "🦓", nameAr: "رحلة سفاري لمشاهدة الهجرة الكبرى", nameEn: "Great Migration safari", costTier: "$$$", booking: "guide" },
      { wikiTitle: "Hot air balloon", emoji: "🎈", nameAr: "رحلة منطاد فوق السافانا", nameEn: "Hot air balloon safari", costTier: "$$$", booking: "guide" },
      { emoji: "🏖️", nameAr: "الاسترخاء في شواطئ ممباسا", nameEn: "Relaxing on Mombasa beaches", costTier: "free", booking: "free" },
    ],
    cuisine: [
      { wikiTitle: "Nyama choma", emoji: "🍖", nameAr: "النيوما تشوما (اللحم المشوي)", nameEn: "Nyama choma (grilled meat)" },
      { wikiTitle: "Ugali", emoji: "🌽", nameAr: "الأوغالي", nameEn: "Ugali" },
      { emoji: "☕", nameAr: "قهوة كينيا", nameEn: "Kenyan coffee" },
    ],
  },
  MX: {
    bestMonthsAr: "نوفمبر – أبريل",
    bestMonthsEn: "November – April",
    attractions: [
      { wikiTitle: "Chichen Itza", nameAr: "تشيتشن إيتزا", nameEn: "Chichen Itza", booking: "official" },
      { wikiTitle: "Tulum", nameAr: "تولوم", nameEn: "Tulum", booking: "official" },
      { wikiTitle: "Mexico City", nameAr: "مكسيكو سيتي", nameEn: "Mexico City", booking: "free" },
    ],
    activities: [
      { wikiTitle: "Cenote", emoji: "🏖️", nameAr: "الغطس في الحفر الطبيعية (سينوتيه)", nameEn: "Cenote snorkeling", costTier: "$$", booking: "guide" },
      { wikiTitle: "Chichen Itza", emoji: "🏛️", nameAr: "استكشاف أهرامات المايا", nameEn: "Mayan pyramid exploration", costTier: "$$", booking: "official" },
      { wikiTitle: "Day of the Dead", emoji: "🎉", nameAr: "تجربة مهرجان يوم الموتى", nameEn: "Day of the Dead festivities", costTier: "free", booking: "free" },
    ],
    cuisine: [
      { wikiTitle: "Taco", emoji: "🌮", nameAr: "التاكو المكسيكي", nameEn: "Mexican tacos" },
      { wikiTitle: "Guacamole", emoji: "🫓", nameAr: "الغواكامولي", nameEn: "Guacamole" },
      { wikiTitle: "Mole (sauce)", emoji: "🌶️", nameAr: "صلصة المولي", nameEn: "Mole sauce" },
    ],
  },
  BR: {
    bestMonthsAr: "أبريل – يونيو، سبتمبر – نوفمبر",
    bestMonthsEn: "April – June, September – November",
    attractions: [
      { wikiTitle: "Christ the Redeemer", nameAr: "تمثال المسيح الفادي", nameEn: "Christ the Redeemer", booking: "official" },
      { wikiTitle: "Iguazu Falls", nameAr: "شلالات إيغواسو", nameEn: "Iguazu Falls", booking: "official" },
      { wikiTitle: "Copacabana Beach", nameAr: "شاطئ كوباكابانا", nameEn: "Copacabana Beach", booking: "free" },
    ],
    activities: [
      { emoji: "🏖️", nameAr: "الاسترخاء في شواطئ ريو", nameEn: "Rio de Janeiro beach time", costTier: "free", booking: "free" },
      { wikiTitle: "Samba", emoji: "💃", nameAr: "حضور عرض سامبا", nameEn: "Samba show", costTier: "$$", booking: "official" },
      { wikiTitle: "Sugarloaf Mountain", emoji: "🚡", nameAr: "التلفريك إلى قمة السكر", nameEn: "Sugarloaf Mountain cable car", costTier: "$$", booking: "official" },
    ],
    cuisine: [
      { wikiTitle: "Churrasco", emoji: "🥩", nameAr: "الشوربراسكو البرازيلي", nameEn: "Brazilian churrasco (BBQ)" },
      { wikiTitle: "Feijoada", emoji: "🍲", nameAr: "الفيجوادا", nameEn: "Feijoada" },
      { wikiTitle: "Caipirinha", emoji: "🍹", nameAr: "الكايبيرينيا", nameEn: "Caipirinha" },
    ],
  },
  AU: {
    bestMonthsAr: "سبتمبر – نوفمبر، مارس – مايو",
    bestMonthsEn: "September – November, March – May",
    attractions: [
      { wikiTitle: "Sydney Opera House", nameAr: "دار أوبرا سيدني", nameEn: "Sydney Opera House", booking: "official" },
      { wikiTitle: "Great Barrier Reef", nameAr: "الحاجز المرجاني العظيم", nameEn: "Great Barrier Reef", booking: "guide" },
      { wikiTitle: "Uluru", nameAr: "صخرة أولورو", nameEn: "Uluru", booking: "official" },
    ],
    activities: [
      { wikiTitle: "Great Barrier Reef", emoji: "🤿", nameAr: "الغطس في الحاجز المرجاني", nameEn: "Great Barrier Reef diving", costTier: "$$$", booking: "guide" },
      { wikiTitle: "Bondi Beach", emoji: "🏄", nameAr: "ركوب الأمواج في بوندي بيتش", nameEn: "Surfing at Bondi Beach", costTier: "$$", booking: "guide" },
      { emoji: "🦘", nameAr: "زيارة محمية الحياة البرية", nameEn: "Wildlife sanctuary visit", costTier: "$$", booking: "official" },
    ],
    cuisine: [
      { emoji: "🥧", nameAr: "فطيرة اللحم الأسترالية", nameEn: "Australian meat pie" },
      { emoji: "🦞", nameAr: "المأكولات البحرية الطازجة", nameEn: "Fresh seafood" },
      { emoji: "☕", nameAr: "ثقافة القهوة الأسترالية", nameEn: "Australian coffee culture" },
    ],
  },
  TN: {
    bestMonthsAr: "أبريل – يونيو، سبتمبر – أكتوبر",
    bestMonthsEn: "April – June, September – October",
    attractions: [
      { wikiTitle: "Carthage", nameAr: "قرطاج الأثرية", nameEn: "Carthage", booking: "official" },
      { wikiTitle: "Sidi Bou Said", nameAr: "سيدي بوسعيد", nameEn: "Sidi Bou Said", booking: "free" },
      { wikiTitle: "Amphitheatre of El Jem", nameAr: "مدرج الجم", nameEn: "Amphitheatre of El Jem", booking: "official" },
    ],
    activities: [
      { wikiTitle: "Sahara", emoji: "🏜️", nameAr: "رحلة صحراوية إلى الصحراء الكبرى", nameEn: "Sahara desert excursion", costTier: "$$", booking: "guide" },
      { wikiTitle: "Hammamet", emoji: "🏖️", nameAr: "الاسترخاء في شواطئ الحمامات", nameEn: "Relaxing in Hammamet", costTier: "free", booking: "free" },
      { emoji: "🛍️", nameAr: "التسوق في أسواق تونس القديمة", nameEn: "Shopping the Tunis medina", costTier: "free", booking: "free" },
    ],
    cuisine: [
      { wikiTitle: "Couscous", emoji: "🍲", nameAr: "الكسكسي التونسي", nameEn: "Tunisian couscous" },
      { wikiTitle: "Harissa", emoji: "🌶️", nameAr: "الهريسة", nameEn: "Harissa" },
      { wikiTitle: "Brik", emoji: "🥙", nameAr: "البريك", nameEn: "Brik" },
    ],
  },
  LB: {
    bestMonthsAr: "أبريل – يونيو، سبتمبر – أكتوبر",
    bestMonthsEn: "April – June, September – October",
    attractions: [
      { wikiTitle: "Baalbek", nameAr: "بعلبك", nameEn: "Baalbek", booking: "official" },
      { wikiTitle: "Jeita Grotto", nameAr: "مغارة جعيتا", nameEn: "Jeita Grotto", booking: "official" },
      { wikiTitle: "Beirut", nameAr: "وسط بيروت", nameEn: "Beirut", booking: "free" },
    ],
    activities: [
      { wikiTitle: "Skiing", emoji: "⛷️", nameAr: "التزلج في جبال لبنان", nameEn: "Skiing in the Lebanese mountains", costTier: "$$", booking: "official" },
      { wikiTitle: "Bekaa Valley", emoji: "🍷", nameAr: "جولة تذوق نبيذ وادي البقاع", nameEn: "Bekaa Valley wine tasting", costTier: "$$", booking: "guide" },
      { emoji: "🌃", nameAr: "السهر في شارع الحمرا", nameEn: "Nightlife on Hamra Street", costTier: "$$", booking: "free" },
    ],
    cuisine: [
      { wikiTitle: "Mezze", emoji: "🥙", nameAr: "المقبلات اللبنانية (مازة)", nameEn: "Lebanese mezze" },
      { wikiTitle: "Falafel", emoji: "🧆", nameAr: "الفلافل والحمص", nameEn: "Falafel & hummus" },
      { emoji: "🍢", nameAr: "الكباب اللبناني", nameEn: "Lebanese kebab" },
    ],
  },
};
