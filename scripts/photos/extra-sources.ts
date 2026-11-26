// Trial of new photo sources (owner, 26 Nov 2026 — an AI report listed
// Unsplash, Wikivoyage banners and Openverse as better/wider than ours).
// Collects candidates for a few cities, draws one contact sheet per city for
// the eye check, and never touches the live galleries.
//
//   UNSPLASH_ACCESS_KEY=… npx tsx scripts/photos/extra-sources.ts collect --only jazan,abha
//     → photo-trial/extra.json
//   npx tsx scripts/photos/extra-sources.ts sheets
//     → photo-trial/x-<slug>.jpg  (tags u# Unsplash, w# Wikivoyage banner, o# Openverse)
//
// Licences: Unsplash = hotlink its own URL + «Photo by X on Unsplash» +
// ping download_location when a photo is chosen (done at publish time, not
// here). Openverse = commercial-use licences only, credit «creator · licence».
// Wikivoyage banners are Commons files (credit «author · licence»).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { COUNTRY_CITIES } from "@/lib/cities";
import { findCountry } from "@/lib/countries";
import { CITY_COORDS } from "@/data/cityCoords";

const DIR = "photo-trial";
const FILE = `${DIR}/extra.json`;
const UA = "SfrtnaBot/1.0 (https://sfrtna.com; info@sfrtna.com)";
const fold = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const arg = (n: string) => {
  const i = process.argv.indexOf(n);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const only = new Set((arg("--only") ?? "").split(",").filter(Boolean));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export type Extra = {
  /** u Unsplash, w Wikivoyage banner (Commons file), o Openverse. */
  s: "u" | "w" | "o";
  /** Image URL to show (Unsplash raw URL with its ixid, kept as given). */
  o: string;
  w: number;
  h: number;
  /** Credit: photographer (+ licence for Openverse / Commons). */
  c?: string;
  /** The photo's own page (credit link). */
  pg?: string;
  /** Unsplash only: ping when the photo is chosen. */
  dl?: string;
  /** Title / description, for the sheet. */
  t: string;
};
type Store = Record<string, Extra[]>;

const NOT_A_VIEW =
  /(interior|inside|indoor|portrait|people|woman|man |men |girl|boy|child|selfie|food|dish|coffee|car |cars|traffic|street sign|logo|map|flag|statue|sculpture|museum|exhibit|bird|cat|dog|camel|horse|animal|flower|insect|screen|phone|laptop)/;

async function getJson(
  url: string | URL,
  headers: Record<string, string> = {},
): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, ...headers },
      });
      if (res.status === 429) {
        await sleep(5000 * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        console.log(
          `  ${res.status} ${String(url).slice(0, 90)} ${(await res.text()).slice(0, 200)}`,
        );
        return null;
      }
      return await res.json();
    } catch (e) {
      console.log(`  error ${String(e).slice(0, 80)}`);
      await sleep(1500);
    }
  }
  return null;
}

async function unsplash(
  city: string,
  country: string,
  cityWord: string,
): Promise<Extra[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  const out: Extra[] = [];
  const seen = new Set<string>();
  for (const q of [`${city} ${country}`, `${city}`]) {
    const url = new URL("https://api.unsplash.com/search/photos");
    url.search = new URLSearchParams({
      query: q,
      per_page: "30",
      orientation: "landscape",
      content_filter: "high",
    }).toString();
    const body = (await getJson(url, {
      Authorization: `Client-ID ${key}`,
      "Accept-Version": "v1",
    })) as {
      results?: {
        id: string;
        width: number;
        height: number;
        description?: string | null;
        alt_description?: string | null;
        premium?: boolean;
        urls: { raw: string };
        links: { html: string; download_location: string };
        user: { name: string };
        location?: { name?: string | null };
      }[];
    } | null;
    for (const r of body?.results ?? []) {
      if (seen.has(r.id) || r.premium) continue;
      const text = fold(
        `${r.description ?? ""} ${r.alt_description ?? ""} ${r.location?.name ?? ""}`,
      );
      if (!text.includes(cityWord) || NOT_A_VIEW.test(text) || r.width < 2000)
        continue;
      seen.add(r.id);
      out.push({
        s: "u",
        o: r.urls.raw,
        w: r.width,
        h: r.height,
        c: r.user.name,
        pg: r.links.html,
        dl: r.links.download_location,
        t: (r.description || r.alt_description || "").slice(0, 80),
      });
    }
    await sleep(1500);
  }
  return out.slice(0, 20);
}

