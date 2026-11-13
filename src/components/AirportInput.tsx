"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/types";
import { airportLabel, findAirport, searchAirports, type Airport } from "@/lib/airports";
import { useDictionary } from "@/lib/dict/context";
import Icon from "@/components/ui/Icon";

const defaultInputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-800 shadow-sm focus:border-brand-600 focus:ring-2 focus:ring-brand-100 outline-none transition placeholder:text-gray-400 placeholder:font-normal";

/** The last airports picked on this device, newest first (owner, 13 Nov: editing a place was hard). */
const RECENT_KEY = "sfr-recent-airports";
/** Shown before anything is typed: where most of our travellers fly from and to. */
const POPULAR = ["RUH", "JED", "DMM", "MED", "DXB", "IST", "CAI", "LON", "PAR", "KUL", "BKK", "TBS", "BAK", "SAW"];

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}
function keepRecent(code: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([code, ...readRecent().filter((c) => c !== code)].slice(0, 5)));
  } catch {
    /* storage off: nothing to remember */
  }
}
const isPhone = () => typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;

/**
 * The departure or destination airport.
 *
 * Changing a place used to mean deleting the whole label letter by letter
 * before a new search could start (owner, 13 Nov). Now:
 *   - a tap empties the field in place (same page, no other screen — owner,
 *     13 Nov 20:01) and the list opens under it: the places picked lately on
 *     this device and the popular ones, so most changes are one tap;
 *   - typing narrows the list; leaving without a pick puts the old place back.
 */
export default function AirportInput({
  locale,
  value,
  onChange,
  placeholder,
  required,
  /** Overridden on the hero, where the field sits on a photograph. */
  className,
  /**
   * Read out in place of the visible label.
   *
   * The visible labels on both search forms are plain <label> elements with
   * no htmlFor, and the input they describe lives inside this component, so
   * nothing connects them: a screen reader announces "edit text" and the
   * question goes unasked. Passing the same words here is the smallest
   * honest fix that does not require threading ids through three layers.
   */
  ariaLabel,
}: {
  locale: Locale;
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const f = useDictionary().form;
  const [query, setQuery] = useState(() => (value ? airportLabel(value, locale) : ""));
  const [open, setOpen] = useState(false);
  // Typed since the field was opened: until then the list shows recent and popular places.
  const [typed, setTyped] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the visible text in sync when the value changes from outside this
  // component (edit-search prefill, swap, or the parent resetting the field).
  useEffect(() => {
    // What the traveller is typing is left alone: "dub" is not turned into
    // Dublin's label under their fingers.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery((prev) => (value && prev === value ? prev : value ? airportLabel(value, locale) : ""));
  }, [value, locale]);

  // Leaving the field without a pick: the place it had comes back.
  const close = useCallback(() => {
    setOpen(false);
    if (!typed) setQuery(value ? airportLabel(value, locale) : "");
    setTyped(false);
  }, [typed, value, locale]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open, close]);

  const starters = (): { title: string; list: Airport[] }[] => {
    const toAirports = (codes: string[]) =>
      codes.map((c) => findAirport(c)).filter((a): a is Airport => Boolean(a));
    const rec = toAirports(recent);
    const pop = toAirports(POPULAR.filter((c) => !recent.includes(c)));
    return [
      ...(rec.length ? [{ title: f.placeRecent, list: rec }] : []),
      { title: f.placePopular, list: pop },
    ];
  };

  const choose = (a: Airport) => {
    onChange(a.iata);
    setQuery(airportLabel(a.iata, locale));
    keepRecent(a.iata);
    setOpen(false);
    setTyped(false);
  };

  const row = (a: Airport, big = false) => (
    <button
      type="button"
      key={a.iata}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => choose(a)}
      className={`flex w-full items-center gap-3 px-4 text-start transition hover:bg-sun-50 ${big ? "py-3" : "py-2"}`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mist-100 text-xs font-black text-navy-700" dir="ltr">
        {a.iata}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-navy-900">
          {locale === "ar" ? a.cityAr : a.cityEn}
          <span className="ms-1.5 font-normal text-navy-500">· {locale === "ar" ? a.nameAr : a.nameEn}</span>
        </span>
        <span className="block truncate text-xs text-navy-500">{locale === "ar" ? a.countryAr : a.countryEn}</span>
      </span>
      {a.iata === value && <Icon name="check" className="h-4 w-4 shrink-0 text-emerald-600" />}
    </button>
  );

  const groups = (q: string, typedNow: boolean, big: boolean) => {
    if (typedNow && q.trim()) {
      const found = searchAirports(q, big ? 25 : 8);
      return found.length ? (
        <div>{found.map((a) => row(a, big))}</div>
      ) : (
        <p className="px-4 py-3 text-sm text-navy-600">{f.placeNone}</p>
      );
    }
    return starters().map((g) => (
      <div key={g.title}>
        <p className="bg-mist-50 px-4 py-1.5 text-xs font-extrabold text-navy-600">{g.title}</p>
        {g.list.map((a) => row(a, big))}
      </div>
    ));
  };

  const openPicker = () => {
    if (open) return;
    setRecent(readRecent());
    setTyped(false);
    setQuery("");
    setOpen(true);
    // Phone: the field to the top of the screen, so the list shows above the keyboard.
    if (isPhone()) window.setTimeout(() => inputRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 250);
  };

  return (
    <div className={`relative ${open ? "z-40" : ""}`} ref={containerRef}>
      <input
        ref={inputRef}
        className={`${className ?? defaultInputClass} scroll-mt-28 ${query && open ? "!pe-10" : ""}`}
        aria-label={ariaLabel ?? placeholder}
        value={query}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);
          setTyped(true);
          setOpen(true);
        }}
        onFocus={openPicker}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Tab") close();
          if (e.key === "Escape") {
            close();
            inputRef.current?.blur();
          }
          if (e.key === "Enter" && open && typed) {
            const first = searchAirports(query)[0];
            if (first) {
              e.preventDefault();
              choose(first);
            }
          }
        }}
      />
      {query && open && (
        <button
          type="button"
          aria-label={f.placeClear}
          title={f.placeClear}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setQuery("");
            setTyped(false);
            inputRef.current?.focus();
          }}
          className="absolute end-2 top-1/2 z-20 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full bg-mist-200/80 text-sm font-black text-navy-700 hover:bg-mist-300"
        >
          ✕
        </button>
      )}
      {open && (
        <div className="absolute start-0 z-30 mt-1 max-h-80 w-full min-w-[19rem] overflow-auto rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
          {groups(query, typed, isPhone())}
        </div>
      )}

    </div>
  );
}
