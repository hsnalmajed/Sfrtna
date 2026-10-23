import { NextResponse } from "next/server";
import { accounts } from "@/lib/accounts";

export const dynamic = "force-dynamic";

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * The counts behind the owner's weekly report: this period and the one
 * before, plus daily visits. Answered only with the site-check key.
 */
export async function GET(request: Request) {
  const token = process.env.SMOKE_TOKEN;
  if (!token || request.headers.get("x-sfrtna-smoke") !== token) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get("days")) || 7, 1), 90);
  const now = Date.now() + 86400e3; // "to" is exclusive: include today
  const to = day(now);
  const from = day(now - days * 86400e3);
  const prevFrom = day(now - 2 * days * 86400e3);
  const store = await accounts();
  if (!store) return NextResponse.json({ error: "no_store" }, { status: 503 });
  const [current, previous, daily] = await Promise.all([
    store.statsRange(from, to),
    store.statsRange(prevFrom, from),
    store.statsDaily("visit", prevFrom, to),
  ]);
  return NextResponse.json({ from, to, prevFrom, days, current, previous, daily }, { headers: { "cache-control": "no-store" } });
}
