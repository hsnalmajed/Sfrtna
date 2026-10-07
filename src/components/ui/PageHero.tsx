import Photo from "@/components/Photo";

/**
 * The one hero every inner page wears.
 *
 * Before this existed each page invented its own banner — a flat navy bar
 * here, a gradient there — which is the single biggest reason the site read
 * as a set of unrelated screens. Now the shape is fixed: a real photograph
 * of the place, the navy scrim, an eyebrow, the title, and an optional row
 * of facts. Only the picture and the words change.
 *
 * `photo` is optional on purpose. Wikipedia is the source for most of these
 * images and it goes down; when it does the hero falls back to a navy
 * gradient with the same proportions, so the page loses its picture without
 * losing its composition.
 *
 * `photoSrcSet` and `photoCredit` travel together and both come from
 * sectionHero(): a hero is the page's largest paint, so it is worth handing a
 * 4K screen the 4K rendering, and the licences these photographs carry are
 * conditional on naming the photographer. Neither is optional in practice —
 * they are optional in the type only because the country pages still pass a
 * discovered Wikipedia photo, which has no credit metadata to print.
 */
export default function PageHero({
  photo,
  photoSrcSet,
  photoCredit,
  eyebrow,
  title,
  subtitle,
  facts,
  children,
  size = "md",
  align = "start",
}: {
  photo?: string;
  /** Larger renderings by width, for displays that can show them. */
  photoSrcSet?: string;
  /** Attribution, printed small in the corner and linked to the file page. */
  photoCredit?: { text: string; href: string };
  eyebrow?: string;
  title: string;
  subtitle?: string;
  facts?: { label: string; value: string }[];
  children?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  align?: "start" | "center";
}) {
  // Heights in svh rather than rem. A hero measured in rem is a fixed slab
  // that happens to look right on a laptop: on a phone it eats the whole
  // screen and on a 4K monitor it becomes a letterbox. Measured against the
  // viewport it keeps the same proportion of the first screen everywhere,
  // and the rem floor stops it collapsing in a short browser window.
  const heights = {
    sm: "min-h-[15rem] sm:min-h-[34svh]",
    md: "min-h-[18rem] sm:min-h-[46svh]",
    lg: "min-h-[22rem] sm:min-h-[60svh]",
  } as const;

  return (
    <section className={`relative isolate flex ${heights[size]} items-end overflow-hidden bg-navy-990`}>
      <Photo
        placeholder
        src={photo}
        // The hero is on screen before anything else is; lazy-loading it makes
        // the browser wait for layout before it will even ask for the file.
        priority
        srcSet={photoSrcSet}
        sizes="100vw"
        className="absolute inset-0 -z-10 h-full w-full object-cover"
        fallback={
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(120%_90%_at_70%_0%,var(--navy-700),var(--navy-990))]" />
        }
      />
      {/* The softer scrim once there is a photograph worth seeing behind the
          type. The stronger one stays for the fallback and for the country
          pages, where the picture is incidental and the words are the point. */}
      <div className={`${photoSrcSet ? "scrim-soft" : "scrim"} absolute inset-0 -z-10`} />

      <div
        className={`mx-auto w-full max-w-6xl px-4 pb-8 pt-24 sm:px-6 sm:pb-11 ${
          align === "center" ? "text-center" : ""
        }`}
      >
        {eyebrow && <p className="eyebrow eyebrow-light mb-2.5">{eyebrow}</p>}
        <h1 className="max-w-4xl font-display text-h1 font-extrabold text-white drop-shadow-[0_2px_12px_rgba(4,24,47,0.5)]">
          {title}
        </h1>
        {subtitle && (
          <p
            className={`mt-3.5 max-w-2xl text-lead text-white/85 drop-shadow-[0_1px_10px_rgba(4,24,47,0.75)] ${
              align === "center" ? "mx-auto" : ""
            }`}
          >
            {subtitle}
          </p>
        )}

        {/* The facts sit on their own dark plate rather than floating on the
            photograph. Numbers this size need a baseline to read against —
            over a busy picture they were doing the work of decoration. */}
        {facts && facts.length > 0 && (
          <div
            className={`mt-7 inline-flex flex-wrap items-center gap-x-7 gap-y-4 rounded-2xl bg-navy-990/45 px-5 py-3.5 ring-1 ring-white/10 backdrop-blur-md ${
              align === "center" ? "justify-center" : ""
            }`}
          >
            {facts.map((f, i) => (
              <div key={f.label} className="flex items-center gap-7">
                {i > 0 && <span className="h-8 w-px bg-white/15" aria-hidden="true" />}
                <div>
                  <p className="font-display text-h2 font-extrabold leading-none text-sun-400">
                    {f.value}
                  </p>
                  <p className="mt-1.5 text-2xs font-semibold text-white/60">{f.label}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {children && <div className="mt-6">{children}</div>}
      </div>

      {/* Named because the licence says so, and small because the page is not
          about the photographer. */}
      {photoCredit && (
        <a
          href={photoCredit.href}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-1.5 end-3 z-10 text-2xs text-white/45 transition hover:text-white/75"
        >
          {photoCredit.text}
        </a>
      )}
    </section>
  );
}
