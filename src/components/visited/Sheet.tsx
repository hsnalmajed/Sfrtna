"use client";

import { useEffect, type ReactNode } from "react";

/**
 * A bottom sheet (phone) / centred panel (desktop) over the map.
 * `tall` = nearly full height (lists); otherwise ~70% so the map stays seen.
 */
export default function Sheet({
  title,
  onClose,
  onBack,
  closeLabel,
  backLabel,
  tall,
  children,
  footer,
}: {
  title: ReactNode;
  onClose: () => void;
  onBack?: () => void;
  closeLabel: string;
  backLabel?: string;
  tall?: boolean;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      html.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label={closeLabel} onClick={onClose} className="absolute inset-0 bg-[#020c19]/60 backdrop-blur-[2px]" />
      <div
        className={`sfr-sheet relative flex w-full max-w-xl flex-col overflow-hidden rounded-t-[1.75rem] bg-white shadow-2xl sm:rounded-[1.75rem] ${
          tall ? "h-[92svh] sm:h-[80vh]" : "max-h-[78svh] sm:max-h-[80vh]"
        }`}
      >
        <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-navy-900/15 sm:hidden" aria-hidden="true" />
        <div className="flex shrink-0 items-center gap-2 px-4 pb-2 pt-2 sm:pt-4">
          {onBack && (
            <button type="button" onClick={onBack} aria-label={backLabel} className="grid h-11 w-11 place-items-center rounded-full text-xl text-navy-900/70 hover:bg-mist-100">
              <span className="rtl:rotate-180" aria-hidden="true">‹</span>
            </button>
          )}
          <h2 className="min-w-0 flex-1 truncate font-display text-lg font-extrabold text-navy-950">{title}</h2>
          <button type="button" onClick={onClose} aria-label={closeLabel} className="grid h-11 w-11 place-items-center rounded-full text-2xl leading-none text-navy-900/50 hover:bg-mist-100">
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-navy-900/10 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">{footer}</div>}
      </div>
    </div>
  );
}
