import { pexelsSizes } from "@/lib/pexels";
import heroLocal from "@/data/heroLocal.json";
import heroPortrait from "@/data/heroPortrait.json";

// The photographs the homepage and the section pages open on.
//
// Chosen by hand from Pexels (see pexels.ts) against a short brief:
//
//   · somewhere else — deserts, seas, mountains and cities on several
//     continents, with AlUla among them, because the site's proposition is
//     "tell us your budget and we'll tell you where".
//   · no people in the frame. A hero with a stranger in it is a photograph of
//     that stranger.
//   · dark enough at the centre for white type to read over it.
//
// They are fixed rather than searched for, so they show even before the
// Pexels API key is set, and nobody's search result can put the wrong city
// behind the headline. Each names its photographer, as Pexels asks.
//
// The hero rotates by date: the page is cached, so a random pick per view
// would be frozen anyway, and one that changes overnight gives a returning
// visitor something new.

export interface HeroPhoto {
  /** Pexels' original image URL, sized by pexelsSizes(). */
  src: string;
  photographer: string;
  photographerUrl: string;
  /** The photo's page on pexels.com — where the credit links. */
  pageUrl: string;
  /** Where it is, for the credit line — from the photo's own Pexels caption. */
  placeAr: string;
  placeEn: string;
}

const P = (id: string, file: string) => `https://images.pexels.com/photos/${id}/${file}`;
const U = (slug: string) => `https://www.pexels.com/${slug}`;

export const HERO_PHOTOS: HeroPhoto[] = [
  {
    src: P("11118464", "pexels-photo-11118464.jpeg"),
    photographer: "Irfan Rahat",
    photographerUrl: U("@irfan-rahat-164426592/"),
    pageUrl: U("photo/elephant-rock-in-saudi-arabia-11118464/"),
    placeAr: "جبل الفيل، العُلا",
    placeEn: "Elephant Rock, AlUla",
  },
  {
    src: P("9149367", "pexels-photo-9149367.jpeg"),
    photographer: "Asad Photo Maldives",
    photographerUrl: U("@asadphoto/"),
    pageUrl: U("photo/sea-landscape-nature-beach-9149367/"),
    placeAr: "جزر المالديف",
    placeEn: "Maldives",
  },
  {
    src: P("30370450", "pexels-photo-30370450/free-photo-of-vibrant-hot-air-balloons-over-cappadocia-landscape.jpeg"),
    photographer: "Sena",
    photographerUrl: U("@sena-1959966536/"),
    pageUrl: U("photo/vibrant-hot-air-balloons-over-cappadocia-landscape-30370450/"),
    placeAr: "كابادوكيا، تركيا",
    placeEn: "Cappadocia, Türkiye",
  },
  {
    src: P("17804518", "pexels-photo-17804518/free-photo-of-lake-in-mountains-in-switzerland.jpeg"),
    photographer: "Christopher Politano",
    photographerUrl: U("@christopher-politano-978995/"),
    pageUrl: U("photo/lake-in-mountains-in-switzerland-17804518/"),
    placeAr: "جبال الألب، سويسرا",
    placeEn: "The Alps, Switzerland",
  },
  {
    src: P("998635", "pexels-photo-998635.jpeg"),
    photographer: "Francesco Ungaro",
    photographerUrl: U("@francesco-ungaro/"),
    pageUrl: U("photo/closeup-photo-of-desert-sands-998635/"),
    placeAr: "كثبان الصحراء، المغرب",
    placeEn: "Sahara dunes, Morocco",
  },
  {
    src: P("32634768", "pexels-photo-32634768/free-photo-of-istanbul-city-silhouette-at-sunset.jpeg"),
    photographer: "Ali Said Güneş",
    photographerUrl: U("@ali-said-gunes-2152915623/"),
    pageUrl: U("photo/istanbul-city-silhouette-at-sunset-32634768/"),
    placeAr: "إسطنبول، تركيا",
    placeEn: "Istanbul, Türkiye",
  },
  {
    src: P("11381591", "pexels-photo-11381591.jpeg"),
    photographer: "Ivan Grachev",
    photographerUrl: U("@ivan-grachev-189555042/"),
    pageUrl: U("photo/wing-of-airplane-at-sunset-11381591/"),
    placeAr: "فوق الغيوم",
    placeEn: "Above the clouds",
  },
];

export function heroPhotoForToday(date = new Date()): HeroPhoto {
  const daysSinceEpoch = Math.floor(date.getTime() / 86_400_000);
  return HERO_PHOTOS[daysSinceEpoch % HERO_PHOTOS.length];
}

/** What a section page needs to draw its hero. */
export interface SectionHero {
  photo?: string;
  photoSrcSet?: string;
  /** The same photograph cut for an upright phone screen. */
  photoPortraitSrcSet?: string;
  photoCredit?: { text: string; href: string };
}

/** The pages that open on a photograph of their own. */
export type HeroSection =
  | "attractions"
  | "maps"
  | "seasons"
  | "visa"
  | "currency"
  | "itinerary";

