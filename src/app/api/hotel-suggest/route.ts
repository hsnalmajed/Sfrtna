import { NextRequest, NextResponse } from "next/server";
import { hotelSuggestions } from "@/lib/providers/googlePlaces";

export const dynamic = "force-dynamic";

/**
 * Hotel names for the planner's search-as-you-type: /api/hotel-suggest?q=sama
 * → { items: [{ name, area }] }. Three to sixty characters; anything else
 * answers an empty list.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 3 || q.length > 60) {
    return NextResponse.json({ items: [] }, { headers: { "Cache-Control": "no-store" } });
  }
  const items = await hotelSuggestions(q);
  return NextResponse.json({ items }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
