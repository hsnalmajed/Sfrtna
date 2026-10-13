import { NextResponse } from "next/server";
import { accounts, sessionToken, type SavedPlanData } from "@/lib/accounts";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** The signed-in traveller's saved plans. */
export async function GET(request: Request) {
  const store = await accounts();
  const token = sessionToken(request);
  const plans = store && token ? await store.plansList(token) : null;
  if (!plans) return NextResponse.json({ ok: false, reason: "signed_out" }, { status: 401 });
  return NextResponse.json({ ok: true, plans }, { headers: { "Cache-Control": "no-store" } });
}

function clean(p: unknown): SavedPlanData | null {
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" && v.length > 0 && v.length <= max ? v : null);
  const code = str(o.code, 2);
  const slug = str(o.slug, 60);
  const city = str(o.city, 80);
  const from = str(o.from, 10);
  const to = str(o.to, 10);
  if (!code || !/^[A-Z]{2}$/.test(code) || !slug || !/^[a-z0-9-]+$/.test(slug) || !city || !from || !to || !ISO.test(from) || !ISO.test(to)) return null;
  if (!Array.isArray(o.days) || o.days.length < 1 || o.days.length > 30) return null;
  const days: string[][] = [];
  for (const d of o.days) {
    if (!Array.isArray(d) || d.length > 40 || !d.every((k) => typeof k === "string" && k.length <= 80)) return null;
    days.push(d as string[]);
  }
  return {
    v: 1,
    code,
    slug,
    city,
    locale: o.locale === "en" ? "en" : "ar",
    source: o.source === "auto" ? "auto" : "pick",
    from,
    to,
    days,
    short: o.short === true,
  };
}

/** Saves a plan to the signed-in account. */
export async function POST(request: Request) {
  const store = await accounts();
  const token = sessionToken(request);
  if (!store || !token) return NextResponse.json({ ok: false, reason: "signed_out" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { title?: unknown; plan?: unknown };
  const plan = clean(body.plan);
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 120) : "";
  if (!plan || !title) return NextResponse.json({ ok: false, reason: "bad_plan" }, { status: 400 });
  const r = await store.planSave(token, title, plan);
  return NextResponse.json(r, { status: r.ok ? 200 : r.reason === "signed_out" ? 401 : 400 });
}
