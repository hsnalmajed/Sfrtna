import { NextResponse } from "next/server";
import { accounts, appleRevoke, clearedCookie, sessionToken } from "@/lib/accounts";

export const dynamic = "force-dynamic";

/** Deletes the signed-in account and everything saved with it. */
export async function POST(request: Request) {
  const store = await accounts();
  const token = sessionToken(request);
  if (!store || !token) return NextResponse.json({ ok: false }, { status: 401 });
  const { appleRefresh, ...r } = await store.deleteAccount(token);
  // Signed in with Apple: revoke the token at Apple too (App Store 5.1.1(v)).
  if (appleRefresh) await appleRevoke(appleRefresh);
  return NextResponse.json(r, { status: r.ok ? 200 : 401, headers: { "Set-Cookie": clearedCookie } });
}
