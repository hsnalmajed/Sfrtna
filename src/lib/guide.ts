// The city guide (scripts/guide/ → public/data/guide/<slug>.json), read
// through the ASSETS binding like the stored places — never bundled.
import type { GuideFile } from "@/lib/guideTypes";

type AssetsBinding = { fetch: (input: Request | string) => Promise<Response> };

export async function readGuide(slug: string): Promise<GuideFile | null> {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    let assets: AssetsBinding | undefined;
    try {
      assets = (getCloudflareContext().env as unknown as { ASSETS?: AssetsBinding }).ASSETS;
    } catch {
      assets = undefined;
    }
    if (!assets) {
      if (process.env.NODE_ENV === "production" && !process.env.SFRTNA_LOCAL_PLACES) return null;
      const { readFile } = await import("node:fs/promises");
      const text = await readFile(`${process.cwd()}/public/data/guide/${slug}.json`, "utf8").catch(() => null);
      return text ? (JSON.parse(text) as GuideFile) : null;
    }
    const res = await assets.fetch(new Request(`https://assets.local/data/guide/${slug}.json`));
    if (!res.ok) return null;
    return (await res.json()) as GuideFile;
  } catch {
    return null;
  }
}
