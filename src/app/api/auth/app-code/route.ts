import { NextResponse } from "next/server";
import { accounts, sessionToken } from "@/lib/accounts";

export const dynamic = "force-dynamic";

/**
 * Step 2 of signing in to the app through the phone's browser: the browser,
 * signed in, asks for a one-time code to hand back to the app. The code is
 * bound to the app's PKCE challenge, so a code caught on the way is useless
 * without the verifier that never left the app.
 */
export async function POST(request: Request) {
  const store = await accounts();
  const token = sessionToken(request);
  if (!store || !token) return NextResponse.json({ ok: false, reason: "signed_out" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { challenge?: unknown };
  const r = await store.appCodeStart(token, String(body.challenge ?? ""));
  return NextResponse.json(r, { status: r.ok ? 200 : r.reason === "signed_out" ? 401 : 400, headers: { "Cache-Control": "no-store" } });
}
