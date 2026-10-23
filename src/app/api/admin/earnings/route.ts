import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TP = "https://api.travelpayouts.com/statistics/v1";
const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/**
 * Travelpayouts earnings for the owner's weekly report, per program and in
 * total (statistics API, token TRAVELPAYOUTS_TOKEN). Answered only with the
 * site-check key. `?fields=1` lists what the API offers (to tune the query).
 */
export async function GET(request: Request) {
  const token = process.env.SMOKE_TOKEN;
  if (!token || request.headers.get("x-sfrtna-smoke") !== token) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const tp = process.env.TRAVELPAYOUTS_TOKEN;
  if (!tp) return NextResponse.json({ error: "no_token" }, { status: 503 });
  const url = new URL(request.url);
  const headers = { "X-Access-Token": tp, "Content-Type": "application/json" };

  const listRes = await fetch(`${TP}/get_fields_list?data_type=aggregated`, { headers, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  const list = listRes && listRes.ok ? ((await listRes.json().catch(() => null)) as unknown) : null;
  if (url.searchParams.get("fields")) return NextResponse.json({ status: listRes?.status ?? 0, list });

  const names = new Set<string>(
    JSON.stringify(list ?? {}).match(/"name"\s*:\s*"([a-z_]+)"/g)?.map((m) => m.split('"')[3]) ?? []
  );
  const wanted = ["redirects_count", "clicks_count", "paid_actions_count", "processing_actions_count", "paid_profit_usd_sum", "processing_profit_usd_sum"];
  const metrics = wanted.filter((f) => names.size === 0 || names.has(f));

  const days = Math.min(Math.max(Number(url.searchParams.get("days")) || 30, 1), 365);
  const to = day(Date.now() + 86400e3);
  const from = day(Date.now() - days * 86400e3);
  const run = (group: string[]) =>
    fetch(`${TP}/execute_query`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        fields: [...group, ...metrics],
        filters: [
          { field: "date", op: "ge", value: from },
          { field: "date", op: "lt", value: to },
        ],
        group,
        limit: 200,
      }),
      signal: AbortSignal.timeout(20_000),
    }).catch(() => null);
  // Per program first; the field list does not name dimensions, so try it
  // and fall back to the total when the API refuses the grouping.
  let fields = ["campaign_id", ...metrics];
  let res = await run(["campaign_id"]);
  if (!res || !res.ok) {
    fields = metrics;
    res = await run([]);
  }
  const text = res ? await res.text() : "";
  let data: unknown = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text.slice(0, 500);
  }
  return NextResponse.json({ status: res?.status ?? 0, from, to, fields, available: [...names].slice(0, 200), listShape: list && typeof list === "object" ? Object.keys(list as object).slice(0, 20) : null, data }, { headers: { "cache-control": "no-store" } });
}
