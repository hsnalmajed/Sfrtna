import { NextResponse } from "next/server";
import { accounts, sessionToken, validEmail } from "@/lib/accounts";
import {
  FEEDBACK_AREAS,
  FEEDBACK_KINDS,
  FEEDBACK_SHOT_MAX,
  FEEDBACK_TEXT_MAX,
  FEEDBACK_TEXT_MIN,
  mailFeedbackReceipt,
  mailFeedbackToOwner,
  type FeedbackArea,
  type FeedbackKind,
} from "@/lib/feedback";

export const dynamic = "force-dynamic";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

async function hashAddress(ip: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`fb:${ip}`));
  return [...new Uint8Array(d)].slice(0, 12).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * «شاركنا رأيك»: one note from a visitor (src/lib/feedback.ts).
 * Kept, then mailed to the owner; a receipt goes back when the visitor
 * left an email and asked for a reply. Six an hour per address at most.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  // A field people never see; a script that fills every input fills it.
  if (str(body.website, 100)) return NextResponse.json({ ok: true, ref: "F-0000" });

  const kind = str(body.kind, 20) as FeedbackKind;
  const area = str(body.area, 20) as FeedbackArea;
  const text = str(body.text, FEEDBACK_TEXT_MAX);
  if (!FEEDBACK_KINDS.includes(kind) || !FEEDBACK_AREAS.includes(area) || text.length < FEEDBACK_TEXT_MIN) {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }
  const ratingN = Number(body.rating);
  const rating = Number.isInteger(ratingN) && ratingN >= 1 && ratingN <= 5 ? ratingN : null;
  const typed = str(body.email, 254);
  const email = typed ? validEmail(typed) : null;
  if (typed && !email) return NextResponse.json({ ok: false, reason: "bad_email" }, { status: 400 });
  const contact = Boolean(body.contact);
  const locale = body.locale === "en" ? "en" : "ar";

  let shot: string | null = null;
  let shotType: string | null = null;
  const raw = str(body.screenshot, FEEDBACK_SHOT_MAX + 64);
  const m = raw.match(/^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/=]+)$/);
  if (raw && (!m || m[2].length > FEEDBACK_SHOT_MAX)) {
    return NextResponse.json({ ok: false, reason: "bad_screenshot" }, { status: 400 });
  }
  if (m) {
    shotType = m[1];
    shot = m[2];
  }

  const c = (body.ctx ?? {}) as Record<string, unknown>;
  const ctx: Record<string, string> = {
    page: str(c.page, 400),
    lang: locale,
    platform: str(c.platform, 20),
    device: str(c.device, 120),
    screen: str(c.screen, 20),
    lastSearch: str(c.lastSearch, 400),
    source: str(c.source, 40),
    shot: shot ? "yes" : "",
  };

  const store = await accounts();
  if (!store) return NextResponse.json({ ok: false, reason: "off" }, { status: 503 });
  const ip = await hashAddress(request.headers.get("cf-connecting-ip") || "unknown");
  const saved = await store.feedbackAdd(sessionToken(request), { kind, area, rating, text, email, contact, ctx, ip });
  if (!saved.ok) return NextResponse.json(saved, { status: 429 });

  await mailFeedbackToOwner({
    ref: saved.ref, kind, area, rating, text, email: saved.email, contact, signedIn: saved.signedIn, ctx, shot, shotType,
  });
  const reply = contact && saved.email ? await mailFeedbackReceipt(saved.email, saved.ref, locale) : false;
  return NextResponse.json({ ok: true, ref: saved.ref, receipt: reply ? saved.email : null });
}
