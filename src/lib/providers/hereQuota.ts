/**
 * The daily cap on HERE searches (free tier: 5,000 a month).
 *
 * Every HERE call — a hotel name the edge cache does not have yet, or the
 * status check — first takes one from the counter (the HereQuota Durable
 * Object in here-quota.js, one count for the whole site). Past the day's or
 * the month's cap the call is not made and the caller falls through to
 * OpenStreetMap: a shorter list, never an error.
 *
 * 160 a day × 31 = 4,960; the month stops at 4,800 so the owner's own tests
 * and the status check never push it past the free 5,000.
 */

export const HERE_DAILY_CAP = 160;
export const HERE_MONTHLY_CAP = 4800;

interface Counts {
  today: number;
  month: number;
}

interface QuotaStub {
  take(dailyCap: number, monthlyCap: number): Promise<Counts & { ok: boolean }>;
  usage(): Promise<Counts>;
}

interface QuotaNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): QuotaStub;
}

async function counter(): Promise<QuotaStub | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ns = (getCloudflareContext().env as unknown as { HERE_QUOTA?: QuotaNamespace }).HERE_QUOTA;
    return ns ? ns.get(ns.idFromName("here")) : null;
  } catch {
    return null;
  }
}

/**
 * May one HERE call be made now? Counts it if so. Without the counter
 * (`next dev`) the answer is yes; if the counter fails on Cloudflare, no —
 * a missed suggestion is cheaper than a bill.
 */
export async function takeHere(): Promise<boolean> {
  const c = await counter();
  if (!c) return process.env.NODE_ENV !== "production";
  try {
    return (await c.take(HERE_DAILY_CAP, HERE_MONTHLY_CAP)).ok;
  } catch {
    return false;
  }
}

/** Today's and this month's HERE calls, for /api/health. */
export async function hereUsage(): Promise<(Counts & { dailyCap: number; monthlyCap: number }) | null> {
  const c = await counter();
  if (!c) return null;
  try {
    const u = await c.usage();
    return { today: u.today, month: u.month, dailyCap: HERE_DAILY_CAP, monthlyCap: HERE_MONTHLY_CAP };
  } catch {
    return null;
  }
}
