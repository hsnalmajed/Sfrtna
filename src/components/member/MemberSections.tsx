"use client";

import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { useMember, type Item } from "@/lib/useMember";
import { countLabel } from "@/lib/format";
import { findAirport } from "@/lib/airports";
import type { Fav, Profile, SavedSearch, Trip, TripStep } from "@/lib/memberItems";
import { tripKey } from "@/lib/memberItems";
import AirportInput from "@/components/AirportInput";
import TravelersPicker from "@/components/TravelersPicker";
import CurrencySelect from "@/components/CurrencySelect";
import { daysUntil, stepHref, tripCityName, tripSearchHref, tripSteps } from "@/components/member/tripLinks";

const card = "rounded-3xl bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-navy-950/5";
const h2 = "mb-3 flex items-center gap-2 font-display text-lg font-extrabold text-navy-900";

/** «حسابي» for a signed-in traveller: trips, favourites, searches, profile. */
export default function MemberSections({ locale }: { locale: Locale }) {
  const member = useMember();
  return (
    <>
      <Trips locale={locale} trips={member.trips} currency={member.profile?.currency} />
      <Favs locale={locale} favs={member.favs} />
      <Searches locale={locale} searches={member.searches} />
      <ProfileForm locale={locale} profile={member.profile} ready={member.ready} />
    </>
  );
}

export function useCountdown() {
  const t = useDictionary().member;
  return (iso: string) => {
    const n = daysUntil(iso);
    if (n < 0) return t.past;
    if (n === 0) return t.today;
    return countLabel(n, { one: t.daysOne, two: t.daysTwo, few: t.daysFew, many: t.daysMany });
  };
}

