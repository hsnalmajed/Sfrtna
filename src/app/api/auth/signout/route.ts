import { NextResponse } from "next/server";
import { accounts, clearedCookie, sessionToken } from "@/lib/accounts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const store = await accounts();
  const token = sessionToken(request);
  if (store && token) await store.signOut(token).catch(() => null);
  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": clearedCookie } });
}
