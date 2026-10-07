# Sfrtna — project notes for a new session

Read this first. It replaces re-explaining the project. Last updated 7 Oct 2026.

## Owner's standing rules (must follow)

- **Always reply in Arabic.** Act as developer, reviewer, CX expert and designer.
- **Every price on the site = the partner's live price, or no number at all.**
  No «يبدأ من», no estimates, no cached fares presented as prices.
- No invented data, no Wikipedia content, **no secrets/API keys in code or chat**,
  never delete a file without the owner asking.
- Secrets live in Cloudflare **Runtime** variables (not Build). Never repeat IDs,
  IBANs or keys seen in screenshots. Never use or store the CDS key.
- Hide internal sources/methodology from visitors.
- **No ads, ever** — on the site or in the mobile apps. No AdSense/AdMob/ad
  SDKs, no Google Ads link, GA4 Google signals off, `ad_storage` always denied.
  Income is partner commission only.
- **Protect the site's data from copying/scraping** — treat as a requirement in
  every feature (API routes, bulk data, AI crawlers). Planned as its own section.
- Before saying "done": `npx tsc --noEmit`, then `npx eslint <files> --max-warnings=0`,
  then open the live page and check it yourself.
- Commits: author `Claude <noreply@anthropic.com>` with trailers
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and the session line.
  Push to `main` deploys automatically in ~5 minutes. If a push is rejected, tell
  the owner and stop.
- Work **one section at a time to 100% launch-ready**, test it yourself, collect all
  issues into one list, fix them together, re-test, then report. Don't make the
  owner discover bugs. Ask only business decisions.
- To save usage: batch work, avoid repeated browser screenshots (the test browser
  freezes on embedded Stay22/Aviasales widgets — ask the owner for a phone
  screenshot instead), start a new conversation per section.

## Stack

Next.js 16 App Router on Cloudflare Workers (opennext), free plan (50 subrequests
per request). No database; edge cache via `src/lib/edgeCache.ts` (`cachedJson`).
GET route handlers that read nothing from the request need
`export const dynamic = "force-dynamic"`. Repo: github.com/hsnalmajed/Sfrtna.
The container shell cannot reach sfrtna.com — test through the browser.

## Partners and accounts

| Partner | Use | Status |
|---|---|---|
| Travelpayouts / Aviasales | Flight search widget (`wl_id=22604`), cached fares | PayPal linked ✅ |
| Stay22 (aid `sfrtna`, lmaID in layout) | LinkSwap on all pages; Allez links; hotel map/list widget | stc bank ✅, address proof under review |
| Expedia (camref `1011l6tt7K`) | City searches via `/api/go/expedia` redirect | bank ✅ |
| RateHawk / ZenHotels | City hotel links (`src/lib/zenhotels.ts`) | linked ✅, W-8BEN under review |
| Agoda | Pending manual site review | when approved: Site ID/API key (`AGODA_API_KEY`) + bank, then build our own Arabic hotel list |
| SerpApi (`SERPAPI_KEY`) | Google Hotels prices for one named hotel | free 250/month, pace guard in `serpapi.ts`; `/api/serp-status` shows usage |
| Google Places (`GOOGLE_PLACES_KEY`) | Hotel-name suggestions | **owner still creating the key** (project "Sfrtna", Places API (New), daily cap 300). Until then OpenStreetMap/Photon answers |

## Section status

### Flights — launch-ready ✅
Fixed in the launch audit: passengers (adults/children/infants digits in
`flightSearchCode.ts`), past dates and unknown places show a notice, English LTR,
"all airports" city entries, same/unknown place validation, multi-city city names,
budget message only after results settle. SerpApi Google Flights was measured 25%
above Aviasales → switched off (`/api/live-fare` returns 404).
**Pending owner action:** click one «احجز الرحلة» and confirm it appears in
Travelpayouts.

### Hotels — rebuilt 6 Oct, awaiting owner's final look
- Form (`HotelPlanner.tsx`): hotel name and city must be **picked from a list**
  (`SuggestInput`, `HotelNameInput`, `HotelCityInput`); a country name lists its
  cities; breakfast switch on its own row like the flight form.
- Named hotel (`HotelPrices.tsx`): photo gallery, rating, address, amenities
  (Arabic labels in `hotelAmenities.ts`), price panel — cheapest first, «قارن
  السعر عند N مواقع أخرى» for the rest. Partners shown: Booking, Expedia, Agoda,
  Hotels.com, each via **Stay22 Allez with hotel name + coordinates**
  (`hotelAllezUrl` in `affiliateLinks.ts`) so the click lands on the hotel itself
  (verified: Booking hotel page, Expedia/Agoda with hotel selected, Hotels.com
  hotel page). Trip.com removed (no Allez link). First load of a new hotel ≈25 s
  (SerpApi), then cached 6 h.
