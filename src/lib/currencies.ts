// The currencies a traveller using this site actually needs.
//
// Deliberately not "every ISO 4217 code": a list of 160 entries is a worse
// picker than a list of 50 that covers where our guides go. This is the
// currency of every country the attractions guide covers, plus the majors
// anyone converting money is likely to be holding.
//
// `decimals` is not decoration. Most currencies are quoted to 2 places, but
// the Kuwaiti, Bahraini, Omani and Jordanian dinars are quoted to 3, and the
// yen and won to none. Showing "0.31 KWD" where the real figure is 0.308 is
// a rounding error a traveller would feel at an exchange counter.

export interface Currency {
  /** ISO 4217 code — also the key used against the rates table. */
  code: string;
  nameAr: string;
  nameEn: string;
  /** ISO 3166-1 alpha-2 country code, only for drawing the flag. */
  country: string;
  /** Places this currency is normally quoted to. */
  decimals: number;
}

export const CURRENCIES: Currency[] = [
  // Gulf
  { code: "SAR", nameAr: "الريال السعودي", nameEn: "Saudi Riyal", country: "SA", decimals: 2 },
  { code: "AED", nameAr: "الدرهم الإماراتي", nameEn: "UAE Dirham", country: "AE", decimals: 2 },
  { code: "QAR", nameAr: "الريال القطري", nameEn: "Qatari Riyal", country: "QA", decimals: 2 },
  { code: "KWD", nameAr: "الدينار الكويتي", nameEn: "Kuwaiti Dinar", country: "KW", decimals: 3 },
  { code: "BHD", nameAr: "الدينار البحريني", nameEn: "Bahraini Dinar", country: "BH", decimals: 3 },
  { code: "OMR", nameAr: "الريال العُماني", nameEn: "Omani Rial", country: "OM", decimals: 3 },

  // Wider Arab world
  { code: "EGP", nameAr: "الجنيه المصري", nameEn: "Egyptian Pound", country: "EG", decimals: 2 },
  { code: "JOD", nameAr: "الدينار الأردني", nameEn: "Jordanian Dinar", country: "JO", decimals: 3 },
  { code: "MAD", nameAr: "الدرهم المغربي", nameEn: "Moroccan Dirham", country: "MA", decimals: 2 },
  { code: "TND", nameAr: "الدينار التونسي", nameEn: "Tunisian Dinar", country: "TN", decimals: 3 },
  { code: "DZD", nameAr: "الدينار الجزائري", nameEn: "Algerian Dinar", country: "DZ", decimals: 2 },
  { code: "LBP", nameAr: "الليرة اللبنانية", nameEn: "Lebanese Pound", country: "LB", decimals: 2 },
  { code: "IQD", nameAr: "الدينار العراقي", nameEn: "Iraqi Dinar", country: "IQ", decimals: 3 },
  { code: "SDG", nameAr: "الجنيه السوداني", nameEn: "Sudanese Pound", country: "SD", decimals: 2 },
  { code: "YER", nameAr: "الريال اليمني", nameEn: "Yemeni Rial", country: "YE", decimals: 2 },
  { code: "SYP", nameAr: "الليرة السورية", nameEn: "Syrian Pound", country: "SY", decimals: 2 },
  { code: "LYD", nameAr: "الدينار الليبي", nameEn: "Libyan Dinar", country: "LY", decimals: 3 },

  // Majors
  { code: "USD", nameAr: "الدولار الأمريكي", nameEn: "US Dollar", country: "US", decimals: 2 },
  { code: "EUR", nameAr: "اليورو", nameEn: "Euro", country: "EU", decimals: 2 },
  { code: "GBP", nameAr: "الجنيه الإسترليني", nameEn: "British Pound", country: "GB", decimals: 2 },
  { code: "CHF", nameAr: "الفرنك السويسري", nameEn: "Swiss Franc", country: "CH", decimals: 2 },
  { code: "JPY", nameAr: "الين الياباني", nameEn: "Japanese Yen", country: "JP", decimals: 0 },
  { code: "CNY", nameAr: "اليوان الصيني", nameEn: "Chinese Yuan", country: "CN", decimals: 2 },
  { code: "CAD", nameAr: "الدولار الكندي", nameEn: "Canadian Dollar", country: "CA", decimals: 2 },
  { code: "AUD", nameAr: "الدولار الأسترالي", nameEn: "Australian Dollar", country: "AU", decimals: 2 },

  // Popular destinations
  { code: "TRY", nameAr: "الليرة التركية", nameEn: "Turkish Lira", country: "TR", decimals: 2 },
  { code: "INR", nameAr: "الروبية الهندية", nameEn: "Indian Rupee", country: "IN", decimals: 2 },
  { code: "PKR", nameAr: "الروبية الباكستانية", nameEn: "Pakistani Rupee", country: "PK", decimals: 2 },
  { code: "THB", nameAr: "البات التايلاندي", nameEn: "Thai Baht", country: "TH", decimals: 2 },
  { code: "MYR", nameAr: "الرينغيت الماليزي", nameEn: "Malaysian Ringgit", country: "MY", decimals: 2 },
  { code: "IDR", nameAr: "الروبية الإندونيسية", nameEn: "Indonesian Rupiah", country: "ID", decimals: 0 },
  { code: "SGD", nameAr: "الدولار السنغافوري", nameEn: "Singapore Dollar", country: "SG", decimals: 2 },
  { code: "PHP", nameAr: "البيزو الفلبيني", nameEn: "Philippine Peso", country: "PH", decimals: 2 },
  { code: "KRW", nameAr: "الوون الكوري", nameEn: "South Korean Won", country: "KR", decimals: 0 },
  { code: "HKD", nameAr: "دولار هونغ كونغ", nameEn: "Hong Kong Dollar", country: "HK", decimals: 2 },
  { code: "LKR", nameAr: "الروبية السريلانكية", nameEn: "Sri Lankan Rupee", country: "LK", decimals: 2 },
  { code: "MVR", nameAr: "الروفية المالديفية", nameEn: "Maldivian Rufiyaa", country: "MV", decimals: 2 },
  { code: "VND", nameAr: "الدونغ الفيتنامي", nameEn: "Vietnamese Dong", country: "VN", decimals: 0 },
  { code: "AZN", nameAr: "المانات الأذربيجاني", nameEn: "Azerbaijani Manat", country: "AZ", decimals: 2 },
  { code: "GEL", nameAr: "اللاري الجورجي", nameEn: "Georgian Lari", country: "GE", decimals: 2 },
  { code: "RUB", nameAr: "الروبل الروسي", nameEn: "Russian Ruble", country: "RU", decimals: 2 },
  { code: "ZAR", nameAr: "الراند الجنوب أفريقي", nameEn: "South African Rand", country: "ZA", decimals: 2 },
  { code: "KES", nameAr: "الشلن الكيني", nameEn: "Kenyan Shilling", country: "KE", decimals: 2 },
  { code: "MUR", nameAr: "الروبية الموريشية", nameEn: "Mauritian Rupee", country: "MU", decimals: 2 },

  // Europe outside the euro
  { code: "SEK", nameAr: "الكرونة السويدية", nameEn: "Swedish Krona", country: "SE", decimals: 2 },
  { code: "NOK", nameAr: "الكرونة النرويجية", nameEn: "Norwegian Krone", country: "NO", decimals: 2 },
  { code: "DKK", nameAr: "الكرونة الدنماركية", nameEn: "Danish Krone", country: "DK", decimals: 2 },
  { code: "PLN", nameAr: "الزلوتي البولندي", nameEn: "Polish Zloty", country: "PL", decimals: 2 },
  { code: "CZK", nameAr: "الكرونة التشيكية", nameEn: "Czech Koruna", country: "CZ", decimals: 2 },
  { code: "HUF", nameAr: "الفورنت المجري", nameEn: "Hungarian Forint", country: "HU", decimals: 2 },
  { code: "RON", nameAr: "الليو الروماني", nameEn: "Romanian Leu", country: "RO", decimals: 2 },
  { code: "UAH", nameAr: "الهريفنيا الأوكرانية", nameEn: "Ukrainian Hryvnia", country: "UA", decimals: 2 },

  // Americas
  { code: "BRL", nameAr: "الريال البرازيلي", nameEn: "Brazilian Real", country: "BR", decimals: 2 },
  { code: "MXN", nameAr: "البيزو المكسيكي", nameEn: "Mexican Peso", country: "MX", decimals: 2 },
  { code: "ARS", nameAr: "البيزو الأرجنتيني", nameEn: "Argentine Peso", country: "AR", decimals: 2 },

  { code: "NZD", nameAr: "الدولار النيوزيلندي", nameEn: "New Zealand Dollar", country: "NZ", decimals: 2 },
  // Added with the coverage section (13 Oct 2026): the currency of every
  // country the site covers or is adding. ISO 4217 codes; `decimals` is how
  // prices are quoted there (currencies that trade in thousands show none).
  { code: "ALL", nameAr: "الليك الألباني", nameEn: "Albanian Lek", country: "AL", decimals: 0 },
  { code: "AMD", nameAr: "الدرام الأرميني", nameEn: "Armenian Dram", country: "AM", decimals: 0 },
  { code: "BAM", nameAr: "المارك البوسني", nameEn: "Bosnia-Herzegovina Convertible Mark", country: "BA", decimals: 2 },
  { code: "ISK", nameAr: "الكرونة الآيسلندية", nameEn: "Icelandic Króna", country: "IS", decimals: 0 },
  { code: "KGS", nameAr: "السوم القيرغيزي", nameEn: "Kyrgyzstani Som", country: "KG", decimals: 2 },
  { code: "KHR", nameAr: "الريال الكمبودي", nameEn: "Cambodian Riel", country: "KH", decimals: 0 },
  { code: "KZT", nameAr: "التينغي الكازاخستاني", nameEn: "Kazakhstani Tenge", country: "KZ", decimals: 0 },
  { code: "NPR", nameAr: "الروبية النيبالية", nameEn: "Nepalese Rupee", country: "NP", decimals: 2 },
  { code: "RSD", nameAr: "الدينار الصربي", nameEn: "Serbian Dinar", country: "RS", decimals: 0 },
  { code: "TZS", nameAr: "الشلن التنزاني", nameEn: "Tanzanian Shilling", country: "TZ", decimals: 0 },
  { code: "UZS", nameAr: "السوم الأوزبكي", nameEn: "Uzbekistani Som", country: "UZ", decimals: 0 },
  { code: "MKD", nameAr: "الدينار المقدوني", nameEn: "Macedonian Denar", country: "MK", decimals: 0 },
  { code: "BDT", nameAr: "التاكا البنغلاديشي", nameEn: "Bangladeshi Taka", country: "BD", decimals: 2 },
  { code: "BTN", nameAr: "النغولترم البوتاني", nameEn: "Bhutanese Ngultrum", country: "BT", decimals: 2 },
  { code: "BND", nameAr: "الدولار البروني", nameEn: "Brunei Dollar", country: "BN", decimals: 2 },
  { code: "LAK", nameAr: "الكيب اللاوسي", nameEn: "Lao Kip", country: "LA", decimals: 0 },
  { code: "MOP", nameAr: "الباتاكا الماكاوية", nameEn: "Macanese Pataca", country: "MO", decimals: 2 },
  { code: "TWD", nameAr: "الدولار التايواني الجديد", nameEn: "New Taiwan Dollar", country: "TW", decimals: 0 },
  { code: "ETB", nameAr: "البير الإثيوبي", nameEn: "Ethiopian Birr", country: "ET", decimals: 2 },
  { code: "UGX", nameAr: "الشلن الأوغندي", nameEn: "Ugandan Shilling", country: "UG", decimals: 0 },
  { code: "RWF", nameAr: "الفرنك الرواندي", nameEn: "Rwandan Franc", country: "RW", decimals: 0 },
  { code: "SCR", nameAr: "الروبية السيشلية", nameEn: "Seychellois Rupee", country: "SC", decimals: 2 },
  { code: "MGA", nameAr: "الأرياري الملغاشي", nameEn: "Malagasy Ariary", country: "MG", decimals: 0 },
  { code: "XOF", nameAr: "فرنك غرب أفريقيا", nameEn: "West African CFA Franc", country: "SN", decimals: 0 },
  { code: "GHS", nameAr: "السيدي الغاني", nameEn: "Ghanaian Cedi", country: "GH", decimals: 2 },
  { code: "NGN", nameAr: "النيرة النيجيرية", nameEn: "Nigerian Naira", country: "NG", decimals: 0 },
  { code: "NAD", nameAr: "الدولار الناميبي", nameEn: "Namibian Dollar", country: "NA", decimals: 2 },
  { code: "BWP", nameAr: "البولا البوتسواني", nameEn: "Botswana Pula", country: "BW", decimals: 2 },
  { code: "ZMW", nameAr: "الكواشا الزامبية", nameEn: "Zambian Kwacha", country: "ZM", decimals: 2 },
  { code: "MZN", nameAr: "الميتيكال الموزمبيقي", nameEn: "Mozambican Metical", country: "MZ", decimals: 2 },
  { code: "CVE", nameAr: "الإسكودو الأخضر", nameEn: "Cape Verdean Escudo", country: "CV", decimals: 0 },
  { code: "CUP", nameAr: "البيزو الكوبي", nameEn: "Cuban Peso", country: "CU", decimals: 0 },
  { code: "DOP", nameAr: "البيزو الدومينيكاني", nameEn: "Dominican Peso", country: "DO", decimals: 0 },
  { code: "JMD", nameAr: "الدولار الجامايكي", nameEn: "Jamaican Dollar", country: "JM", decimals: 0 },
  { code: "CRC", nameAr: "الكولون الكوستاريكي", nameEn: "Costa Rican Colón", country: "CR", decimals: 0 },
  { code: "GTQ", nameAr: "الكتزال الغواتيمالي", nameEn: "Guatemalan Quetzal", country: "GT", decimals: 2 },
  { code: "HNL", nameAr: "اللمبيرا الهندوراسية", nameEn: "Honduran Lempira", country: "HN", decimals: 2 },
  { code: "BZD", nameAr: "الدولار البليزي", nameEn: "Belize Dollar", country: "BZ", decimals: 2 },
  { code: "BSD", nameAr: "الدولار البهامي", nameEn: "Bahamian Dollar", country: "BS", decimals: 2 },
  { code: "BBD", nameAr: "الدولار البربادوسي", nameEn: "Barbadian Dollar", country: "BB", decimals: 2 },
  { code: "TTD", nameAr: "دولار ترينيداد وتوباغو", nameEn: "Trinidad and Tobago Dollar", country: "TT", decimals: 2 },
  { code: "CLP", nameAr: "البيزو التشيلي", nameEn: "Chilean Peso", country: "CL", decimals: 0 },
  { code: "PEN", nameAr: "السول البيروفي", nameEn: "Peruvian Sol", country: "PE", decimals: 2 },
  { code: "COP", nameAr: "البيزو الكولومبي", nameEn: "Colombian Peso", country: "CO", decimals: 0 },
  { code: "UYU", nameAr: "البيزو الأوروغواياني", nameEn: "Uruguayan Peso", country: "UY", decimals: 0 },
  { code: "BOB", nameAr: "البوليفيانو", nameEn: "Bolivian Boliviano", country: "BO", decimals: 2 },
  { code: "PYG", nameAr: "الغواراني الباراغوياني", nameEn: "Paraguayan Guaraní", country: "PY", decimals: 0 },
  { code: "GYD", nameAr: "الدولار الغوياني", nameEn: "Guyanese Dollar", country: "GY", decimals: 0 },
  { code: "SRD", nameAr: "الدولار السورينامي", nameEn: "Surinamese Dollar", country: "SR", decimals: 2 },
  { code: "FJD", nameAr: "الدولار الفيجي", nameEn: "Fijian Dollar", country: "FJ", decimals: 2 },
  { code: "PGK", nameAr: "الكينا البابوية", nameEn: "Papua New Guinean Kina", country: "PG", decimals: 2 },
  { code: "WST", nameAr: "التالا الساموية", nameEn: "Samoan Tālā", country: "WS", decimals: 2 },
  { code: "TOP", nameAr: "البانغا التونغية", nameEn: "Tongan Paʻanga", country: "TO", decimals: 2 },
  { code: "VUV", nameAr: "الفاتو الفانواتي", nameEn: "Vanuatu Vatu", country: "VU", decimals: 0 },
  { code: "SBD", nameAr: "دولار جزر سليمان", nameEn: "Solomon Islands Dollar", country: "SB", decimals: 2 },
];

