"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useDictionary } from "@/lib/dict/context";
import { track } from "@/lib/analytics";

const KEY = "sfr-tips-v1";
export const TIPS_REPLAY_EVENT = "sfr:tips-replay";

type TipPage = "home" | "results" | "hotels" | "city" | "discover" | "trip";

/** Which page this is, for its tips; null = no tips here. */
function pageOf(pathname: string): TipPage | null {
  const p = pathname.split("/").filter(Boolean);
  if (p.length === 1) return "home";
  if (p[1] === "results") return "results";
  if (p[1] === "hotel-results") return "hotels";
  if (p[1] === "discover-results") return "discover";
  if (p[1] === "my-trip") return "trip";
  if (p[1] === "attractions" && p.length === 4) return "city";
  return null;
}

function seen(): TipPage[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    // Storage off: say "seen" so tips never repeat on every page load.
    return ["home", "results", "hotels", "city", "discover", "trip"];
  }
}

/** «أعد عرض النصائح» (the app's «المزيد»). */
export function replayTips() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new Event(TIPS_REPLAY_EVENT));
}

/**
 * First-visit tips (owner's relatives, 23 Oct: "the features are not
 * discovered unless someone explains them"): the first time a visitor opens
 * one of the main pages, a small card at the bottom names what that page
 * can do, in two or three lines, once. Never over the cookie question, the
 * app's welcome cards, the install suggestion or any open sheet.
 */
export default function FirstTips() {
  const t = useDictionary().tips;
  const pathname = usePathname();
  const page = pageOf(pathname);
  const [shown, setShown] = useState<TipPage | null>(null);
  const [replays, setReplays] = useState(0);

  useEffect(() => {
    const onReplay = () => setReplays((n) => n + 1);
    window.addEventListener(TIPS_REPLAY_EVENT, onReplay);
    return () => window.removeEventListener(TIPS_REPLAY_EVENT, onReplay);
  }, []);

  useEffect(() => {
    if (!page || seen().includes(page)) return;
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      if (tries > 40) return window.clearInterval(id);
      if (document.querySelector('[data-consent-banner], [data-install-banner], [aria-modal="true"]')) return;
      if (document.visibilityState !== "visible") return;
      window.clearInterval(id);
      setShown(page);
    }, 1500);
    return () => {
      window.clearInterval(id);
      setShown(null);
    };
  }, [page, replays]);

  if (!shown || shown !== page) return null;
  const lines = t[shown];
  const close = () => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify([...new Set([...seen(), shown])]));
    } catch {}
    track("tip_seen", { page_type: shown });
    setShown(null);
  };
  return (
    <div
      data-first-tip
      role="status"
      className="lift-over-tabbar fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-md rounded-2xl bg-white p-4 text-navy-900 shadow-2xl ring-1 ring-sun-300 print:hidden"
    >
      <p className="text-xs font-extrabold text-sun-700">💡 {t.title}</p>
      <ul className="mt-2 space-y-2">
        {lines.map(([icon, text]) => (
          <li key={text} className="flex items-start gap-2.5 text-sm leading-snug">
            <span className="text-lg leading-none" aria-hidden="true">
              {icon}
            </span>
            <span>{text}</span>
          </li>
        ))}
      </ul>
      <button type="button" onClick={close} className="mt-3 w-full rounded-xl bg-sun-400 px-4 py-2.5 text-sm font-extrabold text-navy-950">
        {t.gotIt}
      </button>
    </div>
  );
}
