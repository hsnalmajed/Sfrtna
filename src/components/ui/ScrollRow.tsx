"use client";

import { useCallback, useEffect, useId, useRef, useState, type HTMLAttributes, type ReactNode } from "react";

/**
 * Every row on the site that scrolls sideways goes through here.
 *
 * Owner, 22 Oct 2026: a row wider than the phone (the city tabs: Places ·
 * Map · Trip plan · Activities · Services) gave no sign that more was
 * hidden — "the customer has to swipe and nothing tells him to". Only the
 * home strip had a faint fade; the other four rows had nothing. So the hint
 * lives in one component, and `scripts/check-rails.mjs` fails the build if a
 * sideways-scrolling row is written anywhere else.
 *
 * What the visitor sees, only while there is more to see:
 *   - the row fades out on the side where it continues (both sides once
 *     scrolled into the middle);
 *   - a round arrow button sits on that side; tapping it moves the row on;
 *   - the first time a row that overflows appears on a page, it slides a
 *     little and back, once per page per session (never with reduced motion);
 *   - the selected tab is brought into view when the row first renders.
 * When everything fits (wide screens, few items) none of this appears.
 *
 * Direction-aware: in Arabic the row continues to the left.
 */
type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  /** Classes for the scrolling row itself (flex, gap, padding…). */
  className?: string;
  /** Classes for the outer box (margins, sticky, visibility). */
  outerClassName?: string;
  /** The arrow buttons' colours: on a light page or on the navy. */
  tone?: "light" | "dark";
};

const FADE = "2.5rem";

export default function ScrollRow({ children, className = "", outerClassName = "", tone = "light", ...rest }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const [more, setMore] = useState({ start: false, end: false, rtl: false });
  const touched = useRef(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rtl = getComputedStyle(el).direction === "rtl";
    // In a right-to-left row browsers report scrollLeft as 0 at the start
    // and negative towards the end; the distance is what matters.
    const from = Math.abs(el.scrollLeft);
    const left = el.scrollWidth - el.clientWidth - from;
    const next = { start: from > 2, end: left > 2, rtl };
    setMore((m) => (m.start === next.start && m.end === next.end && m.rtl === next.rtl ? m : next));
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    for (const c of Array.from(el.children)) ro.observe(c);
    const onScroll = () => measure();
    const onTouch = () => {
      touched.current = true;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("pointerdown", onTouch, { passive: true });
    el.addEventListener("wheel", onTouch, { passive: true });

    // The selected tab in view, without moving the page itself.
    const sel = el.querySelector<HTMLElement>('[aria-selected="true"],[aria-pressed="true"],[aria-current="page"],[data-active="true"]');
    if (sel && el.scrollWidth > el.clientWidth) {
      const box = el.getBoundingClientRect();
      const s = sel.getBoundingClientRect();
      const off = s.left + s.width / 2 - (box.left + box.width / 2);
      if (Math.abs(off) > box.width / 3) el.scrollLeft += off;
    }

    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerdown", onTouch);
      el.removeEventListener("wheel", onTouch);
    };
  }, [measure]);

  // One small slide and back, the first time this row overflows on this page.
  useEffect(() => {
    if (!more.end || more.start) return;
    const el = ref.current;
    if (!el) return;
    let key = "";
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      key = `sfr-nudge:${location.pathname}:${id}`;
      if (sessionStorage.getItem(key)) return;
    } catch {
      return;
    }
    const sign = more.rtl ? -1 : 1;
    const t1 = window.setTimeout(() => {
      if (touched.current) return;
      try {
        sessionStorage.setItem(key, "1");
      } catch {
        /* private window: the slide may repeat, harmless */
      }
      el.scrollBy({ left: 56 * sign, behavior: "smooth" });
      window.setTimeout(() => {
        if (!touched.current) el.scrollBy({ left: -56 * sign, behavior: "smooth" });
      }, 550);
    }, 900);
    return () => window.clearTimeout(t1);
  }, [more.end, more.start, more.rtl, id]);

  const go = (toEnd: boolean) => {
    const el = ref.current;
    if (!el) return;
    touched.current = true;
    const sign = (toEnd ? 1 : -1) * (more.rtl ? -1 : 1);
    el.scrollBy({ left: sign * Math.max(120, el.clientWidth * 0.7), behavior: "smooth" });
  };

  // The fade sits on the physical side the row continues to.
  const leftMore = more.rtl ? more.end : more.start;
  const rightMore = more.rtl ? more.start : more.end;
  const mask =
    leftMore || rightMore
      ? `linear-gradient(to right, ${leftMore ? `transparent 0, #000 ${FADE}` : "#000 0"}, ${
          rightMore ? `#000 calc(100% - ${FADE}), transparent 100%` : "#000 100%"
        })`
      : undefined;

  const ar = more.rtl;
  const btn =
    tone === "dark"
      ? "bg-navy-800/95 text-white ring-white/25 hover:bg-navy-700"
      : "bg-white text-navy-900 ring-mist-300 hover:bg-mist-50";

  return (
    <div className={`relative ${outerClassName}`}>
      <div
        ref={ref}
        {...rest}
        className={`rail overflow-x-auto ${className}`}
        style={{ ...rest.style, WebkitMaskImage: mask, maskImage: mask }}
      >
        {children}
      </div>
      {more.start && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => go(false)}
          aria-label={ar ? "السابق" : "Previous"}
          className={`absolute inset-y-0 start-0 z-10 my-auto flex h-8 w-8 items-center justify-center rounded-full shadow-md ring-1 transition ${btn}`}
        >
          <Chevron flip={!ar} />
        </button>
      )}
      {more.end && (
        <button
          type="button"
          tabIndex={-1}
          onClick={() => go(true)}
          aria-label={ar ? "عرض المزيد" : "Show more"}
          className={`absolute inset-y-0 end-0 z-10 my-auto flex h-8 w-8 items-center justify-center rounded-full shadow-md ring-1 transition ${btn}`}
        >
          <Chevron flip={ar} />
        </button>
      )}
    </div>
  );
}

/** Points right; `flip` turns it to point left. */
function Chevron({ flip }: { flip: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={`h-4 w-4 ${flip ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      <path d="M7.5 4.5 13 10l-5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
