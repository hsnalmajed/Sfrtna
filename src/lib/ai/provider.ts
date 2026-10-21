/**
 * The site's AI, behind one function so the provider is a setting
 * (owner, 21 Oct 2026: start with OpenAI — Google's paid Gemini tier is not
 * open to individuals in Saudi Arabia — and move to Gemini with Google Maps
 * grounding once a business account exists).
 *
 * Settings (Cloudflare → Workers → sfrtna → Variables and Secrets, Runtime):
 *   OPENAI_API_KEY   Secret — enables the AI features
 *   OPENAI_MODEL     optional, default below
 *
 * Every answer that states a fact about a place (hours, booking, dishes) is
 * asked to come from web search, and the pages it used come back as
 * `sources` — shown under the plan, clickable, as the provider requires.
 */

export const DEFAULT_MODEL = "gpt-6.1-sol";

export interface AiSource {
  title: string;
  url: string;
}

export interface AiResult<T> {
  data: T;
  sources: AiSource[];
  model: string;
  usage: { input: number; output: number; searches: number };
}

export function aiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

interface ResponsesOutput {
  output?: {
    type: string;
    content?: { type: string; text?: string; annotations?: { type: string; url?: string; title?: string }[] }[];
  }[];
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { message?: string };
}

/**
 * One structured answer: `schema` is a JSON schema (strict), `search` lets
 * the model look things up on the web (at most `maxSearches` times, as asked
 * in the instructions; the API has no hard cap).
 */
export async function aiJson<T>(opts: {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  search?: { country?: string; city?: string } | false;
  effort?: "low" | "medium" | "high";
  timeoutMs?: number;
}): Promise<AiResult<T> | { error: string }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { error: "off" };
  const model = process.env.OPENAI_MODEL || DEFAULT_MODEL;
  const body: Record<string, unknown> = {
    model,
    instructions: opts.system,
    input: opts.user,
    reasoning: { effort: opts.effort ?? "medium" },
    text: { format: { type: "json_schema", name: opts.schemaName, schema: opts.schema, strict: true } },
  };
  if (opts.search !== false) {
    body.tools = [
      {
        type: "web_search",
        search_context_size: "medium",
        ...(opts.search && (opts.search.country || opts.search.city)
          ? { user_location: { type: "approximate", ...(opts.search.country ? { country: opts.search.country } : {}), ...(opts.search.city ? { city: opts.search.city } : {}) } }
          : {}),
      },
    ];
  }
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 170_000),
    });
  } catch (e) {
    return { error: (e as Error)?.name === "TimeoutError" ? "timeout" : "network" };
  }
  const json = (await res.json().catch(() => ({}))) as ResponsesOutput;
  if (!res.ok) {
    console.error("ai refused", res.status, json.error?.message?.slice(0, 200));
    return { error: `status_${res.status}` };
  }
  const sources = new Map<string, AiSource>();
  let text = "";
  let searches = 0;
  for (const item of json.output ?? []) {
    if (item.type === "web_search_call") searches++;
    if (item.type !== "message") continue;
    for (const c of item.content ?? []) {
      if (c.type !== "output_text" || !c.text) continue;
      text += c.text;
      for (const a of c.annotations ?? []) {
        if (a.type === "url_citation" && a.url && /^https:\/\//.test(a.url)) {
          const url = a.url.replace(/[?&]utm_source=openai$/, "");
          if (!sources.has(url)) sources.set(url, { title: (a.title || new URL(url).hostname).slice(0, 120), url });
        }
      }
    }
  }
  try {
    return {
      data: JSON.parse(text) as T,
      sources: [...sources.values()].slice(0, 30),
      model,
      usage: { input: json.usage?.input_tokens ?? 0, output: json.usage?.output_tokens ?? 0, searches },
    };
  } catch {
    console.error("ai answer not json", text.slice(0, 200));
    return { error: "bad_answer" };
  }
}
