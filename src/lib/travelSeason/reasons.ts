// The reason of each city-month (every factor with its figures), read from
// public/data/season-reasons.json through ASSETS — kept out of the Worker
// bundle (each sentence is unique; inside the site file they doubled it).
// Written by scripts/climate/generate_seasons.mts.

type AssetsBinding = { fetch: (input: Request | string) => Promise<Response> };
type Reasons = Record<string, { ar: (string | null)[]; en: (string | null)[] }>;
let loading: Promise<Reasons> | null = null;

/** The whole file, read once per Worker instance (from disk in dev and scripts). */
export function seasonReasons(): Promise<Reasons> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      let assets: AssetsBinding | undefined;
      try {
        assets = (getCloudflareContext().env as unknown as { ASSETS?: AssetsBinding }).ASSETS;
      } catch {
        assets = undefined;
      }
      if (assets) {
        const res = await assets.fetch(new Request("https://assets.local/data/season-reasons.json"));
        return res.ok ? ((await res.json()) as Reasons) : {};
      }
    } catch {
      // Not on Cloudflare: read the file from disk below.
    }
    try {
      const { readFile } = await import("node:fs/promises");
      return JSON.parse(await readFile(`${process.cwd()}/public/data/season-reasons.json`, "utf8")) as Reasons;
    } catch {
      return {};
    }
  })();
  loading.then((v) => {
    if (!Object.keys(v).length) loading = null;
  });
  return loading;
}

/** One city's twelve reasons in one language (null where none). */
export async function cityReasons(slug: string, locale: "ar" | "en"): Promise<(string | null)[]> {
  const all = await seasonReasons();
  return all[slug]?.[locale] ?? Array(12).fill(null);
}
