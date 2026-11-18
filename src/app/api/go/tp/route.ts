import { NextRequest, NextResponse } from "next/server";
import { cachedJson } from "@/lib/edgeCache";
import { partnerSearchUrl, type ActivityPartner } from "@/lib/activityLinks";
import { BRANDS, brandPage, type PlaceBrand } from "@/lib/tripEssentials";
import { travelpayoutsMarker } from "@/lib/providers/travelpayouts";

export const dynamic = "force-dynamic";

/**
 * Our way out to Travelpayouts partners, through our affiliate link:
 *
 *   /api/go/tp?b=<klook|tiqets>&q=<what to search>   the partner's search
 *   /api/go/tp?b=aviasales&s=<flight search code>   Aviasales' flight search
 *   /api/go/tp?b=<brand>&c=<country code>&p=<city slug>
 *       a page checked for that place, or the partner's own home when it is
 *       itself a search (see tripEssentials.ts)
 *
 * Travelpayouts makes the link (POST /links/v1/create, our server token);
 * each one is kept at the edge for 30 days, so a popular search asks once.
 * Should Travelpayouts refuse or be down, the visitor still lands on the
 * partner's search — without our tag, never on an error page.
 *
 * Only a partner from the lists, with a search or a place we hold a checked
 * page for (tripEssentials.ts), is accepted — never a free URL — so this can
 * never send anyone to a page we did not choose.
 */

/** Our Travelpayouts project ("Sfrtna"), subscribed to these brands. */
const TP_PROJECT = 577683;
const SEARCH_BRANDS = new Set<string>(["klook", "tiqets"]);
const PAGE_BRANDS = new Set<string>(Object.keys(BRANDS));

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
  const brand = sp.get("b") || "";
  let plain: string | null = null;
  if (SEARCH_BRANDS.has(brand)) {
    const q = (sp.get("q") || "").trim();
    if (q && q.length <= 120) plain = partnerSearchUrl(brand as ActivityPartner, q);
  } else if (PAGE_BRANDS.has(brand)) {
    plain = brandPage(brand as PlaceBrand, {
      country: (sp.get("c") || "").toUpperCase(),
      city: sp.get("p") || "",
    });
  } else if (brand === "aviasales") {
    // The flight search on the partner's own site, for the trip as
    // flightSearchCode writes it ("RUH1612IST2312c211"). Used by the iPhone
    // app, where the widget does not run in our page (lib/iosClean.ts).
    const code = sp.get("s") || "";
    if (/^[A-Z]{3}\d{4}[A-Z]{3}(\d{4})?[wcf]?\d{1,3}$/.test(code)) plain = `https://www.aviasales.com/search/${code}`;
  }
  if (!plain) return NextResponse.json({ error: "bad request" }, { status: 400 });
  // Without Travelpayouts' answer, the partner still gets our marker.
  const fallback = brand === "aviasales" ? `${plain}?marker=${travelpayoutsMarker()}` : plain;
  const target = (await partnerLink(plain)) ?? fallback;
  return NextResponse.redirect(target, {
    status: 302,
    headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
