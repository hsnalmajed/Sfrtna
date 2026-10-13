import { useDictionary } from "@/lib/dict/context";
import type { Locale } from "@/lib/types";

/**
 * The letterhead on everything the site prints.
 *
 * A plan saved as a PDF leaves the site and gets sent to whoever is coming on
 * the trip. Up to now it left as an anonymous sheet of black text — no mark on
 * it, nothing to say where it came from. So every printed document opens on
 * the logo, the navy rule and the orange band, and closes on the same note it
 * would in the browser.
 *
 * Invisible on screen and only drawn for print, which is why it carries no
 * layout cost on a page nobody prints.
 *
 * The logo is a plain <img> from /public: the app runs with Next's image
 * optimizer disabled on Workers, and a print stylesheet is no place for a
 * component that might lazy-load.
 */
export default function PrintHeader({
  title,
  subtitle,
}: {
  /** Kept for callers; the words come from useDictionary(). */
  locale: Locale;
  /** What this document is — printed beside the mark, larger than it. */
  title: string;
  /** The line under it: days, picks, dates. Optional. */
  subtitle?: string;
}) {
  const dict = useDictionary();

  return (
    <header className="print-header hidden print:block">
      <div className="print-header-bar">
        {/* The logo already carries the slogan, so it is not printed twice. */}
        {/* eslint-disable-next-line @next/next/no-img-element -- local asset,
            and the app runs with the Next image optimizer disabled. */}
        <img src="/sfrtna-logo.png" alt={dict.siteName} className="print-logo" />
      </div>

      <h1 className="print-title">{title}</h1>
      {subtitle && <p className="print-subtitle">{subtitle}</p>}
    </header>
  );
}
