// Writes wrangler.staging.jsonc: the production wrangler.jsonc with the Worker
// renamed to `sfrtna-staging` and its own rate-limit counters, so the release
// gate (.github/workflows/release.yml) can deploy the SAME build to a second
// Worker and test it before production. wrangler.jsonc itself is never touched.
//
//   node scripts/make-staging-config.mjs [out-file]
//
// Why a generated file and not `--name`: the rate-limit bindings point at an
// account-level namespace id; staging must not share production's counters.
// Durable Objects need nothing: a new Worker name gets its own DO storage, and
// the `migrations` copied from production create the classes on first deploy.
import { readFileSync, writeFileSync } from "node:fs";

const SRC = new URL("../wrangler.jsonc", import.meta.url);
const OUT = process.argv[2] || new URL("../wrangler.staging.jsonc", import.meta.url).pathname;
const STAGING_NAME = "sfrtna-staging";

/** JSONC → JSON text: drops // and /* *\/ comments and trailing commas, string-aware. */
function stripJsonc(text) {
  let out = "";
  let inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const n = text[i + 1];
    if (inStr) {
      out += c;
      if (c === "\\") out += text[++i];
      else if (c === '"') inStr = false;
    } else if (c === '"') {
      inStr = true;
      out += c;
    } else if (c === "/" && n === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (c === "/" && n === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i++;
    } else out += c;
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

const cfg = JSON.parse(stripJsonc(readFileSync(SRC, "utf8")));
if (cfg.name !== "sfrtna") throw new Error(`wrangler.jsonc name is "${cfg.name}", expected "sfrtna"`);

cfg.name = STAGING_NAME;
// Own counters: namespace ids must be unique per counter, numeric strings.
cfg.ratelimits = (cfg.ratelimits || []).map((r) => ({ ...r, namespace_id: String(Number(r.namespace_id) + 1000) }));
// Staging must never claim production's routes or domains.
for (const key of ["routes", "route", "workers_dev", "custom_domains"]) delete cfg[key];
cfg.workers_dev = true;
// No cron on staging: it must never send trip emails (its own Accounts
// store is empty anyway, but a cron there would also spend Resend calls).
delete cfg.triggers;

writeFileSync(OUT, `${JSON.stringify(cfg, null, 2)}\n`);
console.log(`staging config written: ${OUT}`);
console.log(`  name: ${cfg.name}`);
console.log(`  durable objects: ${(cfg.durable_objects?.bindings || []).map((b) => b.class_name).join(", ")}`);
console.log(`  migrations: ${(cfg.migrations || []).map((m) => m.tag).join(", ")}`);
console.log(`  rate limits: ${(cfg.ratelimits || []).map((r) => `${r.name}=${r.namespace_id}`).join(", ")}`);
