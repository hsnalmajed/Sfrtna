import { NextResponse } from "next/server";
import { cityReasons } from "@/lib/travelSeason/reasons";

export const dynamic = "force-dynamic";

/** A city's twelve month reasons, for the season card's detail (one language). */
export async function GET(request: Request) {
  const u = new URL(request.url);
  const city = u.searchParams.get("city") || "";
  const lang = u.searchParams.get("lang") === "en" ? "en" : "ar";
  if (!/^[a-z0-9-]{2,60}$/.test(city)) return NextResponse.json({ reasons: [] }, { status: 400 });
  return NextResponse.json({ reasons: await cityReasons(city, lang) }, { headers: { "Cache-Control": "public, max-age=86400" } });
}
