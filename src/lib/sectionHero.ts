import { SECTION_HEROES, heroImage, heroPortraitSrcSet, type HeroSection, type SectionHero } from "@/lib/heroPhotos";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";

/** A section page's hero: its fixed Pexels photograph and the credit line. */
export async function sectionHero(section: HeroSection, locale: Locale): Promise<SectionHero> {
  const pick = SECTION_HEROES[section];
  const image = heroImage(pick);
  const dict = getDictionary(locale);
  return {
    photo: image.url,
    photoSrcSet: image.srcSet,
    photoPortraitSrcSet: heroPortraitSrcSet(pick),
    photoCredit: {
      text: dict.hero.photoCredit
        .replace("{place}", locale === "ar" ? pick.placeAr : pick.placeEn)
        .replace("{artist}", pick.photographer),
      href: pick.pageUrl,
    },
  };
}
