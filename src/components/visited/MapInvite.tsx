import Link from "next/link";
import type { Locale } from "@/lib/types";

/**
 * «زرت إسطنبول؟ أضفها لخريطتي» — on a country or city guide page (owner 18
 * Nov: show «خريطتي» wherever it makes sense). Opens the «+» sheet on that
 * country (and city); signed out, the map page signs them in first.
 */
export default function MapInvite({
  locale,
  code,
  slug,
  place,
  t,
}: {
  locale: Locale;
  code: string;
  slug?: string;
  place: string;
  t: { inviteTitle: string; inviteBody: string; inviteCta: string };
}) {
  const href = `/${locale}/my-map?add=${code}${slug ? `&city=${slug}` : ""}`;
  return (
    <aside className="relative mt-6 flex flex-col gap-3 overflow-hidden rounded-3xl bg-[#061a33] p-5 text-white shadow-lg sm:flex-row sm:items-center sm:gap-5 sm:p-6 print:hidden">
      {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG drawing, no resizing needed */}
      <img src="/geo/preview.svg" alt="" loading="lazy" className="pointer-events-none absolute inset-y-0 end-0 h-full w-auto opacity-25 sm:opacity-35" />
      <div className="relative min-w-0 flex-1">
        <p className="font-display text-lg font-extrabold">🌍 {t.inviteTitle.replace("{place}", place)}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-white/75">{t.inviteBody}</p>
      </div>
      <Link
        href={href}
        className="relative inline-flex min-h-11 w-fit shrink-0 items-center justify-center rounded-full bg-[#f8b840] px-5 text-sm font-extrabold text-[#061a33] shadow-[0_8px_24px_-8px_rgb(248_184_64/0.7)]"
      >
        {t.inviteCta}
      </Link>
    </aside>
  );
}
