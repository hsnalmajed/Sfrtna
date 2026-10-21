// Our place guide, step 2: a short write-up for each kept place, in Arabic
// and English — what it is, how long a visit takes, the best time, what to
// wear when it matters, one practical tip, good with children or not.
//
//   npx tsx scripts/guide/write.ts [--only slug,slug] [--top N]
//
// Gemini on the free tier (GEMINI_API_KEY, Google AI Studio), run on GitHub
// Actions in daily batches: famous cities first, the top places of each
// city first; a daily-quota answer ends the run and the next day continues.
// Only facts the model is sure of — no prices, no opening hours (hours come
// from OpenStreetMap), no invented numbers. The site reads the stored file;
// visitors never cause an AI call.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CITY_NAMES_EN } from "./cityNames";
import { generate, listModels, ModelGone, pickModel, QuotaError } from "./gemini";
import type { GuideFile, GuidePlace } from "@/lib/guideTypes";

const DIR = join(process.cwd(), "public/data/guide");
// Run logs are not readable from the workspace: the run's own notes are
// committed as scripts/guide/reports/write.txt.
const notes: string[] = [];
const note = (l: string) => {
  notes.push(l);
  console.log(l);
};
function saveNotes() {
  mkdirSync("scripts/guide/reports", { recursive: true });
  writeFileSync("scripts/guide/reports/write.txt", `${new Date().toISOString()}\n${notes.join("\n")}\n`);
}
const BATCH = 15;
const PAUSE_MS = Number(process.env.GEMINI_PAUSE_MS ?? 7_000);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const S = { type: "string" } as const;
const SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      q: S,
      ar: { ...S, description: "1–2 sentences in Modern Standard Arabic: what it is and why visit" },
      en: { ...S, description: "the same in English" },
      minutes: { type: "integer", description: "typical visit length in minutes" },
      best_ar: { ...S, description: "best time to go (time of day / day of week / season), short Arabic phrase" },
      best_en: S,
      dress_ar: { ...S, description: "what to wear if it matters (mosques, churches, hikes, beaches); empty string if nothing special" },
      dress_en: S,
      tip_ar: { ...S, description: "one practical, specific tip in Arabic" },
      tip_en: S,
      kids: { type: "boolean" },
      open_to_public: { type: "boolean", description: "false if visitors cannot go inside (a royal palace, an office, a closed site seen only from outside)" },
      known: { type: "boolean", description: "false if you do not know this exact place well" },
    },
    required: ["q", "ar", "en", "minutes", "best_ar", "best_en", "dress_ar", "dress_en", "tip_ar", "tip_en", "kids", "open_to_public", "known"],
  },
} as const;

type Answer = {
  q: string;
  ar: string;
  en: string;
  minutes: number;
  best_ar: string;
  best_en: string;
  dress_ar: string;
  dress_en: string;
  tip_ar: string;
  tip_en: string;
  kids: boolean;
  open_to_public: boolean;
  known: boolean;
}[];

const SYSTEM = `You write a travel guide for Saudi and Gulf travellers. For each place you get (name, kind, city, Wikidata id), write short, accurate guide notes.
Rules:
- Only what is well established about that exact place. If you do not know it well, set known=false and keep the text generic to its kind (no specific claims).
- Never give prices, ticket costs, phone numbers or opening hours.
- Arabic: clear Modern Standard Arabic, no transliteration mistakes in famous names, no tashkeel.
- Descriptions: at most 220 characters each. Tips: specific (e.g. "ادخل من بوابة ... لتجنب الطابور"), not generic advice.
- For mosques mention modest dress and prayer times; for churches modest dress; for beaches sun protection; for hikes shoes.
- minutes: a realistic visit (a viewpoint 20–40, a big museum 120–240).`;

function cityOrder(files: string[]): string[] {
  const fame = (f: string) => {
    const g = JSON.parse(readFileSync(join(DIR, f), "utf8")) as GuideFile;
    return g.places.slice(0, 10).reduce((s, p) => s + p.sl, 0);
  };
  return files.map((f) => [f, fame(f)] as const).sort((a, b) => b[1] - a[1]).map(([f]) => f.replace(/\.json$/, ""));
}

