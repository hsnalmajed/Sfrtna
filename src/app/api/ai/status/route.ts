import { NextResponse } from "next/server";
import { aiConfigured } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";

/** Whether the AI features are switched on (the key is set). */
export async function GET() {
  return NextResponse.json({ on: aiConfigured() }, { headers: { "Cache-Control": "no-store" } });
}
