// Gemini (Google AI Studio key, free tier) for the stored guide content.
// Used only by scripts on GitHub Actions — never by the site at page time,
// so visitors never cost anything (owner, 21 Oct 2026).

const BASE = "https://generativelanguage.googleapis.com/v1beta";

function key(): string {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw new Error("GEMINI_API_KEY is not set");
  return k;
}

export interface ModelInfo {
  name: string;
  displayName?: string;
  supportedGenerationMethods?: string[];
}

export async function listModels(): Promise<ModelInfo[]> {
  const res = await fetch(`${BASE}/models?pageSize=200`, { headers: { "x-goog-api-key": key() } });
  if (!res.ok) throw new Error(`models: ${res.status} ${(await res.text()).slice(0, 300)}`);
  const j = (await res.json()) as { models?: ModelInfo[] };
  return (j.models ?? []).filter((m) => m.supportedGenerationMethods?.includes("generateContent"));
}

/** The newest plain Flash model (not lite, not preview/image/tts), else any Flash. */
export function pickModel(models: ModelInfo[], prefer = process.env.GEMINI_MODEL): string {
  const names = models.map((m) => m.name.replace(/^models\//, ""));
  if (prefer && names.includes(prefer)) return prefer;
  const ver = (n: string) => Number((n.match(/gemini-(\d+(?:\.\d+)?)/) ?? [])[1] ?? 0);
  const plain = names.filter((n) => /^gemini-[\d.]+-flash(-\d+)?$/.test(n)).sort((a, b) => ver(b) - ver(a));
  if (plain.length) return plain[0];
  const any = names.filter((n) => /flash/.test(n) && !/image|tts|audio|live|embedding/.test(n)).sort((a, b) => ver(b) - ver(a));
  if (!any.length) throw new Error("no Flash model available");
  return any[0];
}

export class QuotaError extends Error {
  constructor(
    msg: string,
    public daily: boolean
  ) {
    super(msg);
  }
}

export interface GenResult<T> {
  data: T;
  sources: { title: string; url: string }[];
}

/**
 * One JSON answer. `schema` is an OpenAPI-style schema (Gemini's
 * responseSchema). With `search`, Google Search grounding is on — then the
 * JSON comes as text (schema mode cannot be combined with tools), parsed here.
 */
export async function generate<T>(opts: {
  model: string;
  system: string;
  user: string;
  schema?: Record<string, unknown>;
  search?: boolean;
  temperature?: number;
}): Promise<GenResult<T>> {
  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: [{ text: opts.user }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.3,
      ...(opts.search ? {} : { responseMimeType: "application/json", ...(opts.schema ? { responseSchema: opts.schema } : {}) }),
    },
  };
  if (opts.search) body.tools = [{ google_search: {} }];
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(`${BASE}/models/${opts.model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });
    const text = await res.text();
    if (res.status === 429) {
      const daily = /PerDay|per day|daily/i.test(text);
      if (daily || attempt === 3) throw new QuotaError(text.slice(0, 400), daily);
      const wait = Number((text.match(/"retryDelay":\s*"(\d+)s"/) ?? [])[1] ?? 30);
      await new Promise((r) => setTimeout(r, (wait + 2) * 1000));
      continue;
    }
    if (res.status >= 500) {
      await new Promise((r) => setTimeout(r, 15_000));
      continue;
    }
    if (!res.ok) throw new Error(`generate ${res.status}: ${text.slice(0, 400)}`);
    const j = JSON.parse(text) as {
      candidates?: {
        content?: { parts?: { text?: string }[] };
        groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] };
      }[];
    };
    const c = j.candidates?.[0];
    const out = (c?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    const json = out.replace(/^[\s\S]*?```(?:json)?\s*/i, (m) => (m.includes("```") ? "" : m)).replace(/```[\s\S]*$/, "").trim();
    const start = json.search(/[[{]/);
    const data = JSON.parse(start > 0 ? json.slice(start) : json) as T;
    const sources = (c?.groundingMetadata?.groundingChunks ?? [])
      .map((g) => ({ title: g.web?.title ?? "", url: g.web?.uri ?? "" }))
      .filter((s) => s.url);
    return { data, sources };
  }
  throw new Error("generate: gave up");
}
