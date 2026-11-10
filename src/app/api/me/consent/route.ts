import { NextResponse } from "next/server";
import { accounts, sessionToken } from "@/lib/accounts";

export const dynamic = "force-dynamic";

/** Where the answer was given (kept with it as proof of consent). */
const SOURCES = new Set(["save_card", "account", "my_trip"]);

/** The signed-in traveller's answer about trip emails (null = never asked). */
export async function GET(request: Request) {
  const store = await accounts();
  const token = sessionToken(request);
  const r = store && token ? await store.consentGet(token) : null;
  if (!r || !r.ok) return NextResponse.json({ ok: false, reason: "signed_out" }, { status: 401 });
  return NextResponse.json(r, { headers: { "Cache-Control": "no-store" } });
}

/** Records yes or no. Only the traveller's own tick sends `tripMail: true`. */
export async function POST(request: Request) {
  const store = await accounts();
  const token = sessionToken(request);
  if (!store || !token) return NextResponse.json({ ok: false, reason: "signed_out" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { tripMail?: unknown; src?: unknown; locale?: unknown };
  if (typeof body.tripMail !== "boolean" || typeof body.src !== "string" || !SOURCES.has(body.src)) {
    return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  }
  const locale = body.locale === "en" ? "en" : "ar";
  const r = await store.consentSet(token, body.tripMail, body.src, locale);
  return NextResponse.json(r, { status: r.ok ? 200 : 401, headers: { "Cache-Control": "no-store" } });
}
