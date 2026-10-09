import { NextRequest, NextResponse } from "next/server";
import { hotelSuggestions } from "@/lib/providers/hotelNames";

export const dynamic = "force-dynamic";

/**
 * Hotel names for the planner's search-as-you-type: /api/hotel-suggest?q=sama
 * → { items: [{ name, area, nameAr? }], city: { slug, code, nameAr, nameEn } | null }. Three to sixty characters; anything else
 * answers an empty list.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 3 || q.length > 60) {
    return NextResponse.json({ items: [], city: null }, { headers: { "Cache-Control": "no-store" } });
  }
  const { items, city } = await hotelSuggestions(q);
  return NextResponse.json({ items, city }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