export function findCurrency(code: string): Currency | undefined {
  return CURRENCIES.find((c) => c.code === code.toUpperCase());
}

/**
 * The 21 states that spend the euro (Bulgaria from 1 Jan 2026, European
 * Commission).
 *
 * Listed explicitly because the euro breaks the one-country-one-currency
 * assumption the table above is built on: France, Italy and Spain have no row
 * of their own, and without this a traveller flying to Paris would be told we
 * don't know what money they use. Non-EU users of the euro (Monaco, Kosovo,
 * Montenegro) are included — what matters here is what you pay with.
 */
const EURO_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT",
  "LU", "MT", "NL", "PT", "SK", "SI", "ES",
  "AD", "MC", "SM", "VA", "ME", "XK",
]);

/** A handful of countries whose currency isn't the one their code suggests. */
const COUNTRY_CURRENCY_OVERRIDES: Record<string, string> = {
  // Both use the US dollar as their own legal tender.
  EC: "USD",
  PA: "USD",
  // Liechtenstein spends Swiss francs.
  LI: "CHF",
  // The US dollar is the legal tender of El Salvador, Palau and Micronesia;
  // Zimbabwe's own ZiG exists but visitors pay in US dollars.
  SV: "USD",
  PW: "USD",
  FM: "USD",
  ZW: "USD",
};

/**
 * What money you actually spend in a country.
 *
 * Returns undefined rather than guessing when we have no row for it — the
 * interface then says nothing instead of quoting a rate for the wrong money,
 * which is the kind of mistake someone budgets a whole trip around.
 */
export function currencyForCountry(countryCode: string | undefined): Currency | undefined {
  const code = (countryCode ?? "").toUpperCase();
  if (!code) return undefined;
  if (EURO_COUNTRIES.has(code)) return findCurrency("EUR");
  const override = COUNTRY_CURRENCY_OVERRIDES[code];
  if (override) return findCurrency(override);
  return CURRENCIES.find((c) => c.country.toUpperCase() === code);
}

