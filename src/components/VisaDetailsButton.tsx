"use client";

import { useState, type ReactNode } from "react";
import type { Locale } from "@/lib/types";
import VisaRequirementsDialog from "@/components/VisaRequirementsDialog";

/**
 * "Visa details" without leaving the page: the requirements and the ways to
 * apply open in a window over it, and closing it leaves the visitor where
 * they were.
 */
export default function VisaDetailsButton({
  countryCode,
  locale,
  className,
  children,
}: {
  countryCode: string;
  locale: Locale;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className} aria-haspopup="dialog">
        {children}
      </button>
      {open && <VisaRequirementsDialog countryCode={countryCode} locale={locale} onClose={() => setOpen(false)} />}
    </>
  );
}
