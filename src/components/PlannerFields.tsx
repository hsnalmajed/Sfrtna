"use client";

import type { Locale } from "@/lib/types";
import Icon, { type IconName } from "@/components/ui/Icon";
import CurrencySelect from "@/components/CurrencySelect";

/**
 * The furniture both homepage planners share.
 *
 * Flights and hotels are two forms now, not one form with a switch in it —
 * but they sit in the same panel, one tap apart, and a label, a switch or a
 * budget box that looked different in each would make the second one feel
 * like another site. So the pieces live here, once.
 */

/**
 * Digits as a Saudi keyboard types them.
 *
 * An Arabic keyboard layout types ٥٠٠٠, not 5000, and a number field that
 * silently rejects those digits looks broken to exactly the audience this
 * site is for. Arabic-Indic and Persian digits are folded to Western ones,
 * and anything that isn't a digit is dropped.
 */
export function toDigits(raw: string): string {
  return raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "")
    .replace(/^0+(?=\d)/, "")
    .slice(0, 9);
}

export function nightsBetween(a: string, b: string) {
  const t1 = new Date(a).getTime();
  const t2 = new Date(b).getTime();
  return Math.max(1, Math.round((t2 - t1) / (1000 * 60 * 60 * 24)));
}

/** A field's caption, with the icon that says what the field is. */
export function FieldLabel({
  icon,
  children,
  htmlFor,
  dark,
}: {
  icon: IconName;
  children: React.ReactNode;
  htmlFor?: string;
  dark: boolean;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`mb-1.5 flex items-center gap-1.5 text-xs font-bold ${dark ? "text-white/70" : "text-navy-700"}`}
    >
      <Icon name={icon} className={`h-3.5 w-3.5 ${dark ? "text-sun-400" : "text-sun-600"}`} />
      {children}
    </label>
  );
}

/**
 * An on/off preference, drawn as a switch.
 *
 * A switch says "this changes a setting" where a checkbox says "tick the
 * ones that apply", and these are settings. Underneath it is still a real
 * checkbox, so keyboards and screen readers get the native behaviour.
 */
export function Toggle({
  id,
  checked,
  onChange,
  icon,
  children,
  dark,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: IconName;
  children: React.ReactNode;
  dark: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-center gap-2.5 text-sm ${dark ? "text-white/85" : "text-navy-800"}`}
    >
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={`relative h-5 w-9 shrink-0 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-sun-400 peer-focus-visible:ring-offset-2 ${
          dark ? "peer-focus-visible:ring-offset-navy-990" : ""
        } ${checked ? "bg-sun-400" : dark ? "bg-white/20" : "bg-mist-300"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
            checked ? "start-[1.125rem]" : "start-0.5"
          }`}
        />
      </span>
      <Icon name={icon} className={`h-4 w-4 ${dark ? "text-white/60" : "text-navy-500"}`} />
      <span className="leading-snug">{children}</span>
    </label>
  );
}

/**
 * Amount and currency, as one answer in one box.
 *
 * The amount is grouped as it is typed (5,000 rather than 5000) and accepts
 * the digits an Arabic keyboard produces.
 */
export function BudgetInput({
  id,
  locale,
  dark,
  label,
  placeholder,
  currencyLabel,
  value,
  onChange,
  currency,
  onCurrencyChange,
  error,
}: {
  id: string;
  locale: Locale;
  dark: boolean;
  label: string;
  placeholder: string;
  currencyLabel: string;
  value: string;
  onChange: (digits: string) => void;
  currency: string;
  onCurrencyChange: (c: string) => void;
  error?: string;
}) {
  return (
    <div data-field="budget">
      <FieldLabel dark={dark} icon="wallet" htmlFor={id}>
        {label}
      </FieldLabel>
      <div
        className={`flex items-stretch overflow-hidden rounded-xl border transition focus-within:ring-2 ${
          dark
            ? "border-white/20 bg-white/10 backdrop-blur-md focus-within:border-sun-400 focus-within:ring-sun-400/30 hover:border-white/30"
            : "border-gray-200 bg-white shadow-sm focus-within:border-brand-500 focus-within:ring-brand-100"
        } ${error ? (dark ? "border-rose-300" : "border-red-400") : ""}`}
      >
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          dir="ltr"
          className={`min-w-0 flex-1 bg-transparent px-4 py-2.75 text-sm font-semibold tabular-nums outline-none ${
            dark
              ? "text-white placeholder:font-normal placeholder:text-white/45"
              : "text-gray-800 placeholder:font-normal placeholder:text-gray-400"
          } ${locale === "ar" ? "text-right" : "text-left"}`}
          value={value ? Number(value).toLocaleString("en-US") : ""}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          onChange={(e) => onChange(toDigits(e.target.value))}
        />
        <CurrencySelect
          className={`cursor-pointer border-s bg-transparent px-2.5 text-sm font-bold outline-none ${
            dark ? "border-white/15 text-white" : "border-gray-200 text-navy-800"
          }`}
          value={currency}
          onChange={onCurrencyChange}
          label={currencyLabel}
        />
      </div>
      {error && (
        <p role="alert" className={`mt-1.5 text-xs font-semibold ${dark ? "text-rose-300" : "text-red-600"}`}>
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The two tabs on the panel's top edge — "I know where" / "suggest one".
 *
 * Lifted half out of the panel so they read as the thing everything below
 * depends on. Solid, not translucent: they overlap the photograph and have
 * to stay legible over any of them.
 */
export function EdgeTabs<T extends string>({
  dark,
  label,
  value,
  onChange,
  tabs,
}: {
  dark: boolean;
  label: string;
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; icon: IconName; title: string; hint: string }[];
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={`relative z-10 mx-auto -mt-9 mb-6 grid w-full max-w-xl grid-cols-2 gap-1.5 rounded-2xl p-1.5 shadow-[0_12px_32px_-12px_rgba(4,24,47,0.6)] ring-1 ${
        dark ? "bg-navy-990 ring-white/15" : "bg-white ring-mist-200"
      }`}
    >
      {tabs.map((t) => {
        const active = value === t.value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={`flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-start transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun-400 sm:px-4 ${
              active
                ? "bg-sun-400 text-navy-950 shadow-[var(--shadow-sun)]"
                : dark
                  ? "text-white/80 hover:bg-white/10 hover:text-white"
                  : "text-navy-700 hover:bg-mist-50"
            }`}
          >
            <span
              className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-full sm:flex ${
                active ? "bg-navy-950/10" : dark ? "bg-white/10" : "bg-mist-100"
              }`}
            >
              <Icon name={t.icon} className="h-[1.125rem] w-[1.125rem]" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-extrabold sm:text-base">
                <Icon name={t.icon} className="h-4 w-4 sm:hidden" />
                {t.title}
              </span>
              <span
                className={`hidden text-2xs leading-snug sm:block sm:truncate sm:text-xs ${active ? "text-navy-950/70" : "opacity-60"}`}
              >
                {t.hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