async function main() {
  if (!existsSync(DIR)) return console.log("no guide files yet");
  const top = Number(arg("--top") ?? 40);
  const only = arg("--only");
  let slugs = only ? only.split(",").map((s) => s.trim()) : cityOrder(readdirSync(DIR).filter((f) => f.endsWith(".json")));
  slugs = slugs.filter((s) => existsSync(join(DIR, `${s}.json`)));
  // Each model has its own free daily allowance: when one is spent, the next
  // (a step down in size) carries on the same day.
  const names = (await listModels()).map((m) => m.name.replace(/^models\//, ""));
  const first = pickModel(names.map((name) => ({ name, supportedGenerationMethods: ["generateContent"] })));
  // Free daily allowances are small for the newest models: the others follow
  // the same day; Gemma (very large free allowance) last.
  const models = [first, ...["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemma-4-31b-it", "gemma-4-26b-a4b-it"].filter((m) => m !== first && names.includes(m))];
  let model = models.shift() as string;
  note(`model: ${model} (then ${models.join(", ")}); cities: ${slugs.length}`);
  const started = Date.now();
  const stopAfter = Number(process.env.STOP_AFTER_MIN ?? 150) * 60_000;
  let calls = 0;
  let written = 0;
  for (const slug of slugs) {
    const path = join(DIR, `${slug}.json`);
    const file = JSON.parse(readFileSync(path, "utf8")) as GuideFile;
    const todo = file.places.slice(0, top).filter((p) => !p.d);
    if (!todo.length) continue;
    const city = CITY_NAMES_EN[slug] ?? slug;
    for (let i = 0; i < todo.length; i += BATCH) {
      if (Date.now() - started > stopAfter) {
        note(`time budget reached; ${written} places written in ${calls} calls`);
        return;
      }
      const batch = todo.slice(i, i + BATCH);
      const user = `City: ${city}\nPlaces:\n${batch.map((p) => `- q=${p.q}; name="${p.e || p.n}"; local="${p.n}"; kind=${p.g}${p.wh ? "; World Heritage" : ""}`).join("\n")}`;
      let ans: Answer;
      try {
        ans = (await generate<Answer>({ model, system: SYSTEM, user, schema: SCHEMA as unknown as Record<string, unknown>, plainJson: model.startsWith("gemma") })).data;
        if (!Array.isArray(ans)) throw new Error("not a list");
        calls++;
      } catch (e) {
        if ((e instanceof QuotaError && e.daily) || e instanceof ModelGone) {
          const next = models.shift();
          note(`${model}: ${e instanceof ModelGone ? "not available" : "daily quota reached"} after ${calls} calls${next ? ` — switching to ${next}` : ""}`);
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
      const at = new Date().toISOString().slice(0, 10);
      for (const a of ans) {
        const p = file.places.find((x) => x.q === a.q) as GuidePlace | undefined;
        if (!p || !a.ar || !a.en) continue;
        p.d = a.ar.slice(0, 260);
        p.de = a.en.slice(0, 260);
        if (a.known && a.minutes >= 10 && a.minutes <= 600) p.m = a.minutes;
        if (a.known) {
          p.bt = a.best_ar.slice(0, 120) || undefined;
          p.bte = a.best_en.slice(0, 120) || undefined;
          p.tp = a.tip_ar.slice(0, 200) || undefined;
          p.tpe = a.tip_en.slice(0, 200) || undefined;
        }
        p.dr = a.dress_ar.slice(0, 140) || undefined;
        p.dre = a.dress_en.slice(0, 140) || undefined;
        p.kids = a.kids;
        if (a.known && a.open_to_public === false) p.out = true;
        p.wAt = at;
        written++;
      }
      writeFileSync(path, JSON.stringify(file));
      await new Promise((r) => setTimeout(r, PAUSE_MS));
    }
    note(`${slug}: done (${written} written so far, ${calls} calls)`);
  }
  note(`all done; ${written} places written in ${calls} calls`);
}

main()
  .then(saveNotes)
  .catch((e) => {
    note(`FAILED: ${String(e).slice(0, 400)}`);
    saveNotes();
    process.exit(1);
  });
