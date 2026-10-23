import { accounts } from "@/lib/accounts";

/**
 * Daily count of calls to services with a free allowance (owner, 23 Oct:
 * "measure how much of each free plan the visitors use before choosing
 * paid plans"). Kept in the same anonymous stats table under kind "ext";
 * the weekly report divides them by visits.
 */
export type UsageKey = "serpapi" | "here" | "resend" | "viator";

export function countUse(key: UsageKey): void {
  const job = (async () => {
    const store = await accounts();
    if (store) await store.statsAdd([["ext", key]]);
  })().catch(() => undefined);
  // Never make the visitor wait for the count.
  void import("@opennextjs/cloudflare")
    .then(({ getCloudflareContext }) => getCloudflareContext().ctx.waitUntil(job))
    .catch(() => undefined);
}
