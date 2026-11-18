"use client";

import type { Locale } from "@/lib/types";
import type { useDictionary } from "@/lib/dict/context";
import { useAccount, setSignedIn } from "@/lib/useAccount";
import { SignInForm } from "@/components/AccountPanel";
import type { WorldMapFile } from "@/lib/visitedMap";
import { NIGHT } from "./WorldCanvas";

type T = ReturnType<typeof useDictionary>["visited"];
/** A sample of a traveller's map, to show what waits after signing in. */
const SAMPLE = new Set(["SA", "AE", "TR", "EG", "MY", "GB", "FR", "JP", "ID", "MA", "IT", "TH", "GE", "BA"]);
const DREAM = new Set(["CA", "AU", "BR"]);

/**
 * Signed out: what «خريطتي» is, and signing in right here. The page itself
 * becomes the map the moment the account is known: no trip to «حسابي»,
 * no return to the home page (owner 18 Nov).
 */
export default function MapGate({ locale, t, world }: { locale: Locale; t: T; world: WorldMapFile | null }) {
  const account = useAccount();
  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-start">
      <div>
        <div className="overflow-hidden rounded-[1.75rem] bg-[#061a33] ring-1 ring-white/10">
          {world ? (
            <svg viewBox={`0 ${world.h * 0.06} ${world.w} ${world.h * 0.86}`} className="block w-full" aria-hidden="true">
              <path d={world.sphere} fill={NIGHT.sphere} />
              <g stroke={NIGHT.line} strokeWidth={0.6}>
                {world.countries.map((c) =>
                  c.d ? <path key={c.c} d={c.d} fill={SAMPLE.has(c.c) ? NIGHT.been : DREAM.has(c.c) ? NIGHT.wish : NIGHT.land} vectorEffect="non-scaling-stroke" /> : null
                )}
              </g>
            </svg>
          ) : (
            <div className="aspect-[2/1]" />
          )}
        </div>
        <h2 className="mt-5 font-display text-2xl font-extrabold text-white sm:text-3xl">{t.gateTitle}</h2>
        <p className="mt-2 leading-8 text-white/75">{t.gateBody}</p>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {t.gatePoints.map((p) => (
            <li key={p} className="flex items-start gap-2 text-sm font-bold text-white/90">
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#f8b840] text-[0.7rem] text-[#061a33]" aria-hidden="true">
                ✓
              </span>
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className="[&>*]:shadow-xl">
        {account.status === "ready" ? (
          <SignInForm locale={locale} methods={account.methods} onSignedIn={(u) => setSignedIn(u)} />
        ) : (
          <p className="py-10 text-center text-navy-500">{t.loading}</p>
        )}
      </div>
    </div>
  );
}
