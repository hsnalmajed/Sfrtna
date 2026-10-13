"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import HotelCityInput from "@/components/HotelCityInput";
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
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 sm:p-5">
      <label htmlFor="services-city" className="mb-2 block text-sm font-bold text-navy-900">
        {label}
      </label>
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
        className="w-full rounded-xl border border-mist-200 bg-white px-4 py-3 text-base text-navy-950 focus:border-sea-400 focus:outline-none focus:ring-2 focus:ring-sea-200"
      />
    </div>
  );
}
