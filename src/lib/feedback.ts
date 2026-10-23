import { countUse } from "@/lib/usage";
/**
 * «شاركنا رأيك» — what a visitor can send, and the email it becomes.
 *
 * Owner, 22 Oct 2026: before inviting testers (and for customers after),
 * one organised way to send a problem, a wrong fact, an idea, an opinion or
 * a question — with the page and device attached automatically, so a note
 * like "the price is wrong" arrives with enough context to act on.
 *
 * The note is kept in the Accounts store (accounts.js, table `feedback`) and
 * mailed to the site's own address (CONTACT_EMAIL, forwarded to the owner),
 * screenshot attached. A visitor who leaves an email and asks for a reply
 * gets a short confirmation with the reference number.
 */
import { CONTACT_EMAIL } from "@/lib/contact";
import { resendKey } from "@/lib/accounts";

import {
  FEEDBACK_AREAS,
  FEEDBACK_KINDS,
  FEEDBACK_SHOT_MAX,
  FEEDBACK_TEXT_MAX,
  FEEDBACK_TEXT_MIN,
  type FeedbackArea,
  type FeedbackKind,
} from "@/lib/feedbackShared";

export { FEEDBACK_AREAS, FEEDBACK_KINDS, FEEDBACK_SHOT_MAX, FEEDBACK_TEXT_MAX, FEEDBACK_TEXT_MIN };
export type { FeedbackArea, FeedbackKind };

const KIND_AR: Record<FeedbackKind, string> = {
  problem: "🐞 مشكلة أو خطأ",
  wrong: "⚠️ معلومة غير دقيقة",
  idea: "💡 فكرة أو اقتراح",
  opinion: "💬 رأي عام",
  question: "❓ سؤال",
};
const AREA_AR: Record<FeedbackArea, string> = {
  flights: "الطيران", hotels: "الفنادق", discover: "اقترح لي وجهة", plan: "الخطة السياحية",
  destinations: "الوجهات والمعالم", visa: "التأشيرات", seasons: "المواسم", budget: "الميزانية",
  services: "خدمات الرحلة", account: "حسابي", app: "التطبيق", other: "أخرى",
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

async function send(body: Record<string, unknown>): Promise<boolean> {
  const key = resendKey();
  if (!key) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.EMAIL_FROM || "سفرتنا <no-reply@sfrtna.com>", ...body }),
      signal: AbortSignal.timeout(12_000),
    });
    countUse("resend");
    if (!res.ok) console.error("feedback email refused", res.status, (await res.text().catch(() => "")).slice(0, 200));
    return res.ok;
  } catch (err) {
    console.error("feedback email failed", err instanceof Error ? err.message : String(err));
    return false;
  }
}

export interface FeedbackMail {
  ref: string;
  kind: FeedbackKind;
  area: FeedbackArea;
  rating: number | null;
  text: string;
  email: string | null;
  contact: boolean;
  signedIn: boolean;
  ctx: Record<string, string>;
  /** JPEG/PNG as base64 (no data: prefix). */
  shot: string | null;
  shotType: string | null;
}

/** The note, to the owner's inbox. Reply goes straight to the visitor when they left an email. */
export async function mailFeedbackToOwner(f: FeedbackMail): Promise<boolean> {
  if (!CONTACT_EMAIL) return false;
  const stars = f.rating ? `${"★".repeat(f.rating)}${"☆".repeat(5 - f.rating)} (${f.rating}/5)` : "—";
  const rows: [string, string][] = [
    ["النوع", KIND_AR[f.kind]],
    ["القسم", AREA_AR[f.area]],
    ["التقييم", stars],
    ["البريد", f.email ? `${f.email}${f.contact ? " — يريد رداً" : ""}` : "لم يترك بريداً"],
    ["مسجّل؟", f.signedIn ? "نعم" : "لا"],
    ["الصفحة", f.ctx.page || "—"],
    ["الجهاز", [f.ctx.platform, f.ctx.device, f.ctx.screen].filter(Boolean).join(" · ") || "—"],
    ["اللغة", f.ctx.lang || "—"],
    ["آخر بحث", f.ctx.lastSearch || "—"],
  ];
  const html = `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;color:#0b1f3a;max-width:640px">
<h2 style="margin:0 0 4px">${esc(KIND_AR[f.kind])} — ${esc(f.ref)}</h2>
<p style="margin:0 0 14px;color:#667">ملاحظة جديدة من «شاركنا رأيك»</p>
<div style="white-space:pre-wrap;background:#f4f6fa;border-radius:12px;padding:14px 16px;line-height:1.7;margin-bottom:16px">${esc(f.text)}</div>
<table style="border-collapse:collapse;width:100%;font-size:14px">${rows
    .map(([k, v]) => `<tr><td style="padding:6px 8px;color:#667;white-space:nowrap;vertical-align:top">${k}</td><td style="padding:6px 8px;word-break:break-all">${esc(v)}</td></tr>`)
    .join("")}</table>
${f.shot ? '<p style="color:#667;margin-top:12px">📎 صورة الشاشة مرفقة.</p>' : ""}
</div>`;
  const text = `${KIND_AR[f.kind]} — ${f.ref}\n\n${f.text}\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}`;
  return send({
    to: [CONTACT_EMAIL],
    subject: `${KIND_AR[f.kind]} · ${AREA_AR[f.area]} · ${f.ref}`,
    text,
    html,
    ...(f.email ? { reply_to: f.email } : {}),
    ...(f.shot ? { attachments: [{ filename: `${f.ref}.${f.shotType === "image/png" ? "png" : "jpg"}`, content: f.shot }] } : {}),
  });
}

/** A short receipt to a visitor who asked for a reply. */
export async function mailFeedbackReceipt(to: string, ref: string, locale: "ar" | "en"): Promise<boolean> {
  const ar = locale === "ar";
  const subject = ar ? `وصلتنا ملاحظتك (${ref}) — سفرتنا` : `We received your note (${ref}) — Sfrtna`;
  const body = ar
    ? `شكراً لك على ملاحظتك.\n\nرقمها: ${ref}\n\nنقرأ كل ملاحظة بأنفسنا، وسنرد عليك على هذا البريد إن احتجنا تفاصيل أكثر أو حين نعالجها.\n\nفريق سفرتنا\nsfrtna.com`
    : `Thank you for your note.\n\nReference: ${ref}\n\nWe read every note ourselves and will reply to this address if we need more detail or once it is handled.\n\nThe Sfrtna team\nsfrtna.com`;
  const html = `<div dir="${ar ? "rtl" : "ltr"}" style="font-family:Tahoma,Arial,sans-serif;font-size:16px;color:#0b1f3a;line-height:1.7">${esc(body).replace(/\n/g, "<br>")}</div>`;
  return send({ to: [to], subject, text: body, html, ...(CONTACT_EMAIL ? { reply_to: CONTACT_EMAIL } : {}) });
}
