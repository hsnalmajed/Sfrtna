"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A text field that must end in a pick from a list.
 *
 * The hotel's name and the hotel city are typed by people who will misspell
 * them, and a misspelled name sends the price search to the wrong hotel or
 * to none. So the field offers a list as they type and the form only accepts
 * what was picked from it; typing again un-picks. `load` returns the list for
 * what was typed — a local filter for cities, a server call for hotels —
 * and runs after a short pause, never for fewer than `minChars` letters.
 */
export interface Suggestion {
  key: string;
  title: string;
  subtitle?: string;
}

export default function SuggestInput({
  id,
  value,
  onType,
  onPick,
  load,
  minChars = 2,
  delayMs = 0,
  className,
  placeholder,
  invalid,
  icon,
  emptyText,
  loadingText,
}: {
  id: string;
  value: string;
  /** Every keystroke: the text, no longer a pick. */
  onType: (text: string) => void;
  onPick: (s: Suggestion) => void;
  load: (query: string) => Promise<Suggestion[]> | Suggestion[];
  minChars?: number;
  delayMs?: number;
  className: string;
  placeholder?: string;
  invalid?: boolean;
  /** Shown before each row, e.g. a hotel or pin glyph. */
  icon?: ReactNode;
  /** Shown when the list for what was typed came back empty. */
  emptyText?: ReactNode;
  loadingText?: string;
}) {
  const [items, setItems] = useState<Suggestion[]>([]);
  const [state, setState] = useState<"idle" | "loading" | "ready">("idle");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [typed, setTyped] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const loader = useRef(load);
  useEffect(() => {
    loader.current = load;
  }, [load]);

  useEffect(() => {
    const q = value.trim();
    if (!typed || q.length < minChars) return;
    let live = true;
    const timer = setTimeout(async () => {
      if (live) setState("loading");
      try {
        const list = await loader.current(q);
        if (live) {
          setItems(list);
          setActive(list.length ? 0 : -1);
          setState("ready");
        }
      } catch {
        if (live) {
          setItems([]);
          setState("ready");
        }
      }
    }, delayMs);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [value, typed, minChars, delayMs]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const long = value.trim().length >= minChars;
  const show = open && typed && long;
  const list = show && state === "ready" ? items : [];

  const pick = (s: Suggestion) => {
    onPick(s);
    setTyped(false);
    setOpen(false);
    setItems([]);
    setState("idle");
  };

  return (
    <div className="relative" ref={box}>
      <input
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        className={className}
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid}
        role="combobox"
        aria-expanded={list.length > 0}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        onChange={(e) => {
          onType(e.target.value);
          setTyped(true);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") return setOpen(false);
          if (!list.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => (i + 1) % list.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => (i <= 0 ? list.length - 1 : i - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(list[active]);
          }
        }}
      />
      {show && (state === "loading" || state === "ready") && (
        <div className="absolute inset-x-0 z-40 mt-1.5 overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-black/10">
          {state === "loading" && (
            <p className="flex items-center gap-2 px-4 py-3 text-sm text-navy-500">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-navy-200 border-t-sun-500" aria-hidden="true" />
              {loadingText}
            </p>
          )}
          {state === "ready" && list.length === 0 && emptyText && (
            <div className="px-4 py-3 text-sm text-navy-700">{emptyText}</div>
          )}
          {list.length > 0 && (
            <ul id={`${id}-list`} role="listbox" className="max-h-80 overflow-auto py-1.5">
              {list.map((s, i) => (
                <li key={s.key} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(s)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-start transition ${
                      i === active ? "bg-sun-50" : ""
                    }`}
                  >
                    {icon && (
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-mist-100 text-navy-600">{icon}</span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-navy-900">
                        <bdi>{s.title}</bdi>
                      </span>
                      {s.subtitle && (
                        <span className="block truncate text-xs text-navy-500">
                          <bdi>{s.subtitle}</bdi>
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
