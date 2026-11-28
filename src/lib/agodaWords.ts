import { stem } from "@/lib/hotelIndex";

/**
 * The file an Agoda hotel-name word is kept in (public/data/agoda/words/):
 * its first three letters as code points ("68-69-6c" for "hil…"), two for a
 * two-letter word. Shared by scripts/agoda/build-words.ts and the search.
 */
export function agodaWordKey(word: string): string | null {
  const w = stem(word);
  if (w.length < 2) return null;
  return [...w.slice(0, 3)].map((c) => c.codePointAt(0)!.toString(16)).join("-");
}