function Trips({ locale, trips, currency }: { locale: Locale; trips: Item<Trip>[]; currency?: string }) {
  const t = useDictionary().member;
  const member = useMember();
  const isAr = locale === "ar";
  const countdown = useCountdown();
  const day = (iso: string) =>
    new Intl.DateTimeFormat(isAr ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const list = [...trips].sort((a, b) => {
    const pa = daysUntil(a.data.back || a.data.depart) < 0;
    const pb = daysUntil(b.data.back || b.data.depart) < 0;
    return pa === pb ? a.data.depart.localeCompare(b.data.depart) * (pa ? -1 : 1) : pa ? 1 : -1;
  });
  const update = (trip: Trip, patch: Partial<Trip>) => member.saveTrip({ ...trip, ...patch });
  const toggleStep = (trip: Trip, step: TripStep) =>
    update(trip, { done: trip.done.includes(step) ? trip.done.filter((s) => s !== step) : [...trip.done, step] });

  return (
    <section id="trips" className="scroll-mt-24">
      <h2 className={h2}>🧳 {t.myTrips}</h2>
      {list.length === 0 ? (
        <p className="rounded-3xl bg-mist-50 p-5 text-sm leading-relaxed text-navy-700">{t.noTrips}</p>
      ) : (
        <ul className="space-y-3">
          {list.map(({ data: trip }) => {
            const past = daysUntil(trip.back || trip.depart) < 0;
            const steps = tripSteps(trip);
            const left = steps.filter((s) => !trip.done.includes(s));
            const from = findAirport(trip.origin);
            return (
              <li key={tripKey(trip)} className={`${card} ${past ? "opacity-70" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-display text-lg font-extrabold text-navy-950">{tripCityName(trip, isAr)}</p>
                    <p className="text-xs text-navy-500">
                      {from ? (isAr ? from.cityAr : from.cityEn) : trip.origin} {isAr ? "←" : "→"} {tripCityName(trip, isAr)} · {day(trip.depart)}
                      {trip.back ? ` – ${day(trip.back)}` : ""}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${past ? "bg-mist-100 text-navy-600" : "bg-sun-100 text-navy-950"}`}>{countdown(trip.depart)}</span>
                </div>

                {!past && (
                  <>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => update(trip, { booked: !trip.booked })}
                        className={`min-h-10 rounded-full px-4 text-sm font-extrabold ${trip.booked ? "bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300" : "bg-white text-navy-900 ring-1 ring-mist-300"}`}
                      >
                        {trip.booked ? t.booked : t.markBooked}
                      </button>
                      <Link href={tripSearchHref(locale, trip, currency)} className="inline-flex min-h-10 items-center rounded-full bg-navy-900 px-4 text-sm font-extrabold text-white">
                        ✈️ {t.searchAgain}
                      </Link>
                    </div>
                    <p className="mt-4 text-xs font-bold text-navy-500">{left.length ? t.stepsTitle : t.ready}</p>
                    <ul className="mt-2 divide-y divide-mist-100 overflow-hidden rounded-2xl ring-1 ring-mist-200">
                      {steps.map((s) => {
                        const done = trip.done.includes(s);
                        const href = stepHref(locale, trip, s);
                        return (
                          <li key={s} className="flex items-center justify-between gap-2 bg-white px-3 py-1.5">
                            <label className="flex min-h-10 flex-1 cursor-pointer items-center gap-2.5 text-sm font-bold text-navy-900">
                              <input type="checkbox" checked={done} onChange={() => toggleStep(trip, s)} className="h-5 w-5 accent-emerald-600" />
                              <span className={done ? "text-navy-400 line-through" : ""}>{t.steps[s]}</span>
                            </label>
                            {href && !done && (
                              <Link href={href} className="inline-flex min-h-10 items-center rounded-full px-3 text-sm font-extrabold text-sea-700 hover:underline">
                                {isAr ? "افتح ←" : "Open →"}
                              </Link>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
                <button type="button" onClick={() => member.remove("trip", tripKey(trip))} className="mt-3 min-h-10 text-xs font-bold text-red-700 hover:underline">
                  {t.removeTrip}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Favs({ locale, favs }: { locale: Locale; favs: Item<Fav>[] }) {
  const t = useDictionary().member;
  const member = useMember();
  const isAr = locale === "ar";
  return (
    <section id="favs" className="scroll-mt-24">
      <h2 className={h2}>❤️ {t.myFavs}</h2>
      {favs.length === 0 ? (
        <p className="rounded-3xl bg-mist-50 p-5 text-sm leading-relaxed text-navy-700">{t.noFavs}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {favs.map(({ key, data: f }) => {
            const href =
              f.type === "city"
                ? `/${locale}/attractions/${f.code}/${f.slug}`
                : `/${locale}/hotel-results?${new URLSearchParams({ hmode: "known", hotel: f.name, hotelArea: f.area, label: f.label || f.name })}`;
            const name = f.type === "city" ? (isAr ? f.nameAr : f.nameEn) : f.label || f.name;
            return (
              <li key={key} className="flex items-center gap-2 rounded-2xl bg-white p-2 ps-4 shadow-sm ring-1 ring-navy-950/5">
                <span aria-hidden="true">{f.type === "city" ? "📍" : "🏨"}</span>
                <Link href={href} className="min-w-0 flex-1 py-2">
                  <span className="block truncate text-sm font-extrabold text-navy-900">{name}</span>
                  <span className="block text-[11px] text-navy-500">{f.type === "city" ? t.favCity : t.favHotel}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => member.remove("fav", key)}
                  aria-label={t.favRemove}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-rose-500 hover:bg-rose-50"
                >
                  ♥
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Searches({ locale, searches }: { locale: Locale; searches: Item<SavedSearch>[] }) {
  const t = useDictionary().member;
  const isAr = locale === "ar";
  const today = new Date().toISOString().slice(0, 10);
  const list = searches.filter((s) => !s.data.date || s.data.date >= today).slice(0, 8);
  const place = (s?: string) => {
    if (!s) return "";
    const a = /^[A-Z]{3}$/.test(s) ? findAirport(s) : undefined;
    return a ? (isAr ? a.cityAr : a.cityEn) : s;
  };
  const day = (iso?: string) =>
    iso ? new Intl.DateTimeFormat(isAr ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)) : "";
  const icon = { flight: "✈️", hotel: "🏨", combo: "✈️🏨", discover: "🧭" };
  return (
    <section id="searches" className="scroll-mt-24">
      <h2 className={h2}>🔎 {t.mySearches}</h2>
      {list.length === 0 ? (
        <p className="rounded-3xl bg-mist-50 p-5 text-sm leading-relaxed text-navy-700">{t.noSearches}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {list.map(({ key, data: s }) => (
            <li key={key}>
              <Link href={s.url} className="flex min-h-12 items-center gap-3 rounded-2xl bg-white px-4 py-2.5 shadow-sm ring-1 ring-navy-950/5 hover:ring-sun-400">
                <span aria-hidden="true">{icon[s.kind]}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-extrabold text-navy-900">
                    {s.from ? `${place(s.from)} ${isAr ? "←" : "→"} ${place(s.to)}` : place(s.to)}
                  </span>
                  <span className="block text-[11px] text-navy-500">
                    {day(s.date)}
                    {s.back ? ` – ${day(s.back)}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProfileForm({ locale, profile, ready }: { locale: Locale; profile: Profile | null; ready: boolean }) {
  const t = useDictionary().member;
  const dict = useDictionary();
  const member = useMember();
  const [draft, setDraft] = useState<Profile | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const p: Profile = draft ?? profile ?? {};
  const edit = (patch: Partial<Profile>) => {
    setDraft({ ...p, ...patch });
    setState("idle");
  };
  if (!ready) return null;
  const chip = (on: boolean) =>
    `min-h-10 rounded-full px-3.5 text-sm font-bold ring-1 transition ${on ? "bg-navy-900 text-white ring-navy-900" : "bg-white text-navy-800 ring-mist-300"}`;
  async function save() {
    setState("saving");
    setState((await member.setProfile(p)) ? "saved" : "failed");
    setDraft(null);
  }
  return (
    <section id="profile" className="scroll-mt-24">
      <h2 className={h2}>👤 {t.profileTitle}</h2>
      <div className={card}>
        <p className="mb-4 text-sm text-navy-600">{t.profileSub}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-sm font-bold text-navy-800">{t.origin}</p>
            <AirportInput locale={locale} value={p.origin || ""} onChange={(v) => edit({ origin: v || undefined })} placeholder={t.originPlaceholder} ariaLabel={t.origin} />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-bold text-navy-800">{t.travellers}</p>
            <TravelersPicker
              locale={locale}
              value={{ adults: p.adults ?? 2, childrenAges: p.childrenAges ?? [], infants: p.infants ?? 0 }}
              onChange={(v) => edit({ adults: v.adults, childrenAges: v.childrenAges, infants: v.infants })}
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-bold text-navy-800">{t.currency}</p>
            <CurrencySelect
              value={p.currency || "SAR"}
              onChange={(c) => edit({ currency: c })}
              label={t.currency}
              className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-navy-800"
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-bold text-navy-800">{t.stars}</p>
            <div className="flex flex-wrap gap-2">
              {[0, 3, 4, 5].map((n) => (
                <button key={n} type="button" className={chip((p.minStars ?? 0) === n)} onClick={() => edit({ minStars: n })}>
                  {n ? "★".repeat(n) : t.anyStars}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={chip(Boolean(p.directOnly))} onClick={() => edit({ directOnly: !p.directOnly })} aria-pressed={Boolean(p.directOnly)}>
            {p.directOnly ? "✓ " : ""}
            {t.direct}
          </button>
          <button type="button" className={chip(Boolean(p.baggage))} onClick={() => edit({ baggage: !p.baggage })} aria-pressed={Boolean(p.baggage)}>
            {p.baggage ? "✓ " : ""}
            {t.bags}
          </button>
          <button type="button" className={chip(Boolean(p.breakfast))} onClick={() => edit({ breakfast: !p.breakfast })} aria-pressed={Boolean(p.breakfast)}>
            {p.breakfast ? "✓ " : ""}
            {t.breakfast}
          </button>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={state === "saving" || !draft}
            className="min-h-11 rounded-full bg-sun-400 px-6 font-extrabold text-navy-950 transition hover:bg-sun-300 disabled:opacity-50"
          >
            {state === "saving" ? dict.account.saving : t.save}
          </button>
          {state === "saved" && <span className="text-sm font-bold text-emerald-700">{t.saved}</span>}
          {state === "failed" && <span className="text-sm font-bold text-red-700">{t.failed}</span>}
        </div>
      </div>
    </section>
  );
}
