import { NextResponse } from "next/server";
import { accounts, sessionToken } from "@/lib/accounts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const store = await accounts();
  const token = sessionToken(request);
  const body = (await request.json().catch(() => ({}))) as { id?: unknown };
  if (!store || !token || typeof body.id !== "string" || body.id.length > 20) return NextResponse.json({ ok: false }, { status: 400 });
  const r = await store.planDelete(token, body.id);
  return NextResponse.json(r, { status: r.ok ? 200 : 401 });
}
