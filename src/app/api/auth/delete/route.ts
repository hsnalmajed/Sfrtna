import { NextResponse } from "next/server";
import { accounts, clearedCookie, sessionToken } from "@/lib/accounts";

export const dynamic = "force-dynamic";

/** Deletes the signed-in account and everything saved with it. */
export async function POST(request: Request) {
  const store = await accounts();
  const token = sessionToken(request);
  if (!store || !token) return NextResponse.json({ ok: false }, { status: 401 });
  const r = await store.deleteAccount(token);
  return NextResponse.json(r, { status: r.ok ? 200 : 401, headers: { "Set-Cookie": clearedCookie } });
}
