import { NextResponse } from "next/server";
import { aiConfigured } from "@/lib/ai/provider";
import { buildPlan, cleanPlanRequest, type SmartPlan } from "@/lib/ai/plan";
import { takeAi } from "@/lib/ai/quota";
import { cachedJson } from "@/lib/edgeCache";

export const dynamic = "force-dynamic";

async function hash(text: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...d].slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** «خطتي الذكية»: a plan for the city, dates and answers (src/lib/ai/plan.ts). */
export async function POST(request: Request) {
  if (!aiConfigured()) return NextResponse.json({ ok: false, reason: "off" }, { status: 503 });
  const req = cleanPlanRequest(await request.json().catch(() => null));
  if (!req) return NextResponse.json({ ok: false, reason: "bad_request" }, { status: 400 });
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