- City search (`Stay22HotelMap.tsx`): Stay22 widget with **List / Map** switch (list
  default). Budget filter: Stay22 `max` is **USD per night** → we pass
  `budget / nights / 3.75` for SAR. Verified: 5,000 SAR / 6 nights → all ≤ 4,752.
  Widget is English and mixes hotels with rentals (hotels-only mode returns an
  empty list).
- Stay22 LinkSwap rewrites Booking/Expedia/Agoda/Hotels.com/Trip.com links into
  address searches — that's why named-hotel links use Allez, and why city-search
  Expedia goes through our own `/api/go/expedia` redirect.

### Measurement — GA4 + Search Console (6 Oct)
- Search Console: Domain property `sfrtna.com` verified by the owner; submit
  `sitemap.xml` there. Bing Webmaster still to do (import from Google).
- GA4 property "Sfrtna - sfrtna.com", stream "Sfrtna Web", ID `G-1438PGGH2W`
  (public, in `src/lib/analytics.ts`). Loaded on sfrtna.com only.
- Owner's decisions: consent banner + Consent Mode v2 (analytics denied until
  «موافق»; ads always denied); BigQuery daily export yes; KPI per search AND per
  session.
- Code: `src/lib/analytics.ts` (track, trackSearchUrl, consent),
  `src/components/Analytics.tsx` (tag, consent banner, global click listener,
  footer «إعدادات الكوكيز»). Privacy page has a measurement section.
- Events: `search` (every form, via `trackSearchUrl` before router.push;
  carries `search_id`), `budget_change` (same search, new budget),
  `flight_results` (FlightBudgetBar, once when settled), **`partner_click`** (any
  `data-partner` link, `/api/go/*`, or known partner host; results-page clicks
  carry the last `search_id`; reaches into the flight widget's shadow root via
  composedPath), `visa_check`, `language_switch`, `currency_convert`,
  `map_download`. Page views: GA4 enhanced measurement (history changes).
- Not visible to GA4: clicks inside the Stay22 iframe widget — use partner
  dashboards. Flight-widget clicks: verify on live site whether its book
  buttons are anchors (caught) or scripted (not caught).
- GA4 Admin done 7 Oct: data retention 14 months, Google signals off,
  BigQuery daily export (project Sfrtna, sandbox → tables expire after 60 days
  unless billing is added, location EU, no streaming, no ad identifiers),
  custom dimensions search_type, partner, page_type, destination, origin.
  `search_id` deliberately NOT registered (high cardinality) — use BigQuery.
- Verified 7 Oct in GA4 Realtime from the owner's test: page_view, search,
  partner_click, language_switch arrive. Search Console ↔ GA4 linked.
- Owner finished 7 Oct: partner_click starred as Key event; Enhanced
  measurement → Form interactions turned off. **Measurement section closed.**
- Flight bookings ARE measured: «احجز الرحلة» (FlightResultsGuide → widget's
  card button) arrives as partner_click partner=aviasales page_type=results,
  one event per click (owner's test 7 Oct). The widget opens its link outside
  its shadow root, so `in_widget` is not set — don't rely on that flag.

### Protection from copying/scraping — closed 7 Oct ✅
- `edge-guard.js` (called from `edge-worker.js` before Next sees any /api
  request): allow-list of routes the site uses (unused `/api/flights`,
  `/api/hotels` → 404, code kept); method check (itinerary POST only);
  same-origin check (Sec-Fetch-Site → Origin → Referer; none → 403);
  `/api/go/expedia` open to any click; `/api/health` and `/api/serp-status`
  also open when typed in the browser bar. Per-IP rate limits via Workers
  Rate Limiting bindings in `wrangler.jsonc`: `API_LIMIT` 120/min on all
  /api, `API_LIMIT_HEAVY` 20/min on discover, multicity, country-places,
  hotel-prices, itinerary, health. Counted per Cloudflare location. 429 has
  Retry-After 60. All /api responses carry `X-Robots-Tag: noindex`.
  **Any new /api route must be added to `ROUTES` in edge-guard.js or it 404s.**
- `robots.ts`: AI-training crawlers (GPTBot, ClaudeBot, CCBot,
  Google-Extended, Bytespider, meta-externalagent…) disallowed site-wide.
  AI search/answer bots (OAI-SearchBot, ChatGPT-User, PerplexityBot,
  Claude-SearchBot) allowed like search engines — owner's decision 7 Oct.
- Terms: new section «منع النسخ والاستخدام الآلي» (ar + en), date 2026-10-07.
- Cloudflare (owner, 7 Oct), Security → Settings → Bot traffic: Bot Fight
  Mode on, AI Labyrinth on, AI bot policies: Search allow, Agent allow,
  Training block; Bot Preference Sync OFF (robots.txt stays ours).
- Live check 7 Oct after all settings: pages, /api from pages, robots.txt,
  sitemap OK; /api opened directly → 403. **Protection section closed.**

### Android app — test build ready 7 Oct, awaiting owner's phone test
- Owner's decision: Capacitor shell that loads the live sfrtna.com (not a
  rebuilt native app); package `com.sfrtna.app` (permanent). Details in
  `mobile/README.md`.
