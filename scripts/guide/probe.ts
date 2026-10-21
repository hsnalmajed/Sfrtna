// Checks the Gemini key: models it may use, one plain answer, one with
// Google Search grounding. Prints no secret.
import { mkdirSync, writeFileSync } from "node:fs";
import { generate, listModels, pickModel } from "./gemini";

// Logs of the run are not readable from the workspace, so the result is
// committed as scripts/guide/reports/probe.txt.
const lines: string[] = [];
const log = (...a: unknown[]) => {
  const l = a.map(String).join(" ");
  lines.push(l);
  console.log(l);
};
function save() {
  mkdirSync("scripts/guide/reports", { recursive: true });
  writeFileSync("scripts/guide/reports/probe.txt", `${new Date().toISOString()}\n${lines.join("\n")}\n`);
}

async function main() {
  const models = await listModels();
  log("models:", models.map((m) => m.name.replace("models/", "")).join(", "));
  const model = pickModel(models);
  log("picked:", model);
  const plain = await generate<{ ar: string; minutes: number }>({
    model,
    system: "Answer in JSON.",
    user: 'Hagia Sophia, Istanbul: {"ar": one-sentence Arabic description, "minutes": typical visit length}',
    schema: { type: "object", properties: { ar: { type: "string" }, minutes: { type: "integer" } }, required: ["ar", "minutes"] },
  });
  log("plain:", JSON.stringify(plain.data));
  try {
    const g = await generate<{ hours: string }>({
      model,
      system: "Search the web. Reply with only a JSON object.",
      user: 'Current opening hours of Topkapi Palace, Istanbul, as {"hours": "..."}',
      search: true,
    });
    log("grounded:", JSON.stringify(g.data), "sources:", g.sources.length);
  } catch (e) {
    log("grounded FAILED:", String(e).slice(0, 300));
  }
  save();
}
main().catch((e) => {
  log("FAILED:", String(e).slice(0, 500));
  save();
  process.exit(1);
});
