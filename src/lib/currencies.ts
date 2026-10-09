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
];

export function findCurrency(code: string): Currency | undefined {
  return CURRENCIES.find((c) => c.code === code.toUpperCase());
}

/**
 * The 20 states that spend the euro.
 *
 * Listed explicitly because the euro breaks the one-country-one-currency
 * assumption the table above is built on: France, Italy and Spain have no row
 * of their own, and without this a traveller flying to Paris would be told we
 * don't know what money they use. Non-EU users of the euro (Monaco, Kosovo,
 * Montenegro) are included — what matters here is what you pay with.
 */
const EURO_COUNTRIES = new Set([
  "AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT",
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

