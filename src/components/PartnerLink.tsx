import type { AnchorHTMLAttributes } from "react";

/**
 * A link out to a booking partner: new tab, no referrer, marked sponsored.
 *
 * One place for every partner button, so the rules for leaving the site live
 * together. Expedia's URL is our own redirect (/api/go/expedia) rather than
 * expedia.com, because Stay22's LinkSwap rewrites Expedia links on the page
 * and would take the booking through its account instead of ours.
 */
export default function PartnerLink({
  partner,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { partner: string; href: string }) {
  return <a target="_blank" rel="noopener noreferrer sponsored" data-partner={partner} {...rest} />;
}
