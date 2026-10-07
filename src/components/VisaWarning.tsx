import { IATA_TRAVEL_CENTRE_URL, SAUDI_MOFA_URL } from "@/lib/visaProviders";

/**
 * The part of this feature that matters most.
 *
 * Visa rules change without notice, and a traveller who trusts a stale "no
 * visa needed" finds out at the gate. So the site states no visa status at
 * all, and this notice says why and links to the two places that actually
 * decide: the IATA database airlines check against, and the Saudi foreign
 * ministry.
 *
 * It is deliberately not collapsible and not styled to be ignorable.
 *
 * It is also the *only* notice on a page. Three warnings in a row is how a
 * page teaches people to skip warnings, so the scope note ("Saudi passports
 * only") is a clause of the same block rather than a bar of its own.
 *
 * Where the page already shows the full official-links block
 * (VisaOfficialLinks), `showLinks={false}` drops the two buttons here so the
 * same links aren't offered twice in a row.
 */
export default function VisaWarning({
  dict,
  scope,
  showLinks = true,
}: {
  dict: {
    warningTitle: string;
    warningBody: string;
    checkIata: string;
    checkMofa: string;
  };
  /** Who this applies to — folded in rather than given its own bar. */
  scope?: string;
  showLinks?: boolean;
}) {
  const linkClass =
    "inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-amber-900 ring-1 ring-amber-300 transition hover:-translate-y-0.5 hover:shadow-sm";

  return (
    // On a phone the icon sits beside the title instead of on a row of its
    // own, and the body drops a size: the notice stays whole (and not
    // collapsible) but stops filling the first screen.
    <div className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-3 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-300 sm:flex sm:flex-row sm:items-center sm:gap-6 sm:p-5">
      <span
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-200/70 text-base ring-1 ring-amber-300 sm:h-10 sm:w-10 sm:rounded-xl sm:text-lg"
        aria-hidden="true"
      >
        ⚠️
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-bold text-amber-900">{dict.warningTitle}</p>
        <p className="mt-1 text-xs leading-relaxed text-amber-800 sm:text-sm">
          {dict.warningBody}
          {scope && <span className="text-amber-700"> {scope}</span>}
        </p>
      </div>

      {/* The sources sit beside the warning rather than under it. On a wide
          screen that turns a four-line block into a two-line one, and the
          links stay where the eye already is. */}
      {showLinks && (
        <div className="col-span-2 flex flex-wrap gap-2 sm:shrink-0 sm:justify-end">
          <a href={IATA_TRAVEL_CENTRE_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {dict.checkIata} ↗
          </a>
          <a href={SAUDI_MOFA_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {dict.checkMofa} ↗
          </a>
        </div>
      )}
    </div>
  );
}
