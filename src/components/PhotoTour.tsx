"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/types";
import type { GalleryPhoto } from "@/lib/gallery";
import { track } from "@/lib/analytics";

const size = (o: string, w: number) => `${o}?auto=compress&cs=tinysrgb&w=${w}`;

/**
 * «استعرض صور المدينة» (owner, 27 Oct): a button beside the trip plan that
 * opens the city's best-known landmarks and views full screen, one at a
 * time, each named, with its place on the map. Nothing is loaded until the
 * button is pressed; then only the photo on screen and the next one.
 */
export default function PhotoTour({
  locale,
  cityName,
  photos,
  className,
  t,
}: {
  locale: Locale;
  cityName: string;
  photos: GalleryPhoto[];
  className: string;
  t: { open: string; openSub: string; close: string; prev: string; next: string; onMap: string; of: string };
}) {
  const [at, setAt] = useState<number | null>(null);
  const isAr = locale === "ar";
  const n = photos.length;
  const go = useCallback((d: number) => setAt((i) => (i === null ? i : (i + d + n) % n)), [n]);
  const touch = useRef<number | null>(null);

  useEffect(() => {
    if (at === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAt(null);
      // Arrows follow the reading direction: in Arabic "←" is the next photo.
      if (e.key === "ArrowLeft") go(isAr ? 1 : -1);
      if (e.key === "ArrowRight") go(isAr ? -1 : 1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [at, go, isAr]);

  if (n < 3) return null;
  const p = at === null ? null : photos[at];
  const next = at === null ? null : photos[(at + 1) % n];

  return (
    <>
      <button
        type="button"
        className={className}
        aria-haspopup="dialog"
        onClick={() => {
          setAt(0);
          track("photo_tour", { photos: n });
        }}
      >
        <span className="text-2xl leading-none" aria-hidden="true">
          📷
        </span>
        <span>
          <span className="block font-display font-extrabold">{t.open}</span>
          <span className="mt-0.5 block text-xs text-white/65">{t.openSub.replace("{count}", String(n))}</span>
        </span>
      </button>

      {p && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.open}
          className="fixed inset-0 z-[90] flex flex-col bg-black text-white print:hidden"
          onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touch.current === null) return;
            const dx = e.changedTouches[0].clientX - touch.current;
            touch.current = null;
            if (Math.abs(dx) < 40) return;
            // Swipe towards the start of the line = next photo.
            go((dx < 0) !== isAr ? 1 : -1);
          }}
        >
          <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-[calc(0.75rem+var(--safe-area-inset-top,0px))]">
            <p className="text-sm font-bold text-white/80">
              {cityName} · {t.of.replace("{n}", String(at! + 1)).replace("{total}", String(n))}
            </p>
            <button type="button" onClick={() => setAt(null)} aria-label={t.close} className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-lg">
              ✕
            </button>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={p.o}
              src={size(p.o, 1280)}
              srcSet={`${size(p.o, 828)} 828w, ${size(p.o, 1280)} 1280w, ${size(p.o, 1920)} 1920w`}
              sizes="100vw"
              alt={isAr ? p.an : p.en}
              decoding="async"
              className="max-h-full max-w-full object-contain"
            />
            {/* The next photo, fetched in the background while this one is read. */}
            {next && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={size(next.o, 828)} alt="" aria-hidden="true" className="hidden" />
            )}
            <button type="button" onClick={() => go(-1)} aria-label={t.prev} className="absolute start-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-2xl">
              <span className="rtl:rotate-180">‹</span>
            </button>
            <button type="button" onClick={() => go(1)} aria-label={t.next} className="absolute end-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-2xl">
              <span className="rtl:rotate-180">›</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 pb-[calc(1rem+var(--safe-area-inset-bottom,0px))] pt-3">
            <p className="min-w-0 font-display text-lg font-extrabold leading-snug">{isAr ? p.an : p.en}</p>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${p.y},${p.x}`}
              target="_blank"
              rel="noopener"
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-sun-400 px-4 text-sm font-extrabold text-navy-950"
            >
              📍 {t.onMap}
            </a>
          </div>
        </div>
      )}
    </>
  );
}
