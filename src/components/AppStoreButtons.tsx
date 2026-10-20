import type { Locale } from "@/lib/types";
import { ANDROID_APP_URL, IOS_APP_URL } from "@/lib/appLinks";

/** The two store buttons (footer). A store with no listing yet says "coming soon". */
export default function AppStoreButtons({ locale, title, soon }: { locale: Locale; title: string; soon: string }) {
  const stores = [
    { key: "android", url: ANDROID_APP_URL, top: locale === "ar" ? "احصل عليه من" : "Get it on", name: "Google Play", icon: "▶" },
    { key: "ios", url: IOS_APP_URL, top: locale === "ar" ? "حمّله من" : "Download on the", name: "App Store", icon: "📱" },
  ];
  return (
    <div>
      <p className="mb-3 text-2xs font-bold uppercase tracking-[0.18em] text-sun-400/85">{title}</p>
      <div className="flex flex-wrap gap-2.5">
        {stores.map((s) => {
          const body = (
            <>
              <span aria-hidden="true" className="text-xl leading-none">
                {s.icon}
              </span>
              <span className="text-start leading-tight">
                <span className="block text-[10px] font-semibold text-white/70">{s.url ? s.top : soon}</span>
                <span className="block text-sm font-extrabold" dir="ltr">
                  {s.name}
                </span>
              </span>
            </>
          );
          const cls = "inline-flex min-w-[9.5rem] items-center gap-2.5 rounded-xl px-3.5 py-2 ring-1 transition";
          return s.url ? (
            <a
              key={s.key}
              href={s.url}
              target="_blank"
              rel="noopener"
              data-partner={`app-${s.key}`}
              className={`${cls} bg-black text-white ring-white/25 hover:ring-sun-400`}
            >
              {body}
            </a>
          ) : (
            <span key={s.key} aria-disabled="true" className={`${cls} cursor-default bg-white/[0.04] text-white/60 ring-white/10`}>
              {body}
            </span>
          );
        })}
      </div>
    </div>
  );
}
