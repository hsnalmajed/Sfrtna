import { NextResponse } from "next/server";
import { readGuide } from "@/lib/guide";

export const dynamic = "force-dynamic";

/**
 * «قريب من» for the hotel search (owner, 27 Oct: choose the area as on
 * Booking): a city's best-known places from our guide, as anchors the
 * hotel list can measure distance from. Names and positions only.
 *   /api/anchors?city=<slug>
 */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("city") || "";
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) return NextResponse.json({ items: [] }, { status: 400 });
  const guide = await readGuide(slug);
  const items = (guide?.places ?? [])
    .filter((p) => !["food", "shopping"].includes(p.g) && !p.out)
    .slice(0, 6)
    .map((p) => ({ an: p.a ?? p.an ?? p.e ?? p.n, en: p.e ?? p.n, y: p.y, x: p.x }));
  return NextResponse.json({ items }, { headers: { "cache-control": "public, max-age=86400" } });
}
