"use client";

import { createContext, useContext } from "react";
import type { ClientDictionary } from "./clientSections";

/**
 * The page's words for client components.
 *
 * The [locale] layout (a server component) picks the page's language and
 * hands that one dictionary to DictionaryProvider — only the sections client
 * code reads (clientSections.ts) — so the browser receives one language only. Client components call useDictionary() and must never
 * import @/lib/dictionaries itself (that file holds both languages; a client
 * import would ship both) — scripts/check-client-words.mjs fails the build if
 * one does.
 */
const DictionaryContext = createContext<ClientDictionary | null>(null);

export function DictionaryProvider({ dict, children }: { dict: ClientDictionary; children: React.ReactNode }) {
  return <DictionaryContext.Provider value={dict}>{children}</DictionaryContext.Provider>;
}

export function useDictionary(): ClientDictionary {
  const dict = useContext(DictionaryContext);
  if (!dict) throw new Error("useDictionary() outside the [locale] layout's DictionaryProvider");
  return dict;
}
