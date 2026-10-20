import { NextResponse } from "next/server";
import { accounts, sessionCookie } from "@/lib/accounts";

export const dynamic = "force-dynamic";

/** Step 3: the app trades the code and its verifier for its own session. */
export async function POST(request: Request) {
  const store = await accounts();
  if (!store) return NextResponse.json({ ok: false, reason: "off" }, { status: 503 });
  const body = (await request.json().catch(() => ({}))) as { code?: unknown; verifier?: unknown };
  const r = await store.appCodeExchange(String(body.code ?? ""), String(body.verifier ?? ""));
  if (!r.ok) return NextResponse.json(r, { status: 400 });
  return NextResponse.json({ ok: true, user: r.user }, { headers: { "Set-Cookie": sessionCookie(r.token, r.maxAge), "Cache-Control": "no-store" } });
}
