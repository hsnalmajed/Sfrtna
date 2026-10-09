// What to actually put in the folder before you apply.
//
// Direct's country pages carry a documents list, and that list is the most
// useful thing on them — so this site needs one too. What it must not be is
// a copy of theirs: their checklists are their own commercial work, and
// republishing them here would be taking someone else's content.
//
// So these are written from published, stable rules instead, and there are
// only two of them — the two cases where we know which checklist applies
// without claiming anything about a country's visa status:
//
//   - Schengen states. The EU Visa Code fixes the document set across every
//     member — the same passport validity, the same €30,000 insurance
//     minimum, the same photo spec, whichever consulate you go to.
//   - Countries whose official online portal we link to (visaProviders.ts).
//     Whatever that portal issues, filling it in takes the same handful of
//     things, and that is all this list says.
//
// Everywhere else we show no checklist at all: picking one would mean
// guessing whether the country wants an embassy visa, an e-visa or nothing,
// which is exactly the status claim this site does not make.
//
// And they are framed as *typical*, never as the list. Consulates add their
// own requirements, change them, and ask for more from some applicants than
// others. The only list that governs is the one the embassy publishes, and
// every page that shows these links straight to it. A checklist that reads as
// definitive when it isn't would send someone to an appointment missing a
// document — which costs them the appointment and often the trip.

import { officialVisaUrl } from "@/lib/visaProviders";

export interface DocumentItem {
  titleAr: string;
  titleEn: string;
  detailAr?: string;
  detailEn?: string;
}

/**
 * The 29 states applying the Schengen Visa Code.
 *
 * Listed explicitly rather than inferred from "is in Europe": Ireland runs
 * its own visa, and Bulgaria, Romania, Croatia and Switzerland are in
 * Schengen while sitting outside other European groupings people confuse it
 * with. Getting this set wrong would hand someone the wrong checklist.
 */
export const SCHENGEN_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR",
  "HU", "IS", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT",
  "RO", "SK", "SI", "ES", "SE", "CH",
]);

const SCHENGEN_DOCUMENTS: DocumentItem[] = [
  {
    titleAr: "جواز السفر الأصلي",
    titleEn: "Original passport",
    detailAr: "ساري لمدة 3 أشهر على الأقل بعد تاريخ العودة، وفيه صفحتان فارغتان، وصادر خلال آخر 10 سنوات.",
    detailEn: "Valid for at least 3 months beyond your return date, with two blank pages, issued within the last 10 years.",
  },
  {
    titleAr: "صورتان شخصيتان",
    titleEn: "Two passport photos",
    detailAr: "مقاس 3.5 × 4.5 سم، خلفية بيضاء، حديثتان (خلال 6 أشهر)، الوجه واضح بدون نظارة.",
    detailEn: "35 × 45 mm, white background, taken within the last 6 months, face clear and unobstructed.",
  },
  {
    titleAr: "تأمين طبي للسفر",
    titleEn: "Travel medical insurance",
    detailAr: "تغطية لا تقل عن 30,000 يورو داخل دول شنغن، وتشمل الإعادة الطبية للوطن. هذا شرط نظامي موحّد.",
    detailEn: "Minimum €30,000 of cover valid across the Schengen area, including medical repatriation. This is a fixed legal requirement.",
  },
  {
    titleAr: "إثبات السكن",
    titleEn: "Proof of accommodation",
    detailAr: "حجز فندقي مؤكد يغطي كامل مدة الإقامة، أو دعوة موثّقة من مُضيف.",
    detailEn: "Confirmed hotel booking covering the whole stay, or a certified invitation from a host.",
  },
  {
    titleAr: "حجز تذاكر الطيران ذهاباً وعودة",
    titleEn: "Return flight reservation",
    detailAr: "حجز مبدئي يكفي عادة — لا يُنصح بشراء التذكرة قبل صدور التأشيرة.",
    detailEn: "A reservation is usually enough — buying the ticket before the visa is issued is not advisable.",
  },
  {
    titleAr: "كشف حساب بنكي",
    titleEn: "Bank statement",
    detailAr: "آخر 3 إلى 6 أشهر، مختوم من البنك، يوضّح رصيداً يكفي مدة الرحلة.",
    detailEn: "The last 3–6 months, stamped by the bank, showing funds sufficient for the trip.",
  },
  {
    titleAr: "تعريف بالراتب أو إثبات العمل",
    titleEn: "Employment or salary letter",
    detailAr: "مختوم من جهة العمل. للطلاب: خطاب من الجهة التعليمية. لأصحاب الأعمال: السجل التجاري.",
    detailEn: "Stamped by your employer. Students: a letter from their institution. Business owners: their commercial registration.",
  },
  {
    titleAr: "نموذج الطلب والرسوم والبصمة",
    titleEn: "Application form, fee and biometrics",
    detailAr: "يُعبّأ النموذج ويُحجز موعد لإعطاء البصمة في مركز التأشيرات، وتُدفع الرسوم عند الموعد.",
    detailEn: "Complete the form, book a biometrics appointment at the visa centre, and pay the fee at the appointment.",
  },
];

const EVISA_DOCUMENTS: DocumentItem[] = [
  {
    titleAr: "جواز سفر ساري",
    titleEn: "Valid passport",
    detailAr: "6 أشهر على الأقل من تاريخ الدخول. تحتاج رقم الجواز وتاريخي الإصدار والانتهاء أثناء التعبئة.",
    detailEn: "At least 6 months from your entry date. You'll need the number and both dates while filling the form.",
  },
  {
    titleAr: "صورة رقمية من الجواز وصورة شخصية",
    titleEn: "Digital passport scan and photo",
    detailAr: "بصيغة JPG أو PDF غالباً، بحجم محدّد في الموقع.",
    detailEn: "Usually JPG or PDF, within the size limit the portal states.",
  },
  {
    titleAr: "بطاقة ائتمان وبريد إلكتروني",
    titleEn: "Payment card and email",
    detailAr: "الرسوم تُدفع إلكترونياً، والموافقة تصل على البريد — تأكّد من صحته.",
    detailEn: "The fee is paid online and the approval arrives by email — make sure the address is right.",
  },
  {
    titleAr: "تفاصيل الرحلة",
    titleEn: "Trip details",
    detailAr: "تاريخ الوصول وعنوان الإقامة، وأحياناً رقم رحلة الطيران.",
    detailEn: "Arrival date and your accommodation address, sometimes the flight number.",
  },
  {
    titleAr: "اطبع الموافقة قبل السفر",
    titleEn: "Print the approval before travelling",
    detailAr: "كثير من شركات الطيران تطلب نسخة مطبوعة عند إنهاء إجراءات السفر.",
    detailEn: "Many airlines ask for a printed copy at check-in.",
  },
];

export type ChecklistKind = "schengen" | "online";

/**
 * The checklist we can honestly show for this destination, or null.
 *
 * Schengen is checked first: a Schengen application is a specific legal
 * procedure whose documents are set in law, so it is the more specific
 * answer. Otherwise a country gets the online-application list only when we
 * link to its official portal ourselves.
 */
export function checklistFor(
  countryCode: string
): { kind: ChecklistKind; items: DocumentItem[] } | null {
  if (SCHENGEN_COUNTRIES.has(countryCode)) return { kind: "schengen", items: SCHENGEN_DOCUMENTS };
  if (officialVisaUrl(countryCode)) return { kind: "online", items: EVISA_DOCUMENTS };
  return null;
}