export const SECTION_HEROES: Record<HeroSection, HeroPhoto> = {
  attractions: {
    src: P("6173322", "pexels-photo-6173322.jpeg"),
    photographer: "Julia Volk",
    photographerUrl: U("@julia-volk/"),
    pageUrl: U("photo/flying-hot-air-balloons-in-the-sky-6173322/"),
    placeAr: "مناطيد الهواء الساخن، تركيا",
    placeEn: "Hot-air balloons, Türkiye",
  },
  maps: {
    src: P("30002090", "pexels-photo-30002090/free-photo-of-winding-roads-of-transfagara-an-highway-romania.jpeg"),
    photographer: "Maarten van den Heuvel",
    photographerUrl: U("@mvdheuvel/"),
    pageUrl: U("photo/winding-roads-of-transfagara-an-highway-romania-30002090/"),
    placeAr: "طريق ترانسفاغاراشان، رومانيا",
    placeEn: "Transfăgărășan road, Romania",
  },
  seasons: {
    src: P("37736013", "pexels-photo-37736013/free-photo-of-scenic-autumn-lake-view-in-hintersee-germany.jpeg"),
    photographer: "Leo Shao",
    photographerUrl: U("@leos/"),
    pageUrl: U("photo/scenic-autumn-lake-view-in-hintersee-germany-37736013/"),
    placeAr: "بحيرة هينترزي، ألمانيا",
    placeEn: "Hintersee, Germany",
  },
  visa: {
    src: P("3140204", "pexels-photo-3140204.jpeg"),
    photographer: "Brett Sayles",
    photographerUrl: U("@brett-sayles/"),
    pageUrl: U("photo/photo-of-airplanes-at-airport-3140204/"),
    placeAr: "في المطار",
    placeEn: "At the airport",
  },
  currency: {
    src: P("30554306", "pexels-photo-30554306/free-photo-of-vibrant-dubai-marina-skyline-at-night.jpeg"),
    photographer: "AJ Ahamad",
    photographerUrl: U("@aj-ahamad-767001191/"),
    pageUrl: U("photo/vibrant-dubai-marina-skyline-at-night-30554306/"),
    placeAr: "مرسى دبي، الإمارات",
    placeEn: "Dubai Marina, UAE",
  },
  itinerary: {
    src: P("11357903", "pexels-photo-11357903.jpeg"),
    photographer: "Ali Kazal",
    photographerUrl: U("@lureofadventure/"),
    pageUrl: U("photo/highway-between-green-mountains-11357903/"),
    placeAr: "ألبرتا، كندا",
    placeEn: "Alberta, Canada",
  },
};

/** Hero ids copied to our domain by scripts/hero-photos.mjs. */
const LOCAL = new Set<string>(heroLocal);
const PORTRAIT = new Set<string>(heroPortrait);

/** The hero's image URLs and srcset, ready for <Photo>. */
/**
 * The photograph cut by the photo host to an upright phone screen
 * (9 : 19.5), at three widths — so a phone shows it sharp and whole across
 * its full screen instead of a wide picture blown up (owner, 20 Oct).
 */
export function heroPortraitSrcSet(photo: HeroPhoto): string | undefined {
  // Our own crops (scripts/hero-photos.mjs). The photo host's own crop
  // answered at the screen's CSS width (390 px for a 1170 px screen), so it
  // is not used: no crop → the wide photo as before.
  const id = photo.src.match(/\/photos\/(\d+)\//)?.[1];
  if (!id || !PORTRAIT.has(id)) return undefined;
  return [720, 1080, 1440].map((w) => `/hero/${id}-p${w}.webp ${w}w`).join(", ");
}

export function heroImage(photo: HeroPhoto): { url: string; srcSet: string } {
  const s = pexelsSizes(photo.src);
  // Our own copy when the hero-photos workflow has made one (WebP, 828 / 1280
  // / 1920w in public/hero): it comes over the connection the page already
  // has, instead of a new one to the photo host — the hero is the page's
  // largest paint (scripts/hero-photos.mjs). 4K screens still get Pexels' 3840w.
  const id = photo.src.match(/\/photos\/(\d+)\//)?.[1];
  if (id && LOCAL.has(id)) {
    const at = (w: number) => `/hero/${id}-${w}.webp`;
    return { url: at(1920), srcSet: `${at(828)} 828w, ${at(1280)} 1280w, ${at(1920)} 1920w, ${s.url4k} 3840w` };
  }
  // Phone sizes too (13 Oct 2026): with only 1920w a phone downloaded the
  // full desktop picture, 200–360 KB, and it was the slowest thing on the
  // first screen. A 390 px phone now takes 828w or 1280w.
  const at = (w: number) => `${photo.src}?auto=compress&cs=tinysrgb&w=${w}`;
  return { url: s.url, srcSet: `${at(828)} 828w, ${at(1280)} 1280w, ${s.url} 1920w, ${s.url4k} 3840w` };
}
