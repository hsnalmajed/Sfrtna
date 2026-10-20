"use client";

import { useState } from "react";
import { useDictionary } from "@/lib/dict/context";
import { track } from "@/lib/analytics";

/**
 * Share (WhatsApp, messages…) through the phone's own share sheet; on a
 * computer, the text and address are copied. Trips are planned together.
 * `text` describes what is shared (one flight: airline, times, stops, price).
 */
export default function ShareButton({
  title,
  text,
  className = "",
  tone = "glass",
}: {
  title: string;
  text?: string;
  className?: string;
  tone?: "glass" | "light";
}) {
  const t = useDictionary().share;
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    track("share", { page_path: window.location.pathname });
    try {
      if (navigator.share) {
        await navigator.share(text ? { title, text, url } : { title, url });
        return;
      }
      await navigator.clipboard.writeText(text ? `${text}\n${url}` : url);
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
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-bold transition ${
        tone === "light" ? "bg-white text-navy-800 ring-1 ring-mist-300 hover:ring-navy-300" : "bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20"
      } ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7M16 6l-4-4-4 4M12 2v14" />
      </svg>
      {copied ? t.copied : t.share}
    </button>
  );
}
