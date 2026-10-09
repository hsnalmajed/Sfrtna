# Sfrtna — project notes for a new session

Read this first. It replaces re-explaining the project. Last updated 9 Oct 2026.

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
| Google Places (`GOOGLE_PLACES_KEY`) | Hotel-name suggestions | **blocked**: Google Cloud in KSA is sold only via CNTXT, which needs a commercial registration; owner has none (7 Oct). Code kept, off without the key |
| HERE (`HERE_API_KEY`) | Hotel-name suggestions (Discover, accommodation categories 500-*) | chosen 7 Oct instead of Google; free 5,000/month; **owner creating account**. Order: Google → HERE → OpenStreetMap. Daily cap 160 / month 4,800 (Durable Object `HereQuota`, 9 Oct). `/api/health` shows `here.status`, lodging hits and `here.usage` |

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

## Next, in order

**▶ Start here (new conversation, 9 Oct): finish the HERE hotel-name section.**
State: the code is done and waiting for the key. `src/lib/providers/googlePlaces.ts`
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
5. Claude: live test the hotel name box (hotel form → «لدي فندق محدد») with
   Arabic and English: «هيلتون إسطنبول», «سماء», «ابها فندق», «Hilton
   Istanbul», a Riyadh/Jeddah hotel; Arabic spelling variants must match
   (أ/ا, ة/ه). Then pick one → named-hotel page loads prices (SerpApi).
6. Update the Partners table row for HERE and this note; commit; report.


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
