/** The visitor's last language ("ar" | "en"), for the root page to open in. */
export const LANG_COOKIE = "sfrtna_lang";

/** Remember a language for a year (the root page and the app's opening read it). */
export function saveLanguage(lang: "ar" | "en"): void {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax; secure`;
}
