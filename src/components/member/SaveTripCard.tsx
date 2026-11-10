"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { setSignedIn, useAccount } from "@/lib/useAccount";
import { useMember } from "@/lib/useMember";
import { tripKey, type Trip } from "@/lib/memberItems";
import { setTripMail } from "@/lib/tripMail";
import { SignInForm } from "@/components/AccountPanel";
import { showToast } from "@/components/member/events";
import { track } from "@/lib/analytics";

const HIDE_KEY = "sfr-save-card-hidden";

/**
 * «احفظ رحلتك إلى …» (item 5 «رحلة المسافر», owner 6 Nov): shown after a
 * flight search, where the traveller already sees what the trip is worth
 * keeping. No pop-up: a card in the page. Signing in happens inside the card
 * (Google button or email code), then the trip is saved at once.
 * The email box starts EMPTY — only the traveller's own tick turns trip
 * reminders on, and that answer is stored with its time (Saudi PDPL).
 * Hidden when the trip is already in the account, when the traveller chose
 * «ليس الآن» in this tab, or when signing in is not possible here.
 */
export default function SaveTripCard({ locale, trip, cityName }: { locale: Locale; trip: Trip; cityName: string }) {
  const t = useDictionary().member;
  const account = useAccount();
  const member = useMember();
  const key = tripKey(trip);
  const [mail, setMail] = useState(false);
  const [asking, setAsking] = useState(false);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [hidden, setHidden] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read once after mount (this tab's choice)
      if (window.sessionStorage.getItem(HIDE_KEY) === key) setHidden(true);
    } catch {
      /* storage off: show it */
    }
  }, [key]);

  const existing = member.trips.find((i) => i.key === key);

  async function save() {
    pending.current = false;
    setState("saving");
    const ok = await member.saveTrip({
      ...trip,
      booked: existing?.data.booked ?? trip.booked,
      done: existing?.data.done ?? trip.done,
      pickedAt: existing?.data.pickedAt ?? trip.pickedAt,
    });
    if (!ok) return setState("error");
    // Only a tick says yes; an empty box records nothing (never a silent "no"
    // that would undo a yes given on another trip).
    const mailOk = mail ? await setTripMail(true, "save_card", locale) : true;
    setState("saved");
    track("trip_save_card", { mail: mail && mailOk ? 1 : 0 });
    showToast({ text: mail && mailOk ? t.saveCardSavedMail : t.saveCardSaved, href: `/${locale}/account#trips`, linkText: t.openTrips });
  }

  // Signed in from inside the card: save as soon as the account is known.
  useEffect(() => {
    if (pending.current && member.signedIn) void save();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the sign-in lands
  }, [member.signedIn]);

  const canSignIn = account.status === "ready" && (account.user || account.methods.email || account.methods.google);
  if (!canSignIn || hidden) return null;
  // Already kept (by this card or by «احجز»): nothing to offer.
  if (existing && state !== "saved") return null;
  if (member.signedIn && !member.ready && state === "idle") return null;

  function notNow() {
    setHidden(true);
    try {
      window.sessionStorage.setItem(HIDE_KEY, key);
    } catch {
      /* storage off */
    }
  }

  if (state === "saved") {
    return (
      <section className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-900 print:hidden" role="status">
        {mail ? t.saveCardSavedMail : t.saveCardSaved}
      </section>
    );
  }

  return (
    <section aria-labelledby="save-trip-title" className="mt-6 rounded-3xl border border-navy-900/10 bg-white p-5 shadow-sm sm:p-6 print:hidden">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sun-100 text-xl">
          🧳
        </span>
        <div className="min-w-0">
          <h2 id="save-trip-title" className="font-display text-lg font-extrabold text-navy-950">
            {t.saveCardTitle.replace("{city}", cityName)}
          </h2>
          <p className="text-sm text-navy-600">{t.saveCardSub}</p>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5 text-sm text-navy-800">
        {t.saveCardPoints.map((p) => (
          <li key={p} className="flex gap-2">
            <span aria-hidden="true" className="text-emerald-600">
              ✓
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-2xl bg-navy-50 p-3 text-sm text-navy-800">
        <input type="checkbox" checked={mail} onChange={(e) => setMail(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-navy-900" />
        <span>{t.saveCardConsent}</span>
      </label>

      {asking && !member.signedIn ? (
        <div className="mt-4">
          <p className="mb-2 text-sm font-bold text-navy-900">{t.saveCardSignIn}</p>
          <SignInForm
            locale={locale}
            methods={account.methods}
            onSignedIn={(u) => {
              pending.current = true;
              setSignedIn(u);
            }}
          />
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={state === "saving"}
            onClick={() => {
              if (member.signedIn) void save();
              else {
                track("join_prompt", { reason: "save_card" });
                setAsking(true);
              }
            }}
            className="min-h-11 rounded-full bg-sun-400 px-6 py-2.5 font-extrabold text-navy-950 shadow-[var(--shadow-sun)] hover:bg-sun-300 disabled:opacity-60"
          >
            {state === "saving" ? "…" : t.saveCardCta}
          </button>
          <button type="button" onClick={notNow} className="min-h-11 rounded-full px-4 text-sm font-bold text-navy-600">
            {t.notNow}
          </button>
          {state === "error" && <p className="w-full text-sm font-bold text-rose-700">{t.failed}</p>}
        </div>
      )}
    </section>
  );
}
