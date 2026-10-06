// A curated list of major world airports used for the origin/destination
// autocomplete on both search forms. Searching by city ("الرياض") or country
// ("السعودية") surfaces the matching airport(s) — real IATA codes, so the
// selected value plugs straight into resolveIata() in flights.ts.
import { searchMatches } from "@/lib/search";

export interface Airport {
  iata: string;
  nameAr: string;
  nameEn: string;
  cityAr: string;
  cityEn: string;
  countryAr: string;
  countryEn: string;
}

export const AIRPORTS: Airport[] = [
  // Saudi Arabia
  { iata: "RUH", nameAr: "مطار الملك خالد الدولي", nameEn: "King Khalid International Airport", cityAr: "الرياض", cityEn: "Riyadh", countryAr: "السعودية", countryEn: "Saudi Arabia" },
  { iata: "JED", nameAr: "مطار الملك عبدالعزيز الدولي", nameEn: "King Abdulaziz International Airport", cityAr: "جدة", cityEn: "Jeddah", countryAr: "السعودية", countryEn: "Saudi Arabia" },
  { iata: "DMM", nameAr: "مطار الملك فهد الدولي", nameEn: "King Fahd International Airport", cityAr: "الدمام", cityEn: "Dammam", countryAr: "السعودية", countryEn: "Saudi Arabia" },
  { iata: "MED", nameAr: "مطار الأمير محمد بن عبدالعزيز الدولي", nameEn: "Prince Mohammad bin Abdulaziz Airport", cityAr: "المدينة المنورة", cityEn: "Medina", countryAr: "السعودية", countryEn: "Saudi Arabia" },
  { iata: "AHB", nameAr: "مطار أبها الإقليمي", nameEn: "Abha International Airport", cityAr: "أبها", cityEn: "Abha", countryAr: "السعودية", countryEn: "Saudi Arabia" },
  { iata: "TIF", nameAr: "مطار الطائف الإقليمي", nameEn: "Taif Regional Airport", cityAr: "الطائف", cityEn: "Taif", countryAr: "السعودية", countryEn: "Saudi Arabia" },
  { iata: "GIZ", nameAr: "مطار جازان الإقليمي", nameEn: "Jazan Regional Airport", cityAr: "جازان", cityEn: "Jazan", countryAr: "السعودية", countryEn: "Saudi Arabia" },
  { iata: "YNB", nameAr: "مطار ينبع", nameEn: "Yanbu Airport", cityAr: "ينبع", cityEn: "Yanbu", countryAr: "السعودية", countryEn: "Saudi Arabia" },
  { iata: "ELQ", nameAr: "مطار الأمير نايف بن عبدالعزيز الإقليمي", nameEn: "Prince Naif bin Abdulaziz Airport", cityAr: "القصيم (بريدة)", cityEn: "Qassim (Buraydah)", countryAr: "السعودية", countryEn: "Saudi Arabia" },
  { iata: "TUU", nameAr: "مطار تبوك الإقليمي", nameEn: "Tabuk Regional Airport", cityAr: "تبوك", cityEn: "Tabuk", countryAr: "السعودية", countryEn: "Saudi Arabia" },
  { iata: "AJF", nameAr: "مطار الجوف الإقليمي", nameEn: "Al Jouf Airport", cityAr: "سكاكا", cityEn: "Sakaka", countryAr: "السعودية", countryEn: "Saudi Arabia" },
  { iata: "HAS", nameAr: "مطار حائل الإقليمي", nameEn: "Hail Regional Airport", cityAr: "حائل", cityEn: "Hail", countryAr: "السعودية", countryEn: "Saudi Arabia" },
  { iata: "AQI", nameAr: "مطار الأحساء", nameEn: "Al Ahsa Airport", cityAr: "الأحساء", cityEn: "Al Ahsa", countryAr: "السعودية", countryEn: "Saudi Arabia" },
  { iata: "NUM", nameAr: "مطار نجران الإقليمي", nameEn: "Najran Airport", cityAr: "نجران", cityEn: "Najran", countryAr: "السعودية", countryEn: "Saudi Arabia" },

  // Gulf & Levant
  { iata: "DXB", nameAr: "مطار دبي الدولي", nameEn: "Dubai International Airport", cityAr: "دبي", cityEn: "Dubai", countryAr: "الإمارات", countryEn: "United Arab Emirates" },
  { iata: "DWC", nameAr: "مطار آل مكتوم الدولي", nameEn: "Al Maktoum International Airport", cityAr: "دبي", cityEn: "Dubai", countryAr: "الإمارات", countryEn: "United Arab Emirates" },
  { iata: "AUH", nameAr: "مطار أبوظبي الدولي", nameEn: "Abu Dhabi International Airport", cityAr: "أبوظبي", cityEn: "Abu Dhabi", countryAr: "الإمارات", countryEn: "United Arab Emirates" },
  { iata: "SHJ", nameAr: "مطار الشارقة الدولي", nameEn: "Sharjah International Airport", cityAr: "الشارقة", cityEn: "Sharjah", countryAr: "الإمارات", countryEn: "United Arab Emirates" },
  { iata: "RKT", nameAr: "مطار رأس الخيمة الدولي", nameEn: "Ras Al Khaimah International Airport", cityAr: "رأس الخيمة", cityEn: "Ras Al Khaimah", countryAr: "الإمارات", countryEn: "United Arab Emirates" },
  { iata: "DOH", nameAr: "مطار حمد الدولي", nameEn: "Hamad International Airport", cityAr: "الدوحة", cityEn: "Doha", countryAr: "قطر", countryEn: "Qatar" },
  { iata: "KWI", nameAr: "مطار الكويت الدولي", nameEn: "Kuwait International Airport", cityAr: "الكويت", cityEn: "Kuwait City", countryAr: "الكويت", countryEn: "Kuwait" },
  { iata: "BAH", nameAr: "مطار البحرين الدولي", nameEn: "Bahrain International Airport", cityAr: "المنامة", cityEn: "Manama", countryAr: "البحرين", countryEn: "Bahrain" },
  { iata: "MCT", nameAr: "مطار مسقط الدولي", nameEn: "Muscat International Airport", cityAr: "مسقط", cityEn: "Muscat", countryAr: "عُمان", countryEn: "Oman" },
  { iata: "SLL", nameAr: "مطار صلالة", nameEn: "Salalah Airport", cityAr: "صلالة", cityEn: "Salalah", countryAr: "عُمان", countryEn: "Oman" },
  { iata: "AMM", nameAr: "مطار الملكة علياء الدولي", nameEn: "Queen Alia International Airport", cityAr: "عمّان", cityEn: "Amman", countryAr: "الأردن", countryEn: "Jordan" },
  { iata: "AQJ", nameAr: "مطار الملك حسين الدولي", nameEn: "King Hussein International Airport", cityAr: "العقبة", cityEn: "Aqaba", countryAr: "الأردن", countryEn: "Jordan" },
  { iata: "BEY", nameAr: "مطار بيروت رفيق الحريري الدولي", nameEn: "Beirut–Rafic Hariri International Airport", cityAr: "بيروت", cityEn: "Beirut", countryAr: "لبنان", countryEn: "Lebanon" },
  { iata: "TLV", nameAr: "مطار بن غوريون", nameEn: "Ben Gurion Airport", cityAr: "تل أبيب", cityEn: "Tel Aviv", countryAr: "فلسطين المحتلة", countryEn: "Israel" },
  { iata: "BGW", nameAr: "مطار بغداد الدولي", nameEn: "Baghdad International Airport", cityAr: "بغداد", cityEn: "Baghdad", countryAr: "العراق", countryEn: "Iraq" },
  { iata: "EBL", nameAr: "مطار أربيل الدولي", nameEn: "Erbil International Airport", cityAr: "أربيل", cityEn: "Erbil", countryAr: "العراق", countryEn: "Iraq" },
  { iata: "BSR", nameAr: "مطار البصرة الدولي", nameEn: "Basra International Airport", cityAr: "البصرة", cityEn: "Basra", countryAr: "العراق", countryEn: "Iraq" },
  { iata: "NJF", nameAr: "مطار النجف الدولي", nameEn: "Najaf International Airport", cityAr: "النجف", cityEn: "Najaf", countryAr: "العراق", countryEn: "Iraq" },
  { iata: "SAH", nameAr: "مطار صنعاء الدولي", nameEn: "Sana'a International Airport", cityAr: "صنعاء", cityEn: "Sana'a", countryAr: "اليمن", countryEn: "Yemen" },

  // Egypt & North Africa
  { iata: "CAI", nameAr: "مطار القاهرة الدولي", nameEn: "Cairo International Airport", cityAr: "القاهرة", cityEn: "Cairo", countryAr: "مصر", countryEn: "Egypt" },
  { iata: "HRG", nameAr: "مطار الغردقة الدولي", nameEn: "Hurghada International Airport", cityAr: "الغردقة", cityEn: "Hurghada", countryAr: "مصر", countryEn: "Egypt" },
  { iata: "SSH", nameAr: "مطار شرم الشيخ الدولي", nameEn: "Sharm El Sheikh International Airport", cityAr: "شرم الشيخ", cityEn: "Sharm El Sheikh", countryAr: "مصر", countryEn: "Egypt" },
  { iata: "LXR", nameAr: "مطار الأقصر الدولي", nameEn: "Luxor International Airport", cityAr: "الأقصر", cityEn: "Luxor", countryAr: "مصر", countryEn: "Egypt" },
  { iata: "ALY", nameAr: "مطار برج العرب الدولي", nameEn: "Borg El Arab Airport", cityAr: "الإسكندرية", cityEn: "Alexandria", countryAr: "مصر", countryEn: "Egypt" },
  { iata: "CMN", nameAr: "مطار محمد الخامس الدولي", nameEn: "Mohammed V International Airport", cityAr: "الدار البيضاء", cityEn: "Casablanca", countryAr: "المغرب", countryEn: "Morocco" },
  { iata: "RAK", nameAr: "مطار مراكش المنارة", nameEn: "Marrakesh Menara Airport", cityAr: "مراكش", cityEn: "Marrakesh", countryAr: "المغرب", countryEn: "Morocco" },
  { iata: "RBA", nameAr: "مطار الرباط سلا", nameEn: "Rabat–Salé Airport", cityAr: "الرباط", cityEn: "Rabat", countryAr: "المغرب", countryEn: "Morocco" },
  { iata: "TUN", nameAr: "مطار تونس قرطاج الدولي", nameEn: "Tunis–Carthage International Airport", cityAr: "تونس", cityEn: "Tunis", countryAr: "تونس", countryEn: "Tunisia" },
  { iata: "ALG", nameAr: "مطار الجزائر الدولي", nameEn: "Algiers International Airport", cityAr: "الجزائر", cityEn: "Algiers", countryAr: "الجزائر", countryEn: "Algeria" },
  { iata: "TIP", nameAr: "مطار طرابلس الدولي", nameEn: "Tripoli International Airport", cityAr: "طرابلس", cityEn: "Tripoli", countryAr: "ليبيا", countryEn: "Libya" },
  { iata: "KRT", nameAr: "مطار الخرطوم الدولي", nameEn: "Khartoum International Airport", cityAr: "الخرطوم", cityEn: "Khartoum", countryAr: "السودان", countryEn: "Sudan" },

  // Turkey & the Caucasus
  { iata: "IST", nameAr: "مطار إسطنبول", nameEn: "Istanbul Airport", cityAr: "إسطنبول", cityEn: "Istanbul", countryAr: "تركيا", countryEn: "Turkey" },
  { iata: "SAW", nameAr: "مطار صبيحة كوكجن", nameEn: "Sabiha Gökçen Airport", cityAr: "إسطنبول", cityEn: "Istanbul", countryAr: "تركيا", countryEn: "Turkey" },
  { iata: "AYT", nameAr: "مطار أنطاليا", nameEn: "Antalya Airport", cityAr: "أنطاليا", cityEn: "Antalya", countryAr: "تركيا", countryEn: "Turkey" },
  { iata: "ESB", nameAr: "مطار أنقرة إسنبوغا", nameEn: "Ankara Esenboğa Airport", cityAr: "أنقرة", cityEn: "Ankara", countryAr: "تركيا", countryEn: "Turkey" },
  { iata: "ADB", nameAr: "مطار إزمير عدنان مندريس", nameEn: "İzmir Adnan Menderes Airport", cityAr: "إزمير", cityEn: "Izmir", countryAr: "تركيا", countryEn: "Turkey" },
  { iata: "GYD", nameAr: "مطار حيدر علييف الدولي", nameEn: "Heydar Aliyev International Airport", cityAr: "باكو", cityEn: "Baku", countryAr: "أذربيجان", countryEn: "Azerbaijan" },
  { iata: "TBS", nameAr: "مطار تبليسي الدولي", nameEn: "Tbilisi International Airport", cityAr: "تبليسي", cityEn: "Tbilisi", countryAr: "جورجيا", countryEn: "Georgia" },
  { iata: "BUS", nameAr: "مطار باتومي الدولي", nameEn: "Batumi International Airport", cityAr: "باتومي", cityEn: "Batumi", countryAr: "جورجيا", countryEn: "Georgia" },
  { iata: "EVN", nameAr: "مطار زفارتنوتس الدولي", nameEn: "Zvartnots International Airport", cityAr: "يريفان", cityEn: "Yerevan", countryAr: "أرمينيا", countryEn: "Armenia" },

  // South & Central Asia
  { iata: "DEL", nameAr: "مطار إنديرا غاندي الدولي", nameEn: "Indira Gandhi International Airport", cityAr: "دلهي", cityEn: "Delhi", countryAr: "الهند", countryEn: "India" },
  { iata: "BOM", nameAr: "مطار تشاتراباتي شيفاجي", nameEn: "Chhatrapati Shivaji Maharaj Airport", cityAr: "مومباي", cityEn: "Mumbai", countryAr: "الهند", countryEn: "India" },
  { iata: "BLR", nameAr: "مطار كيمبيغودا الدولي", nameEn: "Kempegowda International Airport", cityAr: "بنغالورو", cityEn: "Bengaluru", countryAr: "الهند", countryEn: "India" },
  { iata: "HYD", nameAr: "مطار راجيف غاندي الدولي", nameEn: "Rajiv Gandhi International Airport", cityAr: "حيدر أباد", cityEn: "Hyderabad", countryAr: "الهند", countryEn: "India" },
  { iata: "COK", nameAr: "مطار كوتشي الدولي", nameEn: "Cochin International Airport", cityAr: "كوتشي", cityEn: "Kochi", countryAr: "الهند", countryEn: "India" },
  { iata: "CMB", nameAr: "مطار باندارانايكه الدولي", nameEn: "Bandaranaike International Airport", cityAr: "كولومبو", cityEn: "Colombo", countryAr: "سريلانكا", countryEn: "Sri Lanka" },
  { iata: "DAC", nameAr: "مطار شاه جلال الدولي", nameEn: "Hazrat Shahjalal International Airport", cityAr: "دكا", cityEn: "Dhaka", countryAr: "بنغلاديش", countryEn: "Bangladesh" },
  { iata: "KHI", nameAr: "مطار جناح الدولي", nameEn: "Jinnah International Airport", cityAr: "كراتشي", cityEn: "Karachi", countryAr: "باكستان", countryEn: "Pakistan" },
  { iata: "LHE", nameAr: "مطار علامة إقبال الدولي", nameEn: "Allama Iqbal International Airport", cityAr: "لاهور", cityEn: "Lahore", countryAr: "باكستان", countryEn: "Pakistan" },
  { iata: "ISB", nameAr: "مطار إسلام آباد الدولي", nameEn: "Islamabad International Airport", cityAr: "إسلام آباد", cityEn: "Islamabad", countryAr: "باكستان", countryEn: "Pakistan" },
  { iata: "KTM", nameAr: "مطار تريبوفان الدولي", nameEn: "Tribhuvan International Airport", cityAr: "كاتماندو", cityEn: "Kathmandu", countryAr: "نيبال", countryEn: "Nepal" },
  { iata: "MLE", nameAr: "مطار فيلانا الدولي", nameEn: "Velana International Airport", cityAr: "مالِه", cityEn: "Malé", countryAr: "المالديف", countryEn: "Maldives" },

  // Southeast Asia
  { iata: "BKK", nameAr: "مطار سوفارنابومي", nameEn: "Suvarnabhumi Airport", cityAr: "بانكوك", cityEn: "Bangkok", countryAr: "تايلاند", countryEn: "Thailand" },
  { iata: "DMK", nameAr: "مطار دون موينغ", nameEn: "Don Mueang International Airport", cityAr: "بانكوك", cityEn: "Bangkok", countryAr: "تايلاند", countryEn: "Thailand" },
  { iata: "HKT", nameAr: "مطار فوكيت الدولي", nameEn: "Phuket International Airport", cityAr: "فوكيت", cityEn: "Phuket", countryAr: "تايلاند", countryEn: "Thailand" },
  { iata: "USM", nameAr: "مطار كوه سامويْ", nameEn: "Samui Airport", cityAr: "كوه سامويْ", cityEn: "Koh Samui", countryAr: "تايلاند", countryEn: "Thailand" },
  { iata: "SIN", nameAr: "مطار سنغافورة تشانغي", nameEn: "Singapore Changi Airport", cityAr: "سنغافورة", cityEn: "Singapore", countryAr: "سنغافورة", countryEn: "Singapore" },
  { iata: "KUL", nameAr: "مطار كوالالمبور الدولي", nameEn: "Kuala Lumpur International Airport", cityAr: "كوالالمبور", cityEn: "Kuala Lumpur", countryAr: "ماليزيا", countryEn: "Malaysia" },
  { iata: "CGK", nameAr: "مطار سوكارنو هاتا الدولي", nameEn: "Soekarno–Hatta International Airport", cityAr: "جاكرتا", cityEn: "Jakarta", countryAr: "إندونيسيا", countryEn: "Indonesia" },
  { iata: "DPS", nameAr: "مطار نغوراه راي الدولي", nameEn: "Ngurah Rai International Airport", cityAr: "بالي (دنباسار)", cityEn: "Bali (Denpasar)", countryAr: "إندونيسيا", countryEn: "Indonesia" },
  { iata: "MNL", nameAr: "مطار نينوي أكينو الدولي", nameEn: "Ninoy Aquino International Airport", cityAr: "مانيلا", cityEn: "Manila", countryAr: "الفلبين", countryEn: "Philippines" },
  { iata: "CEB", nameAr: "مطار ماكتان سيبو الدولي", nameEn: "Mactan–Cebu International Airport", cityAr: "سيبو", cityEn: "Cebu", countryAr: "الفلبين", countryEn: "Philippines" },
  { iata: "SGN", nameAr: "مطار تان سون نهت الدولي", nameEn: "Tan Son Nhat International Airport", cityAr: "هو تشي مِنه", cityEn: "Ho Chi Minh City", countryAr: "فيتنام", countryEn: "Vietnam" },
  { iata: "HAN", nameAr: "مطار نوي باي الدولي", nameEn: "Noi Bai International Airport", cityAr: "هانوي", cityEn: "Hanoi", countryAr: "فيتنام", countryEn: "Vietnam" },
  { iata: "RGN", nameAr: "مطار يانغون الدولي", nameEn: "Yangon International Airport", cityAr: "يانغون", cityEn: "Yangon", countryAr: "ميانمار", countryEn: "Myanmar" },
  { iata: "PNH", nameAr: "مطار بنوم بنه الدولي", nameEn: "Phnom Penh International Airport", cityAr: "بنوم بنه", cityEn: "Phnom Penh", countryAr: "كمبوديا", countryEn: "Cambodia" },

  // East Asia
  { iata: "NRT", nameAr: "مطار ناريتا الدولي", nameEn: "Narita International Airport", cityAr: "طوكيو", cityEn: "Tokyo", countryAr: "اليابان", countryEn: "Japan" },
  { iata: "HND", nameAr: "مطار هانيدا", nameEn: "Haneda Airport", cityAr: "طوكيو", cityEn: "Tokyo", countryAr: "اليابان", countryEn: "Japan" },
  { iata: "KIX", nameAr: "مطار كانساي الدولي", nameEn: "Kansai International Airport", cityAr: "أوساكا", cityEn: "Osaka", countryAr: "اليابان", countryEn: "Japan" },
  { iata: "ICN", nameAr: "مطار إنتشون الدولي", nameEn: "Incheon International Airport", cityAr: "سيول", cityEn: "Seoul", countryAr: "كوريا الجنوبية", countryEn: "South Korea" },
  { iata: "PEK", nameAr: "مطار بكين العاصمة الدولي", nameEn: "Beijing Capital International Airport", cityAr: "بكين", cityEn: "Beijing", countryAr: "الصين", countryEn: "China" },
  { iata: "PVG", nameAr: "مطار شنغهاي بودونغ الدولي", nameEn: "Shanghai Pudong International Airport", cityAr: "شنغهاي", cityEn: "Shanghai", countryAr: "الصين", countryEn: "China" },
  { iata: "CAN", nameAr: "مطار قوانغتشو بايون الدولي", nameEn: "Guangzhou Baiyun International Airport", cityAr: "قوانغتشو", cityEn: "Guangzhou", countryAr: "الصين", countryEn: "China" },
  { iata: "HKG", nameAr: "مطار هونغ كونغ الدولي", nameEn: "Hong Kong International Airport", cityAr: "هونغ كونغ", cityEn: "Hong Kong", countryAr: "هونغ كونغ", countryEn: "Hong Kong" },
  { iata: "TPE", nameAr: "مطار تايوان تاويوان الدولي", nameEn: "Taiwan Taoyuan International Airport", cityAr: "تايبيه", cityEn: "Taipei", countryAr: "تايوان", countryEn: "Taiwan" },

  // Oceania
  { iata: "SYD", nameAr: "مطار سيدني كينغسفورد سميث", nameEn: "Sydney Kingsford Smith Airport", cityAr: "سيدني", cityEn: "Sydney", countryAr: "أستراليا", countryEn: "Australia" },
  { iata: "MEL", nameAr: "مطار ملبورن", nameEn: "Melbourne Airport", cityAr: "ملبورن", cityEn: "Melbourne", countryAr: "أستراليا", countryEn: "Australia" },
  { iata: "BNE", nameAr: "مطار بريزبن", nameEn: "Brisbane Airport", cityAr: "بريزبن", cityEn: "Brisbane", countryAr: "أستراليا", countryEn: "Australia" },
  { iata: "AKL", nameAr: "مطار أوكلاند", nameEn: "Auckland Airport", cityAr: "أوكلاند", cityEn: "Auckland", countryAr: "نيوزيلندا", countryEn: "New Zealand" },

  // Europe
  { iata: "LHR", nameAr: "مطار هيثرو", nameEn: "Heathrow Airport", cityAr: "لندن", cityEn: "London", countryAr: "بريطانيا", countryEn: "United Kingdom" },
  { iata: "LGW", nameAr: "مطار غاتويك", nameEn: "Gatwick Airport", cityAr: "لندن", cityEn: "London", countryAr: "بريطانيا", countryEn: "United Kingdom" },
  { iata: "MAN", nameAr: "مطار مانشستر", nameEn: "Manchester Airport", cityAr: "مانشستر", cityEn: "Manchester", countryAr: "بريطانيا", countryEn: "United Kingdom" },
  { iata: "EDI", nameAr: "مطار إدنبرة", nameEn: "Edinburgh Airport", cityAr: "إدنبرة", cityEn: "Edinburgh", countryAr: "بريطانيا", countryEn: "United Kingdom" },
  { iata: "CDG", nameAr: "مطار شارل ديغول", nameEn: "Charles de Gaulle Airport", cityAr: "باريس", cityEn: "Paris", countryAr: "فرنسا", countryEn: "France" },
  { iata: "ORY", nameAr: "مطار أورلي", nameEn: "Orly Airport", cityAr: "باريس", cityEn: "Paris", countryAr: "فرنسا", countryEn: "France" },
  { iata: "NCE", nameAr: "مطار نيس كوت دازور", nameEn: "Nice Côte d'Azur Airport", cityAr: "نيس", cityEn: "Nice", countryAr: "فرنسا", countryEn: "France" },
  { iata: "FRA", nameAr: "مطار فرانكفورت", nameEn: "Frankfurt Airport", cityAr: "فرانكفورت", cityEn: "Frankfurt", countryAr: "ألمانيا", countryEn: "Germany" },
  { iata: "MUC", nameAr: "مطار ميونخ", nameEn: "Munich Airport", cityAr: "ميونخ", cityEn: "Munich", countryAr: "ألمانيا", countryEn: "Germany" },
  { iata: "BER", nameAr: "مطار برلين براندنبورغ", nameEn: "Berlin Brandenburg Airport", cityAr: "برلين", cityEn: "Berlin", countryAr: "ألمانيا", countryEn: "Germany" },
  { iata: "AMS", nameAr: "مطار أمستردام سخيبول", nameEn: "Amsterdam Schiphol Airport", cityAr: "أمستردام", cityEn: "Amsterdam", countryAr: "هولندا", countryEn: "Netherlands" },
  { iata: "MAD", nameAr: "مطار مدريد باراخاس", nameEn: "Madrid–Barajas Airport", cityAr: "مدريد", cityEn: "Madrid", countryAr: "إسبانيا", countryEn: "Spain" },
  { iata: "BCN", nameAr: "مطار برشلونة الدولي", nameEn: "Barcelona–El Prat Airport", cityAr: "برشلونة", cityEn: "Barcelona", countryAr: "إسبانيا", countryEn: "Spain" },
  { iata: "AGP", nameAr: "مطار مالقة كوستا ديل سول", nameEn: "Málaga Airport", cityAr: "مالقة", cityEn: "Málaga", countryAr: "إسبانيا", countryEn: "Spain" },
  { iata: "FCO", nameAr: "مطار روما فيوميتشينو", nameEn: "Rome Fiumicino Airport", cityAr: "روما", cityEn: "Rome", countryAr: "إيطاليا", countryEn: "Italy" },
  { iata: "MXP", nameAr: "مطار ميلانو مالبنسا", nameEn: "Milan Malpensa Airport", cityAr: "ميلانو", cityEn: "Milan", countryAr: "إيطاليا", countryEn: "Italy" },
  { iata: "VCE", nameAr: "مطار البندقية ماركو بولو", nameEn: "Venice Marco Polo Airport", cityAr: "البندقية", cityEn: "Venice", countryAr: "إيطاليا", countryEn: "Italy" },
  { iata: "ZRH", nameAr: "مطار زيورخ", nameEn: "Zurich Airport", cityAr: "زيورخ", cityEn: "Zurich", countryAr: "سويسرا", countryEn: "Switzerland" },
  { iata: "GVA", nameAr: "مطار جنيف", nameEn: "Geneva Airport", cityAr: "جنيف", cityEn: "Geneva", countryAr: "سويسرا", countryEn: "Switzerland" },
  { iata: "VIE", nameAr: "مطار فيينا الدولي", nameEn: "Vienna International Airport", cityAr: "فيينا", cityEn: "Vienna", countryAr: "النمسا", countryEn: "Austria" },
  { iata: "BRU", nameAr: "مطار بروكسل", nameEn: "Brussels Airport", cityAr: "بروكسل", cityEn: "Brussels", countryAr: "بلجيكا", countryEn: "Belgium" },
  { iata: "CPH", nameAr: "مطار كوبنهاغن", nameEn: "Copenhagen Airport", cityAr: "كوبنهاغن", cityEn: "Copenhagen", countryAr: "الدنمارك", countryEn: "Denmark" },
  { iata: "OSL", nameAr: "مطار أوسلو", nameEn: "Oslo Airport", cityAr: "أوسلو", cityEn: "Oslo", countryAr: "النرويج", countryEn: "Norway" },
  { iata: "ARN", nameAr: "مطار ستوكهولم أرلاندا", nameEn: "Stockholm Arlanda Airport", cityAr: "ستوكهولم", cityEn: "Stockholm", countryAr: "السويد", countryEn: "Sweden" },
  { iata: "HEL", nameAr: "مطار هلسنكي", nameEn: "Helsinki Airport", cityAr: "هلسنكي", cityEn: "Helsinki", countryAr: "فنلندا", countryEn: "Finland" },
  { iata: "KEF", nameAr: "مطار كيفلافيك الدولي", nameEn: "Keflavík International Airport", cityAr: "ريكيافيك", cityEn: "Reykjavík", countryAr: "آيسلندا", countryEn: "Iceland" },
  { iata: "DUB", nameAr: "مطار دبلن", nameEn: "Dublin Airport", cityAr: "دبلن", cityEn: "Dublin", countryAr: "أيرلندا", countryEn: "Ireland" },
  { iata: "LIS", nameAr: "مطار لشبونة", nameEn: "Lisbon Airport", cityAr: "لشبونة", cityEn: "Lisbon", countryAr: "البرتغال", countryEn: "Portugal" },
  { iata: "OPO", nameAr: "مطار بورتو", nameEn: "Porto Airport", cityAr: "بورتو", cityEn: "Porto", countryAr: "البرتغال", countryEn: "Portugal" },
  { iata: "ATH", nameAr: "مطار أثينا الدولي", nameEn: "Athens International Airport", cityAr: "أثينا", cityEn: "Athens", countryAr: "اليونان", countryEn: "Greece" },
  { iata: "JTR", nameAr: "مطار سانتوريني", nameEn: "Santorini Airport", cityAr: "سانتوريني", cityEn: "Santorini", countryAr: "اليونان", countryEn: "Greece" },
  { iata: "WAW", nameAr: "مطار وارسو شوبان", nameEn: "Warsaw Chopin Airport", cityAr: "وارسو", cityEn: "Warsaw", countryAr: "بولندا", countryEn: "Poland" },
  { iata: "PRG", nameAr: "مطار براغ فاتسلاف هافل", nameEn: "Václav Havel Airport Prague", cityAr: "براغ", cityEn: "Prague", countryAr: "التشيك", countryEn: "Czechia" },
  { iata: "BUD", nameAr: "مطار بودابست", nameEn: "Budapest Ferenc Liszt Airport", cityAr: "بودابست", cityEn: "Budapest", countryAr: "المجر", countryEn: "Hungary" },
  { iata: "OTP", nameAr: "مطار بوخارست هنري كواندا", nameEn: "Henri Coandă International Airport", cityAr: "بوخارست", cityEn: "Bucharest", countryAr: "رومانيا", countryEn: "Romania" },
  { iata: "SOF", nameAr: "مطار صوفيا", nameEn: "Sofia Airport", cityAr: "صوفيا", cityEn: "Sofia", countryAr: "بلغاريا", countryEn: "Bulgaria" },
  { iata: "DBV", nameAr: "مطار دوبروفنيك", nameEn: "Dubrovnik Airport", cityAr: "دوبروفنيك", cityEn: "Dubrovnik", countryAr: "كرواتيا", countryEn: "Croatia" },
  { iata: "SVO", nameAr: "مطار موسكو شيريميتيفو", nameEn: "Sheremetyevo International Airport", cityAr: "موسكو", cityEn: "Moscow", countryAr: "روسيا", countryEn: "Russia" },
  { iata: "KBP", nameAr: "مطار كييف بوريسبيل", nameEn: "Kyiv Boryspil International Airport", cityAr: "كييف", cityEn: "Kyiv", countryAr: "أوكرانيا", countryEn: "Ukraine" },

  // Americas
  { iata: "JFK", nameAr: "مطار جون كينيدي الدولي", nameEn: "John F. Kennedy International Airport", cityAr: "نيويورك", cityEn: "New York", countryAr: "الولايات المتحدة", countryEn: "United States" },
  { iata: "EWR", nameAr: "مطار نيوارك ليبرتي", nameEn: "Newark Liberty International Airport", cityAr: "نيويورك", cityEn: "New York", countryAr: "الولايات المتحدة", countryEn: "United States" },
  { iata: "LAX", nameAr: "مطار لوس أنجلوس الدولي", nameEn: "Los Angeles International Airport", cityAr: "لوس أنجلوس", cityEn: "Los Angeles", countryAr: "الولايات المتحدة", countryEn: "United States" },
  { iata: "SFO", nameAr: "مطار سان فرانسيسكو الدولي", nameEn: "San Francisco International Airport", cityAr: "سان فرانسيسكو", cityEn: "San Francisco", countryAr: "الولايات المتحدة", countryEn: "United States" },
  { iata: "ORD", nameAr: "مطار أوهير الدولي", nameEn: "O'Hare International Airport", cityAr: "شيكاغو", cityEn: "Chicago", countryAr: "الولايات المتحدة", countryEn: "United States" },
  { iata: "MIA", nameAr: "مطار ميامي الدولي", nameEn: "Miami International Airport", cityAr: "ميامي", cityEn: "Miami", countryAr: "الولايات المتحدة", countryEn: "United States" },
  { iata: "ATL", nameAr: "مطار أتلانتا الدولي", nameEn: "Hartsfield–Jackson Atlanta Airport", cityAr: "أتلانتا", cityEn: "Atlanta", countryAr: "الولايات المتحدة", countryEn: "United States" },
  { iata: "IAD", nameAr: "مطار واشنطن دالاس الدولي", nameEn: "Washington Dulles International Airport", cityAr: "واشنطن", cityEn: "Washington, D.C.", countryAr: "الولايات المتحدة", countryEn: "United States" },
  { iata: "SEA", nameAr: "مطار سياتل تاكوما", nameEn: "Seattle–Tacoma International Airport", cityAr: "سياتل", cityEn: "Seattle", countryAr: "الولايات المتحدة", countryEn: "United States" },
  { iata: "BOS", nameAr: "مطار بوسطن لوغان", nameEn: "Boston Logan International Airport", cityAr: "بوسطن", cityEn: "Boston", countryAr: "الولايات المتحدة", countryEn: "United States" },
  { iata: "YYZ", nameAr: "مطار تورونتو بيرسون", nameEn: "Toronto Pearson International Airport", cityAr: "تورونتو", cityEn: "Toronto", countryAr: "كندا", countryEn: "Canada" },
  { iata: "YVR", nameAr: "مطار فانكوفر الدولي", nameEn: "Vancouver International Airport", cityAr: "فانكوفر", cityEn: "Vancouver", countryAr: "كندا", countryEn: "Canada" },
  { iata: "MEX", nameAr: "مطار مكسيكو سيتي الدولي", nameEn: "Mexico City International Airport", cityAr: "مكسيكو سيتي", cityEn: "Mexico City", countryAr: "المكسيك", countryEn: "Mexico" },
  { iata: "CUN", nameAr: "مطار كانكون الدولي", nameEn: "Cancún International Airport", cityAr: "كانكون", cityEn: "Cancún", countryAr: "المكسيك", countryEn: "Mexico" },
  { iata: "GRU", nameAr: "مطار ساو باولو غوارولوس", nameEn: "São Paulo–Guarulhos Airport", cityAr: "ساو باولو", cityEn: "São Paulo", countryAr: "البرازيل", countryEn: "Brazil" },
  { iata: "GIG", nameAr: "مطار ريو دي جانيرو الدولي", nameEn: "Rio de Janeiro–Galeão Airport", cityAr: "ريو دي جانيرو", cityEn: "Rio de Janeiro", countryAr: "البرازيل", countryEn: "Brazil" },
  { iata: "EZE", nameAr: "مطار بوينس آيرس إيزيزا", nameEn: "Ministro Pistarini Airport", cityAr: "بوينس آيرس", cityEn: "Buenos Aires", countryAr: "الأرجنتين", countryEn: "Argentina" },
  { iata: "SCL", nameAr: "مطار سانتياغو الدولي", nameEn: "Santiago International Airport", cityAr: "سانتياغو", cityEn: "Santiago", countryAr: "تشيلي", countryEn: "Chile" },
  { iata: "BOG", nameAr: "مطار بوغوتا الدولي", nameEn: "El Dorado International Airport", cityAr: "بوغوتا", cityEn: "Bogotá", countryAr: "كولومبيا", countryEn: "Colombia" },
  { iata: "LIM", nameAr: "مطار ليما خورخي تشافيز", nameEn: "Jorge Chávez International Airport", cityAr: "ليما", cityEn: "Lima", countryAr: "بيرو", countryEn: "Peru" },

  // Africa (Sub-Saharan)
  { iata: "JNB", nameAr: "مطار جوهانسبرغ أو.آر.تامبو", nameEn: "O. R. Tambo International Airport", cityAr: "جوهانسبرغ", cityEn: "Johannesburg", countryAr: "جنوب أفريقيا", countryEn: "South Africa" },
  { iata: "CPT", nameAr: "مطار كيب تاون الدولي", nameEn: "Cape Town International Airport", cityAr: "كيب تاون", cityEn: "Cape Town", countryAr: "جنوب أفريقيا", countryEn: "South Africa" },
  { iata: "NBO", nameAr: "مطار جومو كينياتا الدولي", nameEn: "Jomo Kenyatta International Airport", cityAr: "نيروبي", cityEn: "Nairobi", countryAr: "كينيا", countryEn: "Kenya" },
  { iata: "ADD", nameAr: "مطار بولي الدولي", nameEn: "Bole International Airport", cityAr: "أديس أبابا", cityEn: "Addis Ababa", countryAr: "إثيوبيا", countryEn: "Ethiopia" },
  { iata: "LOS", nameAr: "مطار موريتالا محمد الدولي", nameEn: "Murtala Muhammed International Airport", cityAr: "لاغوس", cityEn: "Lagos", countryAr: "نيجيريا", countryEn: "Nigeria" },
  { iata: "ACC", nameAr: "مطار كوتوكا الدولي", nameEn: "Kotoka International Airport", cityAr: "أكرا", cityEn: "Accra", countryAr: "غانا", countryEn: "Ghana" },
  { iata: "DAR", nameAr: "مطار جوليوس نيريري الدولي", nameEn: "Julius Nyerere International Airport", cityAr: "دار السلام", cityEn: "Dar es Salaam", countryAr: "تنزانيا", countryEn: "Tanzania" },
  { iata: "ZNZ", nameAr: "مطار زنجبار الدولي", nameEn: "Zanzibar International Airport", cityAr: "زنجبار", cityEn: "Zanzibar", countryAr: "تنزانيا", countryEn: "Tanzania" },
  { iata: "MRU", nameAr: "مطار موريشيوس الدولي", nameEn: "Sir Seewoosagur Ramgoolam Airport", cityAr: "بورت لويس", cityEn: "Port Louis", countryAr: "موريشيوس", countryEn: "Mauritius" },
  { iata: "SEZ", nameAr: "مطار سيشل الدولي", nameEn: "Seychelles International Airport", cityAr: "فيكتوريا", cityEn: "Victoria", countryAr: "سيشل", countryEn: "Seychelles" },
  // Added with the country expansion (OurAirports, public domain)
  { iata: "TIV", nameAr: "مطار تيفات", nameEn: "Tivat Airport", cityAr: "تيفات", cityEn: "Tivat", countryAr: "الجبل الأسود", countryEn: "Montenegro" },
  { iata: "LED", nameAr: "مطار سانت بطرسبرغ", nameEn: "Pulkovo Airport", cityAr: "سانت بطرسبرغ", cityEn: "Saint Petersburg", countryAr: "روسيا", countryEn: "Russia" },
  { iata: "KZN", nameAr: "مطار قازان الدولي", nameEn: "Kazan International Airport", cityAr: "قازان", cityEn: "Kazan", countryAr: "روسيا", countryEn: "Russia" },
  { iata: "AER", nameAr: "مطار سوتشي الدولي", nameEn: "Sochi International Airport", cityAr: "سوتشي", cityEn: "Sochi", countryAr: "روسيا", countryEn: "Russia" },
  { iata: "SJJ", nameAr: "مطار سراييفو الدولي", nameEn: "Sarajevo International Airport", cityAr: "سراييفو", cityEn: "Sarajevo", countryAr: "البوسنة والهرسك", countryEn: "Bosnia and Herzegovina" },
  { iata: "OMO", nameAr: "مطار موستار الدولي", nameEn: "Mostar International Airport", cityAr: "موستار", cityEn: "Mostar", countryAr: "البوسنة والهرسك", countryEn: "Bosnia and Herzegovina" },
  { iata: "TIA", nameAr: "مطار تيرانا الدولي", nameEn: "Tirana International Airport Mother Teresa", cityAr: "تيرانا", cityEn: "Tirana", countryAr: "ألبانيا", countryEn: "Albania" },
  { iata: "CFU", nameAr: "مطار كورفو الدولي", nameEn: "Corfu Ioannis Kapodistrias International Airport", cityAr: "كورفو", cityEn: "Corfu", countryAr: "اليونان", countryEn: "Greece" },
  { iata: "TGD", nameAr: "مطار بودغوريتسا", nameEn: "Podgorica Airport / Podgorica Golubovci Airbase", cityAr: "بودغوريتسا", cityEn: "Podgorica", countryAr: "الجبل الأسود", countryEn: "Montenegro" },
  { iata: "BEG", nameAr: "مطار بلغراد", nameEn: "Belgrade Nikola Tesla Airport", cityAr: "بلغراد", cityEn: "Belgrade", countryAr: "صربيا", countryEn: "Serbia" },
  { iata: "ZAG", nameAr: "مطار زغرب الدولي", nameEn: "Zagreb Franjo Tuđman International Airport", cityAr: "زغرب", cityEn: "Zagreb", countryAr: "كرواتيا", countryEn: "Croatia" },
  { iata: "SPU", nameAr: "مطار سبليت", nameEn: "Split Saint Jerome Airport", cityAr: "سبليت", cityEn: "Split", countryAr: "كرواتيا", countryEn: "Croatia" },
  { iata: "KLV", nameAr: "مطار كارلوفي فاري", nameEn: "Karlovy Vary Airport", cityAr: "كارلوفي فاري", cityEn: "Karlovy Vary", countryAr: "التشيك", countryEn: "Czechia" },
  { iata: "KRK", nameAr: "مطار كراكوف الدولي", nameEn: "Kraków John Paul II International Airport", cityAr: "كراكوف", cityEn: "Kraków", countryAr: "بولندا", countryEn: "Poland" },
  { iata: "TAT", nameAr: "مطار بوبراد تاترا", nameEn: "Poprad-Tatry Airport", cityAr: "بوبراد", cityEn: "Poprad", countryAr: "سلوفاكيا", countryEn: "Slovakia" },
  { iata: "SNN", nameAr: "مطار شانون", nameEn: "Shannon Airport", cityAr: "شانون", cityEn: "Shannon", countryAr: "أيرلندا", countryEn: "Ireland" },
  { iata: "OST", nameAr: "مطار أوستند-بروج الدولي", nameEn: "Ostend-Bruges International Airport", cityAr: "أوستند", cityEn: "Ostend", countryAr: "بلجيكا", countryEn: "Belgium" },
  { iata: "BGO", nameAr: "مطار بيرغن", nameEn: "Bergen Airport, Flesland", cityAr: "بيرغن", cityEn: "Bergen", countryAr: "النرويج", countryEn: "Norway" },
  { iata: "TOS", nameAr: "مطار ترومسو", nameEn: "Tromsø Airport", cityAr: "ترومسو", cityEn: "Tromsø", countryAr: "النرويج", countryEn: "Norway" },
  { iata: "RVN", nameAr: "مطار روفانيمي", nameEn: "Rovaniemi Airport", cityAr: "روفانيمي", cityEn: "Rovaniemi", countryAr: "فنلندا", countryEn: "Finland" },
  { iata: "LJU", nameAr: "مطار ليوبليانا", nameEn: "Ljubljana Jože Pučnik Airport", cityAr: "ليوبليانا", cityEn: "Ljubljana", countryAr: "سلوفينيا", countryEn: "Slovenia" },
  { iata: "LCA", nameAr: "مطار لارنكا الدولي", nameEn: "Larnaca International Airport", cityAr: "لارنكا", cityEn: "Larnaca", countryAr: "قبرص", countryEn: "Cyprus" },
  { iata: "PFO", nameAr: "مطار بافوس الدولي", nameEn: "Paphos International Airport", cityAr: "بافوس", cityEn: "Paphos", countryAr: "قبرص", countryEn: "Cyprus" },
  { iata: "MLA", nameAr: "مطار مالطا الدولي", nameEn: "Malta International Airport", cityAr: "فاليتا", cityEn: "Valletta", countryAr: "مالطا", countryEn: "Malta" },
  { iata: "GHV", nameAr: "مطار براشوف الدولي", nameEn: "Brașov-Ghimbav International Airport", cityAr: "براشوف", cityEn: "Brașov", countryAr: "رومانيا", countryEn: "Romania" },
  { iata: "ALA", nameAr: "مطار ألماتي الدولي", nameEn: "Almaty International Airport", cityAr: "ألماتي", cityEn: "Almaty", countryAr: "كازاخستان", countryEn: "Kazakhstan" },
  { iata: "NQZ", nameAr: "مطار أستانا الدولي", nameEn: "Nursultan Nazarbayev International Airport", cityAr: "أستانا", cityEn: "Astana", countryAr: "كازاخستان", countryEn: "Kazakhstan" },
  { iata: "TAS", nameAr: "مطار طشقند الدولي", nameEn: "Tashkent International Airport", cityAr: "طشقند", cityEn: "Tashkent", countryAr: "أوزبكستان", countryEn: "Uzbekistan" },
  { iata: "SKD", nameAr: "مطار سمرقند الدولي", nameEn: "Samarkand International Airport", cityAr: "سمرقند", cityEn: "Samarkand", countryAr: "أوزبكستان", countryEn: "Uzbekistan" },
  { iata: "BHK", nameAr: "مطار بخارى الدولي", nameEn: "Bukhara International Airport", cityAr: "بخارى", cityEn: "Bukhara", countryAr: "أوزبكستان", countryEn: "Uzbekistan" },
  { iata: "BSZ", nameAr: "مطار بشكيك الدولي", nameEn: "Manas International Airport", cityAr: "بشكيك", cityEn: "Bishkek", countryAr: "قيرغيزستان", countryEn: "Kyrgyzstan" },
  { iata: "IKG", nameAr: "مطار كاراكول الدولي", nameEn: "Karakol International Airport", cityAr: "كاراكول", cityEn: "Karakol", countryAr: "قيرغيزستان", countryEn: "Kyrgyzstan" },
  { iata: "PHH", nameAr: "مطار بوكهارا الدولي", nameEn: "Pokhara International Airport", cityAr: "بوكهارا", cityEn: "Pokhara", countryAr: "نيبال", countryEn: "Nepal" },
  { iata: "KLO", nameAr: "مطار كاليبو الدولي", nameEn: "Kalibo International Airport", cityAr: "كاليبو", cityEn: "Kalibo", countryAr: "الفلبين", countryEn: "Philippines" },
  { iata: "SAI", nameAr: "مطار سييم ريب الدولي", nameEn: "Siem Reap-Angkor International Airport", cityAr: "سييم ريب", cityEn: "Siem Reap", countryAr: "كمبوديا", countryEn: "Cambodia" },
  { iata: "KTI", nameAr: "مطار بنوم بنه الدولي", nameEn: "Techo International Airport", cityAr: "بنوم بنه", cityEn: "Phnom Penh", countryAr: "كمبوديا", countryEn: "Cambodia" },
  { iata: "JRO", nameAr: "مطار كليمنجارو الدولي", nameEn: "Kilimanjaro International Airport", cityAr: "أروشا", cityEn: "Arusha", countryAr: "تنزانيا", countryEn: "Tanzania" },
  { iata: "YUL", nameAr: "مطار مونتريال الدولي", nameEn: "Montreal / Pierre Elliott Trudeau International Airport", cityAr: "مونتريال", cityEn: "Montreal", countryAr: "كندا", countryEn: "Canada" },
  { iata: "YYC", nameAr: "مطار كالغاري الدولي", nameEn: "Calgary International Airport", cityAr: "كالغاري", cityEn: "Calgary", countryAr: "كندا", countryEn: "Canada" },
];

