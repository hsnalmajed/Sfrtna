// Hand-chosen photos → src/data/photoPicks.json (read by pickedPhoto() in
// src/lib/pexels.ts). The choices are made by eye on the numbered sheets of
// the branch `photo-review` (scripts/photos/candidates.ts) and written in
// scripts/photos/picks.txt, one place a line:
//
//   city:istanbul 6 8          the 6th and 8th candidates, in that order
//   city:alula =country:SA#7   another place's candidate
//
//   city:abha c2:1             the 1st candidate of the second search
//
//   npx tsx scripts/photos/build-picks.ts <candidates.json> [candidates2.json]
import { readFileSync, writeFileSync } from "node:fs";
import { COUNTRY_CITIES } from "@/lib/cities";

type C = Record<string, { o: string }[]>;
const cands = JSON.parse(readFileSync(process.argv[2], "utf8")) as C;
const cands2 = (process.argv[3] ? JSON.parse(readFileSync(process.argv[3], "utf8")) : {}) as C;
const out: Record<string, string[]> = {};
const problems: string[] = [];
for (const raw of readFileSync("scripts/photos/picks.txt", "utf8").split("\n")) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const [key, ...refs] = line.split(/\s+/);
  const urls: string[] = [];
  for (const ref of refs) {
    const m = ref.match(/^(c2:)?(?:([a-z]+:[\w-]+)#)?(\d+)$/i);
    if (!m) {
      problems.push(`${key}: bad ref ${ref}`);
      continue;
    }
    const from = m[2] ?? key;
    const c = (m[1] ? cands2 : cands)[from]?.[Number(m[3]) - 1];
    if (!c) problems.push(`${key}: no candidate ${ref}`);
    else urls.push(c.o);
  }
  if (urls.length) out[key] = urls;
}
// A country never shows one of its cities' photos (owner, 27 Oct).
for (const [code, list] of Object.entries(COUNTRY_CITIES)) {
  const key = `country:${code}`;
  if (!out[key]) continue;
  const used = new Set(list.flatMap((c) => out[`city:${c.slug}`] ?? []));
  const own = out[key].filter((u) => !used.has(u));
  if (own.length) out[key] = own;
  else problems.push(`${key}: every photo is also one of its cities'`);
}
const firsts = new Map<string, string>();
for (const [k, v] of Object.entries(out)) {
  const other = firsts.get(v[0]);
  if (other) problems.push(`${k} shows the same first photo as ${other}`);
  firsts.set(v[0], k);
}
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync("src/data/photoPicks.json", JSON.stringify(sorted, null, 1) + "\n");
console.log(`places ${Object.keys(out).length}${problems.length ? `\n${problems.join("\n")}` : ""}`);
