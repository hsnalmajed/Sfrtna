// Summarises one Lighthouse JSON (mobile) for scripts/mobile-speed-report.txt.
// Usage: node scripts/mobile-speed-summary.mjs <lh.json> <page path>
// Prints the headline row, then why the largest paint came when it did:
// its element, its phases (server answer → request start → download → paint),
// the main-thread work, the heaviest files, and the requests that started
// before the largest paint (so a slow page shows what it waited on).
import { readFileSync } from "node:fs";

const [file, page] = process.argv.slice(2);
const r = JSON.parse(readFileSync(file, "utf8"));
const a = r.audits;
const short = (u) => String(u || "").replace(/^https?:\/\//, "").replace(/^sfrtna\.almajedhsn\.workers\.dev/, "").slice(0, 70);
const ms = (n) => `${Math.round(n)}ms`;

const js = (a["resource-summary"]?.details?.items || []).find((i) => i.resourceType === "script");
const doc = (a["resource-summary"]?.details?.items || []).find((i) => i.resourceType === "document");
console.log(
  [
    page,
    Math.round(r.categories.performance.score * 100),
    a["first-contentful-paint"].displayValue,
    a["largest-contentful-paint"].displayValue,
    a["total-blocking-time"].displayValue,
    a["cumulative-layout-shift"].displayValue,
    js ? Math.round(js.transferSize / 1024) : "-",
    doc ? Math.round(doc.transferSize / 1024) : "-",
  ].join(" | "),
);

const lcpItems = a["largest-contentful-paint-element"]?.details?.items || [];
const lcpNode = lcpItems[0]?.items?.[0]?.node?.snippet || "";
console.log("   LCP element: " + lcpNode.slice(0, 140));
const phases = lcpItems[1]?.items || [];
if (phases.length) console.log("   LCP phases: " + phases.map((p) => `${p.phase} ${ms(p.timing)}`).join("; "));

const lcpMs = a["largest-contentful-paint"].numericValue;
const boot = (a["bootup-time"]?.details?.items || []).slice(0, 5).map((i) => `${short(i.url)} ${ms(i.total)}`).join("; ");
console.log("   main-thread JS: " + boot);
const big = (a["total-byte-weight"]?.details?.items || []).slice(0, 5).map((i) => `${short(i.url)} ${Math.round(i.totalBytes / 1024)}KB`).join("; ");
console.log("   heaviest: " + big);

const reqs = (a["network-requests"]?.details?.items || [])
  .filter((q) => q.networkRequestTime <= lcpMs)
  .sort((x, y) => x.networkRequestTime - y.networkRequestTime);
console.log(`   requests before LCP (${reqs.length}):`);
for (const q of reqs.slice(0, 25)) {
  console.log(
    `     ${ms(q.networkRequestTime).padStart(7)} → ${ms(q.networkEndTime).padStart(7)}  ${String(q.priority || "").padEnd(8)} ${String(Math.round((q.transferSize || 0) / 1024)).padStart(4)}KB  ${q.resourceType || ""} ${short(q.url)}`,
  );
}
const blocking = (a["render-blocking-resources"]?.details?.items || []).map((i) => `${short(i.url)} ${ms(i.wastedMs)}`).join("; ");
if (blocking) console.log("   render-blocking: " + blocking);
