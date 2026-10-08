"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";

/**
 * The site's one filter control.
 *
 * Every list page used to filter its own way — a row of continent chips that
 * ran off the side of a phone with nothing to say there were more, a grid of
 * twelve month buttons that took half the screen, a checkbox, a native
 * select. Now each filter is one pill that says what it filters and what is
 * chosen ("القارة: آسيا ▾"); tapping it opens every option at once in a
 * sheet from the bottom of the screen (a small window on a wide one), so no
 * option is ever hidden and the page itself stays short.
 *
 * Single choice closes the sheet on the tap. Multiple choice (`multi`)
 * toggles options and closes on «تم»; the "all" option clears them.
 */
export interface FilterOption<T extends string | number> {
  value: T;
  label: string;
  /** How many results this option would keep — shown beside it. */
  count?: number;
  /** A small marker after the label ("الآن" on the current month). */
  note?: string;
}

const pillBase =
  "inline-flex max-w-full shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400";
const pillOff = "bg-white text-navy-800 ring-mist-300 hover:ring-navy-300";
const pillOn = "bg-navy-900 text-white ring-navy-900";

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 opacity-70" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}

export default function FilterPill<T extends string | number>(
  props: {
    icon?: string;
    /** What the filter is: "القارة". */
    label: string;
    options: FilterOption<T>[];
    /** The option that means "no filter", listed first ("كل القارات").
        Left out for a filter that always has a value (the month). */
    allLabel?: string;
    locale: Locale;
  } & (
    | { multi?: false; value: T | "all"; onChange: (v: T | "all") => void }
    | { multi: true; value: T[]; onChange: (v: T[]) => void }
  )
) {
  const [open, setOpen] = useState(false);
  const t = getDictionary(props.locale).filters;

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

  const chosen: T[] = props.multi ? props.value : props.value === "all" ? [] : [props.value];
  // A filter with no "all" is never "off": it always shows as chosen.
  const active = chosen.length > 0 && props.allLabel !== undefined;
  const summary = chosen.length === 0
    ? props.allLabel ?? ""
    : chosen.length === 1
      ? props.options.find((o) => o.value === chosen[0])?.label ?? ""
      : props.label;

  const pick = (v: T | "all") => {
    if (props.multi) {
      if (v === "all") props.onChange([]);
      else props.onChange(props.value.includes(v) ? props.value.filter((x) => x !== v) : [...props.value, v]);
    } else {
      props.onChange(v);
      setOpen(false);
    }
  };

  const optionClass = (on: boolean) =>
    `flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-start text-sm font-bold ring-1 transition ${
      on ? "bg-navy-900 text-white ring-navy-900" : "bg-mist-50 text-navy-800 ring-mist-200 hover:ring-navy-300"
    }`;

  const sheet = (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={props.label}>
      <button type="button" aria-label={t.close} onClick={() => setOpen(false)} className="absolute inset-0 bg-navy-990/60 backdrop-blur-[2px]" />
      <div className="relative max-h-[80svh] w-full overflow-y-auto rounded-t-3xl bg-white px-4 pb-[calc(1rem+var(--app-tabbar,0px))] pt-3 shadow-2xl sm:max-w-lg sm:rounded-3xl sm:pb-5">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-navy-900/15 sm:hidden" aria-hidden="true" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-display text-lg font-extrabold text-navy-900">
            {props.icon && <span aria-hidden="true">{props.icon} </span>}
            {props.label}
          </p>
          <button type="button" onClick={() => setOpen(false)} aria-label={t.close} className="flex h-9 w-9 items-center justify-center rounded-full bg-mist-100 text-navy-700 hover:bg-mist-200">
            ✕
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {props.allLabel && (
            <button type="button" aria-pressed={!active} onClick={() => pick("all")} className={`col-span-2 ${optionClass(!active)}`}>
              {props.allLabel}
              {!active && <span aria-hidden="true">✓</span>}
            </button>
          )}
          {props.options.map((o) => {
            const on = chosen.includes(o.value);
            return (
              <button key={String(o.value)} type="button" aria-pressed={on} onClick={() => pick(o.value)} className={optionClass(on)}>
                <span className="min-w-0">
                  <span className="block truncate">{o.label}</span>
                  {o.note && <span className={`text-[11px] font-extrabold ${on ? "text-sun-300" : "text-sun-700"}`}>{o.note}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {o.count !== undefined && <span className={`text-xs font-semibold ${on ? "text-white/70" : "text-navy-400"}`}>{o.count}</span>}
                  {on && <span aria-hidden="true">✓</span>}
                </span>
              </button>
            );
          })}
        </div>
        {props.multi && (
          <button type="button" onClick={() => setOpen(false)} className="mt-4 w-full rounded-xl bg-sun-400 px-4 py-3 text-sm font-extrabold text-navy-950 transition hover:bg-sun-300">
            {t.done}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* The pill shows the choice itself ("🌍 آسيا"); what it filters is
          the icon, the sheet's title and the button's accessible name. A
          multiple choice of several shows "الموسم · 2". */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={`${props.label}: ${summary}`}
        className={`${pillBase} ${active ? pillOn : pillOff}`}
      >
        {props.icon && <span aria-hidden="true">{props.icon}</span>}
        <span className="truncate">{chosen.length > 1 ? `${props.label} · ${chosen.length}` : summary}</span>
        <Chevron />
      </button>
      {open && createPortal(sheet, document.body)}
    </>
  );
}

/** An on/off filter that sits in the same row and looks like the pills. */
export function FilterToggle({ icon, label, on, onChange }: { icon?: string; label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" aria-pressed={on} onClick={() => onChange(!on)} className={`${pillBase} ${on ? pillOn : pillOff}`}>
      <span
        aria-hidden="true"
        className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${on ? "border-sun-400 bg-sun-400 text-navy-950" : "border-navy-300"}`}
      >
        {on ? "✓" : ""}
      </span>
      {icon && <span aria-hidden="true">{icon}</span>}
      {label}
    </button>
  );
}
