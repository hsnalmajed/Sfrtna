"use client";

import { useDictionary } from "@/lib/dict/context";
import { openFeedback } from "@/components/feedback/events";

/** «شاركنا رأيك» as a plain link-looking button (footer, menus). */
export default function FeedbackLink({ className = "", source }: { className?: string; source: string }) {
  const t = useDictionary().feedback;
  return (
    <button type="button" onClick={() => openFeedback({ source })} className={className}>
      {t.open}
    </button>
  );
}
