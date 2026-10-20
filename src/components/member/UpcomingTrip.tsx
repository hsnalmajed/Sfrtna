"use client";

import Link from "next/link";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { useMember } from "@/lib/useMember";
import { daysUntil, stepHref, tripCityName, tripSteps } from "@/components/member/tripLinks";
import { useCountdown } from "@/components/member/MemberSections";

/**
 * A member's next trip (within 60 days) on the home page: how long until
 * they fly and the next step left to get ready — dates and steps they chose,
 * nothing guessed.
 */
export default function UpcomingTrip({ locale }: { locale: Locale }) {
  const t = useDictionary().member;
  const member = useMember();
  const countdown = useCountdown();
  const isAr = locale === "ar";
  const next = member.trips
    .map((i) => i.data)
    .filter((d) => {
      const n = daysUntil(d.depart);
      return n >= 0 && n <= 60;
    })
    .sort((a, b) => a.depart.localeCompare(b.depart))[0];
  if (!next) return null;
  const step = tripSteps(next).find((s) => !next.done.includes(s));
  const href = step ? stepHref(locale, next, step) : null;
  return (
    <div className="mx-auto mb-4 max-w-4xl rounded-2xl bg-white/[0.1] px-4 py-3 text-white ring-1 ring-sun-400/40 sm:flex sm:items-center sm:gap-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="text-2xl" aria-hidden="true">
          🧳
        </span>
        <div className="min-w-0">
          <p className="text-sm font-extrabold leading-snug">
            {t.upcomingTitle.replace("{city}", tripCityName(next, isAr))} · <span className="whitespace-nowrap text-sun-300">{countdown(next.depart)}</span>
          </p>
          <p className="text-xs text-white/70">{step ? t.nextStep.replace("{step}", t.steps[step]) : t.ready}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2 sm:mt-0 sm:shrink-0">
        {href && (
          <Link href={href} className="inline-flex min-h-10 flex-1 items-center justify-center whitespace-nowrap rounded-full bg-sun-400 px-4 text-sm font-extrabold text-navy-950 sm:flex-none">
            {t.steps[step!]}
          </Link>
        )}
        <Link
          href={`/${locale}/account#trips`}
          className="inline-flex min-h-10 flex-1 items-center justify-center whitespace-nowrap rounded-full px-4 text-sm font-bold text-white ring-1 ring-white/25 sm:flex-none"
        >
          {t.openTrips}
        </Link>
      </div>
    </div>
  );
}
