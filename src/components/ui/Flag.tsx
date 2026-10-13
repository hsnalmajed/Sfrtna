import { flagImageUrl } from "@/lib/visaProviders";

/**
 * A country flag as an image. Flag emoji show as two letters ("TR") on
 * Windows and in some Android WebViews, so the site never prints them
 * (found on the results page, 13 Oct). `size` is the flag's height in px;
 * width follows the 3:2 shape.
 */
export default function Flag({ code, size = 16, className = "" }: { code: string; size?: number; className?: string }) {
  if (!/^[A-Za-z]{2}$/.test(code)) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- flag CDN; image optimizer is off on Workers
    <img
      src={flagImageUrl(code, size > 24 ? 160 : 80)}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      width={Math.round(size * 1.5)}
      height={size}
      style={{ width: Math.round(size * 1.5), height: size }}
      className={`inline-block shrink-0 rounded-[3px] object-cover ring-1 ring-black/10 ${className}`}
    />
  );
}
