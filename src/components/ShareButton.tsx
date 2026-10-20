"use client";

import { useState } from "react";
import { useDictionary } from "@/lib/dict/context";
import { track } from "@/lib/analytics";

/**
 * Share this search (WhatsApp, messages…) through the phone's own share
 * sheet; on a computer, the address is copied. Trips are planned together.
 */
export default function ShareButton({ title, className = "" }: { title: string; className?: string }) {
  const t = useDictionary().share;
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    track("share", { page_path: window.location.pathname });
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* closed by the traveller */
    }
  };
  return (
    <button
      type="button"
      onClick={share}
      className={`inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-[13px] font-bold text-white ring-1 ring-white/20 transition hover:bg-white/20 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" />
      </svg>
      {copied ? t.copied : t.share}
    </button>
  );
}
