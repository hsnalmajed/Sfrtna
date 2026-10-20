import { NextResponse } from "next/server";
import { accounts, sessionToken } from "@/lib/accounts";
import { cleanItem } from "@/lib/memberItems";

export const dynamic = "force-dynamic";

/** Everything the signed-in traveller keeps: profile, favourites, searches, trips. */
export async function GET(request: Request) {
  const store = await accounts();
  const token = sessionToken(request);
  const items = store && token ? await store.itemsList(token) : null;
  if (!items) return NextResponse.json({ ok: false, reason: "signed_out" }, { status: 401 });
  return NextResponse.json({ ok: true, items }, { headers: { "Cache-Control": "no-store" } });
}

/** Keeps one item (or replaces it). */
export async function POST(request: Request) {
  const store = await accounts();
  const token = sessionToken(request);
  if (!store || !token) return NextResponse.json({ ok: false, reason: "signed_out" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { kind?: unknown; key?: unknown; data?: unknown };
  const item = cleanItem(body.kind, body.key, body.data);
  if (!item) return NextResponse.json({ ok: false, reason: "bad_item" }, { status: 400 });
  const r = await store.itemPut(token, item.kind, item.key, item.data);
  return NextResponse.json(r, { status: r.ok ? 200 : r.reason === "signed_out" ? 401 : 400 });
}
