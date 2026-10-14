// What kind of trip each destination is for — editorial, version 1.0, and
// open to review.
//
// These tags do not change a single climate figure. They only choose which
// trip profile(s) a month is judged against (src/lib/travelSeason/config.ts):
// 31 °C is a fine beach afternoon and a hard city one. A month is scored once
// per tag and the best tag wins; the universal caps (extreme heat, monsoon
// rain, deep cold) apply whatever the tag.
//
// Assigned by what each place is chiefly visited for: "beach" only where the
// city itself is a beach destination, "tropical" for places inside the
// tropics with a tropical climate, "desert" where the city sits in or trades
// on desert, "mountain"/"nature" for towns visited for their landscape. No
// destination is tagged "ski" yet: none of the 145 is primarily a ski resort.

import type { DestinationType } from "../lib/travelSeason/config.ts";

export const DESTINATION_TYPES_VERSION = "1.3";

export const DESTINATION_TYPES: Record<string, DestinationType[]> = {
  // Saudi Arabia
  riyadh: ["city", "desert"],
  jeddah: ["city", "beach"],
  makkah: ["city"],
  madinah: ["city"],
  alula: ["desert", "nature"],
  abha: ["mountain", "nature"],
  // Türkiye
  istanbul: ["city"],
  antalya: ["beach", "city"],
  cappadocia: ["nature"],
  trabzon: ["city", "nature"],
  izmir: ["city", "beach"],
  bursa: ["city", "nature"],
  // UAE, Qatar, Kuwait, Bahrain, Oman
  dubai: ["city", "beach", "desert"],
  "abu-dhabi": ["city", "beach", "desert"],
  sharjah: ["city"],
  "ras-al-khaimah": ["beach", "desert", "nature"],
  doha: ["city", "desert"],
  "al-wakrah": ["beach", "desert"],
  "kuwait-city": ["city", "desert"],
  manama: ["city"],
  muscat: ["city", "beach"],
  salalah: ["nature", "beach"],
  nizwa: ["desert", "nature"],
  // Egypt, Morocco, Jordan, Tunisia, Lebanon
  cairo: ["city", "desert"],
  luxor: ["city", "desert"],
  aswan: ["city", "desert"],
  alexandria: ["city", "beach"],
  "sharm-el-sheikh": ["beach", "desert"],
  marrakesh: ["city", "desert"],
  casablanca: ["city"],
  fes: ["city"],
  chefchaouen: ["mountain", "nature"],
  tangier: ["city", "beach"],
  amman: ["city"],
  petra: ["desert", "nature"],
  aqaba: ["beach", "desert"],
  tunis: ["city"],
  sousse: ["beach", "city"],
  djerba: ["beach"],
  beirut: ["city"],
  byblos: ["city", "beach"],
  baalbek: ["city"],
  // Europe
  london: ["city"],
  edinburgh: ["city"],
  manchester: ["city"],
  oxford: ["city"],
  paris: ["city"],
  nice: ["city", "beach"],
  lyon: ["city"],
  marseille: ["city", "beach"],
  barcelona: ["city", "beach"],
  madrid: ["city"],
  granada: ["city"],
  seville: ["city"],
  cordoba: ["city"],
  rome: ["city"],
  venice: ["city"],
  florence: ["city"],
  milan: ["city"],
  naples: ["city"],
  athens: ["city"],
  santorini: ["beach"],
  mykonos: ["beach"],
  thessaloniki: ["city"],
  zurich: ["city"],
  geneva: ["city"],
  interlaken: ["mountain", "nature"],
  lucerne: ["city", "nature"],
  vienna: ["city"],
  salzburg: ["city"],
  innsbruck: ["mountain", "city"],
  amsterdam: ["city"],
  rotterdam: ["city"],
  "the-hague": ["city"],
  berlin: ["city"],
  munich: ["city"],
  hamburg: ["city"],
  frankfurt: ["city"],
  lisbon: ["city"],
  porto: ["city"],
  madeira: ["nature"],
  // South & South-East Asia
  male: ["beach", "tropical"],
  colombo: ["city", "tropical"],
  kandy: ["city", "tropical"],
  galle: ["beach", "tropical"],
  ella: ["mountain", "nature", "tropical"],
  bali: ["beach", "tropical"],
  ubud: ["nature", "tropical"],
  jakarta: ["city", "tropical"],
  yogyakarta: ["city", "tropical"],
  bangkok: ["city", "tropical"],
  phuket: ["beach", "tropical"],
  "chiang-mai": ["city", "nature", "tropical"],
  pattaya: ["beach", "tropical"],
  "kuala-lumpur": ["city", "tropical"],
  penang: ["city", "beach", "tropical"],
  langkawi: ["beach", "tropical"],
  malacca: ["city", "tropical"],
  singapore: ["city", "tropical"],
  hanoi: ["city"],
  "ho-chi-minh-city": ["city", "tropical"],
  "da-nang": ["beach", "city", "tropical"],
  "hoi-an": ["city", "beach", "tropical"],
  delhi: ["city"],
  agra: ["city"],
  jaipur: ["city", "desert"],
  mumbai: ["city", "tropical"],
  goa: ["beach", "tropical"],
  // East Asia
  tokyo: ["city"],
  kyoto: ["city"],
  osaka: ["city"],
  hiroshima: ["city"],
  seoul: ["city"],
  busan: ["city", "beach"],
  jeju: ["nature", "beach"],
  beijing: ["city"],
  shanghai: ["city"],
  xian: ["city"],
  guangzhou: ["city"],
  // Americas
  "new-york": ["city"],
  "los-angeles": ["city", "beach"],
  "las-vegas": ["city", "desert"],
  "san-francisco": ["city"],
  miami: ["city", "beach"],
  "mexico-city": ["city"],
  cancun: ["beach", "tropical"],
  guadalajara: ["city"],
  "rio-de-janeiro": ["city", "beach", "tropical"],
  "sao-paulo": ["city"],
  salvador: ["city", "beach", "tropical"],
  // Caucasus
  baku: ["city"],
  gabala: ["mountain", "nature"],
  guba: ["mountain", "nature"],
  tbilisi: ["city"],
  batumi: ["city", "beach"],
  kazbegi: ["mountain", "nature"],
  // Africa
  "cape-town": ["city", "beach", "nature"],
  johannesburg: ["city"],
  durban: ["city", "beach"],
  nairobi: ["city", "nature"],
  mombasa: ["beach", "tropical"],
  // Oceania
  sydney: ["city", "beach"],
  melbourne: ["city"],
  brisbane: ["city"],
  "gold-coast": ["beach"],
  // Batch 1 of the country expansion (1 Oct 2026)
  moscow: ["city"],
  "saint-petersburg": ["city"],
  kazan: ["city"],
  sochi: ["beach", "city", "mountain"],
  sarajevo: ["city", "mountain"],
  mostar: ["city"],
  tirana: ["city"],
  durres: ["beach", "city"],
  saranda: ["beach"],
  kotor: ["city", "beach"],
  budva: ["beach", "city"],
  podgorica: ["city"],
  belgrade: ["city"],
  "novi-sad": ["city"],
  zagreb: ["city"],
  split: ["beach", "city"],
  dubrovnik: ["city", "beach"],
  prague: ["city"],
  "karlovy-vary": ["city", "nature"],
  budapest: ["city"],
  warsaw: ["city"],
  krakow: ["city"],
  zakopane: ["mountain", "nature"],
  dublin: ["city"],
  galway: ["city", "nature"],
  brussels: ["city"],
  bruges: ["city"],
  stockholm: ["city"],
  oslo: ["city"],
  bergen: ["city", "nature"],
  tromso: ["nature", "city"],
  copenhagen: ["city"],
  helsinki: ["city"],
  rovaniemi: ["nature", "city"],
  ljubljana: ["city"],
  bled: ["nature", "mountain"],
  larnaca: ["beach", "city"],
  limassol: ["beach", "city"],
  paphos: ["beach", "city"],
  valletta: ["city", "beach"],
  bucharest: ["city"],
  brasov: ["city", "mountain"],
  reykjavik: ["city", "nature"],
  yerevan: ["city"],
  almaty: ["city", "mountain"],
  astana: ["city"],
  tashkent: ["city"],
  samarkand: ["city"],
  bukhara: ["city", "desert"],
  bishkek: ["city", "mountain"],
  karakol: ["mountain", "nature"],
  islamabad: ["city", "nature"],
  lahore: ["city"],
  kathmandu: ["city", "mountain"],
  pokhara: ["nature", "mountain"],
  manila: ["city", "tropical"],
  cebu: ["city", "beach", "tropical"],
  boracay: ["beach", "tropical"],
  "siem-reap": ["city", "tropical"],
  "phnom-penh": ["city", "tropical"],
  zanzibar: ["beach", "tropical"],
  arusha: ["nature", "city"],
  "port-louis": ["city", "beach", "tropical"],
  "grand-baie": ["beach", "tropical"],
  mahe: ["beach", "tropical"],
  toronto: ["city"],
  vancouver: ["city", "nature"],
  montreal: ["city"],
  banff: ["mountain", "nature"],
  // ── Coverage batch 2 (14 Oct 2026): staged cities, same rules as above.
  // Not on the site until each city passes scripts/coverage/check.py.
  // Saudi Arabia
  dammam: ["city", "beach"],
  taif: ["mountain", "city"],
  // Turkey
  bodrum: ["beach"],
  // Georgia
  kutaisi: ["city", "nature"],
  // Kyrgyzstan
  osh: ["city", "mountain"],
  // India
  kochi: ["city", "beach", "tropical"],
  bengaluru: ["city"],
  // Maldives
  maafushi: ["beach", "tropical"],
  // Bhutan
  paro: ["mountain", "nature"],
  // Bangladesh
  dhaka: ["city"],
  // China
  shenzhen: ["city"],
  chengdu: ["city"],
  // Japan
  sapporo: ["city"],
  fukuoka: ["city"],
  okinawa: ["beach"],
  // Taiwan
  taipei: ["city"],
  // Hong Kong
  "hong-kong": ["city"],
  // Macau
  macau: ["city"],
  // Thailand
  krabi: ["beach", "tropical"],
  "koh-samui": ["beach", "tropical"],
  // Malaysia
  "kota-kinabalu": ["city", "beach", "tropical"],
  // Indonesia
  lombok: ["beach", "tropical"],
  "labuan-bajo": ["beach", "nature", "tropical"],
  // Vietnam
  "nha-trang": ["beach", "tropical"],
  "phu-quoc": ["beach", "tropical"],
  // Philippines
  "puerto-princesa": ["nature", "beach", "tropical"],
  // Laos
  "luang-prabang": ["city", "nature", "tropical"],
  vientiane: ["city", "tropical"],
  // Brunei
  "bandar-seri-begawan": ["city", "tropical"],
  // France
  bordeaux: ["city"],
  strasbourg: ["city"],
  // Italy
  pisa: ["city"],
  bologna: ["city"],
  palermo: ["city", "beach"],
  // Spain
  malaga: ["city", "beach"],
  valencia: ["city", "beach"],
  ibiza: ["beach"],
  palma: ["beach", "city"],
  // Portugal
  faro: ["beach", "city"],
  // United Kingdom
  glasgow: ["city"],
  birmingham: ["city"],
  belfast: ["city"],
  // Ireland
  cork: ["city"],
  // Germany
  dusseldorf: ["city"],
  cologne: ["city"],
  // Switzerland
  lausanne: ["city"],
  zermatt: ["mountain", "ski"],
  // Czechia
  brno: ["city"],
  // Poland
  gdansk: ["city", "beach"],
  // Slovakia
  bratislava: ["city"],
  // Greece
  heraklion: ["beach", "city"],
  rhodes: ["beach", "city"],
  corfu: ["beach"],
  // Sweden
  gothenburg: ["city"],
  // Estonia
  tallinn: ["city"],
  // Latvia
  riga: ["city"],
  // Lithuania
  vilnius: ["city"],
  // Bulgaria
  sofia: ["city"],
  varna: ["beach", "city"],
  // North Macedonia
  skopje: ["city"],
  // Luxembourg
  luxembourg: ["city"],
  // Monaco
  "monte-carlo": ["city", "beach"],
  // San Marino
  "san-marino": ["city"],
  // Vatican City
  "vatican-city": ["city"],
  // Andorra
  "andorra-la-vella": ["mountain", "city"],
  // Egypt
  giza: ["city", "desert"],
  hurghada: ["beach", "desert"],
  // Morocco
  agadir: ["beach"],
  rabat: ["city"],
  // Tunisia
  hammamet: ["beach"],
  // Algeria
  algiers: ["city"],
  oran: ["city"],
  // Tanzania
  "dar-es-salaam": ["city", "beach", "tropical"],
  // Ethiopia
  "addis-ababa": ["city"],
  // Uganda
  entebbe: ["nature", "tropical"],
  // Rwanda
  kigali: ["city", "nature"],
  // Seychelles
  praslin: ["beach", "tropical"],
  // Madagascar
  antananarivo: ["city"],
  "nosy-be": ["beach", "tropical"],
  // Senegal
  dakar: ["city", "beach", "tropical"],
  // Ghana
  accra: ["city", "tropical"],
  // Nigeria
  lagos: ["city", "tropical"],
  // Namibia
  windhoek: ["city", "desert"],
  // Botswana
  gaborone: ["city"],
  // Zambia
  livingstone: ["nature", "tropical"],
  // Zimbabwe
  "victoria-falls": ["nature", "tropical"],
  // Mozambique
  maputo: ["city", "beach"],
  // Cabo Verde
  sal: ["beach", "tropical"],
  // United States
  orlando: ["city"],
  chicago: ["city"],
  "washington-dc": ["city"],
  seattle: ["city"],
  honolulu: ["beach", "city", "tropical"],
  boston: ["city"],
  // Canada
  calgary: ["city"],
  "quebec-city": ["city"],
  ottawa: ["city"],
  // Mexico
  "los-cabos": ["beach", "desert"],
  "puerto-vallarta": ["beach", "tropical"],
  // Cuba
  havana: ["city", "tropical"],
  varadero: ["beach", "tropical"],
  // Dominican Republic
  "punta-cana": ["beach", "tropical"],
  "santo-domingo": ["city", "tropical"],
  // Jamaica
  "montego-bay": ["beach", "tropical"],
  kingston: ["city", "tropical"],
  // Costa Rica
  "san-jose": ["city", "tropical"],
  liberia: ["nature", "beach", "tropical"],
  // Panama
  "panama-city": ["city", "tropical"],
  // Guatemala
  "guatemala-city": ["city"],
  // El Salvador
  "san-salvador": ["city", "tropical"],
  // Honduras
  roatan: ["beach", "tropical"],
  // Belize
  "belize-city": ["city", "beach", "tropical"],
  // Bahamas
  nassau: ["beach"],
  // Barbados
  bridgetown: ["beach", "tropical"],
  // Trinidad and Tobago
  "port-of-spain": ["city", "tropical"],
  // Brazil
  "foz-do-iguacu": ["nature"],
  florianopolis: ["beach", "city"],
  // Argentina
  "buenos-aires": ["city"],
  mendoza: ["city", "nature"],
  bariloche: ["mountain", "nature"],
  "el-calafate": ["nature"],
  // Chile
  santiago: ["city"],
  "punta-arenas": ["nature"],
  "easter-island": ["nature"],
  // Peru
  lima: ["city"],
  cusco: ["city", "mountain"],
  arequipa: ["city", "mountain"],
  // Colombia
  bogota: ["city"],
  medellin: ["city"],
  cartagena: ["city", "beach", "tropical"],
  // Ecuador
  quito: ["city", "mountain"],
  guayaquil: ["city", "tropical"],
  galapagos: ["nature", "tropical"],
  // Uruguay
  montevideo: ["city"],
  "punta-del-este": ["beach"],
  // Bolivia
  "la-paz": ["city", "mountain"],
  "santa-cruz": ["city", "tropical"],
  // Paraguay
  asuncion: ["city"],
  // Guyana
  georgetown: ["city", "tropical"],
  // Suriname
  paramaribo: ["city", "tropical"],
  // Australia
  perth: ["city", "beach"],
  adelaide: ["city"],
  cairns: ["nature", "beach", "tropical"],
  // New Zealand
  auckland: ["city"],
  wellington: ["city"],
  christchurch: ["city"],
  queenstown: ["mountain", "nature"],
  // Fiji
  nadi: ["beach", "tropical"],
  suva: ["city", "tropical"],
  // Papua New Guinea
  "port-moresby": ["city", "tropical"],
  // Samoa
  apia: ["beach", "tropical"],
  // Tonga
  nukualofa: ["beach", "tropical"],
  // Vanuatu
  "port-vila": ["beach", "tropical"],
  // Solomon Islands
  honiara: ["city", "tropical"],
  // Palau
  koror: ["beach", "tropical"],
  // Micronesia
  pohnpei: ["nature", "tropical"],
};

/**
 * Quality-test destinations that are not (yet) on the site. Used only by
 * the QA report, never published.
 */
export const QA_DESTINATION_TYPES: Record<string, DestinationType[]> = {
  // Ski fields, to test the ski profile on real data.
  "coronet-peak": ["ski"],
};
