"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { Locale } from "@/lib/types";
import { getDictionary } from "@/lib/dictionaries";
import { findCountry } from "@/lib/countries";
import { VISA_CHECKED_AT, visaStatusFor } from "@/data/visaStatus";
import { checklistFor } from "@/lib/visaDocuments";
import {
  IATA_TRAVEL_CENTRE_URL,
  SAUDI_MOFA_URL,
  directVisaUrl,
  flagImageUrl,
  officialVisaUrl,
} from "@/lib/visaProviders";
import VisaBadge from "@/components/VisaBadge";
import { track } from "@/lib/analytics";

/**
 * "Can I get in?" — answered in a window over the page, like a season city's
 * summary, instead of a trip to another page.
 *
 * Read in the order a traveller needs it: the status for a Saudi passport and
 * what it means in practice; the documents to have ready, where we hold a
 * checklist for that kind of application; then the way to apply — the
 * country's own portal and Direct, each when we have one — or, for a
 * visa-free country, the one check still worth doing. The status is only ever
 * one read from the country's official source, linked with the day we
 * checked it; a country we haven't confirmed says so.
 */
export default function VisaRequirementsDialog({
  countryCode,
  locale,
  onClose,
  onBack,
  backLabel,
}: {
  countryCode: string;
  locale: Locale;
  onClose: () => void;
  /** Opened from another window (a city's summary): a back button returns to it. */
  onBack?: () => void;
  /** What that back button says ("Back to Istanbul"). */
  backLabel?: string;
}) {
  const dict = getDictionary(locale);
  const v = dict.visa;
  const r = dict.results;
  const isAr = locale === "ar";

  useEffect(() => {
    track("visa_check", { destination_country: countryCode.toUpperCase() });
  }, [countryCode]);

  // Escape, or a tap outside, steps back one window when there is one under this.
  const dismiss = onBack ?? onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      dismiss();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [dismiss]);

  const country = findCountry(countryCode);
  const name = country ? (isAr ? country.nameAr : country.nameEn) : countryCode;
  const status = visaStatusFor(countryCode);
  const officialUrl = officialVisaUrl(countryCode);
  const directUrl = directVisaUrl(countryCode, locale);
  const checklist = status?.category === "free" ? null : checklistFor(countryCode);
  const labels = { free: v.statusFree, arrival: v.statusArrival, eta: v.statusEta, required: v.statusRequired };
  const explain = status
    ? { free: r.visaExplainFree, arrival: r.visaExplainArrival, eta: r.visaExplainEta, required: r.visaExplainRequired }[
        status.category
      ]
    : r.visaExplainUnknown;
  const day = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(isAr ? "ar-u-ca-gregory-nu-latn" : "en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  const needsApplication = status?.category === "eta" || status?.category === "required" || !status;

  const dialog = (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-navy-990/70 backdrop-blur-sm sm:items-center sm:p-6"
      onClick={dismiss}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={v.statusHeading.replace("{country}", name)}
        onClick={(e) => e.stopPropagation()}
        className="tab-fade max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-mist-50 text-start shadow-2xl sm:rounded-3xl"
      >
        {/* The question, on navy. */}
        <div className="relative bg-gradient-to-br from-navy-900 to-navy-990 px-5 pb-5 pt-5 text-white sm:px-6">
          <button
            type="button"
            onClick={onClose}
            aria-label={dict.home.summaryClose}
            className="absolute end-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-lg ring-1 ring-white/25 transition hover:bg-white/20"
          >
            ✕
          </button>
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-4 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-2 text-sm font-semibold text-white/90 ring-1 ring-white/20 transition hover:bg-white/20"
            >
              <span aria-hidden="true">{isAr ? "→" : "←"}</span> {backLabel ?? dict.back}
            </button>
          )}
          <div className="flex items-center gap-3 pe-10">
            {/* eslint-disable-next-line @next/next/no-img-element -- flag CDN, image optimizer off on Workers */}
            <img src={flagImageUrl(countryCode, 80)} alt="" className="h-9 w-12 rounded-md object-cover ring-1 ring-white/30" />
            <p className="font-display text-xl font-black">{v.statusHeading.replace("{country}", name)}</p>
          </div>
          <div className="mt-4">
            {status ? (
              <VisaBadge category={status.category} label={labels[status.category]} className="!text-sm" />
            ) : null}
            <p className="mt-3 text-sm leading-relaxed text-white/85">{explain.replace("{country}", name)}</p>
            {status?.until && (
              <p className="mt-2 text-sm font-semibold text-sun-300">{v.statusUntil.replace("{date}", day(status.until))}</p>
            )}
            {status && (
              <p className="mt-3 text-xs text-white/55">
                <a href={status.source} target="_blank" rel="noopener noreferrer" className="font-bold text-sea-300 underline-offset-2 hover:underline">
                  {v.statusSource} ↗
                </a>{" "}
                · {v.statusChecked.replace("{date}", day(VISA_CHECKED_AT))}
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          {/* What to have ready. */}
          {checklist && (
            <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
              <p className="mb-3 text-sm font-extrabold text-navy-950">
                {checklist.kind === "schengen" ? v.schengenChecklistHeading : v.onlineChecklistHeading}
              </p>
              {checklist.kind === "schengen" && (
                <p className="mb-3 rounded-xl bg-sea-50 px-3 py-2.5 text-xs leading-relaxed text-navy-800 ring-1 ring-sea-100">
                  🇪🇺 {v.schengenNote}
                </p>
              )}
              <ol className="space-y-2.5">
                {checklist.items.map((doc, i) => {
                  const detail = isAr ? doc.detailAr : doc.detailEn;
                  return (
                    <li key={doc.titleEn} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-900 text-xs font-bold text-white">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-navy-950">{isAr ? doc.titleAr : doc.titleEn}</p>
                        {detail && <p className="mt-0.5 text-xs leading-relaxed text-navy-600">{detail}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-3 text-xs leading-relaxed text-navy-500">{v.documentsNote}</p>
            </section>
          )}

          {/* Last: the way to apply, or the one check left when none is needed. */}
          <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
            <p className="mb-3 text-sm font-extrabold text-navy-950">
              {needsApplication ? r.visaApplyHeading : r.visaCheckHeading}
            </p>
            {!needsApplication && <p className="mb-3 text-sm leading-relaxed text-navy-700">{r.visaNoApplyNeeded}</p>}

            {needsApplication && (officialUrl || directUrl) && (
              <div className="flex flex-col gap-2 sm:flex-row">
                {officialUrl && (
                  <a
                    href={officialUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-2.5 rounded-xl bg-navy-900 px-4 py-3.5 text-sm font-extrabold text-white transition hover:bg-navy-800"
                  >
                    <span aria-hidden="true">🏛</span>
                    {v.applyOfficial} ↗
                  </a>
                )}
                {directUrl && (
                  <a
                    href={directUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-2.5 rounded-xl bg-sun-400 px-4 py-3.5 text-sm font-extrabold text-navy-950 shadow-[var(--shadow-sun)] transition hover:bg-sun-300"
                  >
                    <span aria-hidden="true">📄</span>
                    {v.applyDirect} ↗
                  </a>
                )}
              </div>
            )}
            {needsApplication && !officialUrl && !directUrl && (
              <p className="text-sm leading-relaxed text-navy-700">{v.noApplyRoute}</p>
            )}

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <a
                href={IATA_TRAVEL_CENTRE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-xl px-4 py-2.5 text-center text-sm font-bold text-navy-800 ring-1 ring-mist-300 transition hover:bg-mist-50"
              >
                ✈️ {v.iataButton.replace("{country}", name)} ↗
              </a>
              <a
                href={SAUDI_MOFA_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 rounded-xl px-4 py-2.5 text-center text-sm font-bold text-navy-800 ring-1 ring-mist-300 transition hover:bg-mist-50"
              >
                🇸🇦 {v.checkMofa} ↗
              </a>
            </div>
            {needsApplication && (officialUrl || directUrl) && (
              <p className="mt-3 text-xs text-navy-500">{v.applyExternalNote}</p>
            )}
          </section>

          <Link href={`/${locale}/visa/${countryCode}`} className="block text-center text-xs font-bold text-sea-700 hover:underline">
            {r.visaFullPage.replace("{country}", name)}
          </Link>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
