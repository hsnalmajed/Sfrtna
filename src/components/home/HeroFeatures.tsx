import Icon, { type IconName } from "@/components/ui/Icon";

/**
 * Everything the site does, under the home headline.
 *
 * The owner wanted the old one-sentence subtitle replaced by what Sfrtna
 * offers, grouped the way the site groups it (the seven the owner picked on 16 Nov,
 * plus «خريطتي» on 18 Nov), each with its own icon, and without boxes or pills
 * around them. Nothing moves (owner, 16 Nov): two rows everywhere, four and
 * four; phones use shorter names so two rows fit at a readable size.
 */
const ICONS: IconName[] = [
  "pin", "map", "sun", "idCard", "calendar", "ticket", "calculator", "globe",
];

function Item({ icon, label, detail, small }: { icon: IconName; label: string; detail?: string; small?: boolean }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap ${small ? "gap-1" : "gap-1.5"}`}>
      <Icon name={icon} className={`${small ? "h-3.5 w-3.5" : "h-4 w-4"} text-sun-400`} strokeWidth={1.75} />
      {label}
      {detail ? <span className="font-normal text-white/65">({detail})</span> : null}
    </span>
  );
}

export default function HeroFeatures({
  labels,
  details,
  shortLabels,
}: {
  labels: readonly string[];
  /** What a wide screen adds in brackets after a name. */
  details: readonly string[];
  /** Phone names, short enough for two rows (owner, 16 Nov). */
  shortLabels: readonly string[];
}) {
  const items = labels.map((label, i) => ({ label, detail: details[i] || undefined, icon: ICONS[i] ?? "check" }));
  const half = Math.ceil(items.length / 2);
  const short = items.map((it, i) => ({ ...it, detail: undefined, label: shortLabels[i] ?? it.label }));
  return (
    <>
      {/* Two balanced rows on wide screens (four, then three), not a wrap
          that leaves one item alone on the second line. */}
      {/* Still, readable rows everywhere (owner, 16 Nov: nothing moving).
          Wide screens: four, then three. Phones: see below. */}
      <div className="mt-4 hidden flex-col items-center gap-y-2.5 text-sm font-medium text-white/90 drop-shadow-[0_1px_8px_rgba(4,24,47,0.95)] sm:flex">
        {[items.slice(0, half), items.slice(half)].map((row, r) => (
          <p key={r} className="flex flex-wrap justify-center gap-x-6 gap-y-2.5">
            {row.map((it) => (
              <Item key={it.label} icon={it.icon} label={it.label} detail={it.detail} />
            ))}
          </p>
        ))}
      </div>
      {/* One wrapping row, filled in order: four then three when they fit,
          otherwise three, three, one — never a lone item in the middle
          (owner, 16 Nov). The type follows the screen width so four fit
          on most phones. */}
      <p className="mt-3 flex max-w-[24rem] flex-wrap justify-center gap-x-2.5 gap-y-2 text-[clamp(11px,3.1vw,12.5px)] font-medium text-white/90 drop-shadow-[0_1px_8px_rgba(4,24,47,0.95)] sm:hidden">
        {short.map((it) => (
          <Item key={it.label} icon={it.icon} label={it.label} small />
        ))}
      </p>
    </>
  );
}
