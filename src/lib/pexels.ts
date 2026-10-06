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

import STORED from "@/data/pexelsPhotos.json";

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

/** One search, uncached: `{ photo }` (null photo = nothing fitting), or null if the call failed. */
export async function rawSearch({ query, mention }: PexelsQuery): Promise<{ photo: PexelsPhoto | null } | null> {
  const url = new URL(API);
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", "15");
  url.searchParams.set("orientation", "landscape");
  try {
    const res = await fetch(url.toString(), { headers: { Authorization: key() } });
    if (!res.ok) return null;
    const body = (await res.json()) as { photos?: PexelsApiPhoto[] };
    const words = mention.map(fold).filter(Boolean);
    const p = (body.photos ?? []).find(
      (ph) => ph.src?.original && words.some((w) => fold(ph.alt ?? "").includes(w))
    );
    if (!p) return { photo: null };
    return {
      photo: {
        ...pexelsSizes(p.src.original),
        photographer: p.photographer,
        photographerUrl: p.photographer_url,
        pageUrl: p.url,
      },
    };
  } catch {
    return null;
  }
}

// ── The stored choices ─────────────────────────────────────────────────

/** One stored choice: the photo, or null when every search was tried and none fit. */
export type StoredPhoto = {
  /** Pexels' original image URL. */
  o: string;
  /** Photographer's name and page, and the photo's own page. */
  n: string;
  nu: string;
  u: string;
} | null;

const STORED_PHOTOS = STORED as Record<string, StoredPhoto>;

/**
 * The stable name of one subject's searches, as stored in the JSON file.
 * The same list of searches always names the same subject, wherever on the
 * site it is asked for.
 */
export function subjectKey(queries: PexelsQuery[]): string {
  return queries.map((q) => `${q.query}|${q.mention.join(",")}`).join(" ;; ");
}

function fromStored(rec: StoredPhoto | undefined): PexelsPhoto | null {
  if (!rec) return null;
  return { ...pexelsSizes(rec.o), photographer: rec.n, photographerUrl: rec.nu, pageUrl: rec.u };
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

function lookup(queries: PexelsQuery[]): PexelsPhoto | null {
  const k = subjectKey(queries);
  if (collector && queries.length > 0) collector.set(k, queries);
  return fromStored(STORED_PHOTOS[k]);
}

/** The stored photo for one search, or null. */
export async function searchPexelsPhoto(q: PexelsQuery): Promise<PexelsPhoto | null> {
  if (!q.query.trim()) return null;
  return lookup([q]);
}

/**
 * The stored photo for each subject, keyed however the caller likes. Each
 * subject is its list of searches in order — a landmark first, then the
 * city, then the country (the script tries them in that order). A subject
 * with no stored photo is simply missing from the result: its card keeps
 * its navy tile until the next run of the script fills it in.
 */
export async function searchPexelsPhotos(
  wanted: Map<string, PexelsQuery[]>
): Promise<Map<string, PexelsPhoto>> {
  const out = new Map<string, PexelsPhoto>();
  for (const [k, queries] of wanted) {
    const p = lookup(queries);
    if (p) out.set(k, p);
  }
  return out;
}
