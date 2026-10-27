"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/lib/types";
import { galleryUrl, type GalleryPhoto } from "@/lib/gallery";
import { track } from "@/lib/analytics";
import ScrollRow from "@/components/ui/ScrollRow";

export interface CityPhotosText {
  title: string;
  sub: string;
  open: string;
  views: string;
  landmarks: string;
  close: string;
  prev: string;
  next: string;
  onMap: string;
  of: string;
  more: string;
}

/**
 * «صور المدينة» (owner, 27 Oct night): its own section near the top of the
 * city page — not one of the planning choices — and a full-screen viewer
 * with a branded bar under every photo: the place's name, where it is, the
 * way to it on the map and the Sfrtna mark.
 *
 * The section draws five small photos (lazy); the viewer loads only the
 * photo on screen, the next one and the thumbnails.
 */
export default function CityPhotos({
  locale,
  cityName,
  countryName,
  photos,
  t,
}: {
  locale: Locale;
  cityName: string;
  countryName: string;
  photos: GalleryPhoto[];
  t: CityPhotosText;
}) {
  const isAr = locale === "ar";
  const views = useMemo(() => photos.filter((p) => p.k === "v"), [photos]);
  const landmarks = useMemo(() => photos.filter((p) => p.k === "l"), [photos]);
  // The section shows views first: the city as a whole, then its sights.
  const ordered = useMemo(() => [...views, ...landmarks], [views, landmarks]);
  const [open, setOpen] = useState<{ kind: "v" | "l"; i: number } | null>(null);

  const list = open ? (open.kind === "v" ? views : landmarks) : [];
  const n = list.length;
  const go = useCallback(
    (d: number) => setOpen((o) => (o ? { ...o, i: (o.i + d + (o.kind === "v" ? views : landmarks).length) % (o.kind === "v" ? views : landmarks).length } : o)),
    [views, landmarks]
  );
  const touch = useRef<number | null>(null);
  const thumbs = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
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
  }, [open, go, isAr]);

  // The thumbnail of the photo on screen stays in view.
  useEffect(() => {
    if (!open) return;
    thumbs.current?.querySelector<HTMLElement>(`[data-i="${open.i}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [open]);

  if (photos.length < 4) return null;

  const start = (p: GalleryPhoto) => {
    const kind = p.k;
    const i = (kind === "v" ? views : landmarks).indexOf(p);
    setOpen({ kind, i: Math.max(0, i) });
    track("photo_tour", { photos: photos.length });
  };

  const tiles = ordered.slice(0, 5);
  const rest = ordered.length - 4;
  const name = (p: GalleryPhoto) => (isAr ? p.an : p.en);
  const alt = (p: GalleryPhoto) => (p.k === "v" ? `${cityName}، ${countryName}` : `${name(p)} — ${cityName}`);

  const p = open ? list[open.i] : null;
  const next = open && n > 1 ? list[(open.i + 1) % n] : null;

  return (
    <section aria-labelledby="city-photos" className="mb-8 overflow-hidden rounded-3xl bg-white shadow-[var(--shadow-card)] ring-1 ring-mist-200">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pb-3 pt-4 sm:px-6">
        <div>
          <h2 id="city-photos" className="font-display text-xl font-extrabold text-navy-900">
            {t.title.replace("{city}", cityName)}
          </h2>
          <p className="mt-0.5 text-sm text-navy-500">
            {t.sub.replace("{count}", String(photos.length))}
          </p>
        </div>
        <button
          type="button"
          onClick={() => start(ordered[0])}
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-navy-900 px-4 text-sm font-extrabold text-white transition hover:bg-navy-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400"
        >
          <span aria-hidden="true">📷</span>
          {t.open}
        </button>
      </div>

      {/* One large photo and four small; on a phone one large and three. */}
      <div className="grid h-60 grid-cols-3 grid-rows-[2fr_1fr] gap-1 sm:h-80 sm:grid-cols-4 sm:grid-rows-2">
        {tiles.map((ph, j) => (
          <button
            key={ph.o}
            type="button"
            onClick={() => start(ph)}
            aria-label={alt(ph)}
            className={`group relative overflow-hidden bg-navy-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-sun-400 ${
              j === 0 ? "col-span-3 sm:col-span-2 sm:row-span-2" : j === 4 ? "hidden sm:block" : ""
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={galleryUrl(ph, j === 0 ? 1280 : 500)}
              alt={alt(ph)}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
            {j === 0 && (
              <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy-990/80 to-transparent px-4 pb-3 pt-10 text-start text-sm font-extrabold text-white">
                {name(ph)}
              </span>
            )}
            {/* "+N" on the last small photo shown: on a phone the 4th, else the 5th. */}
            {rest > 0 && (j === 3 || j === 4) && (
              <span
                dir="ltr"
                className={`absolute inset-0 items-center justify-center bg-navy-990/55 font-display text-xl font-extrabold text-white ${
                  j === 3 ? "flex sm:hidden" : "hidden sm:flex"
                }`}
              >
                {t.more.replace("{count}", String(j === 3 ? ordered.length - 4 : ordered.length - 5))}
              </span>
            )}
          </button>
        ))}
      </div>

      {open && p && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.title.replace("{city}", cityName)}
          className="fixed inset-0 z-[90] flex flex-col bg-navy-990 text-white print:hidden"
          onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touch.current === null) return;
            const dx = e.changedTouches[0].clientX - touch.current;
            touch.current = null;
            if (Math.abs(dx) < 40) return;
            go((dx < 0) !== isAr ? 1 : -1);
          }}
        >
          {/* Top: views / landmarks, where we are, close. */}
          <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-[calc(0.6rem+var(--safe-area-inset-top,0px))] sm:px-5">
            <div className="inline-flex rounded-full bg-white/10 p-1 ring-1 ring-white/15">
              {([
                ["v", views, t.views],
                ["l", landmarks, t.landmarks],
              ] as const).map(([k, l, label]) =>
                l.length ? (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setOpen({ kind: k, i: 0 })}
                    aria-pressed={open.kind === k}
                    className={`min-h-9 rounded-full px-3.5 text-sm font-bold transition ${open.kind === k ? "bg-sun-400 text-navy-950" : "text-white/80 hover:text-white"}`}
                  >
                    {label} <span className={open.kind === k ? "text-navy-900/70" : "text-white/50"}>{l.length}</span>
                  </button>
                ) : null
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold tabular-nums text-white/70">{t.of.replace("{n}", String(open.i + 1)).replace("{total}", String(n))}</span>
              <button type="button" onClick={() => setOpen(null)} aria-label={t.close} className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-lg hover:bg-white/25">
                ✕
              </button>
            </div>
          </div>

          {/* The photo. */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={p.o}
              src={galleryUrl(p, 1280)}
              srcSet={`${galleryUrl(p, 960)} 960w, ${galleryUrl(p, 1280)} 1280w, ${galleryUrl(p, 1920)} 1920w`}
              sizes="100vw"
              alt={alt(p)}
              decoding="async"
              className="max-h-full max-w-full object-contain"
            />
            {next && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={galleryUrl(next, 960)} alt="" aria-hidden="true" className="hidden" />
            )}
            {n > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label={t.prev} className="absolute start-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-navy-990/60 text-2xl ring-1 ring-white/20 hover:bg-navy-900">
                  <span className="rtl:rotate-180">‹</span>
                </button>
                <button type="button" onClick={() => go(1)} aria-label={t.next} className="absolute end-2 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-navy-990/60 text-2xl ring-1 ring-white/20 hover:bg-navy-900">
                  <span className="rtl:rotate-180">›</span>
                </button>
              </>
            )}
          </div>

          {/* The branded bar: name, where, the way there, the mark. */}
          <div className="border-t-2 border-sun-400 bg-navy-900 px-4 pb-[calc(0.75rem+var(--safe-area-inset-bottom,0px))] pt-3 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-display text-lg font-extrabold leading-snug sm:text-xl">{p.k === "v" ? cityName : name(p)}</p>
                <p className="truncate text-sm text-white/65">
                  {p.k === "v" ? countryName : `${cityName}، ${countryName}`}
                  {p.c && <span className="text-white/40"> · 📷 {p.c}</span>}
                </p>
              </div>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${p.y},${p.x}`}
                target="_blank"
                rel="noopener"
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-sun-400 px-4 text-sm font-extrabold text-navy-950 transition hover:bg-sun-300"
              >
                <span aria-hidden="true">📍</span>
                {t.onMap}
              </a>
              {/* The artwork sits on white (see ui/Logo.tsx). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sfrtna-logo-360.webp" alt="Sfrtna" width={90} height={36} className="hidden h-9 w-auto shrink-0 rounded-lg bg-white px-1.5 py-0.5 sm:block" />
            </div>

            {/* Every photo of this kind, small; the one on screen ringed. */}
            {n > 1 && (
              <div ref={thumbs} className="mt-3">
                <ScrollRow className="flex gap-1.5">
                  {list.map((ph, i) => (
                    <button
                      key={ph.o}
                      type="button"
                      data-i={i}
                      onClick={() => setOpen({ kind: open.kind, i })}
                      aria-label={alt(ph)}
                      aria-current={i === open.i}
                      className={`h-12 w-16 shrink-0 overflow-hidden rounded-md ring-2 transition ${i === open.i ? "ring-sun-400" : "opacity-60 ring-transparent hover:opacity-100"}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={galleryUrl(ph, 250)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </ScrollRow>
              </div>
            )}
            {/* On a phone the mark sits under the thumbnails. */}
            <div className="mt-2 flex justify-center sm:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/sfrtna-logo-360.webp" alt="Sfrtna" width={75} height={30} className="h-7 w-auto rounded-md bg-white px-1.5 py-0.5" />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
