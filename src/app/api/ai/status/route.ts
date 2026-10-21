import { NextResponse } from "next/server";
import { aiConfigured } from "@/lib/ai/provider";
import { readGuide } from "@/lib/guide";
import { guidePlanReady } from "@/lib/guidePlan";

export const dynamic = "force-dynamic";

/**
 * Whether the smart features are on: the AI key is set, or — for a city's
 * plan (?city=<slug>) — our own guide has enough written places to build one.
 */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("city") ?? "";
  const ai = aiConfigured();
  const guide = slug ? guidePlanReady(await readGuide(slug)) : false;
  return NextResponse.json({ on: ai || guide, ai, guide }, { headers: { "Cache-Control": "no-store" } });
}