/** The banner Wikivoyage's editors chose for the destination (a Commons file). */
async function wikivoyage(
  titles: string[],
  centre: { lat: number; lon: number },
): Promise<Extra[]> {
  for (const title of titles) {
    const url = new URL("https://en.wikivoyage.org/w/api.php");
    url.search = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      redirects: "1",
      prop: "pageprops|coordinates",
      titles: title,
    }).toString();
    const body = (await getJson(url)) as {
      query?: {
        pages?: {
          title: string;
          missing?: boolean;
          pageprops?: Record<string, string>;
          coordinates?: { lat: number; lon: number }[];
        }[];
      };
    } | null;
    const page = body?.query?.pages?.[0];
    if (!page || page.missing) continue;
    // The banner lives on Wikidata (P948 «Wikivoyage banner»); the page's lead photo beside it.
    const files: string[] = [];
    const qid = page.pageprops?.wikibase_item;
    if (qid) {
      const wd = (await getJson(
        `https://www.wikidata.org/w/api.php?action=wbgetclaims&format=json&entity=${qid}&property=P948`,
      )) as {
        claims?: { P948?: { mainsnak?: { datavalue?: { value?: string } } }[] };
      } | null;
      for (const cl of wd?.claims?.P948 ?? [])
        if (cl.mainsnak?.datavalue?.value)
          files.push(cl.mainsnak.datavalue.value);
    }
    if (page.pageprops?.page_image_free)
      files.push(page.pageprops.page_image_free);
    if (!files.length) continue;
    const co = page.coordinates?.[0];
    if (
      co &&
      Math.hypot(
        co.lat - centre.lat,
        (co.lon - centre.lon) * Math.cos((centre.lat * Math.PI) / 180),
      ) > 0.6
    )
      continue;
    const out: Extra[] = [];
    for (const banner of [...new Set(files.map((f) => f.replace(/_/g, " ")))]) {
      const info = new URL("https://commons.wikimedia.org/w/api.php");
      info.search = new URLSearchParams({
        action: "query",
        format: "json",
        formatversion: "2",
        prop: "imageinfo",
        iiprop: "size|url|extmetadata",
        iiurlwidth: "1920",
        iiextmetadatafilter: "Artist|LicenseShortName",
        titles: `File:${banner}`,
      }).toString();
      const ib = (await getJson(info)) as {
        query?: {
          pages?: {
            imageinfo?: {
              width: number;
              height: number;
              url: string;
              thumburl?: string;
              descriptionurl: string;
              extmetadata?: Record<string, { value: string }>;
            }[];
          }[];
        };
      } | null;
      const ii = ib?.query?.pages?.[0]?.imageinfo?.[0];
      if (!ii) continue;
      const md = ii.extmetadata ?? {};
      const artist = (md.Artist?.value ?? "")
        .replace(/<[^>]+>/g, "")
        .trim()
        .slice(0, 60);
      out.push({
        s: "w",
        o: ii.thumburl || ii.url,
        w: ii.width,
        h: ii.height,
        c:
          [artist, md.LicenseShortName?.value].filter(Boolean).join(" · ") ||
          undefined,
        pg: ii.descriptionurl,
        t: `${page.title}: ${banner}`,
      });
    }
    if (out.length) return out;
  }
  return [];
}

async function openverse(
  city: string,
  country: string,
  cityWord: string,
): Promise<Extra[]> {
  const out: Extra[] = [];
  const seen = new Set<string>();
  for (const q of [`${city} ${country}`, `${city} city`]) {
    const url = new URL("https://api.openverse.org/v1/images/");
    url.search = new URLSearchParams({
      q,
      license_type: "commercial",
      aspect_ratio: "wide",
      size: "large",
      mature: "false",
      page_size: "20",
    }).toString();
    const body = (await getJson(url)) as {
      results?: {
        id: string;
        title?: string;
        url: string;
        creator?: string;
        license: string;
        license_version?: string;
        foreign_landing_url?: string;
        width?: number;
        height?: number;
        tags?: { name: string }[];
        source?: string;
      }[];
    } | null;
    for (const r of body?.results ?? []) {
      if (seen.has(r.id) || !r.url) continue;
      const text = fold(
        `${r.title ?? ""} ${(r.tags ?? []).map((t) => t.name).join(" ")}`,
      );
      if (!text.includes(cityWord) || NOT_A_VIEW.test(fold(r.title ?? "")))
        continue;
      if ((r.width ?? 0) && (r.width ?? 0) < 1000) continue;
      seen.add(r.id);
      out.push({
        s: "o",
        o: r.url,
        w: r.width ?? 0,
        h: r.height ?? 0,
        c: [
          r.creator,
          `CC ${r.license.toUpperCase()} ${r.license_version ?? ""}`.trim(),
        ]
          .filter(Boolean)
          .join(" · "),
        pg: r.foreign_landing_url,
        t: `${r.source ?? ""}: ${(r.title ?? "").slice(0, 70)}`,
      });
    }
    await sleep(2500);
  }
  return out.slice(0, 24);
}

