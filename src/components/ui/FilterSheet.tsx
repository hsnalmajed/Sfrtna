"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useDictionary } from "@/lib/dict/context";

/**
 * Many filters behind one button, as Booking does on a phone (owner, 28 Oct:
 * "mirror Booking"; 13 Oct: "never a tall pile"): «الفلاتر · 3» opens one
 * sheet with every group and the count each option would keep; the list
 * behind it changes as options are tapped, and the footer says how many
 * results are left.
 */
export interface SheetGroup {
  key: string;
  title: string;
  icon?: string;
  /** One choice (tap again to clear) or several. */
  multi?: boolean;
  options: { value: string | number; label: string; count?: number }[];
  value: (string | number)[];
  onChange: (v: (string | number)[]) => void;
}

export default function FilterSheet({
  label,
  groups,
  results,
  onClear,
}: {
  label: string;
  groups: SheetGroup[];
  /** "اعرض 12 فندق" — the footer button. */
  results: string;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const t = useDictionary().filters;
  const active = groups.reduce((n, g) => n + g.value.length, 0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const pick = (g: SheetGroup, v: string | number) => {
    const on = g.value.includes(v);
    if (g.multi) g.onChange(on ? g.value.filter((x) => x !== v) : [...g.value, v]);
    else g.onChange(on ? [] : [v]);
  };

  const sheet = (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={label}>
      <button type="button" aria-label={t.close} onClick={() => setOpen(false)} className="absolute inset-0 bg-navy-990/60 backdrop-blur-[2px]" />
      <div className="relative flex max-h-[88svh] w-full flex-col rounded-t-3xl bg-white shadow-2xl sm:max-w-xl sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-mist-200 px-4 pb-3 pt-3">
          <p className="font-display text-lg font-extrabold text-navy-900">{label}</p>
          <button type="button" onClick={() => setOpen(false)} aria-label={t.close} className="flex h-9 w-9 items-center justify-center rounded-full bg-mist-100 text-navy-700 hover:bg-mist-200">
            ✕
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {groups.map((g) => (
            <section key={g.key}>
              <h3 className="mb-2 text-sm font-extrabold text-navy-950">
                {g.icon && <span aria-hidden="true">{g.icon} </span>}
                {g.title}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {g.options.map((o) => {
                  const on = g.value.includes(o.value);
                  const empty = o.count === 0 && !on;
                  return (
                    <button
                      key={String(o.value)}
                      type="button"
                      aria-pressed={on}
                      disabled={empty}
                      onClick={() => pick(g, o.value)}
                      className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-start text-sm font-bold ring-1 transition disabled:opacity-40 ${
                        on ? "bg-navy-900 text-white ring-navy-900" : "bg-mist-50 text-navy-800 ring-mist-200 hover:ring-navy-300"
                      }`}
                    >
                      <span className="min-w-0 break-words">{o.label}</span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {o.count !== undefined && <span className={`text-xs font-semibold ${on ? "text-white/70" : "text-navy-400"}`}>{o.count}</span>}
                        {on && <span aria-hidden="true">✓</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <div className="flex items-center gap-2 border-t border-mist-200 px-4 pb-[calc(0.75rem+var(--app-tabbar,0px))] pt-3 sm:pb-4">
          <button type="button" onClick={onClear} disabled={!active} className="min-h-11 rounded-xl px-4 text-sm font-extrabold text-navy-800 ring-1 ring-mist-300 disabled:opacity-40">
            {t.clear}
          </button>
          <button type="button" onClick={() => setOpen(false)} className="min-h-11 flex-1 rounded-xl bg-sun-400 px-4 text-sm font-extrabold text-navy-950 transition hover:bg-sun-300">
            {results}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400 ${
          active ? "bg-navy-900 text-white ring-navy-900" : "bg-white text-navy-800 ring-mist-300 hover:ring-navy-300"
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path strokeLinecap="round" d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
          <circle cx="16" cy="6" r="2" />
          <circle cx="10" cy="12" r="2" />
          <circle cx="18" cy="18" r="2" />
        </svg>
        {label}
        {active > 0 && <span className="rounded-full bg-sun-400 px-1.5 text-xs font-extrabold text-navy-950">{active}</span>}
      </button>
      {open && createPortal(sheet, document.body)}
    </>
  );
}
