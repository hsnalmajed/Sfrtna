// Fails the build when browser code can reach src/lib/dictionaries.ts.
//
// That file holds both languages (≈130 KB). Client components get the page's
// one language from useDictionary() (src/lib/dict/context.tsx), filled by the
// [locale] layout. A single client import of the full file — directly or
// through a helper without "use client" — would put both languages back into
// every page's JavaScript, and nothing else would notice.
//
// Walks the import graph from every "use client" file (type-only imports
// don't count: they vanish at build time) and prints each path it finds.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

const ROOT = "src";
const TARGET = join(ROOT, "lib", "dictionaries.ts");

const files = new Map();
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name)) files.set(p, readFileSync(p, "utf8"));
  }
})(ROOT);

function resolve(from, spec) {
  let base;
  if (spec.startsWith("@/")) base = join(ROOT, spec.slice(2));
  else if (spec.startsWith(".")) base = normalize(join(dirname(from), spec));
  else return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) if (files.has(base + ext)) return base + ext;
  return null;
}

const IMPORT = /^\s*import\s+(?!type\b)(?:[^"';]*?from\s+)?["']([^"']+)["']/gm;
const REEXPORT = /^\s*export\s+(?!type\b)[^"';]*?from\s+["']([^"']+)["']/gm;
const DYNAMIC = /import\(\s*["']([^"']+)["']/g;

const graph = new Map();
for (const [file, text] of files) {
  const out = [];
  for (const re of [IMPORT, REEXPORT, DYNAMIC]) for (const m of text.matchAll(re)) {
    const r = resolve(file, m[1]);
    if (r) out.push(r);
  }
  graph.set(file, out);
}

const problems = [];
for (const [file, text] of files) {
  if (!/^\s*["']use client["']/.test(text)) continue;
  const prev = new Map([[file, null]]);
  const queue = [file];
  while (queue.length) {
    const n = queue.shift();
    if (n === TARGET) {
      const path = [];
      for (let x = n; x; x = prev.get(x)) path.unshift(x);
      problems.push(path.join(" → "));
      break;
    }
    for (const m of graph.get(n) || []) if (!prev.has(m)) { prev.set(m, n); queue.push(m); }
  }
}

if (problems.length) {
  console.error("Browser code imports src/lib/dictionaries.ts (ships both languages). Use useDictionary() from @/lib/dict/context instead:");
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log("check-client-words: no browser import of the two-language dictionary");
