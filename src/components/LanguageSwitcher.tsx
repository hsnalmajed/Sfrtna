"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@/lib/types";
import { track } from "@/lib/analytics";

export default function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(next: Locale) {
    if (!pathname) return;
    if (next !== locale) track("language_switch", { from: locale, to: next });
    const segments = pathname.split("/");
    segments[1] = next;
    router.push(segments.join("/") || `/${next}`);
  }

  return (
    <div className="flex items-center gap-1 rounded-full bg-gray-100 p-1 text-sm">
      <button
        onClick={() => switchTo("ar")}
        className={`px-3 py-1 rounded-full transition ${
          locale === "ar" ? "bg-white text-brand-900 font-semibold shadow-sm ring-1 ring-black/5" : "text-gray-500 hover:text-gray-800"
        }`}
      >
        عربي
      </button>
      <button
        onClick={() => switchTo("en")}
        className={`px-3 py-1 rounded-full transition ${
          locale === "en" ? "bg-white text-brand-900 font-semibold shadow-sm ring-1 ring-black/5" : "text-gray-500 hover:text-gray-800"
        }`}
      >
        EN
      </button>
    </div>
  );
}
