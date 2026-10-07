// Fails the build when edge-guard.js and the /api route files disagree.
//
// On 7 Oct 2026 the guard listed /api/discover and /api/multicity as GET
// while their pages send POST, so every "suggest a destination" and every
// multi-city search was refused with 405 and showed "no results". This
// check makes that mistake impossible to deploy:
//   - every method the guard allows must be one the route file exports;
//   - every method a route file exports must be allowed by the guard
//     (or the route must be listed below as deliberately closed).
//
//   node scripts/check-guard.mjs     (also runs before every `npm run build`)

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { ROUTES } from "../edge-guard.js";

/** Routes whose code is kept but which the guard closes on purpose (404). */
const CLOSED = new Set(["/api/flights", "/api/hotels"]);

const API = join(process.cwd(), "src/app/api");
const problems = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name === "route.ts" || name === "route.js") check(p);
  }
}

function check(file) {
  const path = "/api/" + relative(API, file).replace(/\\/g, "/").replace(/\/route\.(ts|js)$/, "");
  const src = readFileSync(file, "utf8");
  const exported = new Set(
    [...src.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1])
  );
  for (const m of src.matchAll(/export\s+const\s+(GET|POST|PUT|PATCH|DELETE)\b/g)) exported.add(m[1]);
  const rule = ROUTES[path];
  if (!rule) {
    if (!CLOSED.has(path)) problems.push(`${path}: route file exists but edge-guard.js has no rule for it (it would answer 404)`);
    return;
  }
  for (const m of rule.methods) {
    if (!exported.has(m)) problems.push(`${path}: guard allows ${m}, the route exports ${[...exported].join(", ") || "nothing"}`);
  }
  for (const m of exported) {
    if (!rule.methods.includes(m)) problems.push(`${path}: route exports ${m}, the guard refuses it (405)`);
  }
}

walk(API);
for (const path of Object.keys(ROUTES)) {
  const base = join(API, path.replace(/^\/api\//, ""));
  let found = false;
  for (const f of ["route.ts", "route.js"]) {
    try {
      statSync(join(base, f));
      found = true;
    } catch {
      /* not this one */
    }
  }
  if (!found) problems.push(`${path}: guard has a rule but there is no route file`);
}

if (problems.length) {
  console.error("edge-guard.js does not match the /api routes:\n  " + problems.join("\n  "));
  process.exit(1);
}
console.log(`edge-guard.js matches all ${Object.keys(ROUTES).length} /api routes.`);
