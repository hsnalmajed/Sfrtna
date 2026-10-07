import { preconnect } from "react-dom";
import type { Metadata } from "next";
import "../globals.css";
import { getDictionary } from "@/lib/dictionaries";
import type { Locale } from "@/lib/types";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NavTracker from "@/components/NavTracker";
import Analytics from "@/components/Analytics";
import AppTabBar from "@/components/AppTabBar";
import Script from "next/script";

export async function generateStaticParams() {
  return [{ locale: "ar" }, { locale: "en" }];
}

export async function generateMetadata(
  { params }: LayoutProps<"/[locale]">
): Promise<Metadata> {
  const { locale } = await params;
  const dict = getDictionary(locale as Locale);
  // Both spellings of the name, in the reader's language first. Someone who
  // heard of the site will type سفرتنا or Sfrtna depending on the keyboard in
  // front of them, and the homepage title is the strongest signal there is
  // that either one means this site.
  const bothNames =
    locale === "ar"
      ? `${dict.siteNameAr} ${dict.siteNameEn}`
      : `${dict.siteNameEn} ${dict.siteNameAr}`;
  return {
    title: `${bothNames} — ${dict.slogan}`,
    description: dict.tagline,
    applicationName: dict.siteNameEn,
    icons: {
      icon: [
        { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: "/favicon-192.png",
      shortcut: "/favicon.ico",
    },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  const loc = (locale === "en" ? "en" : "ar") as Locale;
  const dict = getDictionary(loc);
  // Every card photo comes from Pexels' image servers: opening the
  // connection while the page is still arriving saves a round trip (DNS,
  // TLS) before the first picture can start.
  preconnect("https://images.pexels.com", { crossOrigin: "anonymous" });

  return (
    // suppressHydrationWarning: the script below may add "in-app" to this
    // element's class before React hydrates it — on purpose.
    <html lang={loc} dir={dict.dir} className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/*
          Inside the phone app (mobile/, user agent "SfrtnaApp/…") the page
          wears app chrome — bottom tab bar, compact header, no footer — set
          by CSS under html.in-app (globals.css). Decided here, before the
          first paint, because the edge HTML cache is keyed by URL only: the
          server cannot send the app a different page, and deciding after
          hydration would make every page jump.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(navigator.userAgent.indexOf("SfrtnaApp/")>-1)document.documentElement.classList.add("in-app")}catch(e){}`,
          }}
        />
      </head>
      {/*
        No Travelpayouts Drive script. It was loaded site-wide and opened
        Klook pages over ours on click (seen 29 Sep 2026); a traveller who
        tapped to take a screenshot landed on a tours site. Flight bookings
        earn through the flight widget's own links and are not affected.
      */}
      {/*
        No top padding on <main>. The header is fixed and transparent at rest,
        and every page opens on a hero that deliberately runs underneath it —
        padding here would put a band of background above every photograph and
        undo the whole effect. Each hero carries its own top padding instead.
      */}
      <body className="flex min-h-full flex-col bg-mist-50 text-navy-900">
        <Header locale={loc} />
        <main className="flex-1">{children}</main>
        <Footer locale={loc} />
        <AppTabBar locale={loc} />
        <NavTracker />
        {/* GA4 + consent banner + partner-click tracking (sfrtna.com only). */}
        <Analytics locale={loc} />
        {/*
          Stay22 LinkSwap: turns the plain Booking/Agoda/Expedia/Trip.com links
          on hotel pages into affiliate links. The lmaID is a public account
          id, not a secret. Loaded after hydration so it never delays a page.
        */}
        <Script id="stay22-params" strategy="afterInteractive">
          {`window.Stay22=window.Stay22||{};window.Stay22.params={lmaID:'6abee21c6e93226dc14e814b'};`}
        </Script>
        <Script
          id="stay22-lma"
          src="https://scripts.stay22.com/letmeallez.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
