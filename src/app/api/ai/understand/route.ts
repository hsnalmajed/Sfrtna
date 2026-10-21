import { NextResponse } from "next/server";
import { aiConfigured } from "@/lib/ai/provider";
import { understandTrip } from "@/lib/ai/budget";
import { takeAi } from "@/lib/ai/quota";

export const dynamic = "force-dynamic";

/** The budget advisor's first step: the trip in the traveller's words → search fields. */
export async function POST(request: Request) {
  if (!aiConfigured()) return NextResponse.json({ ok: false, reason: "off" }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as { text?: unknown; locale?: unknown };
  const text = typeof body.text === "string" ? body.text.replace(/[<>]/g, "").trim() : "";
  if (text.length < 3) return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  if (!(await takeAi("budget"))) return NextResponse.json({ ok: false, reason: "busy" }, { status: 429 });
  const today = new Date().toISOString().slice(0, 10);
  const r = await understandTrip(text, body.locale === "en" ? "en" : "ar", today);
  if ("error" in r) return NextResponse.json({ ok: false, reason: r.error }, { status: 502 });
  return NextResponse.json({ ok: true, fields: r }, { headers: { "Cache-Control": "no-store" } });
}
