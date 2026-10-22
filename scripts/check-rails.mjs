// Fails the build when a row that scrolls sideways is written outside
// src/components/ui/ScrollRow.tsx.
//
// Owner, 22 Oct 2026: the city tabs scrolled sideways on a phone with no
// sign that more was hidden; only one of five such rows had any hint. The
// hint (fade, arrow button, first-time slide) now lives in ScrollRow, and
// this check makes it impossible to ship a sideways row without it.
//
//   node scripts/check-rails.mjs     (also runs before every `npm run build`)

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(process.cwd(), "src");
const ALLOWED = new Set(["src/components/ui/ScrollRow.tsx"]);
const PATTERN = /overflow-x-(auto|scroll)|overflowX:\s*["'](auto|scroll)/;
const problems = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx|ts|jsx|js)$/.test(name)) {
      const rel = relative(process.cwd(), p).replaceAll("\\", "/");
      if (ALLOWED.has(rel)) continue;
      readFileSync(p, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (PATTERN.test(line)) problems.push(`${rel}:${i + 1}  ${line.trim().slice(0, 120)}`);
        });
    }
  }
}

walk(ROOT);
if (problems.length) {
  console.error("Sideways-scrolling rows must use <ScrollRow> (src/components/ui/ScrollRow.tsx):\n" + problems.join("\n"));
  process.exit(1);
}
console.log("check-rails: every sideways row uses ScrollRow.");
