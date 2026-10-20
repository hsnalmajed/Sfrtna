/**
 * Google's amenity names in Arabic, for the ones that matter when choosing a
 * hotel. Google sends them in English; on the Arabic page an amenity with no
 * entry here is left out rather than shown in English mid-sentence.
 */
const AR: Record<string, string> = {
  "free wi-fi": "واي فاي مجاني",
  "wi-fi": "واي فاي",
  "paid wi-fi": "واي فاي مدفوع",
  "free breakfast": "إفطار مجاني",
  breakfast: "إفطار",
  "breakfast ($)": "إفطار (مدفوع)",
  pool: "مسبح",
  "outdoor pool": "مسبح خارجي",
  "indoor pool": "مسبح داخلي",
  "free parking": "موقف مجاني",
  "paid parking": "موقف مدفوع",
  parking: "موقف سيارات",
  "air conditioning": "تكييف",
  "fitness centre": "نادٍ رياضي",
  "fitness center": "نادٍ رياضي",
  spa: "سبا",
  restaurant: "مطعم",
  "room service": "خدمة الغرف",
  "airport shuttle": "نقل من المطار",
  "free airport shuttle": "نقل مجاني من المطار",
  "kitchen in some rooms": "مطبخ في بعض الغرف",
  kitchen: "مطبخ",
  accessible: "مناسب لذوي الإعاقة",
  "business centre": "مركز أعمال",
  "business center": "مركز أعمال",
  "laundry service": "خدمة غسيل",
  "child-friendly": "مناسب للأطفال",
  "kid-friendly": "مناسب للأطفال",
  "beach access": "وصول للشاطئ",
  "hot tub": "جاكوزي",
  "smoke-free property": "خالٍ من التدخين",
  "pet-friendly": "يسمح بالحيوانات الأليفة",
  "full-service laundry": "خدمة غسيل كاملة",
  "elevator": "مصعد",
  "free cancellation": "إلغاء مجاني",
  "wi-fi ($)": "واي فاي (مدفوع)",
  "free wi-fi in public areas": "واي فاي مجاني في الأماكن العامة",
  "parking ($)": "موقف (مدفوع)",
  "self-parking": "موقف ذاتي",
  "valet parking": "صف السيارات",
  "pools": "مسابح",
  "bar": "بار",
  "airport shuttle ($)": "نقل من المطار (مدفوع)",
  "kitchen in rooms": "مطبخ في الغرف",
  "kitchenette": "مطبخ صغير",
  "wheelchair accessible": "مهيأ للكراسي المتحركة",
  "kids' club": "نادي أطفال",
  "kids club": "نادي أطفال",
  "golf": "غولف",
  "ocean view": "إطلالة على البحر",
  "balcony": "شرفة",
  "microwave": "ميكروويف",
  "refrigerator": "ثلاجة",
  "24-hour front desk": "استقبال 24 ساعة",
  "no-smoking rooms": "غرف لغير المدخنين",
  "pets allowed": "يسمح بالحيوانات الأليفة",
  "pet-friendly ($)": "يسمح بالحيوانات الأليفة (مدفوع)",
  "tv": "تلفاز",
  "laundry": "غسيل ملابس",
  "fitness centre ($)": "نادٍ رياضي (مدفوع)",
  "family rooms": "غرف عائلية",
  "connecting rooms": "غرف متصلة",
  "prayer room": "مصلى",
  "free breakfast buffet": "إفطار مجاني",
  "private beach": "شاطئ خاص",
};

/**
 * The few things that decide a booking (breakfast, parking, internet, pool,
 * kitchen, airport transfer, air conditioning, family), each once, the free
 * kind marked — shown first on the hotel's page.
 */
const KEY: { test: RegExp; icon: string; ar: string; en: string; free?: RegExp }[] = [
  { test: /breakfast/i, icon: "🍳", ar: "الإفطار", en: "Breakfast", free: /free/i },
  { test: /parking/i, icon: "🅿️", ar: "موقف سيارات", en: "Parking", free: /free/i },
  { test: /wi-?fi|internet/i, icon: "📶", ar: "واي فاي", en: "Wi-Fi", free: /free/i },
  { test: /pool/i, icon: "🏊", ar: "مسبح", en: "Pool" },
  { test: /kitchen/i, icon: "🍽️", ar: "مطبخ", en: "Kitchen" },
  { test: /airport shuttle/i, icon: "🚐", ar: "نقل من المطار", en: "Airport shuttle", free: /free/i },
  { test: /air conditioning/i, icon: "❄️", ar: "تكييف", en: "Air conditioning" },
  { test: /fitness/i, icon: "🏋️", ar: "نادٍ رياضي", en: "Gym" },
  { test: /spa/i, icon: "💆", ar: "سبا", en: "Spa" },
  { test: /restaurant/i, icon: "🍴", ar: "مطعم", en: "Restaurant" },
  { test: /child|kid|family/i, icon: "👨‍👩‍👧", ar: "مناسب للعائلات", en: "Family-friendly" },
  { test: /beach/i, icon: "🏖️", ar: "شاطئ", en: "Beach" },
];

export function keyAmenities(names: string[], locale: "ar" | "en"): { label: string; icon: string; free: boolean }[] {
  const out: { label: string; icon: string; free: boolean }[] = [];
  for (const k of KEY) {
    const hits = names.filter((n) => k.test.test(n));
    if (!hits.length) continue;
    // "Free breakfast" beats "Breakfast ($)": the best kind the hotel offers.
    const free = Boolean(k.free && hits.some((h) => k.free!.test(h) && !/\(\$\)/.test(h)));
    const paid = hits.every((h) => /\(\$\)|paid/i.test(h));
    const base = locale === "ar" ? k.ar : k.en;
    const label = free
      ? locale === "ar" ? `${base} مجاني` : `Free ${base.toLowerCase()}`
      : paid
        ? locale === "ar" ? `${base} (مدفوع)` : `${base} (paid)`
        : base;
    out.push({ label, icon: k.icon, free });
  }
  return out;
}

export function amenityLabel(name: string, locale: "ar" | "en"): string | null {
  if (locale === "en") return name;
  return AR[name.trim().toLowerCase()] ?? null;
}

/** Up to `max` amenities in the page's language, in Google's order. */
export function amenityLabels(names: string[], locale: "ar" | "en", max: number): string[] {
  const out: string[] = [];
  for (const n of names) {
    const l = amenityLabel(n, locale);
    if (l && !out.includes(l)) out.push(l);
    if (out.length >= max) break;
  }
  return out;
}
