// Why does «Update Review» / resubmit fail? Reads the review submission of
// com.sfrtna.app through the App Store Connect API (same key as ios.yml) and
// prints everything Apple checks before review: version + build state,
// encryption answer, age rating gaps, review details, screenshots, and the
// submission's items. With SUBMIT=1 it also resubmits, so Apple's API answers
// with the exact reason when it refuses. Output = annotations (no IDs).
import crypto from "node:crypto";

const kid = (process.env.ASC_KEY_ID || "").trim();
const iss = (process.env.ASC_ISSUER_ID || "").trim();
const pem = process.env.ASC_KEY_P8 || "";
function token() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "ES256", kid, typ: "JWT" });
  const body = b64({ iss, iat: now, exp: now + 1100, aud: "appstoreconnect-v1" });
  const sig = crypto.sign("sha256", Buffer.from(`${head}.${body}`), { key: pem, dsaEncoding: "ieee-p1363" }).toString("base64url");
  return `${head}.${body}.${sig}`;
}
let tok = token();
setInterval(() => (tok = token()), 15 * 60_000).unref();

const note = (s) => console.log(`::warning::${String(s).replace(/\n/g, " ").slice(0, 480)}`);
async function api(method, p, body) {
  let r;
  for (let attempt = 1; ; attempt++) {
    try {
      r = await fetch(`https://api.appstoreconnect.apple.com${p}`, {
        method,
        headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(90_000),
      });
      if (r.status >= 500 && attempt < 4) throw new Error(`HTTP ${r.status}`);
      break;
    } catch (e) {
      // Apple's API sometimes stalls or answers 5xx: wait and try again.
      if (attempt >= 4) throw e;
      await new Promise((ok) => setTimeout(ok, attempt * 10_000));
    }
  }
  const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = (j.errors || [])
      .map((x) => `${x.code}: ${x.detail || x.title}${x.source?.pointer ? ` (${x.source.pointer})` : ""}${x.meta ? ` META ${JSON.stringify(x.meta).replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, "…")}` : ""}`)
      .join(" | ");
    throw new Error(`${r.status} ${method} ${p.split("?")[0].replace(/\/[0-9a-f-]{8,}/gi, "/…")} ${e || JSON.stringify(j).slice(0, 200)}`);
  }
  return j;
}
const get = (p) => api("GET", p);
const app = (await get("/v1/apps?filter[bundleId]=com.sfrtna.app")).data?.[0];
if (!app) {
  note("no app");
  process.exit(0);
}
const safe = async (label, fn) => {
  try {
    note(`${label}: ${await fn()}`);
  } catch (e) {
    for (let k = 0; k < e.message.length; k += 450) note(`${label} ✗ ${e.message.slice(k, k + 450)}`);
  }
};

const versions = (await get(`/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=5`)).data || [];
const version = versions.find((v) => v.attributes.versionString === "1.0") || versions[0];
await safe("version", async () => `${version.attributes.versionString} state=${version.attributes.appStoreState} versionState=${version.attributes.appVersionState} release=${version.attributes.releaseType}`);
await safe("build", async () => {
  const b = (await get(`/v1/appStoreVersions/${version.id}/build`)).data;
  if (!b) return "NONE attached";
  const a = b.attributes;
  return `${a.version} processing=${a.processingState} encryption=${a.usesNonExemptEncryption} expired=${a.expired} minOS=${a.minOsVersion}`;
});
await safe("review detail", async () => {
  const d = (await get(`/v1/appStoreVersions/${version.id}/appStoreReviewDetail`)).data;
  if (!d) return "NONE";
  const a = d.attributes;
  return `name=${!!a.contactFirstName}/${!!a.contactLastName} phone=${!!a.contactPhone} email=${!!a.contactEmail} demoRequired=${a.demoAccountRequired} notes=${(a.notes || "").length} chars`;
});
await safe("screenshots", async () => {
  const locs = (await get(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`)).data || [];
  const out = [];
  for (const l of locs) {
    const sets = (await get(`/v1/appStoreVersionLocalizations/${l.id}/appScreenshotSets?include=appScreenshots`)).data || [];
    const desc = (l.attributes.description || "").length;
    out.push(`${l.attributes.locale}(desc ${desc}, kw ${(l.attributes.keywords || "").length}, ` + sets.map((s) => `${s.attributes.screenshotDisplayType}:${s.relationships?.appScreenshots?.data?.length ?? "?"}`).join(" ") + ")");
  }
  return out.join(" ; ");
});
await safe("app info", async () => {
  const infos = (await get(`/v1/apps/${app.id}/appInfos`)).data || [];
  return infos.map((i) => `state=${i.attributes.appStoreState || i.attributes.state} ageRating=${i.attributes.appStoreAgeRating}`).join(" ; ");
});
await safe("age rating gaps", async () => {
  const infos = (await get(`/v1/apps/${app.id}/appInfos`)).data || [];
  const out = [];
  for (const i of infos) {
    const d = (await get(`/v1/appInfos/${i.id}/ageRatingDeclaration`)).data;
    const empty = Object.entries(d?.attributes || {}).filter(([, v]) => v === null).map(([k]) => k);
    out.push(`${i.attributes.appStoreState || i.attributes.state}: ${empty.length ? "EMPTY " + empty.join(",") : "all answered"}`);
  }
  return out.join(" ; ");
});
await safe("price / territories", async () => {
  const sched = await get(`/v1/apps/${app.id}/appPriceSchedule`).catch((e) => ({ err: e.message }));
  const terr = await get(`/v1/apps/${app.id}/appAvailabilityV2`).catch((e) => ({ err: e.message }));
  return `price=${sched.err ? "✗ " + sched.err : "set"} availability=${terr.err ? "✗ " + terr.err : "set"}`;
});

const subs = (await get(`/v1/apps/${app.id}/reviewSubmissions?filter[platform]=IOS&limit=10`)).data || [];
for (const s of subs) {
  await safe(`submission ${s.attributes.submittedDate || "draft"}`, async () => {
    const items = (await get(`/v1/reviewSubmissions/${s.id}/items`)).data || [];
    return `state=${s.attributes.state} items=` + items.map((it) => it.attributes.state).join(",");
  });
}

if (process.env.SUBMIT === "1") {
  const open = subs.find((s) => ["UNRESOLVED_ISSUES", "READY_FOR_REVIEW"].includes(s.attributes.state));
  if (!open) note("submit: no open submission");
  else
    await safe("SUBMIT", async () => {
      // A rejected item must be marked resolved before the submission can go back.
      const items = (await get(`/v1/reviewSubmissions/${open.id}/items`)).data || [];
      for (const it of items.filter((x) => x.attributes.state === "REJECTED")) {
        try {
          await api("PATCH", `/v1/reviewSubmissionItems/${it.id}`, { data: { type: "reviewSubmissionItems", id: it.id, attributes: { resolved: true } } });
          note("item marked resolved");
        } catch (e) {
          for (let k = 0; k < e.message.length; k += 450) note(`item resolve ✗ ${e.message.slice(k, k + 450)}`);
        }
      }
      await api("PATCH", `/v1/reviewSubmissions/${open.id}`, { data: { type: "reviewSubmissions", id: open.id, attributes: { submitted: true } } });
      const after = (await get(`/v1/reviewSubmissions/${open.id}`)).data;
      return `accepted → state=${after.attributes.state}`;
    });
}
