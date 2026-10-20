import { NextResponse } from "next/server";
import { accounts, sessionCookie, sessionToken, signInMethods } from "@/lib/accounts";

export const dynamic = "force-dynamic";

/** Who is signed in (null when no one), and which ways to sign in are on. */
export async function GET(request: Request) {
  const store = await accounts();
  const token = sessionToken(request);
  const user = store && token ? await store.userFor(token).catch(() => null) : null;
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  // A session in use is renewed (accounts.js), and so is its cookie: the
  // app stays signed in for as long as it is used.
  if (user && store) headers["Set-Cookie"] = sessionCookie(token, await store.sessionMaxAge());
  return NextResponse.json({ user, methods: store ? signInMethods() : { google: null, email: false } }, { headers });
}
