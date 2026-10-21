# Sfrtna — project notes for a new session

Read this first. It replaces re-explaining the project. Last updated 21 Oct 2026.

## Owner's standing rules (must follow)

- **Always reply in Arabic.** Act as developer, reviewer, CX expert and designer.
- **Every price on the site = the partner's live price, or no number at all.**
  No «يبدأ من», no estimates, no cached fares presented as prices.
- **Never fewer options or a wrong price than the market (owner, 13 Oct 16:01,
  "not acceptable, ever"):** a change may add our own view on top, never
  replace a fuller list with a shorter one (hotels: 20 Google cards had
  replaced the partners' full city list). Before release, compare the count
  and prices with the source/partner page and write both in TEST_PLAN.
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
| Travelpayouts / Aviasales | Flight search widget (`wl_id=22604`), cached fares | bank (USD) = main payout ✅ 22 Oct (PayPal limited); "Drive is not working" = Drive script not installed, on purpose (ignore) |
| Stay22 (aid `sfrtna`, lmaID in layout) | LinkSwap on all pages; Allez links; hotel map/list widget | payout portal complete (address, stc bank, tax form; locked), dashboard still says "Missing payout method" 22 Oct → owner asked support; wire min $500 |
| Expedia (camref `1011l6tt7K`) | City searches via `/api/go/expedia` redirect | bank ✅ |
| RateHawk / ZenHotels | City hotel links (`src/lib/zenhotels.ts`) | linked ✅, W-8BEN under review |
| Agoda | Pending manual site review | when approved: Site ID/API key (`AGODA_API_KEY`) + bank, then build our own Arabic hotel list |
| SerpApi (`SERPAPI_KEY`) | Google Hotels prices for one named hotel | free 250/month, pace guard in `serpapi.ts`; `/api/serp-status` shows usage |
| Google Places | — | **removed 10 Oct**: Google Cloud in KSA is sold only via CNTXT (commercial registration needed); code deleted |
| HERE (`HERE_API_KEY`) | Hotel-name suggestions (Discover, accommodation categories 500-*) | chosen 7 Oct instead of Google; free 5,000/month; **key live 9 Oct** (Cloudflare Secret). Second layer after our stored hotels (see Next → 4b). Daily cap 160 / month 4,800 (Durable Object `HereQuota`, 9 Oct). `/api/health` shows `here.status`, lodging hits and `here.usage` |

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
- **App look (7 Oct, owner: "looks like a website stored on the phone"):**
  `html.in-app` set by an inline script in `[locale]/layout.tsx` from the UA
  (before first paint; the edge cache is keyed by URL, so the server can't
  send the app different HTML). CSS in `globals.css` (end): bottom tab bar
  `AppTabBar.tsx` (Home · Destinations · **Book** · Seasons · More — More
  sheet holds itinerary/visa/currency, language, legal pages, cookies,
  disclaimer; back button closes it), slim solid header with centred logo,
  no footer, heroes start under the bar (`hero-pad`, `page-hero`), root
  font 15–16px by phone width. `web-only` / `app-only` classes; bottom-fixed
  bars use `lift-over-tabbar` / `sit-on-tabbar`. Website unchanged.
  Home stats now count the same 73 countries / 214 cities as Destinations.
- **8 Oct (owner's app notes):** native opening `IntroView.java` — mark,
  then «لكل سفره حكاية» word by word with a gold line (min 1.7 s, leaves
  when the page has drawn, max 6 s; Settings → remove animations respected).
  Needs the new APK. Tab bar: class re-applied by `AppTabBar` (layout
  effect + MutationObserver) in case React re-renders `<html>`; could not
  reproduce the owner's "bar disappears" locally — ask him to re-test.
  App home: no showcase tab strip; panel titled «أفضل الوجهات في <شهر>» /
  «احجز رحلتك»; Home tab on the homepage returns to the season cities
  (`HOME_SEASON_EVENT`), Book lights up on the planner (`HOME_TAB_EVENT`).
  "Flying from" row removed from home (web too); the flight form still
  pre-fills the nearest airport (`useDefaultOrigin`).
- **App design section (8 Oct evening, owner: "uncomfortable, not tidy"):**
  light app chrome (white top bar + tab bar, white system bars, SystemBars
  style LIGHT); `.app-light` turns every hero into a light large-title
  header; `@custom-variant app` in globals.css for app-only utilities
  (`app:…`); `useInApp()` for props (search form tone light in the app).
  App home = `AppHome.tsx` (greeting + flights/hotels tiles → planner,
  then 6 season cities two per row, then tools grid); no marquee in app.
  Cards picture-on-top/text-below in app (CountryCardGrid, CityGallery,
  HomeShowcase cities) with flag tiles when no photo. On phones
  everywhere: seasons grouped by continent then country, two per row;
  discover cards and city places two per row. Language remembered:
  `sfrtna_lang` cookie (NavTracker) read by `src/app/page.tsx`; app
  flushes cookies onStop. Opening (`IntroView` + `TaglineFlightView`):
  large mark (`intro_mark.png` from favicon-512), a plane flies across
  writing the tagline in Tajawal ExtraBold (res/font, OFL in
  mobile/licenses) with a dashed gold trail; tagline in the last language
  used (reads the cookie). Live 8 Oct: root → last language OK, app home
  served, APK built. Chrome test browser froze on live home — owner's
  phone screenshots are the check.
- **Reverted 8 Oct night (owner: slower, white worse, old home nicer):**
  the light app chrome, light heroes, AppHome and white app cards are
  gone — the app is back to the navy look and the previous home (strip
  of season cities). Kept: two cards per row, seasons grouped by continent
  then country, language memory, no calendar link / "Flying from".
  **Every city card shows rating + visa + season + temperatures**:
  `cityCardFacts()` (src/lib/cityCardFacts.ts) for CityGallery (country
  and maps pages); CitySeasons cards in the home-card style with visa;
  discover/route cards add season name and low–high.
  **Speed:** edge-worker serves cached pages at once and re-renders in the
  background after 1 h (stale-while-revalidate, kept 7 days), cache key
  includes the deploy version (`version_metadata` binding
  CF_VERSION_METADATA), clients get `no-cache`; tab bar links prefetch
  in full; app language switch = clean page load (saveLanguage + location
  .replace) instead of in-place re-render (owner saw it hang); opening
  min 1.3 s, leaves at first paint (onPageCommitVisible), max 4 s;
  WebView offscreen pre-raster. System bars navy again.
- **9 Oct (owner): filters, results header, preferences.** One filter
  control site-wide: `ui/FilterPill.tsx` (pill shows the choice, opens a
  bottom sheet with every option + counts; single or multi; `FilterToggle`
  for on/off). Used on destinations/maps (DestinationFilters), seasons
  month view (month, continent, «مع وقت جيد»), visa directory (entry +
  continent), discover results (season + visa, multi). Flight results
  header = a summary card (dates, travellers, «تعديل») + visa and
  requirements side by side + full-width currency line. Preferences in
  both planners fold into `PreferencesPanel` (PlannerFields; gold card,
  shows chosen items, opens by itself if any set). Hotel order:
  breakfast → stars (chips) → stay type (chips). `ChoiceChips` shared.
- 9 Oct: opening mark centred on the pin (`intro_mark.png` padded 88 px on
  the leading side; view 212×170 dp). Itinerary city = picked from the list
  (`HotelCityInput`, city or country → its cities); not picked → browser
  check message on the city box; POST destination "city، country".
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
- **Pexels replied 7 Oct:** limit increases paused, no date. Default
  200/hour, 20,000/month stays — ~20× what the stored file needs. Photos
  fill in automatically after the 25 Oct reset.
- Owner's decision (7 Oct, "do what's right"): **3 photos per place,
  rotating weekly** (`PHOTOS_PER_PLACE`, `fromStored` picks by week + a
  per-place offset; no extra API calls). Homepage hero stays daily
  (hand-picked, no API). Speed: `preconnect` to images.pexels.com in the
  layout, `decoding="async"`, `<Photo placeholder>` draws the card's navy
  tile under the photo while it loads (no JS wait, no blank box).
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

### Arabic spelling rule (site-wide, owner 7 Oct)
- أ إ آ = ا, ة = ه, ى = ي, tashkeel ignored, Arabic digits = 0-9:
  `normalizeSearch` in `src/lib/search.ts`; every local search box uses it.
  Outside services (hotel names via Photon/Google) get every spelling via
  `arabicSpellings()` in `providers/googlePlaces.ts` (also word-initial ا →
  أ/إ, word-final ة↔ه), merged and ranked. Live check: «ابها فندق» =
  «أبها فندق», «اسطنبول» = «إسطنبول». **Any new search must use these.**
- Hotel names: OpenStreetMap misses many hotels and most Arabic names
  («إسطنبول هيلتون» → nothing). The fix is the owner's Google Places key.

### Search outage found by the owner — fixed 7 Oct (afternoon)
- **Cause:** `edge-guard.js` listed `/api/discover` and `/api/multicity` as
  GET; their pages POST → 405 for every «اقترح لي وجهة» and multi-city
  search since the protection section. The discover page then showed «no
  results» instead of an error. My crawl only checked GET pages, so it
  missed it.
- Fixes: guard methods; `scripts/check-guard.mjs` (runs as `prebuild`)
  fails the build if guard and route files disagree; discover and itinerary
  pages show an error on a failed request; discover «طيران + فندق» and
  «فندق فقط» no longer return nothing when no hotel list price exists
  (flight-chosen / in-season list, hotel priced live per city); Arabic
  plurals «6 مسافرين», «13 ليلة».
- Live re-test 7 Oct (owner's search RUH 2→15 Jan 2027, 6 travellers,
  80,000 SAR): round trip 7 priced + 24 in season; one way 26 + 24;
  flight+hotel 7 + 24; hotel only 24 in season; routes 24; multi-city 3
  legs; itinerary, day-fares, rates, hotel names, all main pages OK.
- **Site check:** `scripts/smoke.mjs` + `.github/workflows/smoke.yml`
  (after every push + every 6 h; GitHub emails the owner on failure). Runs
  against `sfrtna.almajedhsn.workers.dev` because sfrtna.com's Bot Fight
  Mode blocks GitHub machines. `edge-worker.js` now 301-redirects
  workers.dev to sfrtna.com unless header `x-sfrtna-smoke` = `SMOKE_TOKEN`
  (closes a bot-protection side door). `SMOKE_TOKEN` set by the owner 7 Oct
  in Cloudflare + GitHub (kept in his Bitwarden). First manual run: **all
  18 checks passed** (pages, discover ×4, multi-city, fares, rates, hotel
  names, places, and the three protection checks).
- Rule for every future change: test POST flows (discover, multicity,
  itinerary) with real data, not just page GETs.

### Trust pages and sources — 8 Oct (owner)
- About = short brand text only; Privacy and Terms rewritten in standard
  form, **no tool or source names** (no Google Analytics, Pexels,
  OpenStreetMap, IATA/Timatic, etc.). Privacy covers location permission
  (app) and has the only «تغيير اختيارك للكوكيز» button; the footer/More
  cookie link is gone; consent banner text names no tool.
- Contact page: 404 and unlinked (footer, More, sitemap) until an address
  is set in `src/lib/contact.ts` (`CONTACT_EMAIL`). Suggested: Cloudflare
  Email Routing info@sfrtna.com → owner's inbox (owner decision).
- Source lines removed site-wide: photo credits (PageHero, home hero),
  seasons/places/tours source notes, currency rate source. **Kept on
  purpose:** the small © OpenStreetMap line inside the maps themselves —
  the map data licence (ODbL) requires it; official visa links (IATA,
  MOFA) as actions for the traveller.
- Rule: never name a data source or tool in visitor-facing text.

### Discover — 8 Oct (owner)
- Preferences order: direct | bags, then **continent** (multi-select chips,
  «بدون تفضيل» = all; param `continents`, filtered in `/api/discover` and
  `routeSuggest.ts`), then destination type.
- Results filters: every season rating (5) and every visa kind (4), each a
  toggle with its count; one swipeable row each on phones.
- Multi-country routes now draw from the full pool (`src/lib/discoverPool.ts`,
  shared with /api/discover) instead of 14 hand-picked cities: filtered by
  continent/type, ranked by the home fare table (flown to from home →
  in season → cheapest), top N get a fare table, `MAX_REQUESTS` = 29
  (28 cities for one month, 14 when the trip spans two).
  Stops exclude the home country and never repeat a country; 3-stop routes
  use at most 14 cities (`MAX_CITIES`) — 28 cities × 3 stops hit the
  Worker limit live (503). Live 8 Oct, RUH Jan 2027, 6 pax, 80k: all ×2 24,
  Europe ×2 4, Europe ×3 6, Asia ×2 24, Africa ×3 24, Asia+Europe ×3 24,
  North America 0 (no one-way fares between pairs) — all 200.
- Contact: **live 8 Oct** — Cloudflare Email Routing info@sfrtna.com →
  owner's inbox (rule Active, test mail "Forwarded"). `CONTACT_EMAIL` set;
  page, footer, More sheet and sitemap show it. No reply-time promise.

### Clean-up — 10 Oct (owner: "delete everything not active")
- Removed: 27 unused components/libs (TripBuilder, SearchForm, DiscoverForm,
  HeroPlanner, FlightBudgetBar, …), routes `/api/flights`, `/api/hotels`,
  `/api/live-fare` (+ guard entries), the sample-fare generators in
  flights.ts (invented data), Hotellook (closed 20 Oct 2025 — discover
  still asked it for every city), Google Places code (blocked in KSA;
  `providers/googlePlaces.ts` → `providers/hotelNames.ts`), SerpApi flight
  fares, the Almosafer / Skyscanner / airline-site links (no account → no
  income; Almosafer was still shown in hotel partner links), price
  estimates in countryGuides, 327 unused translation keys (dictionaries.ts
  169 KB → 127 KB, shipped to the browser), `@fontsource/cairo`.
- Kept on purpose: Viator code (owner signing up), climate scripts,
  destinationTypes (used by climate scripts).
- `flight_results` (GA4) was sent only by the unused FlightBudgetBar, so it
  never fired after 27 Sep — now sent by FlightResultsGuide once settled.
- Worker 2,070 → 2,025 KiB gzip. Partners that pay today: Travelpayouts
  (Aviasales), Stay22 (Booking/Agoda/Hotels.com/Trip.com links), Expedia,
  RateHawk/ZenHotels. Direct (visa) links earn nothing (no referral deal).

### Partner audit — 10 Oct (checked in the owner's dashboards)
- Travelpayouts (project "Sfrtna"): **23 programs open now** (links can be
  generated): Klook 2–5%, Tiqets 3.5–8%, WeGoTrip, Go City 3.4–6%, KKday
  1–5%, Kiwitaxi 9–11%, Welcome Pickups 8–9%, intui.travel 10%,
  GetTransfer 4–25%, Airalo 12%, Yesim 18%, GigSky 20%, EKTA insurance 25%,
  AirHelp 15–16.6%, Localrent 7.5–10%, GetRentacar 10%, Economybookings
  3–8%, QEEQ 5–10%, AutoEurope 4.4–8%, BikesBooking 4%, Radical Storage 8%,
  Kiwi.com 3%, Aviasales 40%. **Locked until 3 months of stable traffic**
  (19): GetYourGuide 8%, Viator 8%, Booking 3–5%, Agoda 1–6%, Trip.com,
  Expedia, Tripadvisor Experiences, DiscoverCars, Omio, 12Go, Hostelworld,
  Vrbo, Ticketmaster.
- Viator direct: the owner HAS an account (named "iTravel"), status
  "Retry account verification" → owner must re-submit (dashboard → Try
  again; site sfrtna.com).
- **GetYourGuide direct: account active 10 Oct; bank (USD, SNB) payout set 22 Oct ✅, 2FA on** (owner signed up as
  content creator, site sfrtna.com). Public partner tag `partner_id=NNJW64J`
  (rides in link URLs, not a secret). Tools offered: links, activity / city /
  availability widgets — **no API** on this account; widget languages
  exclude Arabic. 2FA now mandatory (owner to set up). Headout:
  partner.headout.com/affiliate.
- Viator verification = government ID photo + live selfie (camera), done by
  the owner; account name/site can only be changed via Viator support.
- Owner's direction: everything a traveller needs in one place; activity
  page in our site = description (ar/en, our own translation) + live price
  + book button to the activity's own page; every place needs a
  description and coordinates; itinerary days grouped by proximity
  (landmarks + activities + restaurants).

### Activities, phase 1 — 10 Oct (live)
- `src/lib/activityLinks.ts`: GetYourGuide (direct, partner tag), Tiqets and
  Klook (Travelpayouts). Each partner's own search; **no prices** (none of
  these give us an API yet). Links go through our redirects:
  `/api/go/gyg?q=` (adds partner_id + utm_medium=online_publisher) and
  `/api/go/tp?b=klook|tiqets&q=` (Travelpayouts `POST /links/v1/create`,
  token `TRAVELPAYOUTS_TOKEN`, project trs 577683, edge-cached 30 days,
  falls back to the plain search). Search only, never a free URL (400).
- City pages (attractions + maps): `CityActivities.tsx` «جولات وتذاكر في
  <المدينة>» (3 partner cards). Place cards: «تذاكر وجولات:» chips on
  TICKETED_KINDS with fame ≥ 8, or hand-checked landmarks booked
  official/guide; query = English name without "(…)" + city.
- Live check 10 Oct: Istanbul 45 place chips, Dubai 69, London 63, Riyadh
  15, Abha 0; Klook landed with aff_pid=marker (tracked), Tiqets with
  partner=travelpayouts.com (11 results for Hagia Sophia), GetYourGuide
  302 with partner_id. GA4 partner_click: data-partner + product=activity
  + placement city_activities|place_card. Visual check pending (test
  browser froze) → owner's phone screenshot.
- Verified search URLs: GYG `/s/?q=` (auto Arabic), Tiqets `/en/search?q=`
  (`/en/search/` = 404), Klook `/en-US/search/result/?query=`. KKday and
  WeGoTrip search URLs did not verify → not linked yet.
- Next for activities: Viator (API: description + live price + book) once
  the owner's ID verification passes; descriptions + our own translation;
  itinerary by proximity (CityPlacesPlanner already groups picked places
  by distance).

### Trip essentials — 10 Oct (live)
- `scripts/partners/check-pages.ts` + `.github/workflows/partner-pages.yml`
  (monthly on the 7th / on change): keeps only partner pages that answer 200,
  keep the place in the path and name it in the <title> →
  `src/data/partnerPages.json`. First run: Airalo 72/73 countries (no RU),
  Kiwitaxi 40, Welcome Pickups 68, Localrent 95 of 214 cities.
- `src/lib/tripEssentials.ts` + `TripEssentials.tsx` «جهّز رحلتك إلى
  <المدينة>»: eSIM (Airalo), airport transfer (Kiwitaxi, Welcome Pickups),
  car rental (Localrent) — only groups with a checked page. On city pages and
  on flight results (with CityActivities, for the destination city).
- `/api/go/tp` now also `b=airalo&c=<CC>` and `b=kiwitaxi|welcomepickups|
  localrent&p=<city slug>` — looked up in partnerPages.json, else 400.
- Live 10 Oct: all four land tracked (Airalo irclickid, Kiwitaxi tpo,
  Welcome Pickups aff_track_id, Localrent r=…&utm_source=travelpayouts);
  Istanbul shows all, Riyadh eSIM only, Moscow nothing; bad keys → 400.
- Not added: **EKTA insurance** — underwriter licensed in the Comoros (its
  own site), owner decision pending; Yesim (URL pattern not verified);
  GetRentacar/QEEQ/Economybookings/AutoEurope, AirHelp, Radical Storage,
  GetTransfer, intui.travel, Go City, KKday, WeGoTrip — next.

### Trip services panel — 10 Oct (owner: "add ALL partners, not one per need"; old cards too tall)
- **Rule (owner): every partner for a need is offered, never one pick.**
- `TripServices.tsx` replaces CityActivities + TripEssentials (deleted): one
  compact panel «خدمات رحلتك إلى <المدينة>», a row per need, partners as
  pills (one swipeable line per row on phones). City pages + flight results
  (results add «تعويض تأخر الرحلة» → AirHelp).
- `tripEssentials.ts` BRANDS: activity (GYG, Tiqets, Klook search + Go City
  city page + KKday, WeGoTrip home), eSIM (Airalo country page, Yesim,
  Saily), transfer (Kiwitaxi, Welcome Pickups city pages; intui.travel,
  GetTransfer home), car (Localrent city page; GetRentacar, Economybookings,
  QEEQ, Auto Europe **.eu** home), luggage (Radical Storage city page),
  AirHelp. Checked pages first, then partners that are a search of their own.
- Live-tested tracking for every brand (TP click ids in the landing URL).
  Dropped: GigSky (TP makes app links only), Auto Europe .com (untracked →
  .eu). EKTA insurance: **owner said no**.
- Checker now also Radical Storage (126 cities) and Go City (`/en/<city>`,
  rerun pending). Ticket chips also on place_of_worship with fame ≥ 40.

### Hotel names (stored + HERE) — closed 9–10 Oct ✅
History of the section (file is now `src/lib/providers/hotelNames.ts`; Google
removed 10 Oct). Original plan: `src/lib/providers/googlePlaces.ts`
→ `hereHotels()` (HERE Discover, `at` = visitor's rough location else Riyadh,
`limit` 20, keeps categories `500-*` = accommodation, edge-cached 7 days per
query), used by `hotelSuggestions()` in the order Google → HERE → OpenStreetMap;
Arabic spellings via `arabicSpellings()`. `/api/health` reports `here.status`
and `here.lodging` (hits for "Hilton Istanbul") and `keys.here`.
The owner was creating his HERE account (billing page; PayPal advised) — no key
yet. Steps for the section:
1. Owner: finish the HERE account, create a REST API key (HERE platform →
   project → Access manager / API keys). Never paste it in chat.
2. Owner: add it in Cloudflare → Workers → sfrtna → Settings → Variables and
   Secrets as a **Secret** named `HERE_API_KEY` (Runtime, not Build), then
   redeploy (or push any commit).
3. Claude: open `/api/health` in the browser → expect `keys.here: true`,
   `here.status: 200`, `here.lodging > 0`.
4. ✅ 9 Oct: daily cap done. HERE has no free usage endpoint and the edge
   cache is per data centre, so the count lives in one SQLite Durable Object
   (`here-quota.js`, exported from `edge-worker.js`; binding `HERE_QUOTA` +
   migration `here-quota-v1` in `wrangler.jsonc`; free plan). `takeHere()` in
   `src/lib/providers/hereQuota.ts` runs only on an edge-cache miss: 160/day,
   4,800/month (UTC). Past the cap, or if the counter fails on Cloudflare →
   no HERE call, OpenStreetMap answers. The `/api/health` probe also takes
   from the cap; `here.usage` = {today, month, dailyCap, monthlyCap}.
   Tested with `wrangler dev`: health + suggestions counted in one counter.
4b. ✅ 9 Oct (owner: "most visitors type the hotel name in Arabic; nothing
   may run out on a visitor"): **our own stored hotel names**, the main
   layer. `.github/workflows/hotels.yml` (monthly on the 5th, on pushes to
   the collector/word cutting, or by hand) → `scripts/hotels/fetch-hotels.ts`
   (OpenStreetMap tourism=hotel|motel|guest_house|hostel|apartment, 25 km
   around each city, name/name:en/name:ar/stars → `scripts/hotels/cities/`)
   → `scripts/hotels/build-index.ts` → `public/data/hotels/<slug>.json`
   (best 60) + `public/data/hotel-words/<2 letters as hex>.json` (every
   hotel under each word). Read via ASSETS (not public: /data/* = 404).
   `src/lib/hotelIndex.ts`: word cutting + **Arabic dictionary** of chains and
   words (هيلتون→hilton, ماريوت, موفنبيك, روتانا, دبل تري…; فندق/منتجع/أجنحة
   are generic); `localHotels.ts`: finds the city in the query (Arabic or
   English, half-typed last word OK), the rest matched by prefix. Order in
   `hotelSuggestions()`: stored (≥5 → done) → HERE/Google (capped) → OSM
   live. API also returns the guessed `city`; no match → «اعرض فنادق
   <المدينة>». `/api/health` → `storedHotels`. Sample-data test: «هيلتون
   إسطنبول», «هيلتون اسطن», «ماريوت جده», «سما جدة», «ابها فندق», «دبل تري
   اسطنبول», «سويس اوتيل» all found. Add dictionary words as visitors need.
   First run 9 Oct: 183/214 cities, 85,103 hotels (Makkah 814, Madinah 350,
   Dubai 870, Istanbul 1,774; Riyadh 153, Jeddah 141, Abha 13 — OSM is thin
   in KSA, so HERE matters there), 4,278 word files (24 MB, largest 220 KB).
   31 big cities timed out (London, Bangkok, Cairo, Abu Dhabi…) → collector
   now retries at 10 km; a push re-runs missing cities. Ranking: words
   matched exactly → visitor's country (cf.country) → name opens with the
   word ("Hilton …" before "… by Hilton") → stars. «مكة» / «المدينة» = city
   (epithet المكرمة/المنورة optional). Real-data test: «هيلتون مكة»,
   «موفنبيك المدينة», «شيراتون جدة», «هوليداي ان الرياض», «اتلانتس دبي» OK;
   «فندق ماريوت جدة», «صحارى» not in OSM → HERE's job.
   Second run: all 214 cities collected. Outside answers (HERE/OSM) must be
   in the city the traveller named (no Kuwait Marriott for «ماريوت جدة»);
   none → empty list → «اعرض فنادق جدة». Live API check 9 Oct evening OK
   (Istanbul/Makkah/Madinah/Abha/Riyadh/Jeddah queries). UI dropdown check
   pending: test browser froze on the live home → owner's phone screenshot.
   **HERE key live 9 Oct 20:20** (`keys.here: true`, status 200). Discover
   read "Hilton Istanbul" as a street → now asked `<hotel words> hotel`
   around the named city's centre (Arabic chains → Latin via the
   dictionary; `localHotels().rest`), cache key `here-hotels:v2`. Health
   probe = "Marriott hotel" at Jeddah, shows `sample` (title, city,
   categories). HERE's own KSA data is thin too (Jeddah: one "Marriott"),
   so the full fix for Saudi hotels is Agoda's hotel list when approved.
   Restaurants mapped as hotels («مطعم سلام بالاس») dropped in
   build-index unless the name also says hotel/suites/…; 214/214 cities,
   100,750 hotels. «بالاس» = palace added.
5. Claude: live test the hotel name box (hotel form → «لدي فندق محدد») with
   Arabic and English: «هيلتون إسطنبول», «سماء», «ابها فندق», «Hilton
   Istanbul», a Riyadh/Jeddah hotel; Arabic spelling variants must match
   (أ/ا, ة/ه). Then pick one → named-hotel page loads prices (SerpApi).
6. ✅ Partners table and this note updated.

## Owner's design principles (13 Oct, apply to the WHOLE site and app)

- Phone layout is different from the website — design each on its own; same
  features on both, each reaching 100% of the goal, presented differently.
- A smooth, connected flow between every service we offer (flight → hotel →
  activities → eSIM/transfer/car …): the traveller always sees the next step.
  This is also how we earn.
- Simple delivery of information, elegant design. Lots of information is fine
  only when organised and sequenced; never a tall pile of cards (owner
  rejected the first services cards as "too much of the page").
- Fix any bug found anywhere in the site or app; test before saying "ready".

## Partner rule (owner, 10–13 Oct)

- **Offer every partner for a need, never one pick.**
- A partner counts as linked only when (1) its link is tracked — tested live,
  the landing URL carries the click id / marker — and (2) the payout to us is
  set up in that partner's dashboard (bank / PayPal / via Travelpayouts).
  Report both for every new partner.
- No travel insurance (EKTA rejected). Viator last.

## Owner's notes of 13 Oct — root causes, decisions, section plan

Owner tested site + app and sent 31 notes (strong complaint: fixes break other
things, buttons not tested, "I want root fixes and you to find what I missed").
Root causes found in the code (13 Oct):
1. Flight results are read out of the Aviasales widget's shadow DOM
   (`FlightResultsGuide.tsx`). Preferences (direct/bags) were applied only
   with a budget in the widget's currency; with preferences set, every result
   was hidden until the whole search settled (the "long wait"); no-match
   fell back to all flights with a small note at the top; "none within
   budget" also waited for settle.
2. Multi-city and discover priced from **cached** fares
   (`prices_for_dates`) — breaks the live-price rule and often finds nothing
   for exact dates; multi-city budget checked per cheapest leg.
3. Travel-tools itinerary (`src/lib/itinerary.ts`) = canned mock text
   ("local breakfast", "visit landmarks") + invented "estimated cost".
   Stored places have no restaurants.
4. No shared engine: each page has its own date filter, cards and plan
   builder, so a fix in one page never reaches the others.
5. Smoke checks open pages but never run the search buttons end to end.

**Four app notes added by the owner later on 13 Oct (not in the first file):**
- App home: photo over the WHOLE home background (not only the top part),
  Sfrtna logo on that background instead of on a separate band → section 7.
- App search: same search failures as the site, plus others → section 1
  (the app loads sfrtna.com, so the fixes reach it; re-test at phone width
  and inside the app, UA `SfrtnaApp/Android`).
- App layout: tabs sized for the phone; test users said the app is "very
  crowded" — things shown that aren't needed, tab rows taking space → every
  section gets its own phone layout check (390 px) before hand-off.
- Test EVERY scenario in site and app (round trip, one way, multi-city,
  suggest a destination, hotels, itinerary, landmarks, everything) — e2e
  checks grow with each section, not one page only.

**Owner's decisions (13 Oct, afternoon) — prices from every site:**
- Show **every** site's live price, partner or not (hotels and flights):
  more visitors now, partner terms (traffic thresholds) met later.
- Display: cheapest always · all our partners · well-known names always
  (the hotel's/airline's own site, Booking, Agoda, Almosafer…) · the rest
  folded under «عرض N مواقع أخرى»; sorted by price honestly — the owner
  dropped his idea of hiding pricier competitors (trust).
- The button shows **the price** («عرض السعر» / the amount), never «احجز الآن».
- A click must land on **the same hotel/flight with the same dates** on that
  site (partners via Stay22 Allez / our redirects; others via the source's
  own deep link) — test every site's landing before release.
- Hotels first (Google Hotels via SerpApi has every site); flights from other
  sources only via Google Flights (SerpApi, costs extra searches, measured
  25 % above Aviasales on 6 Oct) — measure before adding. Never scrape a
  site against its terms.
- **No paid SerpApi for now** (owner, 13 Oct 13:08): stay on the free 250
  searches/month until visitor demand is seen. Both together: partner
  prices/links (income) + every other site (no income, for traffic). Where
  the free allowance is paced out, show partners only — no number without a
  live price. Watch GA4 searches + how often the pace guard says no
  (`/api/serp-status`) and propose the paid plan with that evidence.

**Owner's decisions (13 Oct):**
- Hotel list prices: **paid data plan now** (Google Hotels via SerpApi —
  confirm exact price with the owner before subscribing).
- Accounts (to save plans in the app): **Google + email now; Apple later**
  (owner, 13 Oct 17:42: no Apple account; Apple sign-in and the iPhone app
  come after the website and the Android app are finished and approved).
- Restaurants in plans: **OpenStreetMap, stored monthly** (name, location,
  cuisine; no ratings).
- Multi-city: **one tab per leg, each a live search**, picked fares summed
  against the whole-trip budget.

**Section plan (one at a time, each tested end to end):**
1. Flight search engine: one way, multi-city (next leg date ≥ previous leg,
   whole-trip budget), strict preferences in every case, results shown as
   they arrive with a moving-plane progress bar, ask-before-showing dialog
   when nothing meets the preferences, discover fixed, results header facts
   in one row, + end-to-end tests of every search button.
2. Hotel results: cards like flights (breakfast, stars, rating, distance to
   centre, check-in/out, amenities), «احجز» lists every site with its price,
   long intro text removed; same card on «اقترح لي فندق».
3. One itinerary engine (destinations + travel tools): «أنشئ لي» / «أختار
   بنفسي», real named landmarks/activities/restaurants with locations,
   ordered by proximity, no estimated cost, «بدون تفضيل», unified date picker,
   real PDF download, save to account. After any plan: PDF · download places
   · save in app.
4. Next-step tabs under every result (flight, hotel, trip services, plan,
   landmarks) — show only what the traveller has not opened yet.
5. Destinations page: services + plan as tabs; landmarks/map/places/
   activities/download in one row.
6. Travel tools: trip-services page with country search; plan on engine (3).
7. Home: remove rain line, sign-in/up in «المزيد», photo full-bleed.

**Section 1 work, 13 Oct (pushed, live re-test below):**
- `FlightResultsGuide.tsx`: our cards drawn with or without a budget (no
  budget → every flight "fits", budget lines hidden); "more" auto-pressed per
  new batch during the search; preferences strict always — matches shown as
  they arrive; none at the end → dialog «لا توجد رحلات تطابق تفضيلاتك» with
  «نعم، اعرض الرحلات الأخرى» / «لا، عدّل البحث» (+ same card in page); after
  yes, an amber line says so. Moving-plane bar (`.sfr-flight-track` in
  globals.css) + «وجدنا N حتى الآن» until every agency answered. "None within
  budget" card shows at once ("so far"), dialog at the end.
- Results header: dates · travellers · edit, visa, requirements, currency in
  one wrapping row; no visa line for Saudi or same-country trips (same fix on
  discover cards in `DestinationCard.tsx`).
- Multi-city = `MultiCityTabs.tsx` on the results page (`legs` JSON + `leg`
  index in the query/hash). Each tab is a full page load (the widget reads
  its route once). Fare clicked «احجز» per flight kept in sessionStorage
  (`sfr-mc:<legs>`); the flight on screen gets budget − picks on the others.
  Form posts straight there; `/multicity-results` only forwards old links;
  discover route flights open the same tabs with the budget.
  `/api/multicity` (cached fares) is no longer called by any page — kept.
- Date picker `minDate`: a multi-city flight can't be dated before the
  previous one; later flights dated earlier are cleared.
- `scripts/e2e.mjs` (Playwright) + job `pages` in smoke.yml: opens result
  pages on workers.dev and waits for an answer; token header sent to our host
  only. The flight widget may refuse workers.dev → reported as a note, not a
  failure; flight answers then checked by hand on sfrtna.com.
- **Testing note:** the "frozen test browser" is Chrome throttling timers in
  a background tab (`document.visibilityState = hidden`), not the site. Use
  short synchronous JS probes; never `await` long timers in a probe.
- Date picker day colours (`/api/day-fares`): a colour for cheaper days, no
  number — fits the live-price rule (checked 13 Oct; earlier question to the
  owner withdrawn).

**Flight fallback (13 Oct night, owner: "no second source is not acceptable"):**
the owner's home network could not reach any Aviasales host (aviasales.com
itself: Chrome error page; works on his mobile data) → endless search. Now
`FlightResultsGuide` waits 12 s for the widget; if it never loads, or the
search ends with 0 flights, `FallbackFlights.tsx` asks `/api/flight-fallback`
→ `googleFlights()` in serpapi.ts (Google Flights via SerpApi, same paced
free allowance as hotels, edge cache 20 min). Each fare opens Google Flights
on the same route/dates (checked: same 19 flights and prices). Always shows
links to the same search on Google Flights, KAYAK, Skyscanner. No allowance →
links only, no numbers. Fallback earns nothing (no partner).

**Phone check + speed (13 Oct late, owner: "slow, many buttons don't work on the phone"):**
`scripts/mobile-taps.mjs` + workflow `mobile-taps.yml` (by hand): every button
on 14 main pages tapped on emulated Pixel 7 / iPhone 13, fresh page per tap →
all worked (only already-selected ones changed nothing), no page errors.
`mobile-speed.yml` (Lighthouse mobile, report in scripts/mobile-speed-report.txt).
Found: Stay22 LetMeAllez held the main thread 0.7 s per page, 3.9 s on home
(taps ignored meanwhile) → now only on /results and /hotel-results
(`Stay22LinkSwap.tsx`), lazyOnload; gtag lazyOnload; logo 175 KB PNG → 9 KB
WebP (`sfrtna-logo-360.webp`); Arabic faces self-hosted in public/fonts with
2 preloads (CLS home 0.13→0.006); hero srcset 828w/1280w. Home score 37–63 →
84, TBT 3.8 s → 0.46 s. Still: LCP ~5 s on some pages (photos, noisy runs),
dictionary chunk ships both languages (~100 KB raw) — next.

**Section 7 item done early, 13 Oct (owner's screenshot):** home photo is the
background of the whole home block down to the footer's gold line
(`.home-photo` wrapper in `[locale]/page.tsx`: fixed layer + clip-path, so no
re-crop when the planner changes height); app header clear over it until
scroll (`data-solid` on `.site-header-bar`, CSS `html.in-app:has(.home-photo)`).
Checked desktop, 390 px phone, app.

**Section 4 done, 13 Oct (owner's screenshots + spec):** `NextStepTabs.tsx`
under flight results (`current="flight"`) and hotel results
(`current="hotel"`): four tabs in one row, each with its own SVG picture —
hotel ↔ flight (the page's own service swapped), «خدمات رحلتك» (sheet with
`TripServices`), «خطة سياحية» (city attractions page `?from&to&plan=1#trip-plan`,
planner reads the dates from the address), «المعالم السياحية». Every target
carries `back` (hotel results + attractions show «العودة إلى نتائج رحلتك»).
Opened tabs / booked flight («احجز» → `markStep`) / hotel partner click are
remembered per city in sessionStorage `sfr-steps` and not offered again.
Replaced on the flight page: hotel banner, services table, itinerary prompt
(to the mock planner) and attractions card. Live-tested 13 Oct: all four
tabs, sheet, plan dates prefilled, back link, hotel page swaps in flight,
phone row 138 px. e2e check added. Flight tab from the hotel page opens the
home form (filled in); its way back is the browser's back.

## Coverage section (13 Oct, owner: "cover every tourist country and city, accurate, ≥ 90 %") — IN PROGRESS, before section 2

Owner sent a list of 335 tourist cities / 135 countries (6 continents); the
site had 214 / 73. Decisions (mine, owner said "do the best and accurate"):
- **Gate:** `scripts/coverage/check.py` → `scripts/coverage/report.md`: per
  city, required = centre, gateway airport, trip type, climate + season,
  places, hotels, country visa + currency; expected = tourism months, guide,
  photo. New cities are **staged** (`scripts/geo/batch2.json` → workflow
  `geo-stage.yml` → `scripts/geo/out/batch2.staged.json`: Nominatim centre +
  owner's gateway airport checked in OurAirports) and go live only when
  complete. 156 staged (68 in covered countries, 88 in 63 new; Gabala was
  a duplicate). The stage report caught wrong gateways/centres — always
  read its `review` list. TW, HK, MO are not in `countries.ts` yet.
- **Fixed live:** 8 gateway airports (Makkah TIF→JED, Kyoto ITM→KIX, New
  York LGA→JFK, Interlaken→ZRH, Bruges→BRU, Agra→DEL, Bursa→SAW,
  Alexandria ALY (closed) → HBE); Bulgaria = euro; 55 currencies added
  (11 live countries had none); visa +26 countries (176/214 live cities).
  Visa still to confirm: AM, AU, BR, IE, JO, KH, KW, KZ, LB, MA, ME (free
  until 31 Oct 2026, then visa — Official Gazette 108/2026, not yet read
  on gov.me), MU, PK, TN, TZ + new countries. Many official visa pages are
  JS-only: the owner's Chrome window must be **visible**.
- **Climate accuracy (measured):** ERA5-Land daily highs read 1.7 °C cold vs
  94 official stations (46 % of city-months within ±1.5 °C). New pipeline:
  official station within 25 km (WMO normals `data/wmo_normals.json`, else
  NOAA GHCN-Daily `data/ghcn_normals.json`, both from workflow
  `climate-stations.yml`); else ERA5-Land calibrated by up to 3 stations
  within 150 km (ERA5-Land downloaded at the stations too); else regional
  median correction (±10° latitude). `validate_climate.py` = leave-own-
  station-out test, target 90 % within ±2 °C. Plan: 249 cities direct,
  69 calibrated, 52 regional (Athens, Hanoi, São Paulo, Auckland, Muscat…
  — official national normals for these would be better: station_overrides).
- **Season rating:** to be rebuilt on the Holiday Climate Index (published:
  HCI:Urban Scott et al. 2016, HCI:Beach Rutty et al. 2020; `hci.py`,
  daily, `build_hci.py` → `src/data/climate/hci.json`), keeping our safety
  caps (HCI alone rates 42 °C dry as "good"). Validate against tourism
  months before replacing v1 (v1 today: 83 % of board months rated good,
  62 % of our top months in the board's list; wrong in humid tropics and
  Salalah khareef). Engine v2 not written yet — needs hci.json.
- **Staged data collected ahead (13 Oct evening):** places, hotels and
  restaurants workflows take input `staged` (scripts use `--staged`,
  `scripts/lib/cityPoints.ts`); files land under the usual folders but no page
  links them until the city is in cityCoords.ts; build-index skips staged
  hotels. Partner pages (check-pages.ts) run at publish time (needs the city
  in COUNTRY_CITIES). Visa 13 Oct evening: + AU BR IE KZ LB MU PK AM ME
  (ME switches to required on 1 Nov via `then`); still JO KH KW MA TN TZ.
- **Owner runs (his Copernicus key never leaves his PC):**
  `scripts/climate/run_coverage.bat` (fetch_static, 6 ERA5-Land workers,
  fetch_cloud — hours), then `run_build.bat` (check_cells, build_normals,
  merge_sources, validate_climate, build_hci). Then Claude collects
  era5land.json, normals.json, hci.json, reports via the device bridge
  (owner adds his Sfrtna folder), tunes engine v2, validates, publishes.
- Tourism months: many cities genuinely have none (Tokyo, Singapore,
  Prague, Budapest: Lonely Planet names no single best period) — "expected",
  not required.

**13 Oct afternoon, owner said "do all my notes":** done and live —
section 2 hotels (every site's price, «عرض السعر», cards + more pages + the
partners' full list always), section 5 (one row of city tabs), section 6
(/services with city/country search), section 3 (travel-tools plan opens the
city planner; site calendar; «بدون تفضيل»; meals from stored OSM restaurants,
workflow `restaurants.yml`), section 7 rain line + cached fares removed.
Results in TEST_PLAN sections 2, 3, 5, 6. Accounts (13 Oct evening, live, switched off until settings exist):
`accounts.js` SQLite Durable Object `ACCOUNTS` (users, sessions = token hash,
codes, plans by place key; delete account removes all), `src/lib/accounts.ts`,
routes /api/auth/{me,email-code,email-verify,google,signout,delete},
/api/plans (+/delete), page /[locale]/account (`AccountPanel`), `AccountLink`
in header, phone drawer and «المزيد», `SavePlanButton` in the plan view
(signed out → plan kept in sessionStorage, sign in, saved, back with
`?saved=<id>`; planner rebuilds the plan from its places). Google button via
Google Identity Services — hidden inside the app (Google refuses WebView
sign-in; app uses email). **Owner settings to switch on:** `GOOGLE_CLIENT_ID`
(Runtime variable; OAuth web client, origin https://sfrtna.com) and
`RESEND_API_KEY` (Secret; domain sfrtna.com verified in Resend). Each method
appears only when its setting exists. Tested: DO logic in local workerd
(code, wrong/reused code, Google link to same email, plans, rate limit,
delete), Google token checks (good/aud/exp/tampered/unverified email), live
/api/auth/me + 401 on /api/plans + page shows "not available yet".
Still open: visa for the remaining countries (needs a visible
Chrome), climate v2 after the owner's download, publishing staged cities.

**Phone speed, round 2 (14 Oct 00:00):**
- Report (`mobile-speed.yml` → `scripts/mobile-speed-summary.mjs`) now prints
  LCP phases (TTFB / load delay / load time / render delay), HTML size and
  the requests before LCP. A fresh run showed the "LCP ≈ 5 s" pages at
  2.1–2.9 s, the next run 1.9–6.3 s for the same pages: single Lighthouse
  runs on GitHub's shared machines swing by seconds. The workflow now warms
  the edge cache (a deploy changes the cache key), runs every page 3 times
  interleaved and reports the median run + every run's LCP, each run's
  observed paint times, and one applied-throttling run per page. The slow
  simulated runs are runs where the CI machine painted late; applied
  throttling gives LCP 2.0–3.0 s on every page (TEST_PLAN «Phone speed»).
  Judge on the applied run + medians, never one simulated run.
- **Words, one language per page:** `src/lib/dict/ar.ts`, `en.ts`;
  `src/lib/dictionaries.ts` = server only (both). Client components call
  `useDictionary()` (`src/lib/dict/context.tsx`); the [locale] layout passes
  `clientDictionary(dict)` — only the sections client code reads
  (`src/lib/dict/clientSections.ts`; `legal`/`home`/`attractions` key-picked).
  The hook's type is that shape, so reading a missing section fails `tsc`
  → add it to clientSections.ts. `scripts/check-client-words.mjs` (prebuild)
  fails the build if browser code imports `@/lib/dictionaries`. Per page:
  ~124 KB less JS to parse, ~25 KB less to download on a first visit (HTML
  +15 KB gz carries the words). Two providers (one per language) were tried
  first: Turbopack put both in the layout's chunk — don't retry that.
- **Home strip:** the marquee drifted every in-season city twice (78 → 156
  cards, DOM 2,640 elements); now the top 16 (`MARQUEE_CITIES` in
  HomeShowcase), «تصفّح كل وجهات <شهر> (N)» still opens all N as a grid.
  DOM 656; style/layout −0.5 s at 4× CPU slowdown.
- **Headline font:** home h1 is Tajawal 900, not preloaded → fetched after
  the scripts and repainted (that repaint was the LCP). Arabic home now
  preloads `/fonts/tajawal-ar-900.woff2`. English home: Latin 900 is a
  hashed fontsource file — not preloaded.
- **Hero photos on our domain:** `scripts/hero-photos.mjs` +
  `hero-photos.yml` (on change of heroPhotos.ts or by hand) → 13 heroes ×
  828/1280/1920w WebP in `public/hero/`, listed in `src/data/heroLocal.json`;
  `heroImage()` uses them when listed (4K screens still Pexels 3840w). Saves
  the second connection (DNS+TCP+TLS) before the largest paint.
- e2e: the multi-city calendar test looked inside the form box; the shared
  date picker is a dialog → fixed. Local e2e: 7/8 (route suggestions need
  fare data, pass live).

## Owner's notes of 20 Oct — done (live)

- **Flight filters (Wego-style)** in `FlightResultsGuide.tsx`: stops, features
  (no night flights = in the air 1–5 am or overnight stop; no long stops > 4 h;
  no self-transfer; bag included), outbound/return time slots, airlines, and
  **booking sites** read from the widget's own agencies list (each site's
  cheapest) and applied by ticking the widget's hidden checkboxes (one click
  per second, kept in sync while chosen). Filters narrow the pick, tabs and
  lists; counts per option are faceted.
- **Discover:** kinds of place multi-select (`preferenceCategory` comma list →
  `preferenceCategories`), continent + kind pills on results.
  Pending owner: show «أرخص سعر رُصد» on cards (cached fares) or keep no number.
- **Hotels:** suggestions show Arabic names/areas on the Arabic page
  (`arabicHotelName` in hotelIndex.ts: only when every word is known — chains,
  generic words, our cities); the same on price results (`lang=ar`). Named
  hotel = `BookPanel` (cheapest + «احجز الآن», «قارن الأسعار في N مواقع»),
  `one=1` asks Google by the hotel's id when a name returns a list; all
  amenities + key features. Preferences now Google's own filters
  (`src/lib/hotelPrefs.ts`): kind of place (all/apartment hotels/resorts/
  boutique/beach/**apartments-villas-chalets = vacation rentals**), guest
  rating, free cancellation, facilities; list sort on the client.
  «ابحث لدى بقية شركائنا» shown only when no list/price exists.
- **Flight + hotel:** third home choice; `TripPlanner combo` + `ComboHotelFields`;
  hotel half rides in the address as h* keys (`src/lib/combo.ts`);
  `/results` shows a two-budget bar and `ComboHotelSection`; discover cards
  carry it. Round trip only.
- **Photos:** stored choices moved to `public/data/photos.json`, read through
  ASSETS (`storedPhotos()` in pexels.ts) — never bundled into the Worker
  (900+ subjects × 3 would have been ~800 KB in every route chunk → 1102).
  `scripts/check-bundle-json.mjs` (prebuild) fails the build on any imported
  JSON > 800 KB. src/data/pexelsPhotos.json is no longer read (kept, not deleted).
- **App:** home photo = top 62 svh fading to navy, home block fills the
  screen (no white), body navy on app home; Book tab opens the flight form;
  first-launch intro `AppWelcome.tsx` (3 cards, once).
- **Store buttons + install suggestion:** `src/lib/appLinks.ts` (empty until
  the listings exist), footer `AppStoreButtons`, `AppInstallBanner` (phone
  browser only, its OS's store, after the cookie question, 14 days quiet).
- **Monitoring:** Workers Logs on (`observability` in wrangler.jsonc); GA4
  `exception` (browser errors), `service_failure` (flight widget not loaded,
  discover error, hotel list down), `flight_filter`; combo searches are
  `search_type = flight_hotel`; site check every 2 h.
- Chalets: no public affiliate programme found for Gathern; chalets reach us
  through vacation rentals (Google lists Booking/Vrbo/Airbnb offers) — owner
  may contact Gathern directly.

## Whole-project pass, 20 Oct afternoon (owner: "apply every note to the whole site and app")

- **Audit tool:** `scripts/ux-audit.mjs` + `.github/workflows/ux-audit.yml` (by hand):
  26 pages, two phones, browser + app UA, flags overflow/off-screen/wrapped/
  cut/blurry (real file pixels)/tiny taps/dead-end words/empty bands/errors,
  full-page JPEG per page; report + shots force-pushed to branch
  `ux-audit-results` (artifacts and logs are not reachable from the
  workspace). Run it after every section.
- Flight fallback has priority on SerpApi (`FLIGHT_RESERVE` 40, hotels stop
  above it); fares shown with price + «احجز», no warning banner.
- Hero photos: portrait crops (sharp attention, 720/1080/1440) made by
  `hero-photos.mjs`, listed in `src/data/heroPortrait.json`, used by the home
  and every PageHero via `<picture>` (orientation: portrait). The host's own
  crop answered at CSS width — not used. NB: `img.naturalWidth` of a srcset
  image is divided by its density — measure the file itself.
- No dead ends: discover cards show the fare that chose them + «ضمن ميزانيتك»
  + «احجز» (owner asked to show the price, 20 Oct); unpriced places only on
  hotel-only searches; a hotel with no price → «فنادق <المدينة> المتاحة»; no
  plain partner-search pills on hotel pages.
- Seasons opens on this month; recent searches on the home planner
  (`recentSearches.ts`, this browser only); share button on flight/hotel
  results; welcome cards as points; 40 px taps site-wide.
- **Business decision open:** SerpApi plan — the free 250/month was spent by
  20 Oct (162 used), so hotel city lists fall back to the partners' English
  widget. Proposed Starter $25 (1,000) or Developer $75 (5,000).

## Accounts, membership and app sign-in — 21 Oct (owner: "do all three; Apple later")

- **Member features** (owner: only accurate ones), stored in the Accounts DO
  table `items` (`accounts.js`; kinds profile / fav / search / trip, limits
  1 / 200 / 20 / 30), routes `/api/me/items` (GET, POST) and
  `/api/me/items/delete`, validation in `src/lib/memberItems.ts`
  (`cleanItem`), client store `src/lib/useMember.ts`:
  - profile: home airport, travellers, currency, direct/bags, breakfast,
    stars → fills an empty TripPlanner/HotelPlanner once (`useProfileOnce`);
  - favourites: `member/FavButton.tsx` ♡ on city pages (hero), discover
    cards, named hotel page; list in «حسابي» (#favs);
  - searches: `rememberSearch` also keeps them in the account when signed in;
    home «عمليات بحثك الأخيرة» merges account + browser;
  - trips: «احجز» on flight results (single trips) saves the trip
    (`keepTrip` in results page) → «رحلاتي» (#trips) with countdown, «حجزتها»
    (the traveller says so — we cannot see bookings), get-ready checklist
    (hotel, services, plan, visa — ticked by the traveller, each with its
    link, `member/tripLinks.ts`); home shows the next trip within 60 days
    (`member/UpcomingTrip.tsx`).
- **Encouraging sign-up:** `member/JoinHost.tsx` (layout) — sheet listing the
  six benefits (`member/JoinBenefits.tsx`, dict `member.benefits`) opened by
  ♡ or the first «احجز» of a visit when signed out; toasts confirm saves;
  benefits on the sign-in card; More sheet subtitle. GA4: `join_prompt`,
  `favourite`, `login` (google_auto).
- **App sign-in (no Google WebView):** `src/lib/appAuth.ts` — PKCE verifier in
  the app, Custom Tab to `/{l}/account/app?c=<challenge>`
  (`member/AppHandoff.tsx`; Google button works there), `/api/auth/app-code`
  issues a 2-minute one-time code bound to the challenge, the browser opens
  `sfrtna://auth?code=…&lang=…` (intent filter on MainActivity), the app
  loads `/{l}/account?app_code=…` and trades code + verifier at
  `/api/auth/app-exchange`. Needs the new APK (plugin `openAuth`, `info`
  features ["auth","google"]); an old APK keeps the sign-in link hidden.
- **Staying signed in:** sessions renew while used (`SESSION_RENEW_DAYS`
  90, cookie re-set by /api/auth/me). Silent Google sign-in on app open:
  `member/AppAutoSignIn.tsx` → plugin `googleSilent` (Credential Manager,
  authorized accounts only, auto-select), once per launch, never after a
  deliberate sign-out (`sfr-no-auto`). **Works only after an Android OAuth
  client (package com.sfrtna.app + signing SHA-1) exists in the same Google
  Cloud project** — test APKs are signed with a fresh debug key per build,
  so this waits for the Play upload (Play App Signing SHA-1).
- DO logic tested in local workerd (code flow, wrong verifier, reuse, items,
  search eviction, delete account). Email sign-in still needs
  `RESEND_API_KEY` (owner).

## AI planner + budget advisor — 21 Oct (owner: "our places DB is very bad"; "budget advisor for both cases")

- Smart plan (`src/lib/ai/plan.ts`): the AI picks the city's best places and
  restaurants itself via web search (>= 4.3 with many reviews, rating string,
  website, local name, area); our stored lists are hints only. Stops placed by
  stored-name match -> Photon (<= 24) -> model coordinates within 60 km.
- Budget advisor, two modes (`BudgetAdvisor.tsx`): «كم أحتاج؟» (default) and
  «أعرف ميزانيتي». Estimate = `POST /api/budget-estimate`
  (`src/lib/ai/budgetEstimate.ts`): flight live (Travel Explore, else Google
  Flights with pace "explore"), hotel live (Google Hotels list, well-rated, a
  room per two adults), daily spending (food/transport/tickets + one-offs,
  per traveller, AI web search, cached 14 days per city+level, labelled
  «تقدير من مصادر منشورة»). Suggested budget = high end + 10 %, shown ONLY
  when every part is priced; else «ما حسبناه حتى الآن» + what is left out +
  hotel link. No destination -> cheapest 18 places for the dates (live fares).
  AI text without a budget switches to estimate mode.
- Live 21 Oct: flight part works (RUH->IST 23-28 Nov, 2 pax: 2,594 SAR);
  hotel part empty because SerpApi has 47 left (reserve 40) until 6 Nov;
  daily part waits for `OPENAI_API_KEY`. UI checked at 390 px (local, mocked).

## City guide — our own place database, 21 Oct (owner: "our places are very bad"; "no cost we cannot recover")

- **No AI per visitor.** AI writes once, stored; the site reads files.
- Facts: `scripts/guide/build-facts-wd.ts` (Wikidata query service, CC0 facts,
  no Wikipedia text): items within 20 km with articles in >= 4 languages,
  classes sorted into groups (`src/lib/guideTypes.ts` GROUPS) through parent
  classes; ruled out: settlements, schools (unless also a mosque/museum/
  palace — Al-Masjid al-Haram is P31 "educational institution"), hospitals,
  stations, stadiums, airports, hotels/offices (unless >= 45 languages, e.g.
  Burj Al Arab). Famous-only classes (skyscraper, tower, street, library,
  strait, archipelago) need >= 45. Ranked by fame + World Heritage +
  visitors; top 150 per city → `public/data/guide/<slug>.json` (ASSETS).
  Report with "dropped (famous)" in `scripts/guide/reports/facts.txt` — read
  it when tuning. (`build-facts.ts` = the older OpenStreetMap route, 5–10
  min a city on Overpass; kept, unused.)
- Write-ups: `scripts/guide/write.ts` — Gemini free tier (GitHub secret
  `GEMINI_API_KEY`, AI Studio key in the Default Gemini Project, no billing):
  per place Arabic/English description, visit minutes, best time, dress,
  tip, kids, open_to_public (`out` = seen from outside → not in plans),
  Arabic name when Wikidata has none (`an`). 15 places a call; newest Flash
  models have tiny free daily limits, `gemini-3.5-flash-lite` does the bulk
  (no quota hit in 2.5 h); Gemma last. Notes in `reports/write.txt`.
- Workflow `guide.yml`: daily 08:11 UTC (after the Pacific-midnight reset),
  facts refresh after 25 days, write-ups continue where they stopped.
  Status 21 Oct evening: 365 cities, 20,438 places kept, ~6,200 written,
  171 cities plan-ready; the rest fill in over the next runs.
- Site: city page list gets «⭐ الأبرز (N)» / «الكل (N)» (never a shorter list),
  badges (World Heritage / city highlight / visit length / seen from outside),
  «تفاصيل الزيارة» (best time, dress, tip, readable OSM hours when known,
  website, kids, free entry). Joined to listed places by OSM id, else
  position + name (or a famous place within ~130 m).
- «خطتي الذكية» = `src/lib/guidePlan.ts` when the city has >= 6 written places
  (`/api/ai/status?city=` → guide): interests → groups, first visit vs
  return, kids, pace; variety (<= 2 of a kind a day, one place of worship a
  day, no two of a kind in a row); a day per part of the city; theme parks
  alone; times from start + visit + travel (walk < 1.5 km); lunch/dinner =
  best-documented nearby stored restaurant, halal-tagged first, no chains or
  cafés; free time shown; weather/wear from our climate normals. OpenAI path
  (`src/lib/ai/plan.ts`) only if `OPENAI_API_KEY` is ever set.
- Known gaps: Saudi cities thin in Wikidata (Abha 1 place) — the full list
  stays; photos wait for the Pexels reset (25 Oct); restaurant ratings: none
  (owner approved members' 👍/👎 later — the "learning layer": shared
  plan templates, aggregate signals, member memory with consent).

## Viator — linked 21 Oct (owner)

- Production API key (Basic Access) live as Cloudflare Secret `VIATOR_API_KEY`
  (no `VIATOR_ENV`; set it to `sandbox` only for a sandbox key — `viator.ts`
  switches host). `/api/health` → `viator` {status 200, destinations 3398}.
  Read it from the workspace with workflow `health-report.yml` → branch
  `health-report` (health.json).
- Terms accepted: content only to drive affiliate traffic, own domain/app
  only, no bidding on "Viator", **no indexing of Viator unique content**
  (render it client-side / noindex), licence agreement.
- Payout: bank transfer (USD, min $50, monthly for trips travelled the month
  before) set in Finance → Payment Methods; billing address = owner's national
  address; contact details filled. Account still named "iTravel" → owner to
  ask support to rename; ID verification: **Verified** (owner, 21 Oct 23:01).
- **Live 21 Oct night:** `viatorDestinationFor()` maps a city by name within
  60 km else nearest city-like within 25 km (Istanbul → 585, Riyadh → 50285),
  cached a week; `/api/viator/offers?city=&q=&n=` (browser only; Viator's
  content never in our HTML) → city tab «الأنشطة والتذاكر», «🎟️ عروض
  التذاكر» on place cards and in the smart plan. Booking URLs carry our
  pid/mcid (tracked). Viator rate-limits /destinations: ask it only through
  the cached list (a 429 is never cached as "no offers"). Check from the
  workspace: workflow `health-report.yml` (offers-*.json, `debug=1`).
  Prices shown in USD as Viator gives them, label «السعر الآن».
- Next: map our 365 cities to Viator destination ids; attraction cards with
  live ticket price + rating + book (client-side); tours per day in the smart
  plan; budget advisor activities from live prices. Ingestion
  (`/modified-since`) needs a request in the dashboard — not needed for
  real-time search.

## Next, in order

**Search Console (owner's mail of 12 Oct, read 22 Oct):** new non-indexed
reasons — Alternate page with proper canonical, Duplicate without
user-selected canonical, Blocked due to access forbidden (403), Soft 404,
Page with redirect. Normal ones: redirect (/ → /ar, workers.dev → sfrtna.com),
alternate (our own canonical works, `src/lib/seo.ts`). To check: which URLs
are 403 (robots.txt already closes /api/ and results pages, so a 403 is
elsewhere — Bot Fight Mode / AI Labyrinth on Googlebot, or /data/*), which
pages lack a canonical (pages without the seo.ts metadata, or address
variants with ?query), and soft 404s (thin/empty pages). Owner to send the
example URLs per reason from Indexing → Pages in the new conversation.

**▶ Start here (hand-off 21 Oct 23:50):** this conversation built the city
guide (Wikidata + Gemini), the smart planner on our own engine (everywhere:
/itinerary, city pages, app «المزيد»), the budget advisor's estimate mode
(stored city costs `public/data/costs.json` + live prices where possible),
membership/app sign-in, and Viator (live). Background jobs still filling in:
`guide.yml` daily (write-ups for remaining cities; facts with kinds `kd`;
costs). A run with task=all, only=all was queued 21 Oct ~21:00 UTC (facts
with kinds for every city → costs → write-ups); a new dispatch while one is
pending REPLACES it (same concurrency group) — check before dispatching.
Check `scripts/guide/reports/*.txt`, `public/data/costs.json` and counts first.
Owner is doing payouts (bank details in each partner): Travelpayouts (PayPal
limited → bank), GetYourGuide (add bank), Stay22 (upload national address as
address proof); Viator ✅ bank, Expedia ✅, RateHawk ✅ (W-8BEN review).
Open items for Claude: phone check of Viator offers + smart planner (owner's
screenshots); learning layer (shared plan templates, 👍/👎, member memory —
owner approved the order); budget advisor live activities from Viator.

**▶ Start here (hand-off 20 Oct):** coverage section closed — 365 live cities /
133 countries, all checks green (Site check, e2e, phone taps on 30565a7). The
owner opens a new conversation with **a list of notes — work on that list
first**, one section at a time. Open before the closed beta:
- Owner: payout method to replace PayPal (Travelpayouts); Android phone test;
  one «احجز الرحلة» seen in Travelpayouts; settings `GOOGLE_CLIENT_ID` +
  `RESEND_API_KEY` to switch on sign-in.
- Claude: re-test TEST_PLAN 3.4 (meals — restaurants now stored, 361 files),
  2.8/2.9, 3.7, 5.5/5.6, 6.1 (phone 390 px iframe + app); photos for the 151
  new cities fill in after the Pexels reset on 25 Oct (photos.yml hourly) —
  check after; Madagascar visa (official page), Cusco/Paro/Pohnpei/Valletta/
  Madeira/Kazbegi climate (national normals).

**Previous hand-off (14 Oct):**
1. ✅ **Phone speed closed 14 Oct:** re-run on 33c8fac, applied throttling
   1.9–2.1 s on all 8 pages (TEST_PLAN). History: /ar/itinerary 3.0 s and /ar/visa
   2.7 s (applied throttling) are just over 2.5 s (their HTML is small:
   itinerary 82 KB raw, visa 165 KB — the time is not page data).
   ✅ /ar/seasons (14 Oct): months now sent packed (`src/lib/seasonPack.ts`:
   each month a row of numbers into one table of 113 distinct strings,
   rebuilt once in `CitySeasons`). HTML 725 → 217 KB raw (−70 %), 64 → 51 KB
   gz; en 643 → 196 KB. Local before/after at 390 px: month view (78 cards),
   six month windows, Istanbul year view — identical text, no errors; all
   3,456 city-months round-trip exactly. Biggest JS chunk
   (`3svhqtx…`, 72 KB gz) is the framework. Re-run both speed + taps
   workflows after each change.
2. **Climate (14 Oct):** download finished; build run by Claude on the
   owner's PC through the bridge (`C:\Sfrtna-climate` granted; the PC's Linux
   workspace runs the Python steps — `pip install --user numpy pandas xarray
   netCDF4 timezonefinder`; each call ≤ 3 min, so run build_normals /
   build_hci repeatedly — both cache per place; background jobs die between
   calls). Results: 363/363 places (8 islands via NASA POWER from workflow
   `climate-power.yml` → branch `climate-power`, copied to raw/power/ — the
   PC cannot reach NASA). Accuracy (validate, cities treated as if they had
   no station): highs 90 % calibrated / 87 % regional, lows 84 / 83 %;
   236 of 363 places publish their own official station → site-wide est.
   ≈95 % highs, ≈93 % lows within ±2 °C. New rule: one station alone
   calibrates only within 60 km (`CAL_SINGLE_MAX_KM`; Doha from Bahrain
   140 km was +4 °C). **Season engine v2 (HCI) evaluated and NOT adopted**
   (`scripts/climate/reports/engine-v2-evaluation.md`: no better than v1.1
   vs tourism months, worse in the tropics) — v1.1 stays, fed the new
   normals. ✅ **Published 14 Oct (afternoon):** owner ran `1d_BETTER_CELLS.bat`
   (75 of 84 moved cells re-downloaded today, 6 were already right; Kotor,
   Herceg Novi, Seogwipo: the better cell has no ERA5-Land data → old cell
   kept). Build (check_cells → normals → merge → validate → hci) on the PC.
   Accuracy: highs 91 % calibrated / 88 % regional, lows 85 / 84 % (was
   90/87, 84/83). **Bug fixed in merge_sources.py:** the comment said Gabala
   from Akhty (55 km, across the Caucasus) is refused, but the 60 km rule let
   it in (+6.9 °C; Gabala July 32.7 °C) → new `CAL_SINGLE_MAX_OFFSET_C` = 4:
   a lone station correcting any month by > 4 °C is refused → regional
   (Gabala now Jan 4.2 / Jul 28.5). **Valletta withheld** (cell_overrides):
   Malta's Luqa station is in neither WMO nor GHCN normals; Sicilian
   stations 103–133 km give July 27.5 °C (~4 °C cold) → needs Malta Met
   Office normals. Withheld now: madeira, kazbegi, valletta.
   travelSeasons.json now from these normals: **211 of 214 live cities
   rated (was 144)**; of the 144 old ones 92.2 % of months keep their class,
   1 month jumps two classes (Al Wakrah Oct, high 35.1 → 37 °C), 30 cities'
   best months shift by about a month (Doha drops Apr, Lisbon adds Feb…).
   Home/seasons "best in October": 78 → 110 cities. Season tests 25/25.
   Known weak spots (not withheld, within ~2 °C): NASA POWER islands (Mahé,
   Praslin, Maafushi ~2 °C cold); staged high-altitude cities on regional
   correction (Cusco ~3 °C cold, Paro ~5 °C cold — fix with national
   normals before they go live). Next: the 156 staged cities.
   **Outage 14 Oct 15:15–15:25 and fix:** the new travelSeasons.json (5.8 MB,
   all engine fields) is bundled into the Worker — 4 copies, one per route
   chunk — and every /api route returned Cloudflare 1102 (resource limit);
   the site check caught it. Restored the old file (70f25b6), then: the site
   now imports `travelSeasons.site.json` (1.37 MB, only the 18 fields in
   `src/lib/travelSeason/siteFields.ts`; written by generate_seasons.mts;
   `SeasonRecord` in site.ts is a Pick, so reading another field fails tsc).
   The full file stays for scripts/tests only. **Rule: never import a large
   data file into Worker code — slim it or serve it via ASSETS.** Measured
   limit: 1.37 MB worked, 2.0 MB → 1102; keep any imported JSON well under 1 MB
   (check `wrangler deploy --dry-run` Total Upload before pushing).
2b. **Coverage batch 2 — publishing (14 Oct, afternoon):** trip types for
   all 156 staged cities (destinationTypes v1.3; Dhaka not "tropical", 23.8°N);
   HK, MO, TW added to countries.ts; generate_seasons now rates staged cities in
   the full travelSeasons.json (9.9 MB, scripts only) while the site file stays
   live-only (`liveSlugs` from cities.ts). Visa +31 countries (official pages,
   each `checked: 2026-10-14`): HK MO free; EC SV ZM BW free; RW ET BN arrival;
   MZ BT UG LA eta; AR CO PE UY CL BO DO JM BS BZ ZW NA TW BD MC SN FJ SB
   required. **Still no official status (their cities stay staged):** AD BB CR
   CU CV DZ FM GH GT GY HN MG MK NG PA PG PW PY SM SR TO TN TT VA VU WS (+TN
   live). Paraguay's migraciones.gov.py unreachable; Guatemala's IGM site moved
   (404); Costa Rica's directive is a scanned gazette.
   `scripts/geo/publish_staged.py` (dry run / `--apply`) moves complete staged
   cities into cities.ts, cityCoords.ts, cityAirports.ts, airports.ts; HOLD:
   cusco, paro (climate several °C cold). Places + hotels for staged cities:
   workflows started 13:32 UTC with `staged=true` (13 Oct runs had been
   cancelled). Dry run before they finish: 124 ready except places/hotels,
   32 waiting on visa. After publish: partner-pages.yml, mobile-taps.yml,
   live check.
   **15 Oct ~03:40 UTC: 102 cities published** → live 316 cities / 104
   countries (site seasons 313; madeira, kazbegi, valletta withheld), 78
   gateway airports added, hotel index 129,552 hotels. Collectors now stop
   after `STOP_AFTER_MIN` (300) and commit; the 13–14 Oct runs had hit the
   340-min job limit with nothing saved. Gate fixes in publish_staged.py:
   staged hotels are read from `scripts/hotels/cities/` (build-index writes
   public/data/hotels only for live cities → run
   `npx tsx scripts/hotels/build-index.ts` after `--apply`), currency
   overrides (EC/PA/SV/PW/FM/ZW = USD) count, one-line country blocks
   (`MV: [{…}]`) are opened before appending, quotes stripped from airport
   names. **Outage 15 Oct ~03:50 UTC:** the first push (season site file
   2.0 MB for 313 cities) made every /api answer Cloudflare 1102 again →
   reverted at once (2ab9e50), then the site file is now **packed**
   (`generate_seasons.mts`: `fields` + one string `table` + rows; strings as
   `[index]`), unpacked per city on first use in `site.ts` → 339 KB for 313
   cities; 211-city unpack checked identical to the old objects. Worker
   upload 15.5 → 10.7 MB (2,188 KiB gzip). Re-published with it (6cc1ed3; Site check `check` passed, `pages`
   flaky once on the next-step tabs click, passed on the 04:47 run; partner
   pages now cover 316 cities). **15 Oct 08:20: +22 cities** (the re-run
   collectors finished them) → **338 live** (site seasons 335), site file
   362 KB, Worker 10.8 MB / 2,208 KiB gzip. Live 338 cities / 110 countries.
   **15 Oct ~06:40 UTC: visa for 22 more countries** (official pages, each
   `checked: 2026-10-15` with quote): free GT HN BB PA VU WS FM; arrival CV
   PW; eta CU (e-visa since 30 Jun 2025) NG (eVisa); required DZ MK CR PY GH
   PG TT TO, and SM/VA/AD (reached only through Schengen; SM tourism office
   "open to all those who have a valid visa to enter Italy"). GACA circulars
   (gaca.gov.sa Air-Transport-Facilitation-Circulars) are an official Saudi
   source for exemptions (Honduras = no. 180) — check them first next time.
   **+24 cities → 362 live / 131 countries**, site seasons file 388 KB, Worker
   10.9 MB / 2,239 KiB gzip. Then TN free (SPA 30 May 2012: Tunisia
   exempts Saudi citizens), GY required (MFA list 17 Jul 2025), SR eta (online
   Entry Fee; visa only for 21 listed countries) → **365 live / 133
   countries**. **Still staged (5):** MG antananarivo, nosy-be (no official
   page found — Madagascar e-visa news only); HOLD cusco, paro; pohnpei
   (climate withheld). Rerun the dry run when the collectors commit; publish the rest the same way.
3. **Visa:** MA ✅, TZ ✅, KW ✅, KH ✅, JO ✅ 14 Oct. KW free — Saudi Jawazat
   via SPA (spa.gov.sa/2349663): GCC travel with the national ID. KH eta —
   MFA exemption list (image on mfaic.gov.kh) has no Saudi Arabia; official
   e-Visa (evisa.gov.kh) has no nationality limit (application behind a
   CAPTCHA — not passed). JO free — Royal Jordanian (national carrier):
   "GCC Countries do not require entry visas"; Jordan MOI/MFA/visitjordan
   pages list no exempt nationalities (checked). Each entry now carries its
   own `checked` date (shown on /visa/<code> and the requirements dialog;
   they all said 26 Sep before). **TN still open:**
   diplomatie.gov.tn has no list, Saudi embassy portal (saudiembassy.sa →
   tn.saudiembassy.sa) has no host-country entry page, IATA Travel Centre
   freezes the test browser at the results step. Next for TN: the owner (or a
   visible Chrome) runs IATA Travel Centre RUH → TUN once, or a Tunisian
   embassy page naming Saudi Arabia.
4. **Accounts:** ✅ owner tested 14 Oct 01:05 — saving the plan to the
   account and the plan PDF work.
5. **PayPal (owner, 14 Oct):** owner's PayPal account permanently limited;
   Travelpayouts payout was PayPal → needs another payout method before
   launch (no earnings yet). Appeal drafted for the owner.
6. Owner asks: reply in Arabic, test on phone (390 px) before saying ready,
   no big blank spaces, labels centred in tabs, ask only business decisions.

Older order (kept):

**▶ Start here: finish the coverage section above (owner's ERA5 run →
climate v2 → publish staged cities complete), then section 2 — hotel results.**
Done so far: section 1 (flight search, 22/22 in `docs/TEST_PLAN.md`),
section 4 (next-step tabs), section 7 item "home photo full-bleed" (+ app
logo on the photo, 40 px gap to the footer). Remaining order: 2 → 3 → 5 → 6
→ rest of 7 (rain line off, sign-in in «المزيد»).
First step of section 2: check the exact current price/plans of the hotel
data source (SerpApi Google Hotels — searches/month, cost, what a city
search returns: name, stars, rating, distance, check-in/out, amenities,
breakfast, prices per site) and **show the owner before subscribing**
(business decision). Then build the hotel card like the flight card, the
«احجز» list of every site with its price, remove the long intro text, same
card on «اقترح لي فندق»; test with a written list in TEST_PLAN.md (site,
390 px phone, app) before reporting.
How to test (see TEST_PLAN.md header): the owner must keep the Chrome test
window visible; phone = same-origin iframe 390 px (window can't resize);
app = same iframe with `html.in-app` added.
Owner preference: reply in Arabic only; report what was tested and what was
not, honestly; send progress in short Arabic messages.

Previous hand-off state (still true):
- Hotel-name search done (stored names → HERE capped → OSM). UI dropdown not
  yet seen on a phone.
- Trip services panel `TripServices.tsx` live on city pages and flight results
  (activities, eSIM, transfer, car, luggage, + AirHelp on results). Phone look
  of the compact version not yet confirmed by the owner.
- **Go City:** checker still finds 0 cities with `https://gocity.com/en/<city>`
  (`scripts/partners/check-pages.ts`) — find the real city URL/title pattern;
  until then Go City is not shown.
- Partners still to add: Headout (owner signs up at
  partner.headout.com/affiliate), BikesBooking, Viator (owner re-submits ID
  verification; account name «iTravel» → change via Viator support), Agoda
  when approved. Confirm payout setup for each.
- Activities phase 2 (needs Viator API): own activity page = description
  (ar/en via our own translation, stored) + live price + book button.
  Wikidata for descriptions/coordinates: owner not yet decided.
- Itinerary: days grouped by proximity, mixing landmarks, activities,
  restaurants.
- Owner actions still open: Android phone test; one «احجز الرحلة» click seen
  in Travelpayouts.


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
