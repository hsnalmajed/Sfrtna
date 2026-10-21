// The stored city costs (public/data/costs.json), read through ASSETS.
import type { CityCosts } from "@/lib/costsTypes";

type AssetsBinding = { fetch: (input: Request | string) => Promise<Response> };

export async function readCityCosts(slug: string): Promise<CityCosts | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    let assets: AssetsBinding | undefined;
    try {
      assets = (getCloudflareContext().env as unknown as { ASSETS?: AssetsBinding }).ASSETS;
    } catch {
      assets = undefined;
    }
    let all: Record<string, CityCosts> | null = null;
    if (!assets) {
      if (process.env.NODE_ENV === "production" && !process.env.SFRTNA_LOCAL_PLACES) return null;
      const { readFile } = await import("node:fs/promises");
      const text = await readFile(`${process.cwd()}/public/data/costs.json`, "utf8").catch(() => null);
      all = text ? JSON.parse(text) : null;
    } else {
      const res = await assets.fetch(new Request("https://assets.local/data/costs.json"));
      all = res.ok ? ((await res.json()) as Record<string, CityCosts>) : null;
    }
    return all?.[slug] ?? null;
  } catch {
    return null;
  }
}
