"use client";

import { useDictionary } from "@/lib/dict/context";
import { useMember } from "@/lib/useMember";
import { useAccount } from "@/lib/useAccount";
import { favCityKey, favHotelKey, type Fav } from "@/lib/memberItems";
import { openJoin, showToast } from "@/components/member/events";
import { track } from "@/lib/analytics";

/**
 * ♡ on a city or a hotel. Signed in: kept in «مفضلتي» (account), on every
 * device. Signed out: the «create your account» sheet explains why it is
 * worth it.
 */
export default function FavButton({
  locale,
  fav,
  tone = "light",
  className = "",
}: {
  locale: string;
  fav: Fav;
  tone?: "light" | "dark" | "glass";
  className?: string;
}) {
  const t = useDictionary().member;
  const account = useAccount();
  const member = useMember();
  const key = fav.type === "city" ? favCityKey(fav.code, fav.slug) : favHotelKey(fav.name, fav.area);
  const on = member.isFav(key);
  if (account.status !== "ready") return null;

  async function click(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!member.signedIn) {
      track("join_prompt", { reason: "fav" });
      openJoin("fav");
      return;
    }
    const ok = await member.toggleFav(fav);
    if (!ok) return showToast({ text: t.failed });
    track("favourite", { action: on ? "remove" : "add", kind: fav.type });
    showToast(on ? { text: t.favRemoved } : { text: t.favSaved, href: `/${locale}/account#favs`, linkText: t.myFavs });
  }

  const look =
    tone === "glass"
      ? "bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-md hover:bg-white/25"
      : tone === "dark"
        ? "bg-navy-900 text-white hover:bg-navy-800"
        : "bg-white/95 text-navy-900 shadow-sm ring-1 ring-navy-900/10 hover:bg-white";
  return (
    <button
      type="button"
      onClick={click}
      aria-pressed={on}
      aria-label={on ? t.favRemove : t.favAdd}
      title={on ? t.favRemove : t.favAdd}
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition active:scale-95 ${look} ${className}`}
    >
      <svg viewBox="0 0 24 24" className={`h-5 w-5 ${on ? "fill-rose-500 stroke-rose-500" : "fill-none stroke-current"}`} strokeWidth="2" aria-hidden="true">
        <path strokeLinejoin="round" d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" />
      </svg>
    </button>
  );
}
