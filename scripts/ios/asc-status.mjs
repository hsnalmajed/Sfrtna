// Reads the app's builds from App Store Connect (processing state etc.) and
// prints them as GitHub annotations — the workspace can read annotations,
// not logs. Uses the same API key as ios.yml. No IDs are printed.
import crypto from "node:crypto";

const kid = (process.env.ASC_KEY_ID || "").trim();
const iss = (process.env.ASC_ISSUER_ID || "").trim();
const pem = process.env.ASC_KEY_P8 || "";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now() / 1000);
const head = b64({ alg: "ES256", kid, typ: "JWT" });
const body = b64({ iss, iat: now, exp: now + 900, aud: "appstoreconnect-v1" });
const sig = crypto.sign("sha256", Buffer.from(`${head}.${body}`), { key: pem, dsaEncoding: "ieee-p1363" }).toString("base64url");
const token = `${head}.${body}.${sig}`;

async function get(path) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${r.status} ${path.split("?")[0]} ${JSON.stringify(j.errors?.[0]?.detail ?? j).slice(0, 200)}`);
  return j;
}
const note = (s) => console.log(`::warning::${s}`);

try {
  const apps = await get("/v1/apps?filter[bundleId]=com.sfrtna.app");
  const app = apps.data?.[0];
  if (!app) { note("no app with bundle com.sfrtna.app"); process.exit(0); }
  note(`app: ${app.attributes.name}`);
  const builds = await get(`/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=10&include=buildBetaDetail`);
  const details = Object.fromEntries((builds.included || []).filter((x) => x.type === "buildBetaDetails").map((x) => [x.id, x.attributes]));
  if (!builds.data?.length) note("no builds yet");
  for (const b of builds.data || []) {
    const a = b.attributes;
    const d = details[b.relationships?.buildBetaDetail?.data?.id] || {};
    note(`build ${a.version}: processing=${a.processingState} uploaded=${a.uploadedDate} expired=${a.expired} internal=${d.internalBuildState} external=${d.externalBuildState}`);
  }
  const groups = await get(`/v1/apps/${app.id}/betaGroups?limit=20`);
  note(`beta groups: ${(groups.data || []).map((g) => `${g.attributes.name}${g.attributes.isInternalGroup ? " (internal)" : ""}`).join(", ") || "none"}`);
} catch (e) {
  note(`error: ${e.message}`);
}
