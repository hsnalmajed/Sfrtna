"use client";

import Link from "next/link";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { useMember } from "@/lib/useMember";
import { daysUntil, tripCityName, tripSearchHref } from "@/components/member/tripLinks";
import { useCountdown } from "@/components/member/MemberSections";
import { myTripProgress, setMyTrip, useMyTrip } from "@/lib/myTrip";

/**
 * The trip being got ready, on the home page: where, how long until they
 * fly, and the next step — opening «رحلتي». The trip in this browser comes
 * first (anyone); otherwise a member's next saved trip within 60 days.
 */
export default function UpcomingTrip({ locale }: { locale: Locale }) {
  const dict = useDictionary();
  const t = dict.myTrip;
  const member = useMember();
  const countdown = useCountdown();
  const local = useMyTrip();
  const isAr = locale === "ar";
  const saved = member.trips
    .map((i) => i.data)
    .filter((d) => {
      const n = daysUntil(d.depart);
      return n >= 0 && n <= 60;
    })
    .sort((a, b) => a.depart.localeCompare(b.depart))[0];
  const trip = local ?? saved;
  if (!trip) return null;
  const p = myTripProgress({ ...trip, at: 0 });
  const stepName =
    p.next === "flight" ? t.flightTitle : p.next === "hotel" ? t.hotelTitle : p.next === "visa" ? t.visaTitle : p.next === "services" ? t.servicesTitle : p.next === "plan" ? t.planTitle : null;
  return (
    <Link
      href={`/${locale}/my-trip`}
      onClick={() => {
        if (!local && saved) setMyTrip({ ...saved, flightUrl: tripSearchHref(locale, saved, member.profile?.currency) });
      }}
      className="mx-auto mb-4 flex max-w-4xl items-center gap-3 rounded-2xl bg-white/[0.1] px-4 py-3 text-white ring-1 ring-sun-400/40 transition hover:bg-white/[0.14]"
    >
      <span className="text-2xl" aria-hidden="true">
        🧳
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-extrabold leading-snug">
          {t.homeTitle.replace("{city}", tripCityName(trip, isAr)).replace("{when}", countdown(trip.depart))}
        </span>
        <span className="block text-xs text-white/70">
          {stepName ? t.homeNext.replace("{step}", stepName) : t.allReady} · {t.progress.replace("{done}", String(p.done)).replace("{total}", String(p.total))}
        </span>
      </span>
      <span className="inline-flex min-h-10 shrink-0 items-center rounded-full bg-sun-400 px-4 text-sm font-extrabold text-navy-950">{t.homeOpen}</span>
    </Link>
  );
}
