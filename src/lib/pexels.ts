/**
 * Photographs from Pexels — the site's one source of pictures.
 *
 * ── How photos reach a page (changed 7 Oct 2026) ──────────────────────
 * Pages never call Pexels. Every photo choice lives in
 * src/data/pexelsPhotos.json, written by scripts/pexels-photos.ts (run on
 * GitHub Actions, .github/workflows/photos.yml). A page looks its photos up
 * in that file: no network, no wait, no allowance spent per visitor.
 *
 * Why: searching at page-view time, cached per Cloudflare data centre, spent
 * the whole monthly Pexels allowance (20,000 calls) in a few days. With the
 * allowance gone every card fell back to its navy tile, and while it lasted
 * a cold card waited on a search. Now the search happens once per place,
 * ever, and the picture itself loads straight from Pexels' image CDN.
 *
 * Why Pexels: every photo on it is licensed for commercial use without a fee,
 * the API key is free and issued on sign-up, and the pictures are by working
 * photographers rather than whatever happened to be uploaded to an
 * free-encyclopaedia upload. The owner chose it as the site's one source.
 *
 * Their API guidelines ask for two things, and the site does both: a visible
 * link to Pexels wherever its photos appear (the footer carries one), and the
 * photographer's name where it reasonably fits (the large heroes carry one).
 *
 * Credentials:
 *   PEXELS_API_KEY — a Cloudflare secret, read on the server at run time.
 *   Without it every search returns null and the cards fall back to their
 *   navy tiles; nothing breaks and nothing is invented.
 *
 * Docs: https://www.pexels.com/api/documentation/
 */

// The stored choices live in public/data/photos.json, read through the
// Worker's asset binding — NOT imported into the Worker's code. With every
// place's three photos the file is several hundred KB, and a data file that
// size bundled into the Worker (once per route) is what took every page
// down with Cloudflare error 1102 on 14 and 15 Oct. The photos refill after
// the Pexels allowance resets (25 Oct 2026), so it is moved out now.
// (src/data/pexelsPhotos.json, the old location, is no longer read.)

const API = "https://api.pexels.com/v1/search";

export interface PexelsPhoto {
  /** 1920 wide — heroes and large cards. */
  url: string;
  /** 3840 wide, for 4K screens. */
  url4k: string;
  /** 640 wide — grid cards. */
  small: string;
  photographer: string;
  photographerUrl: string;
  /** The photo's own page on pexels.com. */
  pageUrl: string;
}

interface PexelsApiPhoto {
  id: number;
  url: string;
  alt?: string;
  photographer: string;
  photographer_url: string;
  src: { original: string };
}

function key(): string {
  return process.env.PEXELS_API_KEY || "";
}

/**
 * Builds the sized URLs from Pexels' original, using their own resizer.
 * `small` is for cards: 640 wide covers a 320-pixel card on a sharp phone
 * screen, at about half the bytes of 800.
 */
export function pexelsSizes(original: string): Pick<PexelsPhoto, "url" | "url4k" | "small"> {
  const at = (w: number) => `${original}?auto=compress&cs=tinysrgb&w=${w}`;
  return { url: at(1920), url4k: at(3840), small: at(640) };
}

/** One search, and the words its result must be captioned with. */
export interface PexelsQuery {
  query: string;
  /**
   * The photo's caption must mention one of these (case-insensitive), or the
   * result is skipped. A search for "Jeddah" on Pexels returns Dubai's skyline
   * and the pyramids among its first results; the caption is what tells them
   * apart, and a card with no photo is better than a card with the wrong city.
   */
  mention: string[];
}

