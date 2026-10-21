// Checks the Gemini key: models it may use, one plain answer, one with
// Google Search grounding. Prints no secret.
import { generate, listModels, pickModel } from "./gemini";

async function main() {
  const models = await listModels();
  console.log("models:", models.map((m) => m.name.replace("models/", "")).join(", "));
  const model = pickModel(models);
  console.log("picked:", model);
  const plain = await generate<{ ar: string; minutes: number }>({
    model,
    system: "Answer in JSON.",
    user: 'Hagia Sophia, Istanbul: {"ar": one-sentence Arabic description, "minutes": typical visit length}',
    schema: { type: "object", properties: { ar: { type: "string" }, minutes: { type: "integer" } }, required: ["ar", "minutes"] },
  });
  console.log("plain:", JSON.stringify(plain.data));
  try {
    const g = await generate<{ hours: string }>({
      model,
      system: "Search the web. Reply with only a JSON object.",
      user: 'Current opening hours of Topkapi Palace, Istanbul, as {"hours": "..."}',
      search: true,
    });
    console.log("grounded:", JSON.stringify(g.data), "sources:", g.sources.length);
  } catch (e) {
    console.log("grounded FAILED:", String(e).slice(0, 300));
  }
}
main().catch((e) => {
  console.error(String(e).slice(0, 500));
  process.exit(1);
});
