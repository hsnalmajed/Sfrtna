import { NextResponse } from "next/server";
import { accounts, sessionToken, signInMethods } from "@/lib/accounts";

export const dynamic = "force-dynamic";

/** Who is signed in (null when no one), and which ways to sign in are on. */
export async function GET(request: Request) {
  const store = await accounts();
  const token = sessionToken(request);
  const user = store && token ? await store.userFor(token).catch(() => null) : null;
  return NextResponse.json({ user, methods: store ? signInMethods() : { google: null, email: false } }, { headers: { "Cache-Control": "no-store" } });
}