function fold(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/**
 * Captions that mean the photo is not a picture of the place (owner, 27
 * Oct): people in it, aircraft, a view from above, or a close-up of
 * something else. Matched on whole words of the folded caption.
 */
export const UNFIT =
  /\b(man|men|woman|women|person|people|couple|couples|kiss|kissing|girl|girls|boy|boys|child|children|kid|kids|baby|lady|guy|bride|groom|wedding|model|posing|portrait|selfie|tourist|tourists|crowd|friends|family|smiling|smile|hijab|face|silhouette|walking|sitting|standing|holding|wearing|dancer|dancing|musician|vendor|worker|airplane|aeroplane|aircraft|plane|planes|airport|airline|jet|aerial|drone|overhead|bird's eye|birds eye|from above|top view|rooftop view|map|flag|passport|money|banknote|coin|food|dish|plate|meal|coffee|cup|drink|car|cars|taxi|bus|traffic|logo|close up|closeup|interior|inside|indoor|room|bed|hotel room)\b/;

/** One search, uncached: `{ photo }` (null photo = nothing fitting), or null if the call failed. */
/** How many photos are kept per place; the page shows one of them, changing weekly. */
export const PHOTOS_PER_PLACE = 3;

/**
 * One search, uncached: up to PHOTOS_PER_PLACE photos whose caption names
 * the place (an empty list = nothing fitting), or null if the call failed.
 * One call returns 15 results, so keeping three costs nothing extra.
 */
export async function rawSearch({ query, mention }: PexelsQuery): Promise<{ photos: PexelsPhoto[] } | null> {
  const url = new URL(API);
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "15");
  url.searchParams.set("orientation", "landscape");
  try {
    const res = await fetch(url.toString(), { headers: { Authorization: key() } });
    if (!res.ok) return null;
    const body = (await res.json()) as { photos?: PexelsApiPhoto[] };
    const words = mention.map(fold).filter(Boolean);
    const photos = (body.photos ?? [])
      .filter((ph) => ph.src?.original && words.some((w) => fold(ph.alt ?? "").includes(w)) && !UNFIT.test(fold(ph.alt ?? "")))
      .slice(0, PHOTOS_PER_PLACE)
      .map((p) => ({
        ...pexelsSizes(p.src.original),
        photographer: p.photographer,
        photographerUrl: p.photographer_url,
        pageUrl: p.url,
      }));
    return { photos };
  } catch {
    return null;
  }
}

// ── The stored choices ─────────────────────────────────────────────────

/** One stored photo. */
export interface StoredPhotoRec {
  /** Pexels' original image URL. */
  o: string;
  /** Photographer's name, and (older records) their page and the photo's page. */
  n: string;
  nu?: string;
  u?: string;
}

/**
 * A place's stored photos (up to PHOTOS_PER_PLACE). An empty list means
 * every search was tried and none fit; `null` is the older single-photo
 * form of the same thing.
 */
export type StoredPhoto = StoredPhotoRec[] | StoredPhotoRec | null;

type AssetsBinding = { fetch: (input: Request | string) => Promise<Response> };
let storedPromise: Promise<Record<string, StoredPhoto>> | null = null;

/** The stored file, read once per Worker instance (or from disk in scripts and dev). */
export function storedPhotos(): Promise<Record<string, StoredPhoto>> {
  if (storedPromise) return storedPromise;
  storedPromise = (async () => {
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      let assets: AssetsBinding | undefined;
      try {
        assets = (getCloudflareContext().env as unknown as { ASSETS?: AssetsBinding }).ASSETS;
      } catch {
        assets = undefined;
      }
      if (assets) {
        const res = await assets.fetch(new Request("https://assets.local/data/photos.json"));
        return res.ok ? ((await res.json()) as Record<string, StoredPhoto>) : {};
      }
    } catch {
      // Not on Cloudflare: read the file from disk below.
    }
    try {
      const { readFile } = await import("node:fs/promises");
      return JSON.parse(await readFile(`${process.cwd()}/public/data/photos.json`, "utf8")) as Record<string, StoredPhoto>;
    } catch {
      return {};
    }
  })();
  // A failed read is not kept: the next request tries again.
  storedPromise.then((v) => {
    if (!Object.keys(v).length) storedPromise = null;
  });
  return storedPromise;
}

/**
 * The stable name of one subject's searches, as stored in the JSON file.
 * The same list of searches always names the same subject, wherever on the
 * site it is asked for.
 */
export function subjectKey(queries: PexelsQuery[]): string {
  return queries.map((q) => `${q.query}|${q.mention.join(",")}`).join(" ;; ");
}

function toPhoto(rec: StoredPhotoRec): PexelsPhoto {
  return { ...pexelsSizes(rec.o), photographer: rec.n, photographerUrl: rec.nu ?? "", pageUrl: rec.u ?? "" };
}

/** A short stable number for a key, so places do not all change on the same photo slot. */
function spread(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * This week's photo of a place: with three stored, a returning visitor sees
 * a different one each week (weeks counted from 1970, so every server agrees
 * which week it is).
 */
function fromStored(key: string, rec: StoredPhoto | undefined): PexelsPhoto | null {
  if (!rec) return null;
  const list = Array.isArray(rec) ? rec : [rec];
  if (list.length === 0) return null;
  const week = Math.floor(Date.now() / (7 * 86_400_000));
  return toPhoto(list[(week + spread(key)) % list.length]);
}

/**
 * While set, every lookup also records the subject — this is how
 * scripts/pexels-photos.ts learns the full list of places the site asks
 * pictures for, from the same code the pages run.
 */
let collector: Map<string, PexelsQuery[]> | null = null;

export function startCollectingSubjects(): Map<string, PexelsQuery[]> {
  collector = new Map();
  return collector;
}

export function stopCollectingSubjects(): void {
  collector = null;
}

function lookup(queries: PexelsQuery[], stored: Record<string, StoredPhoto>): PexelsPhoto | null {
  const k = subjectKey(queries);
  if (collector && queries.length > 0) collector.set(k, queries);
  return fromStored(k, stored[k]);
}

/**
 * The stored photo for each subject, keyed however the caller likes. Each
 * subject is its list of searches in order — a landmark first, then the
 * city, then the country (the script tries them in that order). A subject
 * with no stored photo is simply missing from the result: its card keeps
 * its navy tile until the next run of the script fills it in.
 */
export async function searchPexelsPhotos(
  wanted: Map<string, PexelsQuery[]>,
  /**
   * The searches a subject used before (27 Oct): shown only until the new
   * searches have been run for it, so no card goes blank in between. Never
   * collected, so the photo job never searches them again.
   */
  legacy?: Map<string, PexelsQuery[]>
): Promise<Map<string, PexelsPhoto>> {
  const out = new Map<string, PexelsPhoto>();
  const stored = collector ? {} : await storedPhotos();
  for (const [k, queries] of wanted) {
    const p = lookup(queries, stored);
    if (p) out.set(k, p);
    else if (!collector && legacy?.has(k) && !(subjectKey(queries) in stored)) {
      const old = legacy.get(k)!;
      const lp = fromStored(subjectKey(old), stored[subjectKey(old)]);
      if (lp) out.set(k, lp);
    }
  }
  return out;
}
