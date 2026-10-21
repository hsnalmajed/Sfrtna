/**
 * Caps on AI calls, one count for the whole site (the same Durable Object
 * class as the HERE cap, its own instance per feature). Past a cap the
 * feature says it is busy — never an unbounded bill.
 */

interface QuotaStub {
  take(dailyCap: number, monthlyCap: number): Promise<{ ok: boolean; today: number; month: number }>;
  usage(): Promise<{ today: number; month: number }>;
}
interface QuotaNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): QuotaStub;
}

export const AI_CAPS = {
  plan: { daily: 80, monthly: 1500 },
  budget: { daily: 150, monthly: 3000 },
} as const;

async function counter(feature: keyof typeof AI_CAPS): Promise<QuotaStub | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ns = (getCloudflareContext().env as unknown as { HERE_QUOTA?: QuotaNamespace }).HERE_QUOTA;
    return ns ? ns.get(ns.idFromName(`ai-${feature}`)) : null;
  } catch {
    return null;
  }
}

/** Takes one call from the feature's caps; false when spent (or the counter fails on Cloudflare). */
export async function takeAi(feature: keyof typeof AI_CAPS): Promise<boolean> {
  const c = await counter(feature);
  if (!c) return process.env.NODE_ENV !== "production";
  try {
    return (await c.take(AI_CAPS[feature].daily, AI_CAPS[feature].monthly)).ok;
  } catch {
    return false;
  }
}

export async function aiUsage(feature: keyof typeof AI_CAPS) {
  const c = await counter(feature);
  if (!c) return null;
  try {
    return { ...(await c.usage()), ...AI_CAPS[feature] };
  } catch {
    return null;
  }
}
