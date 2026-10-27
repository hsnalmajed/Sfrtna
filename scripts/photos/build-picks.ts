// Hand-chosen photos → src/data/photoPicks.json (read by pickedPhoto() in
// src/lib/pexels.ts). The choices are made by eye on the numbered sheets of
// the branch `photo-review` (scripts/photos/candidates.ts) and written in
// scripts/photos/picks.txt, one place a line:
//
//   city:istanbul 6 8          the 6th and 8th candidates, in that order
//   city:alula =country:SA#7   another place's candidate
//
//   npx tsx scripts/photos/build-picks.ts <path to candidates.json>
import { readFileSync, writeFileSync } from "node:fs";

const cands = JSON.parse(readFileSync(process.argv[2], "utf8")) as Record<string, { o: string }[]>;
const out: Record<string, string[]> = {};
const problems: string[] = [];
for (const raw of readFileSync("scripts/photos/picks.txt", "utf8").split("\n")) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const [key, ...refs] = line.split(/\s+/);
  const urls: string[] = [];
  for (const ref of refs) {
    const m = ref.match(/^=?(?:([a-z]+:[\w-]+)#)?(\d+)$/i);
    if (!m) {
      problems.push(`${key}: bad ref ${ref}`);
      continue;
    }
    const from = m[1] ?? key;
    const c = cands[from]?.[Number(m[2]) - 1];
    if (!c) problems.push(`${key}: no candidate ${ref}`);
    else urls.push(c.o);
  }
  if (urls.length) out[key] = urls;
}
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync("src/data/photoPicks.json", JSON.stringify(sorted, null, 1) + "\n");
console.log(`places ${Object.keys(out).length}${problems.length ? `\n${problems.join("\n")}` : ""}`);
