import { NextResponse } from "next/server";
import { aiConfigured } from "@/lib/ai/provider";
import { buildPlan, cleanPlanRequest, type SmartPlan } from "@/lib/ai/plan";
import { takeAi } from "@/lib/ai/quota";
import { cachedJson } from "@/lib/edgeCache";
import { readGuide } from "@/lib/guide";
import { guidePlanReady } from "@/lib/guidePlan";
import { buildRoutePlan, routeOptions } from "@/lib/routePlan";
import { appOfflinePlan } from "@/lib/appPlan";
import type { GuideFile } from "@/lib/guideTypes";

export const dynamic = "force-dynamic";

async function hash(text: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...d].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** «خطتي الذكية»: a plan for the city, dates and answers (src/lib/ai/plan.ts). */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const req = cleanPlanRequest(body);
  if (!req) return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
  // The iPhone app's native «خطّط» screen also takes the offline copy (src/lib/appPlan.ts).
  const forApp = (body as { app?: unknown }).app === true;
  const extra = (plan: SmartPlan) => (forApp ? { offline: appOfflinePlan(plan, req.locale) } : {});
  // Our own guide first: built here by rules from stored data, no AI call
  // and no cost per visitor (src/lib/guidePlan.ts).
  const guide = await readGuide(req.slug);
  // Before the plan: the days the city needs and the cities he could add (the planner asks him).
  if ((body as { preview?: unknown }).preview === true) {
    const opts = guidePlanReady(guide) ? await routeOptions(req, guide as GuideFile) : null;
    return NextResponse.json({ ok: true, options: opts }, { headers: { "Cache-Control": "no-store" } });
  }
  if (guidePlanReady(guide)) {
    // One city, or a route across the country when the trip is longer than the city needs (routePlan.ts).
    const plan = await buildRoutePlan(req, guide as GuideFile);
    if (!plan) return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
    return NextResponse.json({ ok: true, plan, fresh: true, ...extra(plan) }, { headers: { "Cache-Control": "no-store" } });
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
  return NextResponse.json({ ok: true, plan, fresh: spent, ...extra(plan) }, { headers: { "Cache-Control": "no-store" } });
}
