"use client";

import { useState, useSyncExternalStore } from "react";
import { useDictionary } from "@/lib/dict/context";
import { track } from "@/lib/analytics";
import { openFeedback } from "@/components/feedback/events";
import type { FeedbackArea } from "@/lib/feedbackShared";

/**
 * «هل وجدت ما تبحث عنه؟» under results (flights, hotels, suggestions, plan).
 * One tap answers it (GA4 `quick_feedback`); «لا» opens the full sheet on
 * «مشكلة» for this section, «نعم» offers to say more. Answered once per
 * section per visit, then it steps aside.
 */
export default function QuickFeedback({ area, className = "" }: { area: FeedbackArea; className?: string }) {
  const t = useDictionary().feedback;
  const key = `sfr-quick-fb:${area}`;
  // Answered earlier this visit? Read from sessionStorage after hydration
  // (the server renders nothing, so there is no mismatch).
  const answered = useSyncExternalStore(
    noop,
    () => {
      try {
        return Boolean(sessionStorage.getItem(key));
      } catch {
        return false;
      }
    },
    () => true
  );
  const [local, setState] = useState<"ask" | "yes" | "hidden">("ask");
  const state = local === "ask" && answered ? "hidden" : local;

  const remember = () => {
    try {
      sessionStorage.setItem(key, "1");
    } catch {
      /* private window: it may ask again, harmless */
    }
  };

  if (state === "hidden") return null;

  return (
    <div className={`mx-auto flex max-w-xl flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-2xl bg-white px-4 py-3 text-center shadow-sm ring-1 ring-mist-200 print:hidden ${className}`}>
      {state === "ask" ? (
        <>
          <span className="text-sm font-bold text-navy-900">{t.quickQ}</span>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                track("quick_feedback", { area, answer: "yes" });
                remember();
                setState("yes");
              }}
              className="min-h-10 rounded-full bg-emerald-50 px-4 text-sm font-bold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
            >
              👍 {t.quickYes}
            </button>
            <button
              type="button"
              onClick={() => {
                track("quick_feedback", { area, answer: "no" });
                remember();
                setState("hidden");
                openFeedback({ kind: "problem", area, source: "quick_no" });
              }}
              className="min-h-10 rounded-full bg-red-50 px-4 text-sm font-bold text-red-700 ring-1 ring-red-200 hover:bg-red-100"
            >
              👎 {t.quickNo}
            </button>
          </span>
        </>
      ) : (
        <>
          <span className="text-sm font-bold text-navy-900">{t.quickThanks}</span>
          <button
            type="button"
            onClick={() => {
              setState("hidden");
              openFeedback({ kind: "opinion", area, source: "quick_yes" });
            }}
            className="min-h-10 rounded-full bg-sun-400 px-4 text-sm font-extrabold text-navy-950 hover:bg-sun-300"
          >
            {t.quickTell}
          </button>
        </>
      )}
    </div>
  );
}

const noop = () => () => {};
