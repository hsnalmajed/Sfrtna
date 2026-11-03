// Fills the App Store listing of com.sfrtna.app through the App Store Connect
// API (same key as ios.yml): category, name/subtitle/privacy URL, version 1.0
// texts (ar-SA + en-US), age rating, review notes, free price, all
// territories, 6.9" screenshots (from SHOTS_DIR) and the newest valid build.
// Prints what it did as GitHub annotations (no IDs). Safe to run again: it
// updates what exists. Not done here (Apple has no API, or the owner's own
// data): App Privacy, review contact name/phone, «Add for Review».
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const listing = JSON.parse(fs.readFileSync(new URL("../../mobile/ios/store/listing.json", import.meta.url), "utf8"));
const SHOTS = process.env.SHOTS_DIR || "";
const LOCALES = ["ar-SA", "en-US"];

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

const note = (s) => console.log(`::warning::${String(s).replace(/\n/g, " ").slice(0, 500)}`);
async function api(method, p, body) {
  const r = await fetch(`https://api.appstoreconnect.apple.com${p}`, {
    method,
    headers: { Authorization: `Bearer ${tok}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = r.status === 204 ? {} : await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = (j.errors || []).map((x) => `${x.code}: ${x.detail || x.title}${x.source?.pointer ? ` (${x.source.pointer})` : ""}`).join(" | ");
    throw new Error(`${r.status} ${method} ${p.split("?")[0].replace(/\/[0-9a-f-]{8,}/gi, "/…")} ${e || JSON.stringify(j).slice(0, 200)}`);
  }
  return j;
}
const get = (p) => api("GET", p);
async function step(name, fn) {
  try {
    const r = await fn();
    note(`✓ ${name}${r ? ` — ${r}` : ""}`);
  } catch (e) {
    note(`✗ ${name}: ${e.message}`);
  }
}

const app = (await get("/v1/apps?filter[bundleId]=com.sfrtna.app")).data?.[0];
if (!app) {
  note("no app com.sfrtna.app");
  process.exit(0);
}
const appRel = { app: { data: { type: "apps", id: app.id } } };

// App info (the editable one) — category, localizations, age rating.
const infos = (await get(`/v1/apps/${app.id}/appInfos`)).data || [];
const info = infos.find((i) => !["READY_FOR_SALE", "READY_FOR_DISTRIBUTION", "REPLACED_WITH_NEW_INFO"].includes(i.attributes.appStoreState || i.attributes.state)) || infos[0];

await step("category Travel", async () => {
  await api("PATCH", `/v1/appInfos/${info.id}`, {
    data: { type: "appInfos", id: info.id, relationships: { primaryCategory: { data: { type: "appCategories", id: listing.category } } } },
  });
});

await step("name, subtitle, privacy URL (ar + en)", async () => {
  const have = (await get(`/v1/appInfos/${info.id}/appInfoLocalizations`)).data || [];
  const out = [];
  for (const loc of LOCALES) {
    const attributes = { name: listing.name[loc], subtitle: listing.subtitle[loc], privacyPolicyUrl: listing.privacyPolicyUrl[loc] };
    const ex = have.find((h) => h.attributes.locale === loc);
    if (ex) await api("PATCH", `/v1/appInfoLocalizations/${ex.id}`, { data: { type: "appInfoLocalizations", id: ex.id, attributes } });
    else
      await api("POST", "/v1/appInfoLocalizations", {
        data: { type: "appInfoLocalizations", attributes: { locale: loc, ...attributes }, relationships: { appInfo: { data: { type: "appInfos", id: info.id } } } },
      });
    out.push(`${loc} ${ex ? "updated" : "added"}`);
  }
  return out.join(", ");
});

await step("age rating (no objectionable content)", async () => {
  const decl = (await get(`/v1/appInfos/${info.id}/ageRatingDeclaration`)).data;
  const levels = new Set([
    "alcoholTobaccoOrDrugUseOrReferences", "contests", "gamblingSimulated", "gunsOrOtherWeapons", "horrorOrFearThemes",
    "matureOrSuggestiveThemes", "medicalOrTreatmentInformation", "profanityOrCrudeHumor", "sexualContentGraphicAndNudity",
    "sexualContentOrNudity", "violenceCartoonOrFantasy", "violenceRealistic", "violenceRealisticProlongedGraphicOrSadistic",
  ]);
  const skip = new Set(["kidsAgeBand", "ageRatingOverride", "ageRatingOverrideV2", "koreaAgeRatingOverride", "developerAgeRatingInfoUrl", "seventeenPlus"]);
  const attrs = {};
  for (const [k, v] of Object.entries(decl.attributes || {})) {
    if (skip.has(k)) continue;
    if (levels.has(k)) attrs[k] = "NONE";
    else if (typeof v === "boolean" || v === null) attrs[k] = false;
  }
  for (let i = 0; i < 6; i++) {
    try {
      await api("PATCH", `/v1/ageRatingDeclarations/${decl.id}`, { data: { type: "ageRatingDeclarations", id: decl.id, attributes: attrs } });
      return `${Object.keys(attrs).length} answers`;
    } catch (e) {
      const bad = [...e.message.matchAll(/attributes\/(\w+)/g)].map((m) => m[1]).filter((k) => k in attrs);
      if (!bad.length) throw e;
      for (const k of bad) delete attrs[k];
    }
  }
  throw new Error("age rating refused");
});

// Version 1.0 — texts, release, review notes, build.
let version = ((await get(`/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=10`)).data || []).find((v) =>
  ["PREPARE_FOR_SUBMISSION", "DEVELOPER_REJECTED", "REJECTED", "METADATA_REJECTED"].includes(v.attributes.appStoreState || v.attributes.appVersionState)
);
await step("version 1.0", async () => {
  const attributes = { copyright: listing.copyright, releaseType: "AFTER_APPROVAL" };
  if (version) {
    await api("PATCH", `/v1/appStoreVersions/${version.id}`, { data: { type: "appStoreVersions", id: version.id, attributes: { ...attributes, versionString: listing.version } } });
    return `kept (${version.attributes.appStoreState || version.attributes.appVersionState})`;
  }
  version = (await api("POST", "/v1/appStoreVersions", { data: { type: "appStoreVersions", attributes: { platform: "IOS", versionString: listing.version, ...attributes }, relationships: appRel } })).data;
  return "created";
});
if (!version) process.exit(0);

const vlocs = {};
await step("description, keywords, promo text, URLs (ar + en)", async () => {
  const have = (await get(`/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations`)).data || [];
  for (const loc of LOCALES) {
    const attributes = {
      description: listing.description[loc],
      keywords: listing.keywords[loc],
      promotionalText: listing.promotionalText[loc],
      supportUrl: listing.supportUrl[loc],
      marketingUrl: listing.marketingUrl[loc],
    };
    const ex = have.find((h) => h.attributes.locale === loc);
    vlocs[loc] = ex
      ? (await api("PATCH", `/v1/appStoreVersionLocalizations/${ex.id}`, { data: { type: "appStoreVersionLocalizations", id: ex.id, attributes } })).data
      : (await api("POST", "/v1/appStoreVersionLocalizations", {
          data: { type: "appStoreVersionLocalizations", attributes: { locale: loc, ...attributes }, relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: version.id } } } },
        })).data;
  }
  return LOCALES.join(", ");
});

await step("review notes (no sign-in needed)", async () => {
  const attributes = { notes: listing.reviewNotes, demoAccountRequired: false };
  let d = null;
  try {
    d = (await get(`/v1/appStoreVersions/${version.id}/appStoreReviewDetail`)).data;
  } catch {
    d = null;
  }
  if (d) await api("PATCH", `/v1/appStoreReviewDetails/${d.id}`, { data: { type: "appStoreReviewDetails", id: d.id, attributes } });
  else await api("POST", "/v1/appStoreReviewDetails", { data: { type: "appStoreReviewDetails", attributes, relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: version.id } } } } });
  return d ? "updated" : "added";
});

await step("price Free", async () => {
  const points = (await get(`/v1/apps/${app.id}/appPricePoints?filter[territory]=USA&limit=200`)).data || [];
  const free = points.find((p) => Number(p.attributes.customerPrice) === 0);
  if (!free) throw new Error("no free price point");
  await api("POST", "/v1/appPriceSchedules", {
    data: {
      type: "appPriceSchedules",
      relationships: { ...appRel, baseTerritory: { data: { type: "territories", id: "USA" } }, manualPrices: { data: [{ type: "appPrices", id: "${p0}" }] } },
    },
    included: [{ type: "appPrices", id: "${p0}", attributes: { startDate: null }, relationships: { appPricePoint: { data: { type: "appPricePoints", id: free.id } } } }],
  });
});

await step("available in all countries", async () => {
  try {
    const cur = (await get(`/v1/apps/${app.id}/appAvailabilityV2`)).data;
    if (cur) return "already set";
  } catch {
    /* none yet */
  }
  const terr = [];
  let next = "/v1/territories?limit=200";
  while (next) {
    const j = await get(next);
    terr.push(...(j.data || []).map((t) => t.id));
    next = j.links?.next ? j.links.next.replace("https://api.appstoreconnect.apple.com", "") : null;
  }
  await api("POST", "/v2/appAvailabilities", {
    data: {
      type: "appAvailabilities",
      attributes: { availableInNewTerritories: true },
      relationships: { ...appRel, territoryAvailabilities: { data: terr.map((t) => ({ type: "territoryAvailabilities", id: `\${${t}}` })) } },
    },
    included: terr.map((t) => ({
      type: "territoryAvailabilities",
      id: `\${${t}}`,
      attributes: { available: true, releaseDate: null, preOrderEnabled: false },
      relationships: { territory: { data: { type: "territories", id: t } } },
    })),
  });
  return `${terr.length} territories`;
});

// Screenshots: store-*.png (Arabic) and store-en-*.png (English), 1320×2868.
async function uploadSet(loc, files) {
  const vl = vlocs[loc];
  if (!vl) throw new Error("no version localization");
  const sets = (await get(`/v1/appStoreVersionLocalizations/${vl.id}/appScreenshotSets`)).data || [];
  let set = sets.find((s) => s.attributes.screenshotDisplayType === "APP_IPHONE_67");
  if (set) {
    for (const old of (await get(`/v1/appScreenshotSets/${set.id}/appScreenshots`)).data || []) await api("DELETE", `/v1/appScreenshots/${old.id}`);
  } else {
    set = (await api("POST", "/v1/appScreenshotSets", {
      data: { type: "appScreenshotSets", attributes: { screenshotDisplayType: "APP_IPHONE_67" }, relationships: { appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: vl.id } } } },
    })).data;
  }
  for (const f of files) {
    const buf = fs.readFileSync(f);
    const shot = (await api("POST", "/v1/appScreenshots", {
      data: { type: "appScreenshots", attributes: { fileName: path.basename(f), fileSize: buf.length }, relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: set.id } } } },
    })).data;
    for (const op of shot.attributes.uploadOperations || []) {
      const headers = Object.fromEntries((op.requestHeaders || []).map((h) => [h.name, h.value]));
      const r = await fetch(op.url, { method: op.method, headers, body: buf.subarray(op.offset, op.offset + op.length) });
      if (!r.ok) throw new Error(`upload part ${r.status}`);
    }
    const md5 = crypto.createHash("md5").update(buf).digest("hex");
    await api("PATCH", `/v1/appScreenshots/${shot.id}`, { data: { type: "appScreenshots", id: shot.id, attributes: { uploaded: true, sourceFileChecksum: md5 } } });
  }
  return `${files.length} screenshots`;
}
if (SHOTS && fs.existsSync(SHOTS)) {
  const all = fs.readdirSync(SHOTS).filter((f) => /^store-.*\.png$/.test(f)).sort();
  const ar = all.filter((f) => !f.startsWith("store-en-")).map((f) => path.join(SHOTS, f));
  const en = all.filter((f) => f.startsWith("store-en-")).map((f) => path.join(SHOTS, f));
  await step("screenshots ar-SA", () => uploadSet("ar-SA", ar));
  await step("screenshots en-US", () => uploadSet("en-US", en.length ? en : ar));
} else note("no screenshots folder");

await step("attach the newest build", async () => {
  const builds = (await get(`/v1/builds?filter[app]=${app.id}&filter[processingState]=VALID&filter[expired]=false&sort=-uploadedDate&limit=1`)).data || [];
  if (!builds[0]) throw new Error("no valid build");
  await api("PATCH", `/v1/appStoreVersions/${version.id}/relationships/build`, { data: { type: "builds", id: builds[0].id } });
  return `build ${builds[0].attributes.version}`;
});
note("left for the owner: App Privacy, review contact (name, phone, e-mail), Add for Review");