- /api guard unchanged: the page runs on sfrtna.com inside the WebView, so
  its fetches are same-origin with Sec-Fetch-Site. No app-only route.
- Partner/other sites open in Custom Tabs; widget pop-ups caught; back
  button; native offline screen (auto-retry); print and KML/GPX share via
  `SfrtnaAppPlugin` ← `src/lib/nativeApp.ts`. UA suffix `SfrtnaApp/Android`;
  GA4 user property `app_platform` (live check 7 Oct: `web` on the site).
  To see it in reports, register `app_platform` as a user-scoped custom
  dimension in GA4.
- Built on GitHub Actions (cloud workspace can't download the Android SDK):
  `.github/workflows/android.yml` → APK on the public `android-test`
  pre-release. First build passed: versionCode 1, min SDK 24, target 36,
  permissions INTERNET, NETWORK_STATE, COARSE/FINE location; no AD_ID.
- Not yet tested on a real phone. Owner to install and check: launch,
  flight search + «احجز الرحلة» (Custom Tab), hotel map widget, back
  button, airplane mode → offline screen, KML/GPX share, plan PDF.
- Before Play: owner's developer account (unknown if it exists), upload
  key → 4 GitHub secrets, App Links (`assetlinks.json` after first upload),
  store listing + Data safety.

### Photos — rebuilt 7 Oct (stored file, no page-time Pexels calls)
- Cause of blank cards: page-time Pexels searches, cached per Cloudflare
  data centre, used up the **monthly** allowance (20,000). /api/health on
  7 Oct: 429, remaining 0, resets **25 Oct 2026 17:41 UTC**.
- Now: `src/data/pexelsPhotos.json` (623 subjects: countries, cities,
  map-city cards, landmarks) filled by `scripts/pexels-photos.ts` via the
  hourly `.github/workflows/photos.yml` (≤180 searches/run, resumable,
  commits only when something new). Pages only read the file. Card size 640w.
- **Owner action:** add GitHub secret `PEXELS_API_KEY` (same key as
  Cloudflare). Optional: ask Pexels for a higher limit to get photos before
  25 Oct. Until then cards show their navy tiles.
- GitHub secret `PEXELS_API_KEY` added by owner 7 Oct; manual run OK (key
  read, Pexels answered 429 — allowance still empty). Owner emailed
  api@pexels.com 7 Oct asking for a higher limit. **Owner's decision:** wait
  for Pexels' reply before choosing (a) 3 photos per place rotating weekly
  and (b) homepage hero daily vs weekly. Old photos cannot be recovered
  (they lived only in per-data-centre edge cache).
- Same day: footer 3 columns on phones; homepage season cards no longer
  overlap badges on the city name (checked at 375 px).

### Places, speed, country page — 7 Oct (night)
- City places are stored, not fetched live: `public/data/places/<slug>.json`
  (214 cities, 68k places, top 500 per city by fame) +
  `src/data/placeCounts.json`, written by `scripts/places/fetch-places.ts`
  via `.github/workflows/places.yml` (monthly on the 3rd, on cityCoords
  changes, or by hand; full run ≈ 3.5 h). Read through `env.ASSETS`
  (`wrangler.jsonc`: binding ASSETS, `run_worker_first: ["/data/*"]`);
  `edge-worker.js` answers 404 to /data/* from outside. Live check: Istanbul
  page 22 s → 0.6 s, country pages 4.8 s → 0.7 s, London no error.
- `src/app/[locale]/loading.tsx`: instant skeleton + gold line on every
  navigation (taps used to look dead while the server worked).
- Country page «قبل أن تقرر»: visa kind + «متطلبات السفر» (dialog with
  requirements, apply options at the bottom); currency shows 1 SAR = X with
  «احسب مبلغاً آخر» converter (`TripCurrencyInline variant="light"`).
- Destinations list now shows every country with cities (73), not only the
  41 with guides (`destinationList.ts`).
- Site crawl 7 Oct: 314 sitemap pages + 92 linked pages, no 404/500.
- Known, minor: hydration attribute mismatch in CityPlacesPlanner (dev
  console only).

## Next, in order

0. Owner decision pending: which countries to add next (site has 73 with
   cities; each new one needs cities + coords, airports, a confirmed visa
   status, currency, season data) — its own section.
1. Finish Android (phone test, then Play), then iPhone app with the same
   shell (`npx cap add ios`; Stay22 Mobile SDK worth checking).
2. Marketing plan before launch.
3. When Agoda is approved: Arabic hotel list from Agoda's API.
4. Owner asked for: a glossary of technical terms (offered as a doc) and a full
   map of every system used (front end, data, analytics) explained for a data
   analyst.
