import type { FeedbackArea, FeedbackKind } from "@/lib/feedbackShared";

/** Opens the «شاركنا رأيك» sheet (FeedbackHost) from anywhere on the page. */
export const FEEDBACK_EVENT = "sfr:feedback";

export interface FeedbackOpen {
  kind?: FeedbackKind;
  area?: FeedbackArea;
  /** Where it was opened from, for GA4: floating, footer, app_menu, quick_no… */
  source?: string;
}

export function openFeedback(detail: FeedbackOpen = {}): void {
  window.dispatchEvent(new CustomEvent(FEEDBACK_EVENT, { detail }));
}
