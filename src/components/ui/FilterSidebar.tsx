"use client";

import type { ReactNode } from "react";
import { useDictionary } from "@/lib/dict/context";
import type { SheetGroup } from "@/components/ui/FilterSheet";

/**
 * The same filter groups as FilterSheet, laid out as Booking does on a wide
 * screen (owner, 7 Nov: "the filters Booking puts on the right, in their right
 * place"): a column beside the list, every option a checkbox with the number
 * of hotels it would keep. The groups, counts and handlers are the sheet's —
 * one source of truth for both layouts, so they can never disagree.
 */
export default function FilterSidebar({
  label,
  groups,
  onClear,
  top,
  extraActive = 0,
}: {
  label: string;
  groups: SheetGroup[];
  onClear: () => void;
  /** Controls that are not checkboxes (the budget slider), first in the column. */
  top?: ReactNode;
  /** How many of those are set, for «مسح». */
  extraActive?: number;
}) {
  const t = useDictionary().filters;
  const active = groups.reduce((n, g) => n + g.value.length, 0) + extraActive;

  const pick = (g: SheetGroup, v: string | number) => {
    const on = g.value.includes(v);
    if (g.multi) g.onChange(on ? g.value.filter((x) => x !== v) : [...g.value, v]);
    else g.onChange(on ? [] : [v]);
  };

  return (
    <nav aria-label={label} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between gap-2 border-b border-mist-200 px-4 py-3">
        <h2 className="font-display text-base font-extrabold text-navy-950">{label}</h2>
        {active > 0 && (
          <button type="button" onClick={onClear} className="min-h-8 rounded-full px-2 text-xs font-extrabold text-sea-800 hover:underline">
            {t.clear}
          </button>
        )}
      </div>
      <div className="max-h-[calc(100svh-9rem)] divide-y divide-mist-200 overflow-y-auto">
        {top}
        {groups.map((g) => (
          <fieldset key={g.key} className="px-4 py-3">
            <legend className="mb-2 text-sm font-extrabold text-navy-950">
              {g.icon && <span aria-hidden="true">{g.icon} </span>}
              {g.title}
            </legend>
            {/* A long group scrolls inside itself, so the column never grows into a tall pile. */}
            <ul className={`space-y-0.5 ${g.options.length > 7 ? "max-h-56 overflow-y-auto pe-1" : ""}`}>
              {g.options.map((o) => {
                const on = g.value.includes(o.value);
                const empty = o.count === 0 && !on;
                return (
                  <li key={String(o.value)}>
                    <label className={`flex min-h-9 cursor-pointer items-center gap-2.5 rounded-lg px-1 text-sm font-semibold hover:bg-mist-50 ${empty ? "cursor-not-allowed opacity-40" : "text-navy-800"}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={empty}
                        onChange={() => pick(g, o.value)}
                        className="h-4 w-4 shrink-0 rounded border-mist-300 accent-navy-900"
                      />
                      <span className="min-w-0 flex-1 break-words">{o.label}</span>
                      {o.count !== undefined && <span className="shrink-0 text-xs font-semibold text-navy-400">{o.count}</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ))}
      </div>
    </nav>
  );
}
