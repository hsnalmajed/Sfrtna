import Image from "next/image";

/**
 * The Sfrtna logo — the owner's artwork, used exactly as supplied.
 *
 * The master file lives in /brand/sfrtna-logo-master.png. Nothing here is
 * redrawn, recoloured or re-set. Two files are derived from it, and both
 * derivations are mechanical:
 *
 *   "full"  the whole signature — pin, wordmark and «لكل سفره حكاية» — with
 *           only the empty white margin trimmed off and the file scaled to
 *           roughly three times its largest display size.
 *   "mark"  the pin with its sun, trail and plane, lifted out of the same
 *           artwork for the square slots a wordmark cannot fill: the browser
 *           tab, the home-screen icon, link previews. The plane and the
 *           wordmark are separated by a clean 24px gap in the master, so the
 *           icon comes out whole without any of its own pixels being touched.
 *
 * The artwork is on white and the wordmark is navy, so on dark surfaces it
 * sits on a white card rather than being recoloured. Reversing it would also
 * repaint the navy inside the pin, and the mark would stop being the mark.
 */
// Intrinsic sizes match the files on disk. Images are served unoptimized on
// Workers (see next.config.ts), so the browser performs every downscale.
const SOURCES = {
  // 360 px wide (3× its largest display, h-12) as WebP: 9 KB instead of 175 KB.
  full: { src: "/sfrtna-logo-360.webp", width: 360, height: 144 },
  mark: { src: "/sfrtna-mark.png", width: 256, height: 256 },
} as const;

export default function Logo({
  variant = "full",
  className = "",
  priority = false,
  alt,
}: {
  variant?: keyof typeof SOURCES;
  className?: string;
  priority?: boolean;
  alt: string;
}) {
  const s = SOURCES[variant];
  return (
    <Image
      src={s.src}
      alt={alt}
      width={s.width}
      height={s.height}
      priority={priority}
      className={className}
    />
  );
}
