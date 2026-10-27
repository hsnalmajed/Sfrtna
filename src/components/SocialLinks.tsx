import { SOCIAL_PROFILES, type SocialProfile } from "@/lib/social";
import { InstagramIcon, SnapchatIcon, TikTokIcon, XIcon } from "@/components/ui/BrandIcons";

const ICONS: Record<SocialProfile["id"], (p: { className?: string }) => React.ReactElement> = {
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  snapchat: SnapchatIcon,
  x: XIcon,
};

/**
 * Our accounts as round logo buttons (footer, contact page, the app's
 * «المزيد»). `tone` = the background they sit on.
 */
export default function SocialLinks({ tone = "dark", className = "" }: { tone?: "dark" | "light"; className?: string }) {
  const ring =
    tone === "dark"
      ? "text-white/85 ring-white/20 hover:text-sun-300 hover:ring-sun-300/60"
      : "bg-white text-navy-900 ring-navy-900/10 hover:text-sun-700 hover:ring-sun-400";
  return (
    <ul className={`flex flex-wrap gap-2.5 ${className}`}>
      {SOCIAL_PROFILES.map((p) => {
        const Icon = ICONS[p.id];
        return (
          <li key={p.id}>
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer me"
              aria-label={p.label}
              title={p.label}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full ring-1 transition ${ring}`}
            >
              <Icon />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
