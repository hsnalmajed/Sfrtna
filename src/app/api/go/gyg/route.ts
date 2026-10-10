import { NextRequest, NextResponse } from "next/server";
import { partnerSearchUrl } from "@/lib/activityLinks";

export const dynamic = "force-dynamic";

/**
 * /api/go/gyg?q=<what to search> → GetYourGuide's search for it, with our
 * partner tag. Only a search is accepted (never a free URL), so this cannot
 * send anyone anywhere else. See activityLinks.ts for why links go through here.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (!q || q.length > 120) return NextResponse.json({ error: "bad request" }, { status: 400 });
  return NextResponse.redirect(partnerSearchUrl("getyourguide", q), {
    status: 302,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
