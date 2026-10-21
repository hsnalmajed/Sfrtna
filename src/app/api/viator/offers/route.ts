import { NextResponse } from "next/server";
import { COUNTRY_CITIES } from "@/lib/cities";
import { CITY_COORDS } from "@/data/cityCoords";
import { viatorConfigured, viatorDebug, viatorDestinationFor, viatorOffers } from "@/lib/viator";

export const dynamic = "force-dynamic";

const NAME_EN: Record<string, string> = Object.fromEntries(Object.values(COUNTRY_CITIES).flatMap((l) => l.map((c) => [c.slug, c.nameEn])));

/**
 * Tours and tickets from Viator for one of our cities, or for one place in
 * it (?q=Hagia Sophia). Asked for by the page in the browser, not written
 * into the HTML: Viator's own content must not be indexed (its licence), and
 * every /api answer carries X-Robots-Tag: noindex.
 */
export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const slug = sp.get("city") ?? "";
  const q = (sp.get("q") ?? "").replace(/[<>]/g, "").trim().slice(0, 80) || undefined;
  const n = Math.min(12, Math.max(1, Number(sp.get("n")) || 6));
  const at = CITY_COORDS[slug];
  const name = NAME_EN[slug];
  if (!at || !name) return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  if (!viatorConfigured()) return NextResponse.json({ ok: true, offers: [] });
  const dest = await viatorDestinationFor(slug, name, at.lat, at.lon);
  if (sp.get("debug") === "1") return NextResponse.json({ dest, debug: await viatorDebug() });
  if (!dest) return NextResponse.json({ ok: true, offers: [] });
  const offers = await viatorOffers(dest, q, n);
  return NextResponse.json({ ok: true, offers }, { headers: { "Cache-Control": "public, max-age=600" } });
}