/**
 * City codes that stand for every airport of a city ("PAR" is CDG and ORY),
 * mapped to its main airport for the city, country and names. Searches and
 * suggestions use them, and without this the page read "PAR" for Paris.
 */
const CITY_CODES: Record<string, string> = {
  PAR: "CDG", LON: "LHR", NYC: "JFK", MIL: "MXP", ROM: "FCO", TYO: "HND", MOW: "SVO",
  WAS: "IAD", CHI: "ORD", STO: "ARN", BUH: "OTP", SEL: "ICN", BJS: "PEK", SHA: "PVG",
  OSA: "KIX", JKT: "CGK", YTO: "YYZ", SAO: "GRU", RIO: "GIG", BUE: "EZE", REK: "KEF",
};

export function findAirport(code: string): Airport | undefined {
  const c = code.trim().toUpperCase();
  const exact = AIRPORTS.find((a) => a.iata === c);
  if (exact || !CITY_CODES[c]) return exact;
  const main = AIRPORTS.find((a) => a.iata === CITY_CODES[c]);
  // The city, under its own code: "PAR — باريس", not one of its airports.
  return main ? { ...main, iata: c, nameAr: main.cityAr, nameEn: main.cityEn } : undefined;
}

export function airportLabel(code: string, locale: "ar" | "en"): string {
  const a = findAirport(code);
  if (!a) return code;
  // IATA code first, so once an airport is picked the field itself confirms
  // exactly which one — e.g. "RUH مطار الملك خالد الدولي - الرياض".
  return locale === "ar" ? `${a.iata} ${a.nameAr} - ${a.cityAr}` : `${a.iata} ${a.nameEn} - ${a.cityEn}`;
}

