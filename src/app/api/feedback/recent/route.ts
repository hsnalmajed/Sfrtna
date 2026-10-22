import { NextResponse } from "next/server";
import { accounts } from "@/lib/accounts";

export const dynamic = "force-dynamic";

/**
 * Feedback since a time, for the owner's twice-daily status email
 * (scripts/status-report.mjs). Not for visitors: answered only to a request
 * carrying the site-check key (SMOKE_TOKEN), otherwise "not found".
 */
export async function GET(request: Request) {
  const token = process.env.SMOKE_TOKEN;
  if (!token || request.headers.get("x-sfrtna-smoke") !== token) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const hours = Math.min(Math.max(Number(new URL(request.url).searchParams.get("hours")) || 12, 1), 24 * 31);
  const store = await accounts();
  if (!store) return NextResponse.json({ items: [] });
  const items = await store.feedbackRecent(Date.now() - hours * 3600e3);
  return NextResponse.json({ items }, { headers: { "cache-control": "no-store" } });
}
