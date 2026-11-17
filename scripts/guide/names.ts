// Our place guide, step 3 (owner, 17 Nov: «every planned place has an Arabic
// name» — Ella's plan read in English). Every written place (it can enter a
// plan) with no Arabic name from Wikidata (`a`) or from its write-up (`an`)
// gets one: the usual Arabic name, else the generic word translated and the
// proper name in Arabic letters. 60 names a call, so a few calls a day cover
// the backlog; stored in `an`, the field the site already reads.
//
//   npx tsx scripts/guide/names.ts [--only slug,slug]

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CITY_NAMES_EN } from "./cityNames";
import { generate, listModels, ModelGone, NAME_AR_RULE, pickModel, QuotaError } from "./gemini";
import type { GuideFile } from "@/lib/guideTypes";

const DIR = join(process.cwd(), "public/data/guide");
const BATCH = 60;
const PAUSE_MS = Number(process.env.GEMINI_PAUSE_MS ?? 5_000);
const ARABIC = /^[؀-ۿ\s\d\-–'’().،«»]+$/;

const notes: string[] = [];
const note = (l: string) => {
  notes.push(l);
  console.log(l);
};

const SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: { q: { type: "string" }, name_ar: { type: "string", description: NAME_AR_RULE } },
    required: ["q", "name_ar"],
  },
} as const;

const SYSTEM = `You give Arabic names for places in a travel guide for Saudi and Gulf travellers.
For each place (id, English or local name, kind, city) return name_ar: ${NAME_AR_RULE}
Keep it short (the name only, no city, no explanation), Modern Standard Arabic, no tashkeel.`;

async function main() {
  if (!existsSync(DIR)) return;
  const onlyArg = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : "";
  const slugs = (onlyArg ? onlyArg.split(",") : readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5))).filter((s) =>
    existsSync(join(DIR, `${s}.json`))
  );
  const names = (await listModels()).map((m) => m.name.replace(/^models\//, ""));
  const first = pickModel(names.map((name) => ({ name, supportedGenerationMethods: ["generateContent"] })));
  const models = [first, ...["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemma-4-31b-it"].filter((m) => m !== first && names.includes(m))];
  let model = models.shift() as string;
  const started = Date.now();
  const stopAfter = Number(process.env.STOP_AFTER_MIN ?? 60) * 60_000;
  let named = 0;
  let calls = 0;
  for (const slug of slugs) {
    const path = join(DIR, `${slug}.json`);
    const file = JSON.parse(readFileSync(path, "utf8")) as GuideFile;
    const todo = file.places.filter((p) => p.d && !p.a && !p.an);
    for (let i = 0; i < todo.length; i += BATCH) {
      if (Date.now() - started > stopAfter) {
        note(`time budget reached; ${named} named in ${calls} calls`);
        return;
      }
      const batch = todo.slice(i, i + BATCH);
      const user = `City: ${CITY_NAMES_EN[slug] ?? slug}\nPlaces:\n${batch.map((p) => `- q=${p.q}; name="${p.e || p.n}"; local="${p.n}"; kind=${p.kd ?? p.g}`).join("\n")}`;
      let ans: { q: string; name_ar: string }[];
      try {
        ans = (await generate<typeof ans>({ model, system: SYSTEM, user, schema: SCHEMA as unknown as Record<string, unknown>, plainJson: model.startsWith("gemma"), temperature: 0.1 })).data;
        if (!Array.isArray(ans)) throw new Error("not a list");
        calls++;
      } catch (e) {
        if ((e instanceof QuotaError && e.daily) || e instanceof ModelGone) {
          const next = models.shift();
          note(`${model}: ${e instanceof ModelGone ? "not available" : "daily quota reached"}${next ? ` — switching to ${next}` : ""}`);
          writeFileSync(path, JSON.stringify(file));
          if (!next) return;
          model = next;
          i -= BATCH;
          continue;
        }
        note(`${slug}: batch failed — ${String(e).slice(0, 200)}`);
        await new Promise((r) => setTimeout(r, PAUSE_MS));
        continue;
      }
      for (const a of ans) {
        const p = batch.find((x) => x.q === a.q);
        const name = (a.name_ar ?? "").trim();
        if (!p || !name || !ARABIC.test(name) || !/[؀-ۿ]/.test(name)) continue;
        p.an = name.slice(0, 80);
        named++;
      }
      writeFileSync(path, JSON.stringify(file));
      await new Promise((r) => setTimeout(r, PAUSE_MS));
    }
  }
  note(`all done; ${named} named in ${calls} calls`);
}

main()
  .catch((e) => note(`FAILED: ${String(e).slice(0, 400)}`))
  .finally(() => {
    mkdirSync("scripts/guide/reports", { recursive: true });
    writeFileSync("scripts/guide/reports/names.txt", `${new Date().toISOString()}\n${notes.join("\n")}\n`);
  });