async function collect() {
  mkdirSync(DIR, { recursive: true });
  const store: Store = existsSync(FILE)
    ? JSON.parse(readFileSync(FILE, "utf8"))
    : {};
  for (const [code, list] of Object.entries(COUNTRY_CITIES)) {
    for (const c of list as {
      slug: string;
      nameEn: string;
      wikiTitle?: string;
    }[]) {
      if (!only.has(c.slug)) continue;
      const centre = CITY_COORDS[c.slug];
      if (!centre) continue;
      const city = c.nameEn.replace(/\s*\(.*?\)\s*/g, " ").trim();
      const country = findCountry(code)?.nameEn ?? "";
      const cityWord = fold(
        city.split(/[\s-]/).sort((a, b) => b.length - a.length)[0],
      );
      const u = await unsplash(city, country, cityWord);
      const w = await wikivoyage(
        [
          ...new Set(
            [c.wikiTitle, city, `${city} (${country})`].filter(
              Boolean,
            ) as string[],
          ),
        ],
        centre,
      );
      const o = await openverse(city, country, cityWord);
      store[c.slug] = [...u, ...w, ...o];
      writeFileSync(FILE, JSON.stringify(store));
      console.log(
        `${c.slug}: unsplash ${u.length}, wikivoyage ${w.length}, openverse ${o.length}`,
      );
    }
  }
}

const thumb = (p: Extra, w: number) =>
  p.s === "u" ? `${p.o}&w=${w}&q=70&fm=jpg` : p.o;

async function sheets() {
  const sharp = (await import("sharp")).default;
  const store: Store = JSON.parse(readFileSync(FILE, "utf8"));
  const W = 200,
    H = 133,
    PER_ROW = 8,
    GAP = 4;
  const esc = (s: string) =>
    s.replace(
      /[&<>]/g,
      (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[ch]!,
    );
  for (const [slug, all] of Object.entries(store)) {
    if (only.size && !only.has(slug)) continue;
    if (!all.length) continue;
    const n = { u: 0, w: 0, o: 0 };
    const tagged = all.map((p) => ({ p, tag: `${p.s}${++n[p.s]}` }));
    const rows = Math.ceil(tagged.length / PER_ROW);
    const width = PER_ROW * (W + GAP) + GAP,
      height = 34 + rows * (H + 22);
    const layers: { input: Buffer; left: number; top: number }[] = [];
    let svg = `<text x="6" y="24" font-size="20" font-weight="bold" font-family="sans-serif">${esc(slug)} — unsplash ${n.u}, wikivoyage ${n.w}, openverse ${n.o}</text>`;
    for (const [j, { p, tag }] of tagged.entries()) {
      const x = GAP + (j % PER_ROW) * (W + GAP),
        y = 34 + Math.floor(j / PER_ROW) * (H + 22);
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(thumb(p, 400), {
            headers: { "User-Agent": UA },
          });
          if (!res.ok) throw new Error(String(res.status));
          layers.push({
            input: await sharp(Buffer.from(await res.arrayBuffer()))
              .resize(W, H, { fit: "cover" })
              .jpeg()
              .toBuffer(),
            left: x,
            top: y,
          });
          break;
        } catch {
          await sleep(1500 * (attempt + 1));
        }
      }
      await sleep(250);
      svg += `<rect x="${x}" y="${y}" width="${tag.length * 11 + 6}" height="22" fill="${p.s === "u" ? "#000" : p.s === "w" ? "#06c" : "#a50"}"/><text x="${x + 3}" y="${y + 17}" font-size="16" font-weight="bold" fill="#ff0" font-family="sans-serif">${tag}</text><text x="${x}" y="${y + H + 15}" font-size="11" font-family="sans-serif">${esc(p.t.slice(0, 32))}</text>`;
    }
    layers.push({
      input: Buffer.from(
        `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">${svg}</svg>`,
      ),
      left: 0,
      top: 0,
    });
    await sharp({ create: { width, height, channels: 3, background: "#fff" } })
      .composite(layers)
      .jpeg({ quality: 70 })
      .toFile(`${DIR}/x-${slug}.jpg`);
    console.log(`sheet ${slug}`);
  }
}

const mode = process.argv[2];
(mode === "collect"
  ? collect()
  : mode === "sheets"
    ? sheets()
    : Promise.reject(new Error("collect | sheets"))
).catch((e) => {
  console.error(e);
  process.exit(1);
});
