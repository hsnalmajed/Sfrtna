"use client";

import { useDictionary } from "@/lib/dict/context";

/** What an account gives the traveller — every line something the site does today. */
export default function JoinBenefits({ compact = false }: { compact?: boolean }) {
  const t = useDictionary().member;
  return (
    <ul className={compact ? "space-y-2.5" : "grid gap-3 sm:grid-cols-2"}>
      {t.benefits.map((b) => (
        <li key={b.title} className={`flex gap-3 ${compact ? "" : "rounded-2xl bg-mist-50 p-3.5 ring-1 ring-navy-900/5"}`}>
          <span className="text-xl leading-none" aria-hidden="true">
            {b.icon}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-extrabold text-navy-900">{b.title}</span>
            <span className="block text-xs leading-relaxed text-navy-600">{b.body}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
