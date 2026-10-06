import { NextResponse } from "next/server";
import { serpConfigured, serpUsage } from "@/lib/providers/serpapi";

// Read at request time: without this the build renders it once, with no key.
export const dynamic = "force-dynamic";

/** How much of the month's SerpApi allowance is used — counts only, never the key. */
export async function GET() {
  const usage = await serpUsage();
  if (!usage) return NextResponse.json({ connected: false, keySet: serpConfigured() });
  const share = usage.perMonth ? Math.round((usage.used / usage.perMonth) * 100) : 0;
  return NextResponse.json(
    { connected: true, used: usage.used, left: usage.left, perMonth: usage.perMonth, usedPercent: share, mayUse: usage.mayUse, warn: share >= 80 },
    { headers: { "Cache-Control": "no-store" } }
  );
}
