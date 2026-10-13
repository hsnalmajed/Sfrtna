"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import HotelCityInput from "@/components/HotelCityInput";
import Icon from "@/components/ui/Icon";
import type { Locale } from "@/lib/types";

/** The city box of «خدمات رحلتك»: a city, or a country's name to list its cities. */
export default function ServicesFinder({
  locale,
  initial,
  placeholder,
  label,
}: {
  locale: Locale;
  initial: string;
  placeholder: string;
  label: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  return (
    <div className="relative z-10 mt-6 rounded-3xl bg-white p-4 shadow-[var(--shadow-lift)] ring-1 ring-black/5 sm:-mt-8 sm:p-6">
      <label htmlFor="services-city" className="mb-2.5 flex items-center gap-2 font-display text-base font-extrabold text-navy-900">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sun-400 text-navy-950" aria-hidden="true">
          <Icon name="pin" className="h-4 w-4" />
        </span>
        {label}
      </label>
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute start-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-navy-400" />
      <HotelCityInput
        id="services-city"
        locale={locale}
        value={text}
        onType={setText}
        onPick={(city, code) => {
          setText(locale === "ar" ? city.nameAr : city.nameEn);
          router.push(`/${locale}/services?code=${code}&city=${city.slug}`);
        }}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-mist-200 bg-mist-50 py-3.5 pe-4 ps-11 text-base text-navy-950 focus:border-sun-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sun-400/20"
      />
      </div>
    </div>
  );
}
