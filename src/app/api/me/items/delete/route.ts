import { NextResponse } from "next/server";
import { accounts, sessionToken } from "@/lib/accounts";

export const dynamic = "force-dynamic";

const KINDS = ["profile", "fav", "search", "trip"];

/** Removes one kept item. */
export async function POST(request: Request) {
  const store = await accounts();
  const token = sessionToken(request);
  if (!store || !token) return NextResponse.json({ ok: false, reason: "signed_out" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { kind?: unknown; key?: unknown };
  if (typeof body.kind !== "string" || !KINDS.includes(body.kind) || typeof body.key !== "string" || body.key.length > 200)
    return NextResponse.json({ ok: false, reason: "bad_item" }, { status: 400 });
  const r = await store.itemDelete(token, body.kind, body.key);
  return NextResponse.json(r, { status: r.ok ? 200 : 401 });
}