// Matches by IATA code, airport name, city, or country (in either language)
// so typing a country ("السعودية") surfaces every airport within it.
export function searchAirports(query: string, limit = 8): Airport[] {
  const q = query.trim();
  if (!q) return [];
  const matches = AIRPORTS.filter(
    (a) =>
      searchMatches(
        [a.iata, a.nameAr, a.nameEn, a.cityAr, a.cityEn, a.countryAr, a.countryEn],
        q
      )
  );
  // A city with several airports also comes as itself — "London · all
  // airports" (LON) — first: a search on the city code covers Stansted and
  // Luton too, where the low-cost fares often are, which a search on
  // Heathrow alone never shows.
  const out: Airport[] = [];
  const seen = new Set<string>();
  for (const a of matches) {
    const code = Object.keys(CITY_CODES).find((c) => {
      const main = AIRPORTS.find((m) => m.iata === CITY_CODES[c]);
      return main && main.cityEn === a.cityEn && main.countryEn === a.countryEn;
    });
    if (code && !seen.has(code)) {
      seen.add(code);
      out.push({ ...a, iata: code, nameAr: "كل المطارات", nameEn: "All airports" });
    }
    out.push(a);
  }
  return out.slice(0, limit);
}

/**
 * The airport for a city, matched on the English city and country names —
 * so a season card for Istanbul can open the flight planner already pointed
 * at IST. Cities with no airport of their own (Petra, Cappadocia, Mecca)
 * return undefined and simply get no flight shortcut.
 */
export function airportForCity(cityEn: string, countryEn: string): Airport | undefined {
  const fold = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const city = fold(cityEn);
  const country = fold(countryEn);
  return AIRPORTS.find((a) => fold(a.cityEn) === city && fold(a.countryEn) === country);
}
