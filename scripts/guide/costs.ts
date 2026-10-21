// What a day in each city costs a traveller, by trip level — for the budget
// advisor's «كم أحتاج؟» when no live price can be had (owner, 21 Oct 2026:
// "help him set his budget because he does not know it at all").
//
//   npx tsx scripts/guide/costs.ts [--only slug,slug]
//
// Gemini (free tier, GitHub secret GEMINI_API_KEY), five cities a call, in US
// dollars; the site converts to the traveller's currency and labels every
// number «تقدير» — never shown as a price. Refreshed every 90 days.
// Output: public/data/costs.json (read through ASSETS).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { liveSlugs } from "../lib/cityPoints";
import { CITY_NAMES_EN } from "./cityNames";
import { generate, listModels, ModelGone, pickModel, QuotaError } from "./gemini";
import type { CityCosts } from "@/lib/costsTypes";

const OUT = join(process.cwd(), "public/data/costs.json");
const BATCH = 5;
const PAUSE_MS = Number(process.env.GEMINI_PAUSE_MS ?? 7_000);

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const PAIR = { type: "array", items: { type: "number" } } as const;
const LEVELS = { type: "array", items: PAIR, description: "[budget, mid-range, luxury], each [low, high]" } as const;
const SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      slug: { type: "string" },
      food: { ...LEVELS, description: "a day's three meals for one adult, [budget, mid, luxury] each [low, high] USD" },
      transport: { ...LEVELS, description: "a day's local transport for one adult (not the airport), [budget, mid, luxury] each [low, high] USD" },
      activities: { ...LEVELS, description: "an average sightseeing day's tickets/tours for one adult, [budget, mid, luxury] each [low, high] USD" },
      hotel: { ...LEVELS, description: "one night in a double room in a well-rated hotel: [3-star, 4-star, 5-star] each [low, high] USD, taxes included" },
      transfer: { ...PAIR, description: "airport to city centre by taxi, one way, [low, high] USD for the car" },
      sim: { ...PAIR, description: "a tourist eSIM or SIM with data for a week, [low, high] USD" },
      tips_ar: { type: "array", items: { type: "string" }, description: "3 concrete money-saving tips for this city, in Arabic" },
      tips_en: { type: "array", items: { type: "string" }, description: "the same 3 tips in English" },
    },
    required: ["slug", "food", "transport", "activities", "hotel", "transfer", "sim", "tips_ar", "tips_en"],
  },
} as const;

type Answer = {
  slug: string;
  food: number[][];
  transport: number[][];
  activities: number[][];
  hotel: number[][];
  transfer: number[];
  sim: number[];
  tips_ar: string[];
  tips_en: string[];
}[];

const SYSTEM = `You estimate travel costs for tourists (Saudi families and couples) in 2026, in US dollars.
For each city give realistic ranges a careful traveller would actually pay — not the cheapest possible, not the most expensive. Halal-friendly food is assumed.
Levels: budget = local eateries, public transport, free or cheap sights; mid-range = good sit-down restaurants, taxis/ride apps some of the time, main paid sights; luxury = fine restaurants, private car, premium tours.
Every pair is [low, high] with high >= low > 0. Tips: specific to that city (real passes, free days, transport cards), one sentence each.`;

const pair = (x: unknown): [number, number] | null => {
  if (!Array.isArray(x) || x.length < 2) return null;
  const lo = Math.round(Number(x[0]));
  const hi = Math.round(Number(x[1]));
  if (!(lo > 0) || !(hi >= lo) || hi > 5000) return null;
  return [lo, hi];
};
const levels = (x: unknown): [[number, number], [number, number], [number, number]] | null => {
  if (!Array.isArray(x) || x.length < 3) return null;
  const l = x.slice(0, 3).map(pair);
  return l.every(Boolean) ? (l as [[number, number], [number, number], [number, number]]) : null;
};

async function main() {
  const all: Record<string, CityCosts> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  const only = arg("--only");
  let slugs = only ? only.split(",").map((s) => s.trim()) : liveSlugs();
  slugs = slugs.filter((s) => only || !all[s] || Date.now() - Date.parse(all[s].at) > 90 * 86_400_000);
  if (!slugs.length) return console.log("costs: nothing to do");
  const names = (await listModels()).map((m) => m.name.replace(/^models\//, ""));
  const first = pickModel(names.map((name) => ({ name, supportedGenerationMethods: ["generateContent"] })));
  const models = [first, ...["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemma-4-31b-it"].filter((m) => m !== first && names.includes(m))];
  let model = models.shift() as string;
  let done = 0;
  for (let i = 0; i < slugs.length; i += BATCH) {
    const batch = slugs.slice(i, i + BATCH);
    const user = batch.map((s) => `- slug=${s}; city="${CITY_NAMES_EN[s] ?? s}"`).join("\n");
    let ans: Answer;
    try {
      ans = (await generate<Answer>({ model, system: SYSTEM, user, schema: SCHEMA as unknown as Record<string, unknown>, plainJson: model.startsWith("gemma") })).data;
      if (!Array.isArray(ans)) throw new Error("not a list");
    } catch (e) {
      if ((e instanceof QuotaError && e.daily) || e instanceof ModelGone) {
        const next = models.shift();
        console.log(`${model}: stopped — ${next ? `switching to ${next}` : "no model left"}`);
        if (!next) break;
        model = next;
        i -= BATCH;
        continue;
      }
      console.log(`batch ${batch.join(",")} failed: ${String(e).slice(0, 160)}`);
      await new Promise((r) => setTimeout(r, PAUSE_MS));
      continue;
    }
    for (const a of ans) {
      if (!batch.includes(a.slug)) continue;
      const food = levels(a.food);
      const transport = levels(a.transport);
      const activities = levels(a.activities);
      const hotel = levels(a.hotel);
      const transfer = pair(a.transfer);
      const sim = pair(a.sim);
      if (!food || !transport || !activities || !hotel || !transfer || !sim) continue;
      all[a.slug] = {
        at: new Date().toISOString().slice(0, 10),
        food,
        transport,
        activities,
        hotel,
        transfer,
        sim,
        tipsAr: a.tips_ar.slice(0, 3).map((x) => x.slice(0, 200)),
        tipsEn: a.tips_en.slice(0, 3).map((x) => x.slice(0, 200)),
      };
      done++;
    }
    mkdirSync(join(process.cwd(), "public/data"), { recursive: true });
    writeFileSync(OUT, JSON.stringify(all));
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
  console.log(`costs: ${done} cities written; ${Object.keys(all).length} in the file`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
