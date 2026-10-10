import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/edgeCache";
import { partnerSearchUrl, type ActivityPartner } from "@/lib/activityLinks";
import { travelpayoutsMarker } from "@/lib/providers/travelpayouts";

export const dynamic = "force-dynamic";

/**
 * /api/go/tp?b=<klook|tiqets>&q=<what to search> → that partner's search,
 * through our Travelpayouts affiliate link.
 *
 * Travelpayouts makes the link (POST /links/v1/create, our server token);
 * each one is kept at the edge for 30 days, so a popular search asks once.
 * Should Travelpayouts refuse or be down, the visitor still lands on the
 * partner's search — without our tag, never on an error page.
 *
 * Only a partner from the list and a search are accepted, so this can never
 * send anyone to a page we did not choose.
 */

/** Our Travelpayouts project ("Sfrtna"), subscribed to Klook and Tiqets. */
const TP_PROJECT = 577683;
const BRANDS = new Set<ActivityPartner>(["klook", "tiqets"]);

interface CreateResponse {
  result?: { links?: { url?: string; code?: string; partner_url?: string }[] };
}

async function partnerLink(url: string): Promise<string | null> {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) return null;
  const hit = await cachedJson<{ url: string }>(`tp-link:${url}`, 30 * 86_400, async () => {
    try {
      const res = await fetch("https://api.travelpayouts.com/links/v1/create", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Access-Token": token },
        body: JSON.stringify({
          trs: TP_PROJECT,
          marker: Number(travelpayoutsMarker()),
          shorten: false,
          links: [{ url, sub_id: "activities" }],
        }),
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as CreateResponse;
      const link = body.result?.links?.[0];
      return link?.code === "success" && link.partner_url ? { url: link.partner_url } : null;
    } catch {
      return null;
    }
  });
  return hit?.url ?? null;
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const brand = sp.get("b") as ActivityPartner;
  const q = (sp.get("q") || "").trim();
  if (!BRANDS.has(brand) || !q || q.length > 120) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const plain = partnerSearchUrl(brand, q);
  const target = (await partnerLink(plain)) ?? plain;
  return NextResponse.redirect(target, {
    status: 302,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
