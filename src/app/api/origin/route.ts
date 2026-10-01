import { NextResponse } from "next/server";
import { userOrigin } from "@/lib/origin";

/**
 * This visitor's departure airport (see src/lib/origin.ts), for the search
 * forms, which are client components: they open with it filled in.
 * Never cached — it is per visitor.
 */
export async function GET() {
  const origin = await userOrigin();
  return NextResponse.json(origin, { headers: { "Cache-Control": "private, no-store" } });
}
