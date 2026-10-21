import { NextResponse } from "next/server";
import { aiConfigured } from "@/lib/ai/provider";
import { buildPlan, cleanPlanRequest, type SmartPlan } from "@/lib/ai/plan";
import { takeAi } from "@/lib/ai/quota";
import { cachedJson } from "@/lib/edgeCache";
import { readGuide } from "@/lib/guide";
import { buildGuidePlan, guidePlanReady } from "@/lib/guidePlan";
import type { GuideFile } from "@/lib/guideTypes";
import { readStoredRestaurants } from "@/lib/mapPins";
import { findCity } from "@/lib/cities";
import { CITY_COORDS } from "@/data/cityCoords";

export const dynamic = "force-dynamic";

async function hash(text: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...d].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** «خطتي الذكية»: a plan for the city, dates and answers (src/lib/ai/plan.ts). */
export async function POST(request: Request) {
  const req = cleanPlanRequest(await request.json().catch(() => null));
  if (!req) return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  // Our own guide first: built here by rules from stored data, no AI call
  // and no cost per visitor (src/lib/guidePlan.ts).
  const guide = await readGuide(req.slug);
  if (guidePlanReady(guide)) {
    const city = findCity(req.code, req.slug);
    if (!city) return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
    const restaurants = await readStoredRestaurants(req.slug);
    const plan = buildGuidePlan(req, guide as GuideFile, restaurants, req.locale === "ar" ? city.nameAr : city.nameEn, city.nameEn, CITY_COORDS[req.slug]);
    return NextResponse.json({ ok: true, plan, fresh: true }, { headers: { "Cache-Control": "no-store" } });
  }
  if (!aiConfigured()) return NextResponse.json({ ok: false, reason: "off" }, { status: 503 });
  // The same city, dates and answers get the same plan for a day: no second
  // bill for a reload or a shared link.
  const key = `ai-plan:v1:${await hash(JSON.stringify(req))}`;
  let spent = false;
  let failure = "";
  const plan = await cachedJson<SmartPlan>(key, 86_400, async () => {
    if (!(await takeAi("plan"))) {
      failure = "busy";
      return null;
    }
    spent = true;
    const r = await buildPlan(req);
    if ("error" in r) {
      failure = r.error;
      return null;
    }
    return r;
  });
  if (!plan) return NextResponse.json({ ok: false, reason: failure || "failed" }, { status: failure === "busy" ? 429 : 502 });
  return NextResponse.json({ ok: true, plan, fresh: spent }, { headers: { "Cache-Control": "no-store" } });
}
