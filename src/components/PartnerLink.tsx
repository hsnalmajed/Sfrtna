"use client";

import type { AnchorHTMLAttributes, MouseEvent } from "react";

/**
 * A link out to a booking partner.
 *
 * Stay22's LinkSwap (loaded site-wide in the layout) rewrites every
 * Booking/Agoda/Expedia/Trip.com link into its own affiliate link. For
 * Booking.com that is the point — it is how a Booking click pays us. For
 * Expedia it is not: we have our own Expedia account, and LinkSwap unwraps
 * our Expedia affiliate link and wraps the bare search in Stay22's instead,
 * so the commission goes through Stay22 and Stay22 keeps a share.
 *
 * So for Expedia the click opens the URL we built, read from React's props
 * rather than from the (rewritten) href. A middle-click or "open in new tab"
 * still follows the href, which then pays through Stay22 — less, never
 * nothing.
 */
const DIRECT_PARTNERS = new Set(["Expedia"]);

export default function PartnerLink({
  partner,
  href,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { partner: string; href: string }) {
  const direct = DIRECT_PARTNERS.has(partner);
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!direct || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    window.open(href, "_blank", "noopener,noreferrer");
  };
  return <a href={href} target="_blank" rel="noopener noreferrer sponsored" onClick={onClick} {...rest} />;
}
