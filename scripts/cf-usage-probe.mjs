// One-off: how close is sfrtna to the 50 GB/month Observability allowance?
// Prints shares and GB only (public repo): no raw traffic counts.
const T = process.env.CF_API_TOKEN, A = process.env.CF_ACCOUNT_ID;
const H = { Authorization: `Bearer ${T}`, "Content-Type": "application/json" };
const iso = (ms) => new Date(ms).toISOString().slice(0, 10);
const gql = async (query, variables) => {
  const r = await fetch("https://api.cloudflare.com/client/v4/graphql", { method: "POST", headers: H, body: JSON.stringify({ query, variables }) });
  return r.json();
};
// 1) Requests over the last 30 days
const inv = await gql(`query($a:String!,$f:Date!,$t:Date!){viewer{accounts(filter:{accountTag:$a}){
  workersInvocationsAdaptive(limit:5000,filter:{scriptName:"sfrtna",date_geq:$f,date_leq:$t}){sum{requests} dimensions{date}}}}}`,
  { a: A, f: iso(Date.now() - 29 * 864e5), t: iso(Date.now()) });
const rows = inv?.data?.viewer?.accounts?.[0]?.workersInvocationsAdaptive || [];
const byDay = new Map(); for (const r of rows) byDay.set(r.dimensions.date, (byDay.get(r.dimensions.date) || 0) + r.sum.requests);
const days = [...byDay.values()]; const req30 = days.reduce((a, b) => a + b, 0);
console.log("invocations: days", days.length, "errors", JSON.stringify((inv.errors || []).map((e) => e.message)));
// 2) Account datasets that look like logs/observability
const intro = await gql(`{__type(name:"account"){fields{name}}}`);
const names = (intro?.data?.__type?.fields || []).map((f) => f.name).filter((n) => /observ|log|telemetry|trace/i.test(n));
console.log("datasets:", names.join(", ") || "(none)", JSON.stringify((intro.errors || []).map((e) => e.message)));
// 3) Workers Logs: real event count + sample of event sizes (last 24 h)
const now = Date.now(), base = `https://api.cloudflare.com/client/v4/accounts/${A}/workers/observability/telemetry/query`;
const q = async (body) => { const r = await fetch(base, { method: "POST", headers: H, body: JSON.stringify(body) }); let j; try { j = await r.json(); } catch { j = {}; } return { s: r.status, j }; };
const tf = { from: now - 864e5, to: now };
const ev = await q({ queryId: "probe-events", timeframe: tf, view: "events", limit: 100, parameters: { filters: [{ key: "$metadata.service", operation: "eq", type: "string", value: "sfrtna" }] } });
console.log("telemetry events status", ev.s, JSON.stringify((ev.j.errors || []).map((e) => e.message)).slice(0, 300));
const evs = ev.j?.result?.events?.events || [];
const sizes = evs.map((e) => Buffer.byteLength(JSON.stringify(e)));
const avgB = sizes.length ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 0;
const cnt = await q({ queryId: "probe-count", timeframe: tf, view: "calculations", parameters: { calculations: [{ operator: "count" }], filters: [{ key: "$metadata.service", operation: "eq", type: "string", value: "sfrtna" }] } });
console.log("telemetry count status", cnt.s, JSON.stringify((cnt.j.errors || []).map((e) => e.message)).slice(0, 300));
const calc = cnt.j?.result?.calculations?.[0];
const ev24 = Number(calc?.aggregates?.[0]?.value ?? calc?.series?.[0]?.data?.[0]?.value ?? NaN);
// Results (shares only)
const reqDay = days.length ? req30 / days.length : 0;
console.log("sampled events", sizes.length, "avg event KB", (avgB / 1024).toFixed(2));
if (Number.isFinite(ev24) && reqDay) console.log("log events per request (24h vs 30d avg)", (ev24 / reqDay).toFixed(2));
const evDay = Number.isFinite(ev24) ? ev24 : reqDay; // fallback: 1 event per request
for (const kb of [avgB / 1024 || 0, 1, 2, 4].filter(Boolean)) {
  const gb = (evDay * 30 * kb) / (1024 * 1024);
  console.log(`at ${kb.toFixed(2)} KB/event: ~${gb.toFixed(2)} GB/month = ${((gb / 50) * 100).toFixed(1)}% of 50 GB`);
}
console.log("busiest day vs average", days.length ? (Math.max(...days) / reqDay).toFixed(2) + "x" : "-");
