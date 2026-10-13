import type { Locale } from "./types";
import ar from "./dict/ar";
import en from "./dict/en";

/**
 * Server side: both languages (layouts, metadata, server pages).
 *
 * Client components must NOT import this file — it would put both languages
 * in the browser bundle. They call useDictionary() (src/lib/dict/context.tsx);
 * the [locale] layout wraps the page in the provider of its own language, so
 * the browser only downloads that one.
 */
export const dictionaries = { ar, en } as const;

export type Dictionary = (typeof dictionaries)[Locale];

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.ar;
}
