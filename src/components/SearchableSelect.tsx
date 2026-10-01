"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchMatches } from "@/lib/search";

export interface SearchableOption {
  value: string;
  /** Main line — what the reader is looking for. */
  label: string;
  /** Optional second line, e.g. the country a city belongs to. */
  hint?: string;
  /** Extra words this option should match on but doesn't display. */
  keywords?: string;
}

/**
 * A dropdown you can type into.
 *
 * A native `<select>` with fifty currencies in it means scrolling a list to
 * find "Turkish Lira" — on a phone that's a long spin through an opaque
 * column. This opens to a search box, so a visitor who knows what they want
 * types three letters and is done, and a visitor who doesn't can still scroll
 * the whole list exactly as before.
 */
export default function SearchableSelect({
  value,
  options,
  onChange,
  label,
  searchPlaceholder,
  emptyText,
  placeholder,
  labelClassName = "text-gray-700",
  buttonClassName = "",
}: {
  value: string;
  options: SearchableOption[];
  onChange: (value: string) => void;
  label: string;
  searchPlaceholder: string;
  emptyText: string;
  /** Shown on the closed button when nothing is selected yet. */
  placeholder?: string;
  /** The label's colour — light on a dark panel. */
  labelClassName?: string;
  /** Extra classes for the closed button (a taller one, say). */
  buttonClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return options;
    return options.filter((o) => searchMatches([o.value, o.label, o.hint, o.keywords], q));
  }, [options, query]);

  // Clicking anywhere else closes the list — the behaviour every dropdown on
  // the web has, and its absence is immediately noticeable.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  // Opening puts the cursor straight in the search box, so the visitor can
  // start typing without a second tap.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function choose(next: string) {
    onChange(next);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className="relative" ref={containerRef}>
      <span className={`mb-1.5 block text-sm font-bold ${labelClassName}`}>{label}</span>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-start text-sm font-semibold text-gray-800 outline-none transition hover:border-brand-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 ${buttonClassName}`}
      >
        <span className={`truncate ${selected || value ? "" : "font-normal text-gray-400"}`}>
          {selected?.label || value || placeholder}
        </span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="border-b border-gray-100 p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                // Enter takes the top match, so a confident typist never has
                // to move to the mouse.
                if (e.key === "Enter" && filtered.length > 0) {
                  e.preventDefault();
                  choose(filtered[0].value);
                }
              }}
              placeholder={searchPlaceholder}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 placeholder:text-gray-400"
            />
          </div>

          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-sm text-gray-400">{emptyText}</li>
            )}
            {filtered.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => choose(option.value)}
                  className={`block w-full px-4 py-2.5 text-start text-sm transition hover:bg-brand-50 ${
                    option.value === value ? "bg-brand-50 font-bold text-brand-900" : "text-gray-700"
                  }`}
                >
                  <span className="block truncate">{option.label}</span>
                  {option.hint && <span className="block truncate text-xs text-gray-400">{option.hint}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
