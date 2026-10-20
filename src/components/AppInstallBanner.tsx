"use client";

import { useEffect, useState } from "react";
import { useDictionary } from "@/lib/dict/context";
import { ANDROID_APP_URL, IOS_APP_URL } from "@/lib/appLinks";

const KEY = "sfr-install-dismissed";
const QUIET_DAYS = 14;

/**
 * "Get the app", for a visitor on a phone's browser (owner, 20 Oct): the
 * phone is read from the browser, and only that phone's store is offered —
 * Google Play on Android, the App Store on an iPhone. Never inside the app
 * itself, never on a computer, never for a store with no listing yet
 * (appLinks.ts), and quiet for two weeks once closed.
 */
export default function AppInstallBanner() {
  const t = useDictionary().appInstall;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/SfrtnaApp\//.test(ua) || document.documentElement.classList.contains("in-app")) return;
    const os = /Android/i.test(ua) ? "android" : /iPhone|iPad|iPod/i.test(ua) ? "ios" : null;
    const link = os === "android" ? ANDROID_APP_URL : os === "ios" ? IOS_APP_URL : "";
    if (!link) return;
    try {
      const until = Number(window.localStorage.getItem(KEY) || 0);
      if (until > Date.now()) return;
    } catch {
      // Storage blocked: show it; closing still hides it for this visit.
    }
    // Not over the first seconds of a visit, and never on top of the cookie
    // question: shown once the page has settled and that is answered.
    const id = window.setInterval(() => {
      if (document.querySelector("[data-consent-banner]")) return;
      window.clearInterval(id);
      setUrl(link);
    }, 2500);
    return () => window.clearInterval(id);
  }, []);

  if (!url) return null;
  const close = () => {
    setUrl(null);
    try {
      window.localStorage.setItem(KEY, String(Date.now() + QUIET_DAYS * 86_400_000));
    } catch {}
  };
  return (
    <div role="dialog" aria-label={t.title} className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-md rounded-2xl bg-navy-990 p-3.5 text-white shadow-2xl ring-1 ring-white/15 print:hidden">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/favicon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-xl bg-white" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-sm font-extrabold">{t.title}</p>
          <p className="text-xs leading-snug text-white/70">{t.body}</p>
        </div>
        <button type="button" onClick={close} aria-label={t.close} className="self-start rounded-lg p-1 text-white/60 hover:text-white">
          ✕
        </button>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener"
        data-partner="app-install"
        onClick={close}
        className="mt-3 flex w-full items-center justify-center rounded-xl bg-sun-400 px-4 py-2.5 text-sm font-extrabold text-navy-950"
      >
        {t.cta}
      </a>
    </div>
  );
}
