"use client";

import Link from "next/link";
import { useState } from "react";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { countLabel } from "@/lib/format";
import { findCountry } from "@/lib/countries";
import { visaStatusFor } from "@/data/visaStatus";
import VisaBadge from "@/components/VisaBadge";
import VisaRequirementsDialog from "@/components/VisaRequirementsDialog";
import TripServices from "@/components/TripServices";
import RecentSearches from "@/components/RecentSearches";
import { useMember } from "@/lib/useMember";
import { useAccount } from "@/lib/useAccount";
import { openJoin } from "@/components/member/events";
import { useCountdown } from "@/components/member/MemberSections";
import { daysUntil, stepHref, tripCityName, tripSearchHref, tripSteps } from "@/components/member/tripLinks";
import { clearMyTrip, myTripProgress, setMyTrip, toggleMyTripStep, updateMyTrip, useMyTrip } from "@/lib/myTrip";
import type { Trip, TripStep } from "@/lib/memberItems";
import { track } from "@/lib/analytics";

/**
 * «رحلتي»: the trip being got ready, one page, in the order a traveller does
 * it — flight, hotel, visa, trip services, plan. Visa and services open in
 * place (no moving between pages); hotel and plan open their own pages with
 * the trip's city, dates and party filled in.
 */
export default function MyTripView({ locale }: { locale: Locale }) {
  const dict = useDictionary();
  const t = dict.myTrip;
  const trip = useMyTrip();
  const member = useMember();
  const account = useAccount();
  const countdown = useCountdown();
  const isAr = locale === "ar";
  const [visaOpen, setVisaOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

  const others = member.trips
    .map((i) => i.data)
    .filter((d) => daysUntil(d.back || d.depart) >= 0 && !(trip && d.origin === trip.origin && d.destination === trip.destination && d.depart === trip.depart && (d.back || "") === (trip.back || "")))
    .sort((a, b) => a.depart.localeCompare(b.depart));

  const useTrip = (d: Trip) => {
    setMyTrip({ ...d, flightUrl: tripSearchHref(locale, d, member.profile?.currency) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!trip) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-navy-900/5">
          <span className="text-5xl" aria-hidden="true">
            🧳
          </span>
          <h2 className="mt-3 font-display text-xl font-black text-navy-900">{t.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-navy-900/70">{t.emptyBody}</p>
          <ul className="mx-auto mt-4 max-w-xs space-y-2 text-start">
            {t.emptyPoints.map((p) => (
              <li key={p} className="rounded-xl bg-mist-50 px-3.5 py-2.5 text-sm font-semibold text-navy-900 ring-1 ring-navy-900/5">
                {p}
              </li>
            ))}
          </ul>
          <Link href={`/${locale}#plan`} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-sun-400 px-6 text-sm font-extrabold text-navy-950">
            {t.emptyCta}
          </Link>
        </section>
        {others.length > 0 && <OtherTrips locale={locale} trips={others} onUse={useTrip} />}
        <div className="rounded-3xl bg-navy-990 px-4 py-5">
          <RecentSearches locale={locale} />
        </div>
      </div>
    );
  }

  const city = tripCityName(trip, isAr);
  const country = trip.code ? findCountry(trip.code) : undefined;
  const countryName = country ? (isAr ? country.nameAr : country.nameEn) : city;
  // The order a traveller gets ready: where to stay, can I enter, then the rest.
  const ORDER: TripStep[] = ["hotel", "visa", "services", "plan"];
  const steps = tripSteps(trip).sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const progress = myTripProgress(trip);
  const party = trip.adults + trip.childrenAges.length + trip.infants;
  const day = (iso: string) =>
    new Intl.DateTimeFormat(isAr ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { weekday: "short", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const visa = trip.code ? visaStatusFor(trip.code) : undefined;
  const visaLabels = { free: dict.visa.statusFree, arrival: dict.visa.statusArrival, eta: dict.visa.statusEta, required: dict.visa.statusRequired };
  const flightHref = trip.flightUrl || tripSearchHref(locale, trip, member.profile?.currency);
  const opened = (step: TripStep) => {
    toggleMyTripStep(step, true);
    track("my_trip_step", { step });
  };
  const pct = Math.round((progress.done / progress.total) * 100);

  return (
    <div className="space-y-4">
      {/* The trip itself: where, when, who — and how ready it is. */}
      <section className="rounded-3xl bg-navy-990 p-5 text-white shadow-lg">
        <p className="text-xs font-bold text-sun-300">{countdown(trip.depart)}</p>
        <h2 className="mt-1 font-display text-2xl font-black">{city}</h2>
        <p className="mt-1 text-sm text-white/75">
          {day(trip.depart)}
          {trip.back ? ` – ${day(trip.back)}` : ` · ${t.oneWay}`}
        </p>
        <p className="text-sm text-white/75">
          {countLabel(party, { one: t.travellersOne, two: t.travellersTwo, few: t.travellersFew, many: t.travellersMany })}
        </p>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-bold">
            <span>{progress.next ? t.progress.replace("{done}", String(progress.done)).replace("{total}", String(progress.total)) : t.allReady}</span>
            <span className="text-white/60">{pct}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-sun-400 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/${locale}#plan`} className="inline-flex min-h-10 items-center rounded-full px-4 text-xs font-bold text-white ring-1 ring-white/25">
            {t.change}
          </Link>
          <button type="button" onClick={() => clearMyTrip()} className="inline-flex min-h-10 items-center rounded-full px-4 text-xs font-bold text-white/70 ring-1 ring-white/15">
            {t.clear}
          </button>
        </div>
      </section>

      {/* 1. Flight */}
      <Step
        n={1}
        icon="✈️"
        title={t.flightTitle}
        body={trip.picked && !trip.booked ? t.flightPicked : t.flightBody}
        done={trip.booked}
        doneLabel={t.booked}
        markLabel={t.markBooked}
        onToggle={() => {
          updateMyTrip((x) => ({ ...x, booked: !x.booked }));
          track("my_trip_step", { step: "flight_booked" });
        }}
        action={
          <Link href={flightHref} className={btn} onClick={() => track("my_trip_step", { step: "flight" })}>
            {t.flightCta}
          </Link>
        }
      />

      {steps.map((step, i) => {
        const n = i + 2;
        const done = trip.done.includes(step);
        const common = { n, done, doneLabel: t.done, markLabel: t.markDone, onToggle: () => toggleMyTripStep(step) };
        if (step === "hotel") {
          const href = stepHref(locale, trip, "hotel");
          return (
            <Step
              key={step}
              {...common}
              icon="🏨"
              title={t.hotelTitle}
              body={t.hotelBody.replace("{city}", city)}
              action={
                href && (
                  <Link href={href} className={btn} onClick={() => opened("hotel")}>
                    {t.hotelCta}
                  </Link>
                )
              }
            />
          );
        }
        if (step === "visa") {
          return (
            <Step
              key={step}
              {...common}
              icon="🛂"
              title={t.visaTitle}
              body={t.visaBody.replace("{country}", countryName)}
              badge={visa && <VisaBadge category={visa.category} label={visaLabels[visa.category]} className="mt-2" />}
              action={
                <button
                  type="button"
                  className={btn}
                  aria-haspopup="dialog"
                  onClick={() => {
                    setVisaOpen(true);
                    opened("visa");
                  }}
                >
                  {t.visaCta}
                </button>
              }
            />
          );
        }
        if (step === "services") {
          return (
            <Step
              key={step}
              {...common}
              icon="📱"
              title={t.servicesTitle}
              body={t.servicesBody}
              action={
                trip.code && trip.slug ? (
                  <button
                    type="button"
                    className={btn}
                    aria-expanded={servicesOpen}
                    onClick={() => {
                      setServicesOpen((v) => !v);
                      if (!servicesOpen) opened("services");
                    }}
                  >
                    {servicesOpen ? t.servicesHide : t.servicesCta}
                  </button>
                ) : (
                  <Link href={stepHref(locale, trip, "services") || `/${locale}/services`} className={btn} onClick={() => opened("services")}>
                    {t.servicesCta}
                  </Link>
                )
              }
              extra={
                servicesOpen &&
                trip.code &&
                trip.slug && (
                  <div className="mt-3">
                    <TripServices
                      locale={locale}
                      countryCode={trip.code}
                      citySlug={trip.slug}
                      cityName={city}
                      cityNameEn={trip.cityEn || city}
                      withCompensation
                      bare
                      t={dict.attractions}
                    />
                  </div>
                )
              }
            />
          );
        }
        const href = stepHref(locale, trip, "plan");
        return (
          <Step
            key={step}
            {...common}
            icon="🗺️"
            title={t.planTitle}
            body={t.planBody}
            action={
              href && (
                <Link href={href} className={btn} onClick={() => opened("plan")}>
                  {t.planCta}
                </Link>
              )
            }
          />
        );
      })}

      {!account.user && account.status === "ready" && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-sun-50 px-4 py-3 ring-1 ring-sun-300">
          <span className="text-xl" aria-hidden="true">
            🔐
          </span>
          <p className="min-w-0 flex-1 text-sm font-semibold text-navy-900">{t.saveHint}</p>
          <button type="button" onClick={() => openJoin("trip")} className="min-h-10 rounded-full bg-navy-900 px-4 text-xs font-extrabold text-white">
            {t.saveCta}
          </button>
        </div>
      )}

      {others.length > 0 && <OtherTrips locale={locale} trips={others} onUse={useTrip} />}

      {visaOpen && trip.code && <VisaRequirementsDialog countryCode={trip.code} locale={locale} onClose={() => setVisaOpen(false)} />}
    </div>
  );
}

const btn =
  "inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full bg-sun-400 px-4 text-sm font-extrabold text-navy-950 transition hover:bg-sun-300";

function Step({
  n,
  icon,
  title,
  body,
  done,
  doneLabel,
  markLabel,
  onToggle,
  action,
  badge,
  extra,
}: {
  n: number;
  icon: string;
  title: string;
  body: string;
  done: boolean;
  doneLabel: string;
  markLabel: string;
  onToggle: () => void;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <section className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${done ? "ring-emerald-300" : "ring-navy-900/5"}`}>
      <div className="flex items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg ${done ? "bg-emerald-100" : "bg-mist-50"}`}
          aria-hidden="true"
        >
          {done ? "✓" : icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-extrabold text-navy-900">
            <span className="text-navy-900/40">{n}.</span> {title}
          </h3>
          <p className="mt-0.5 text-sm leading-snug text-navy-900/70">{body}</p>
          {badge}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 ps-[52px]">
        {action}
        <button
          type="button"
          onClick={onToggle}
          aria-pressed={done}
          className={`inline-flex min-h-10 items-center rounded-full px-4 text-sm font-bold ring-1 ${
            done ? "bg-emerald-50 text-emerald-800 ring-emerald-300" : "text-navy-900/70 ring-navy-900/15"
          }`}
        >
          {done ? doneLabel : markLabel}
        </button>
      </div>
      {extra}
    </section>
  );
}

function OtherTrips({ locale, trips, onUse }: { locale: Locale; trips: Trip[]; onUse: (t: Trip) => void }) {
  const t = useDictionary().myTrip;
  const countdown = useCountdown();
  const isAr = locale === "ar";
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-navy-900/5">
      <h2 className="text-sm font-extrabold text-navy-900">{t.savedTrips}</h2>
      <ul className="mt-2 divide-y divide-navy-900/5">
        {trips.map((d) => (
          <li key={`${d.origin}-${d.destination}-${d.depart}-${d.back || ""}`} className="flex items-center gap-3 py-2.5">
            <span className="min-w-0 flex-1 text-sm font-bold text-navy-900">
              {tripCityName(d, isAr)} <span className="font-semibold text-navy-900/55">· {countdown(d.depart)}</span>
            </span>
            <button type="button" onClick={() => onUse(d)} className="min-h-10 shrink-0 rounded-full px-3 text-xs font-bold text-navy-900 ring-1 ring-navy-900/15">
              {t.useThis}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
