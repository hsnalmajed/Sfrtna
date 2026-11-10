"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/types";
import { useDictionary } from "@/lib/dict/context";
import { getTripMail, setTripMail, type TripMailConsent } from "@/lib/tripMail";

/**
 * «تذكيرات الرحلات بالبريد» in «حسابي»: what the traveller agreed to, since
 * when, and one button to turn it on or off (Saudi PDPL: consent can be
 * withdrawn as easily as it was given).
 */
export default function TripMailSwitch({ locale }: { locale: Locale }) {
  const t = useDictionary().member;
  const [c, setC] = useState<TripMailConsent | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void getTripMail().then(setC);
  }, []);

  if (c === undefined) return null;
  const on = Boolean(c?.tripMail);
  const date = c ? new Date(c.at).toLocaleDateString(locale === "ar" ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

  async function flip() {
    setBusy(true);
    setFailed(false);
    const ok = await setTripMail(!on, "account", locale);
    if (ok) setC({ tripMail: !on, at: Date.now(), src: "account", locale });
    else setFailed(true);
    setBusy(false);
  }

  return (
    <section id="trip-mail" className="scroll-mt-24 rounded-3xl bg-white p-5 ring-1 ring-mist-200">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-extrabold text-navy-900">✉️ {t.tripMailTitle}</h2>
          <p className={`text-sm font-bold ${on ? "text-emerald-700" : "text-navy-600"}`}>
            {on ? t.tripMailOn.replace("{date}", date) : c ? t.tripMailOff : t.tripMailNever}
          </p>
        </div>
        <button
          type="button"
          onClick={flip}
          disabled={busy}
          className={`min-h-11 rounded-full px-5 py-2 text-sm font-extrabold disabled:opacity-60 ${on ? "text-navy-700 ring-1 ring-mist-300 hover:ring-navy-300" : "bg-sun-400 text-navy-950 hover:bg-sun-300"}`}
        >
          {on ? t.tripMailTurnOff : t.tripMailTurnOn}
        </button>
      </div>
      <p className="mt-2 text-sm text-navy-600">{t.tripMailHint}</p>
      {failed && <p className="mt-2 text-sm font-bold text-rose-700">{t.failed}</p>}
    </section>
  );
}
