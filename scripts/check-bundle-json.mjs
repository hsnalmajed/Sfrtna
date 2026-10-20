// Fails the build when a data file imported into the site's code is big
// enough to take the Worker down. Every JSON a page or route imports is
// bundled into the Worker — once per route chunk that uses it — and data
// files of 2 MB took every page down with Cloudflare error 1102 on 14 and
// 15 Oct 2026 (1.37 MB still worked). Large data belongs in public/data/,
// read through the ASSETS binding (see storedPhotos() in src/lib/pexels.ts).
//
// Runs as part of `prebuild`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

const LIMIT = 800 * 1024;
const ROOT = resolve(process.cwd());
const SRC = join(ROOT, "src");
const bad = [];
const seen = new Map();

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.(ts|tsx|js|mjs)$/.test(name) && !/\.test\./.test(name)) check(p);
  }
}

function check(file) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/(?:import|from)\s*["']([^"']+\.json)["']/g)) {
    const spec = m[1];
    const target = spec.startsWith("@/") ? join(SRC, spec.slice(2)) : resolve(dirname(file), spec);
    let size = 0;
    try {
      size = statSync(target).size;
    } catch {
      continue;
    }
    seen.set(target, size);
    if (size > LIMIT) bad.push(`${file.replace(ROOT + "/", "")} imports ${spec} (${Math.round(size / 1024)} KB)`);
  }
}

walk(SRC);
const total = [...seen.values()].reduce((a, b) => a + b, 0);
if (bad.length) {
  console.error("Data files too large to bundle into the Worker (limit 800 KB each):\n  " + bad.join("\n  "));
  console.error("Move them to public/data/ and read them through ASSETS.");
  process.exit(1);
}
console.log(`check-bundle-json: ${seen.size} imported JSON files, largest ${Math.round(Math.max(0, ...seen.values()) / 1024)} KB, total ${Math.round(total / 1024)} KB — OK`);
