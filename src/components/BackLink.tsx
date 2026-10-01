"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { hasPreviousPage, subscribe } from "@/lib/navHistory";

/**
 * A back button that goes back: to the page the visitor came from on this
 * site, with that page's scroll and state, like the browser's own back. Only
 * when they arrived here directly (a shared link, a search result) does it
 * take them to the fixed page above this one, under that page's name.
 */
export default function BackLink({
  href,
  label,
  backLabel,
  arrow,
  className,
}: {
  /** The page above this one, for a visitor who arrived here directly. */
  href: string;
  /** Its name ("All countries"). */
  label: string;
  /** What the button says when it returns to the previous page ("Back"). */
  backLabel: string;
  arrow: string;
  className?: string;
}) {
  const router = useRouter();
  // False on the server and until the layout has recorded this page.
  const canGoBack = useSyncExternalStore(
    subscribe,
    () => hasPreviousPage(window.location.pathname + window.location.search),
    () => false
  );

  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        if (!canGoBack || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        router.back();
      }}
    >
      <span aria-hidden="true">{arrow}</span> {canGoBack ? backLabel : label}
    </Link>
  );
}
