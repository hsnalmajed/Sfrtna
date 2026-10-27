// «صور المدينة» (owner, 27 Oct): a city's views and best-known landmarks,
// chosen by eye (scripts/photos/gallery2.ts → public/data/gallery/<slug>.json),
// read through ASSETS like the guide.
export interface GalleryPhoto {
  /** Pexels: the original image URL. Commons: the "a/ab/File.jpg" path. */
  o: string;
  an: string;
  en: string;
  y: number;
  x: number;
  /** v = a view of the city, l = a landmark. */
  k: "v" | "l";
  /** p = Pexels, c = Wikimedia Commons. */
  s: "p" | "c";
  /** The file's own width (Commons thumbnails are never asked wider). */
  w?: number;
  /** Commons credit: "author · licence". */
  c?: string;
}

type Stored = Omit<GalleryPhoto, "k" | "s"> & Partial<Pick<GalleryPhoto, "k" | "s">>;

/**
 * Wikimedia serves thumbnails only at its standard widths; any other width
 * is refused (checked 27 Oct 2026: 330, 500, 960, 1280, 1920 load; 400, 480,
 * 640 fail).
 */
const COMMONS_STEPS = [120, 250, 330, 500, 960, 1280, 1920];

/** A Commons file ("a/ab/File.jpg") at the standard width nearest above `width`. */
export function commonsUrl(im: string, width: number, fileWidth?: number): string {
  const file = im.split("/").slice(2).join("/");
  const step = COMMONS_STEPS.find((s) => s >= width) ?? COMMONS_STEPS[COMMONS_STEPS.length - 1];
  if (fileWidth && step >= fileWidth) return `https://upload.wikimedia.org/wikipedia/commons/${im}`;
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${im}/${step}px-${file}${/\.tiff?$/i.test(file) ? ".jpg" : ""}`;
}

/** The photo at about `width` px wide. */
export function galleryUrl(p: Pick<GalleryPhoto, "o" | "s" | "w">, width: number): string {
  if (p.s !== "c") return `${p.o}?auto=compress&cs=tinysrgb&w=${width}`;
  return commonsUrl(p.o, width, p.w);
}

type AssetsBinding = { fetch: (input: Request | string) => Promise<Response> };

export async function readGallery(slug: string, cityEn?: string): Promise<GalleryPhoto[]> {
  if (!/^[a-z0-9-]+$/.test(slug)) return [];
  let raw: Stored[] = [];
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
      raw = text ? (JSON.parse(text) as Stored[]) : [];
    } else {
      const res = await assets.fetch(new Request(`https://assets.local/data/gallery/${slug}.json`));
      raw = res.ok ? ((await res.json()) as Stored[]) : [];
    }
  } catch {
    return [];
  }
  // Files written before v2 have no kind: the city's own views carry its name.
  return raw.map((p) => ({ ...p, s: p.s ?? "p", k: p.k ?? (cityEn && p.en === cityEn ? "v" : "l") }));
}
