// «استعرض صور المدينة» (owner, 27 Oct): a city's best-known landmarks and
// views, chosen by eye (scripts/photos/build-gallery.ts →
// public/data/gallery/<slug>.json), read through ASSETS like the guide.
export interface GalleryPhoto {
  /** Pexels original image URL (sized on request). */
  o: string;
  an: string;
  en: string;
  y: number;
  x: number;
}

type AssetsBinding = { fetch: (input: Request | string) => Promise<Response> };

export async function readGallery(slug: string): Promise<GalleryPhoto[]> {
  if (!/^[a-z0-9-]+$/.test(slug)) return [];
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    let assets: AssetsBinding | undefined;
    try {
      assets = (getCloudflareContext().env as unknown as { ASSETS?: AssetsBinding }).ASSETS;
    } catch {
      assets = undefined;
    }
    if (!assets) {
      const { readFile } = await import("node:fs/promises");
      const text = await readFile(`${process.cwd()}/public/data/gallery/${slug}.json`, "utf8").catch(() => null);
      return text ? (JSON.parse(text) as GalleryPhoto[]) : [];
    }
    const res = await assets.fetch(new Request(`https://assets.local/data/gallery/${slug}.json`));
    return res.ok ? ((await res.json()) as GalleryPhoto[]) : [];
  } catch {
    return [];
  }
}
