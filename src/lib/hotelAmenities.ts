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
};

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
