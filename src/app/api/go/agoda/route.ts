import { NextRequest, NextResponse } from "next/server";
import { agodaAffiliateUrl } from "@/lib/affiliateLinks";

export const dynamic = "force-dynamic";

/**
 * The way out to Agoda: /api/go/agoda?landing=<an agoda.com page>
 * redirects to that page with our Agoda affiliate tag (cid).
 *
 * Why a redirect and not the tagged link itself: Stay22's LinkSwap, which the
 * site loads, rewrites agoda.com links it finds on the page into its own, so a
 * booking would pay through Stay22 and Stay22 would keep a share. It leaves
 * links to our own domain alone (same as /api/go/expedia).
 *
 * Only www.agoda.com pages are accepted: anything else gets a 400, so this can
 * never be used to send someone to another site.
 */
export async function GET(req: NextRequest) {
  const landing = req.nextUrl.searchParams.get("landing") || "";
  let url: URL;
  try {
    url = new URL(landing);
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (url.protocol !== "https:" || url.hostname !== "www.agoda.com") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  return NextResponse.redirect(agodaAffiliateUrl(url.toString()), {
    status: 302,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
