import { NextResponse } from "next/server";
import { accounts } from "@/lib/accounts";
import { STAT_KINDS, cleanStatKey, type StatKind } from "@/lib/statsShared";

export const dynamic = "force-dynamic";

/**
 * One anonymous event from a page: up to 6 (kind, key) pairs, each counted
 * once for today. No cookie, no address, no session is read or kept.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { p?: unknown } | null;
  const raw = Array.isArray(body?.p) ? body!.p.slice(0, 6) : [];
  const pairs: [string, string][] = [];
  for (const item of raw) {
    if (!Array.isArray(item)) continue;
    const kind = String(item[0]) as StatKind;
    const key = cleanStatKey(item[1]);
    if (STAT_KINDS.includes(kind) && key) pairs.push([kind, key]);
  }
  if (!pairs.length) return new NextResponse(null, { status: 204 });
  const store = await accounts();
  if (store) await store.statsAdd(pairs).catch(() => undefined);
  return new NextResponse(null, { status: 204 });
}
