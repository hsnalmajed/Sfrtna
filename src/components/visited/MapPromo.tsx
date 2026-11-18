import Link from "next/link";
import type { Locale } from "@/lib/types";

/** Home page: «خريطتي» shown as the feature it is (owner 18 Nov). */
export default function MapPromo({ locale, t }: { locale: Locale; t: { homeTitle: string; homeBody: string; homeCta: string; gatePoints: readonly string[] } }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <Link
        href={`/${locale}/my-map`}
        className="group grid overflow-hidden rounded-[2rem] bg-[#061a33] text-white shadow-xl ring-1 ring-white/10 transition hover:shadow-2xl md:grid-cols-[1fr_1.15fr]"
      >
        <div className="p-6 sm:p-8">
          <p className="inline-block rounded-full bg-[#f8b840]/15 px-3 py-1 text-xs font-extrabold text-[#f8b840]">🌍 {locale === "ar" ? "جديد" : "New"}</p>
          <h2 className="mt-3 font-display text-2xl font-extrabold leading-snug sm:text-3xl">{t.homeTitle}</h2>
          <p className="mt-2 leading-8 text-white/75">{t.homeBody}</p>
          <ul className="mt-4 space-y-1.5">
            {t.gatePoints.slice(0, 3).map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm font-bold text-white/85">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#f8b840] text-[0.7rem] text-[#061a33]" aria-hidden="true">
                  ✓
                </span>
                {p}
              </li>
            ))}
          </ul>
          <span className="mt-6 inline-flex min-h-12 items-center rounded-full bg-[#f8b840] px-6 text-base font-extrabold text-[#061a33] shadow-[0_8px_24px_-8px_rgb(248_184_64/0.7)] transition group-hover:translate-x-0.5">
            {t.homeCta}
          </span>
        </div>
        <div className="relative min-h-52 bg-[#0a2547]">
          {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG drawing */}
          <img src="/geo/preview.svg" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        </div>
      </Link>
    </section>
  );
}
