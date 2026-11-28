import { NextRequest, NextResponse } from "next/server";
import { agodaHotelDetails, agodaPhoto } from "@/lib/providers/agoda";

export const dynamic = "force-dynamic";

/**
 * One Agoda hotel's details from our bundle (Agoda's Hotel Data File):
 * photos, address, description (Arabic when Agoda has it), check-in/out,
 * rooms, years. /api/agoda-hotel?city=riyadh&shard=0&id=462868
 * Prices come from /api/agoda-hotels (live), not from here.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const city = sp.get("city") || "";
  const shard = Number(sp.get("shard"));
  const id = Number(sp.get("id"));
  if (!/^[a-z0-9-]{2,60}$/.test(city) || !Number.isInteger(shard) || !Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const d = await agodaHotelDetails(city, shard, id);
  if (!d) return NextResponse.json({ result: null }, { status: 404 });
  return NextResponse.json(
    {
      result: {
        photos: (d.photos ?? []).map((p) => agodaPhoto(p, "1024x768")),
        address: d.addr ?? "",
        addressAr: d.addrAr ?? "",
        overview: d.ov ?? "",
        overviewAr: d.ovAr ?? "",
        checkIn: d.in ?? "",
        checkOut: d.out ?? "",
        rooms: d.rooms ?? null,
        opened: d.opened ?? "",
        renovated: d.renov ?? "",
        chain: d.chain && d.chain !== "No chain" ? d.chain : "",
      },
    },
    { headers: { "Cache-Control": "public, max-age=86400" } }
  );
}
