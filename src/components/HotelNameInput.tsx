"use client";

import { useEffect, useRef, useState } from "react";
import type { HotelSuggestion } from "@/lib/providers/googlePlaces";

/**
 * The hotel's name, with Google's hotel names offered as the traveller types
 * (from the third letter, after a short pause). Picking one fills the name
 * and keeps where it is, so the price search finds the right hotel even when
 * the name is shared — there is a Holiday Inn in every city.
 *
 * Typing freely still works: with no suggestion picked, or no key on the
 * server, the field is the plain text box it always was.
 */
export default function HotelNameInput({
  id,
  value,
  onChange,
  onPick,
  className,
  placeholder,
  invalid,
}: {
  id: string;
  value: string;
  /** Every keystroke: the text, with no place attached. */
  onChange: (name: string) => void;
  /** A suggestion was picked. */
  onPick: (s: HotelSuggestion) => void;
  className: string;
  placeholder?: string;
  invalid?: boolean;
}) {
  const [items, setItems] = useState<HotelSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [typed, setTyped] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Ask only after the traveller pauses, and only for what they typed.
  useEffect(() => {
    const q = value.trim();
    if (!typed || q.length < 3) return;
    let live = true;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/hotel-suggest?q=${encodeURIComponent(q)}`);
        const body = (await res.json()) as { items?: HotelSuggestion[] };
        if (live) {
          setItems(body.items ?? []);
          setActive(-1);
        }
      } catch {
        if (live) setItems([]);
      }
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [value, typed]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const shown = open && value.trim().length >= 3 ? items : [];

  const pick = (s: HotelSuggestion) => {
    onPick(s);
    setTyped(false);
    setOpen(false);
    setItems([]);
  };

  return (
    <div className="relative" ref={box}>
      <input
        id={id}
        type="text"
        autoComplete="off"
        className={className}
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid}
        role="combobox"
        aria-expanded={shown.length > 0}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        onChange={(e) => {
          onChange(e.target.value);
          setTyped(true);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!shown.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % shown.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i <= 0 ? shown.length - 1 : i - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(shown[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {shown.length > 0 && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute inset-x-0 z-30 mt-1 max-h-72 overflow-auto rounded-xl bg-white py-1 shadow-lg ring-1 ring-black/10"
        >
          {shown.map((s, i) => (
            <li key={`${s.name}|${s.area}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                className={`block w-full px-4 py-2.5 text-start transition hover:bg-mist-100 ${i === active ? "bg-mist-100" : ""}`}
              >
                <span className="block text-sm font-bold text-navy-900" dir="auto">
                  {s.name}
                </span>
                {s.area && (
                  <span className="block text-xs text-navy-500" dir="auto">
                    {s.area}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
