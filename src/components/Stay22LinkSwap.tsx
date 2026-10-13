"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

/**
 * Stay22 LinkSwap: turns plain Booking/Agoda/Expedia/Trip.com links into
 * affiliate links. Loaded only on the result pages, where such links can
 * appear, and only after the page has loaded (owner, 13 Oct 2026: "the site
 * is slow and buttons don't respond on the phone" — measured on an emulated
 * phone, this script alone held the main thread 0.7 s on every page and
 * 3.9 s on the home page, while no link it could rewrite was there; our
 * hotel links already go through Allez and our redirects). The lmaID is a
 * public account id, not a secret.
 */
export default function Stay22LinkSwap() {
  const path = usePathname() || "";
  if (!/\/(results|hotel-results)(\/|$)/.test(path)) return null;
  return (
    <>
      <Script id="stay22-params" strategy="lazyOnload">
        {`window.Stay22=window.Stay22||{};window.Stay22.params={lmaID:'6abee21c6e93226dc14e814b'};`}
      </Script>
      <Script id="stay22-lma" src="https://scripts.stay22.com/letmeallez.js" strategy="lazyOnload" />
    </>
  );
}
