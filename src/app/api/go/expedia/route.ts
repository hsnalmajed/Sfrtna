import { NextRequest, NextResponse } from "next/server";
import { expediaAffiliateUrl } from "@/lib/affiliateLinks";

export const dynamic = "force-dynamic";

/**
 * The way out to Expedia: /api/go/expedia?landing=<an expedia.com page>
 * redirects to that page through our own Expedia affiliate link.
 *
 * Why not link to Expedia directly: Stay22's LinkSwap, which the site loads
 * so that Booking.com links pay us, also rewrites every Expedia link it finds
 * on the page — it unwraps our affiliate link and wraps the bare search in
 * Stay22's own, so an Expedia booking would pay through Stay22 and Stay22
 * would keep a share. It leaves links to our own domain alone, so the button
 * points here and the redirect adds our tag.
 *
 * Only www.expedia.com pages are accepted: anything else gets a 400, so this
 * can never be used to send someone to another site.
 */
export async function GET(req: NextRequest) {
  const landing = req.nextUrl.searchParams.get("landing") || "";
  let url: URL;
  try {
    url = new URL(landing);
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  if (url.protocol !== "https:" || url.hostname !== "www.expedia.com") {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  return NextResponse.redirect(expediaAffiliateUrl(url.toString()), {
    status: 302,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
