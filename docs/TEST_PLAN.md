# Sfrtna — test plan (every section, before "ready")

Owner's rule (13 Oct): test every scenario, small and large, on the site AND
the phone layout AND the app, before saying a section is ready. Record the
result and the time for each line. A section is done only when every line
passes; screenshots (desktop + 390 px phone) go to the owner with the report.

How to test (see PROJECT_NOTES "Testing note"):
- The Chrome test window must be **visible** (a hidden tab throttles timers to
  once a minute — timings and screenshots are then wrong).
- Phone width: the window is maximized and can't be resized, so load the page
  in a same-origin `<iframe>` 390 × 844 and screenshot it.
- Timings: a probe started right after navigation records, every 250 ms:
  first partner card, first card of ours, search done.
- Automated: `scripts/e2e.mjs` (GitHub, after each deploy + every 6 h).

## Section 1 — flight search

Route used unless said: RUH → IST, 1 adult, SAR. Dates 30–45 days ahead.

| # | Scenario | Expected | Result |
|---|---|---|---|
| 1.1 | Round trip, budget 8,000, no preferences | Pick card ≤ 20 s, plane bar until done, "remaining budget" correct (budget − price) | ✅ 13 Oct: partner 9.6 s, pick 18 s, done 36 s; remaining = budget − price |
| 1.2 | Round trip, budget 8,000, direct | Every card ours shows «مباشرة»; tab and list too | ✅ 13 Oct: all direct (Turkish/Pegasus) |
| 1.3 | Round trip, budget 8,000, bags | Every card shows «الأمتعة مشمولة» | ✅ 13 Oct (with 1.4) |
| 1.4 | Round trip, budget 8,000, direct + bags | Both on every card; no early "nothing matches" while matches are still loading | ✅ 13 Oct after fix (early question waited for 100 flights; showed at 6 s before) |
| 1.5 | Round trip, budget 300 (too low) | "None within budget" card on the page at once with cheapest found and how much over; dialog at the end; time noted | ✅ 13 Oct: card 7.4 s (cheapest 786 → 747 as it ran), dialog 23.9 s |
| 1.6 | Round trip, no budget | Our cards, title «أفضل رحلة لتواريخك», no budget lines | ✅ 13 Oct after fix (labels said «ضمن ميزانيتك» without a budget) |
| 1.7 | One way, budget 3,000 | Pick card, one leg only on cards | ✅ 13 Oct (RUH → JED one leg) |
| 1.8 | One way, no budget, direct | All shown direct | ✅ 13 Oct: 11 direct of 200, all shown direct |
| 1.9 | Route with no direct flight (RUH → LIS), direct | Question on the page after ≥ 100 flights, dialog at the end, «نعم» shows others with the amber line, «لا» goes to the form filled in | ✅ 13 Oct: dialog at end, «نعم» shows others + amber line |
| 1.10 | Multi-city 3 flights, budget 9,000 | 3 tabs; tab 1 live; «احجز» on tab 1 saves the fare; tab 2 shows "picked X · left Y" and its budget = 9,000 − X | ✅ 13 Oct: tab 1 picked 373 → tab 2 budget 8,627, after 1,115 pick 7,512 left |
| 1.11 | Multi-city form | Flight 2 can't be dated before flight 1; changing flight 1 later clears an earlier flight 2; calendar names the flight | ✅ 13 Oct by hand + e2e: days before flight 1 blocked; calendar names the flight |
| 1.12 | Old /multicity-results link | Forwards to tab 1 with all answers | ✅ 13 Oct + e2e |
| 1.13 | Discover round trip / one way / flight+hotel / hotel only | Destinations listed; «اعرض السعر الحي» carries budget + preferences | ✅ 13 Oct after fix: hotel-only cards lead with the hotel; budget label per type |
| 1.14 | Discover routes (2 and 3 countries) | Each flight button opens the multi-city tabs with the whole budget | ✅ 13 Oct + e2e: 72 flight links with legs + budget |
| 1.15 | Children + infant (2 adults, 1 child, 1 infant) | Widget code `…211`; card says 4 travellers | ✅ 13 Oct: code …211, «4 مسافرين» |
| 1.16 | Past date in the link | "Date passed" notice, no search | ✅ 13 Oct after fix (hotel offer was shown for past dates) |
| 1.17 | Price check | Our card price = the partner's price on its offer page (no click recorded as a booking: compare the widget card) | ✅ 13 Oct: card 747 SAR = cheapest offer (Turna.com 747) on the partner panel |
| 1.18 | Edit search | Opens the form with every answer filled (round trip, one way, multi-city legs) | ✅ 13 Oct after fix: every answer filled; now lands on the form |
| 1.19 | English page | Same as 1.1 and 1.10, left-to-right, English labels | ✅ 13 Oct after fix: times/days/cities/waits were Arabic in English cards |
| 1.20 | Domestic (RUH → JED) | No visa line, no currency line | ✅ 13 Oct: no visa, no currency |
| 1.21 | Phone 390 px | Header: trip card + one swipe line; tabs one line each; cards readable; nothing cut | ✅ 13 Oct after fixes: short date range, travellers as number, card 471 → ~385 px, price beside button |
| 1.22 | App (UA SfrtnaApp/Android, `html.in-app`) | Same as 1.21 with the tab bar; nothing hidden behind it | ✅ 13 Oct: same as 1.21 with tab bar |

Fixes found by this run (13 Oct): early preferences question; return date
cut on phones; emoji flags shown as letters (4 places); footer called
prices estimates; no-budget wording; edit search landed on the hero;
multi-city tab 2 currency in Turkish lira; hotel offer on a past date;
English cards in Arabic; discover hotel-only led with flights; flight
card too tall on phones.

Automated (GitHub, 49f1e12): API check 18/18 ✓, browser 7/7 ✓ — the flight
widget returns no flights on the workers.dev address (domain-bound), so
flight answers are tested by hand on sfrtna.com (above).

## Section 2 — hotel results (13 Oct, owner's decisions of the afternoon)

| # | Scenario | Expected | Result |
|---|---|---|---|
| 2.1 | «اقترح لي فندق» Istanbul, 20–23 Nov, 2 adults | Our cards (no English widget): photo, stars, rating + reviews, km from centre, check-in/out, amenities, lowest price for the stay | ✅ 13 Oct live: 20 cards, e.g. Skalion 0.9 km, 793 SAR |
| 2.2 | «الأسعار في كل المواقع» on a card | Every site's price, cheapest first; cheapest + partners + known names in view, rest folded; button «عرض السعر» | ✅ 13 Oct: 12 sites, KAYAK 793 → Expedia/Hotels.com 1,196, «عرض 8 مواقع أخرى» |
| 2.3 | A non-partner site's button | Lands on the same hotel, same dates, same guests | ✅ 13 Oct: KAYAK → Skalion Hotel, 20–23 Nov, 2 adults |
| 2.4 | A partner's button (Expedia/Hotels.com/Booking/Agoda) | Stay22 Allez → the hotel itself | ✅ 6 Oct (unchanged links); re-check by owner |
| 2.5 | Free breakfast badge | Only for "Free breakfast", not "Breakfast ($)" | ✅ fixed after the live run (paid breakfast showed the badge) |
| 2.6 | Clicktrip.com etc. | Not pinned as a "known name" | ✅ fixed (matched "trip.com") |
| 2.7 | Free allowance paced out | One line + partners' widget, no number | not tested live (needs the allowance used up) |
| 2.8 | Named hotel («لدي فندق محدد») | Same every-site rows on its page | to test by owner |
| 2.9 | Phone 390 px / app | Card stacks (photo on top), buttons reachable | to test by owner (phone screenshot) |
| 2.10 | Coverage (owner: "only 20 hotels?") | Never fewer than the partners' full list | ✅ 13 Oct after fix: our 20 cards + «عرض المزيد» (page 2 = 20, 16 new; token «CBI=» was refused by a too-strict check — fixed) + the partners' full city list under them, always |

## Section 5 — destinations page (13 Oct)

| # | Scenario | Expected | Result |
|---|---|---|---|
| 5.1 | City page (Istanbul) | One row: المعالم (count) · الخريطة · خطة سياحية · الأنشطة والتذاكر · خدمات رحلتك · download GPX/KML | ✅ 13 Oct live: all six in one row |
| 5.2 | «خدمات رحلتك» tab | eSIM, transfer, car, luggage — every partner | ✅ 4 rows (Airalo/Yesim/Saily · Kiwitaxi/Welcome Pickups/intui/GetTransfer · Localrent/GetRentacar/Economybookings/QEEQ/Auto Europe · Radical Storage) |
| 5.3 | «الأنشطة والتذاكر» tab | Activity partners (+ tours when any) | ✅ GetYourGuide, Tiqets, Klook, KKday, WeGoTrip |
| 5.4 | Phone 390 px | Row scrolls sideways, sticky under the header | ✅ 13 Oct iframe 390 px: row one line, scrolls |
| 5.5 | «خطة سياحية» tab | Scrolls to the planner | to test by owner (needs a visible window) |
| 5.6 | App (html.in-app) | Same as 5.4 with the tab bar | to test by owner |

## Section 6 — travel tools (13 Oct)

| # | Scenario | Expected | Result |
|---|---|---|---|
| 6.1 | /ar/services, type «تركيا» | Lists Turkish cities; pick one → services | to test by owner (typing) |
| 6.2 | /ar/services?code=TR&city=istanbul | Every service row | ✅ 13 Oct live: 5 rows, all partners |
| 6.3 | Menu, footer, app «المزيد», home tools | «خدمات رحلتك» link everywhere | ✅ menu + footer seen live |

## Section 3 — trip plan, one engine (13 Oct)

| # | Scenario | Expected | Result |
|---|---|---|---|
| 3.1 | Travel tools → «خطتك السياحية» | City (picked) + the site's calendar + «أنشئ لي خطة» / «أختار بنفسي» | ✅ 13 Oct live: fields and both buttons |
| 3.2 | Istanbul 20–23 Nov, «أنشئ لي خطة», «بدون تفضيل» | 4 days, real named places, near each other per day, no cost | ✅ 13 Oct live: 16 places in 4 days (Taksim/Galata day, Sultanahmet day …) |
| 3.3 | Dates carried from the address | Calendar shows 20 → 23 Nov | ✅ |
| 3.4 | Meals per day | 2 nearest restaurants, halal tag when known | ⏳ restaurants are being collected (workflow «Restaurants», ~3 h); re-test after |
| 3.5 | PDF / Google Maps file | Print to PDF, KML download | ✅ buttons present (unchanged); PDF to test by owner |
| 3.6 | Save to account | — | ⏳ needs accounts (Google/Apple/email) — owner decision on the storage |
| 3.7 | Phone / app | Sheet as bottom sheet, calendar usable | to test by owner |

## Phone speed (14 Oct, workflow `mobile-speed.yml`, Lighthouse mobile)

Simulated runs on GitHub swing by seconds (same page 2.2 s / 5.4 s); judge
on the applied-throttling run (Chrome really slowed to phone CPU + 4G) and
the median of three. Before = old report (13 Oct), after = 14 Oct 01:00.

| Page | LCP before (1 run) | LCP after, applied throttling | Median of 3 simulated (runs) |
|---|---|---|---|
| /ar | 2.4–6.3 s, TBT up to 2.5 s | 2.3 s, TBT 440 ms | 2.8 s (2.3 / 2.8 / 5.4) |
| /ar/attractions | 5.7 s | 2.3 s | 2.2 s (2.1 / 2.2 / 2.2) |
| /ar/attractions/TR/istanbul | 2.1 s | 2.1 s | 3.5 s (2.0 / 3.5 / 4.3) |
| /ar/seasons | 5.0 s | 2.2 s | 2.5 s (2.5 / 2.5 / 2.7) |
| /ar/services | 2.3 s | 2.0 s | 3.5 s (2.0 / 3.5 / 4.7) |
| /ar/itinerary | 4.7 s | 3.0 s | 4.9 s (2.3 / 4.9 / 5.6) |
| /ar/visa | 5.9 s | 2.7 s | 5.1 s (2.5 / 5.1 / 5.4) |
| /en/visa | — | 2.5 s | 4.7 s (2.2 / 4.7 / 4.8) |

/ar/seasons, 14 Oct (packed months): HTML 725 → 217 KB raw, 64 → 51 KB gz
(local build). Same text before/after in month view, 6 month windows and the
Istanbul year view (ar + en, 390 px), no page errors. Lighthouse re-run on the
deploy (33c8fac, 14 Oct), applied throttling: /ar 2.1 s, attractions 1.9 s,
Istanbul 1.9 s, seasons 2.0 s (was 2.2), services 1.9 s, itinerary 2.0 s
(was 3.0), /ar/visa 1.9 s (was 2.7), /en/visa 1.9 s — every page under 2.5 s.
`mobile-taps.yml` on the same deploy: passed.

Also checked: local build — 11 pages hydrate at 390 px with no errors, only
the page's language in its HTML, no dictionary text in any JS chunk; home
«تصفّح كل وجهات أكتوبر (78)» opens all 78; e2e 7/8 locally (route
suggestions need fare data), live site check: API ✓, browser ✓ except the
stale calendar test (fixed). `mobile-taps.yml` on the new code: 28 page
checks, no errors; "no effect" only on already-selected items (active tab,
chosen amount, current language).

## Climate data published (14 Oct, afternoon)

| # | Check | Result |
|---|---|---|
| C.1 | Accuracy test (leave-own-station-out, ±2 °C) | ✅ highs 91 % calibrated / 88 % regional; lows 85 / 84 % |
| C.2 | Season tests (`npm run test:seasons`) | ✅ 25/25 |
| C.3 | Old 144 cities: months keeping their class | ✅ 92.2 %; 1 two-class jump (Al Wakrah Oct, 35.1 → 37 °C) |
| C.4 | Gabala (lone-station bug) | ✅ Jan 4.2 / Jul 28.5 °C (was 9.3 / 32.7) |
| C.5 | 68 newly rated cities read by hand for impossible values | ✅ one found (Valletta July 27.5 °C) → withheld |
| C.6 | Local build at 390 px: /ar/seasons, Gabala year view, home | ✅ October 110 cities, no page errors |

## Owner's notes of 20 Oct — live checks (sfrtna.com, after each deploy)

| # | Scenario | Result |
|---|---|---|
| 20.1 | Flight filters RUH→IST 24 Nov–1 Dec: stops / features / outbound+return time / airlines / booking sites, counts per option | ✅ stops «مباشر» 32/200, all cards direct; time 18–24 → 22; airlines with "from" price; 18 booking sites with each one's cheapest |
| 20.2 | Booking-site filter drives the partner's own filter | ✅ Qatar → 31 flights, + Lufthansa → 33, «إلغاء الفلاتر» → 200 (after a sync fix: one click per second, kept in sync while chosen) |
| 20.3 | Night flights definition | ✅ fixed: in the air 1–5 am or an overnight stop (was any 0–6 am departure/arrival → 14/200) |
| 20.4 | Discover RUH 10–17 Dec, 6,000, kinds beach+city | ✅ 32 cards; continent pill (آسيا 20 · أوروبا 3 · أفريقيا 9), Asia → 20, + beaches → 11 |
| 20.5 | Named hotel (Hilton Riyadh Olaya, 24–27 Nov) | ✅ Arabic title «هيلتون الرياض العليا», cheapest Booking 2,974 + «احجز الآن», «قارن الأسعار في 8 مواقع» each with price + button; key features row; no «ابحث لدى بقية شركائنا» |
| 20.6 | Hotel name search Arabic | ✅ «هيلتون الرياض» → Arabic names + Arabic area («الرياض، السعودية»); names with no known Arabic stay in their own spelling |
| 20.7 | Flight + hotel (RUH→IST, 2 adults, flight 6,000, hotel 4,000, 4★, breakfast) | ✅ two budgets bar, flight results, «فندقك في إسطنبول» 18 cards all 4★ + free breakfast, ≤ budget |
| 20.8 | Home: combo choice, 390 px | ✅ form, hotel block, both budget hints readable (224 / 192 px fields) |
| 20.9 | App (html.in-app, 390 px): home photo top 62 svh, navy below, Book tab | ✅ no white area; Book now opens the flight form directly (next deploy) |
| 20.10 | Built-in browser on the owner's PC: flight partner did not load → fallback card shown | note: same network issue as 13 Oct; Chrome loads it |
| 20.11 | Not tested live | install banner (no store link yet — hidden by design), first-launch intro (needs the app), photos (Pexels resets 25 Oct) |

## Whole-site phone audit (20 Oct, `ux-audit.yml` → branch `ux-audit-results`)

26 pages × iPhone 13 + Pixel 7 × browser + app (app user agent), screenshot each.

| Check | Run 1 | Run 3 (after fixes) |
|---|---|---|
| Sideways scroll / off-screen | 0 | 0 |
| Blurry photos (real pixels vs screen) | every photo hero ×2.6–4 | 0 (portrait crops `public/hero/<id>-p<w>.webp`) |
| Dead ends (no price, "search elsewhere") | flight fallback, hotel page, discover unpriced | 0 |
| Tap targets < 32 px | chips, switches, currency, maps, counters | map pin 28 px, map chips 32 px → fixed after run 3 |
| Empty screens | seasons (app), account (app) | account only (sign-in methods) |
| Page errors | 0 | 0 |


## Accounts and membership — 21 Oct (local workerd + Playwright, 390 px, signed-in session seeded)

| Check | Result |
|---|---|
| ♡ signed out on city page → sheet with the six benefits + «أنشئ حسابك مجاناً» | ✓ |
| ♡ signed in → toast «حُفظت في مفضلتك ✓», aria-pressed, item stored | ✓ |
| Trip saved (API), «حسابي»: رحلاتي, countdown, checklist; ticking «الفندق» persists | ✓ |
| Profile (JED, direct, 4★) saved; home flight form opens with JED (beats the nearest-airport guess) | ✓ |
| Home «رحلتك القادمة إلى إسطنبول» card, next step + «رحلاتي» (phone layout fixed) | ✓ |
| App hand-off: /ar/account/app?c= → «المتابعة إلى التطبيق باسم …» → sfrtna://auth?code=…&lang=ar | ✓ |
| App context: /ar/account?app_code= + verifier → signed in; same code again → 400 | ✓ |
| More sheet (app UA): language first, then sign-in with subtitle | ✓ |
| DO unit run: wrong verifier, reuse, 20-search cap, delete account removes items | ✓ |
| Not testable here: native Custom Tab + deep link on a phone (needs the new APK), silent Google (needs Android OAuth client), email codes (needs RESEND_API_KEY) | owner |

## Suppliers directory — 8 Nov 2026 (links checked by hand in Chrome)

Trip used: RUH → IST, 10–17 Dec 2026, 2 adults + 1 child (7). Each URL shape
in `src/lib/suppliers.ts` was opened and the site's own search box read back:

| Site | Route | Dates | Party | Result |
|---|---|---|---|---|
| Google Flights (`hl=en`, q in words) | ✓ | ✓ | 3 | ✓ (`hl=ar` → empty form ✗, fixed) |
| Google Flights + «on flynas/Saudia» | ✓ | ✓ | 3 | airline chip set ✓ |
| Almosafer `/RUH-IST/d1/d2/Economy/2Adult/1Child` | ✓ | ✓ | 3 | ✓ (shape from its own form) |
| Trip.com `showfarefirst` | ✓ | ✓ | 3 | ✓ |
| KAYAK flights `/children-7` | ✓ | ✓ | 3 | ✓ |
| Expedia `Flights-Search` | ✓ | ✓ | 3 | ✓ |
| KAYAK hotels `Istanbul,Turkey/…/1children-7` | ✓ | ✓ | 3 | ✓ |
| Google Hotels (q in words) | ✓ | ✓ | — | party not read from q |
| KAYAK cars `/IST/d1/d2` | ✓ | ✓ | — | ✓ («Turkey» text → Turkey NC ✗, so airport code) |

Not linked (domain refused by the checking browser, shape unproven): Wego,
Momondo, Kiwi.com, Klook, Airbnb. Skyscanner kept as before (page opened,
not readable).

### Airlines' own booking links — round 1 (8 Nov 2026, Chrome)

Same trip. Rule: an airline gets its own link only if the link opens its
results with route + dates + party; else it keeps Google Flights «on X».

| Airline | Shape tried | Result | Decision |
|---|---|---|---|
| flynas | `booking.flynas.com/#/booking/search-redirect?origin&destination&currency&departureDate&returnDate&flightMode=round\|oneway&adultCount&childCount&infantCount&culture&locationsource=SA` (names read from flynas.com's own `flight-search-js`) | today's date (DMM→MED 8 Nov) → results with 2 ad + 1 ch ✓; ANY future date (DMM→MED, JED→SAW, RUH→IST/SAW, 10–17 Dec; RUH→JED 20–25 Nov) → «Invalid departure date» ✗ | keep Google |
| Saudia | Search on saudia.com (RUH→IST 10–17 Dec, 2 ad + 1 ch) → results at `saudia.com/en-SA/booking` with NO search data in the URL (state in session storage; last search also in localStorage `LASTTWORECENTSEARCH`). Bundles (Angular/Sitecore JSS) read no origin/date/pax from the URL; the only meta flow is `GOOGLE_WEGO` (order made by Google's own integration, not a public link) | same URL in a fresh tab → bounced to home ✗. Search itself works: 12 results, 2 non-stop (10:30, 14:20) | keep Google |
| Qatar Airways | `qatarairways.com/app/booking/flight-selection?widget=QR&searchType=F&addTaxToFare=Y&minPurTime=0&selLang=ar\|en&tripType=R\|O&fromStation&toStation&departing&returning&bookingClass=E&adults&children&infants&ofw=0&teenager=0&flexibleDate=off&allowRedemption=N` (copied from the URL its own widget opened) | fresh tab: RUH→IST RT 10–17 Dec 2+1 en → 15 results ✓; JED→IST RT 12–20 Dec 2+1 **ar** → 15 results ✓; DMM→LHR **OW** 15 Dec 1 ad + 1 inf ar → 15 results ✓ | **own link** (`OWN_SITE` in suppliers.ts) |
| flyadeal | flyadeal.com Angular app (`main.*.js`): `/search-flight` reads only login/pnr flags from the query; the search lives in session storage `flightSearch`, then `/select-flight` | no URL form of a search ✗ (and the search hung on its loader 30 s in Chrome, 8 Nov) | keep Google |

### Airlines' own booking links — round 2 (8 Nov 2026, Chrome)

| Airline | Shape tried | Result | Decision |
|---|---|---|---|
| Emirates | `www.emirates.com/booking/search-results/?pub=/sa/arabic\|/sa/english&seldcity1&selacity1&selddate1=10 Dec 26&seladate1=17 Dec 26&seladults&selchildren&selinfants&selcabinclass=0` (names read from its own `searchResultsPayloadTransformer`; no `seladate1` = one way) | fresh tab: RUH→IST RT 2+1 ar → «العودة · 3 من المسافرين», 22 options, lowest total SAR 4,546 = the site's own search (22 options, SAR 4,546) ✓; DMM→LHR OW 1 + infant en → «One way · 2 passengers» ✓ | **OWN LINK** |
| Etihad | `digital.etihad.com/book/search?LANGUAGE&CHANNEL=DESKTOP&B_LOCATION&E_LOCATION&TRIP_TYPE=R\|O&CABIN=E&TRAVELERS=ADT,ADT,CHD&TRIP_FLOW_TYPE=AVAILABILITY&SITE_EDITION=EN-SA&DATE_1=202612100000&DATE_2=…` (shape = its own `OneAUrlStaticParams`) | first cold visit → bot-check page «Pardon Our Interruption» ✗; after etihad.com set its cookies → results RUH→IST 10–17 Dec, 3 guests ✓ | keep Google (a traveller arriving cold would hit the bot check); re-test cold later |

### Airlines' own booking links — round 3 (8 Nov 2026, Chrome)

| Airline | Shape tried | Result | Decision |
|---|---|---|---|
| flydubai | `flights2.flydubai.com/{en\|ar}/results/{rt\|ow}/a2c1i0/RUH_IST/20261210_20261217?cabinClass=Economy&isOriginMetro=false&isDestMetro=false&pm=cash` (the URL its own search lands on) | new tab: RUH→IST RT 2+1 en → same party and dates, lowest total SAR 7,815, first options SAR 996 / 1,950 = the site's own search (owner's screenshot, 3 outbound options); DMM→DXB OW 1 + infant ar → «2 مسافرين» ✓. Tested in a browser that had already visited flydubai.com, so a truly cold visit is not proven | **OWN LINK** |
| Turkish Airlines | RUH→IST 10–17 Dec 2+1 through its own form | results URL = `availability-international/?cId=<session id>`, carries no route, dates or party ✗ | keep Google |
| Gulf Air | `flights.gulfair.com/flights?adt=2&cabin_class=A&chd=1&departure_date=20261210&destination=IST&flight_type=return&inf=0&locale=en&origin=RUH&return_date=20261217&tnn=0` (the URL its own search lands on) | Chrome tool refuses gulfair.com; in the built-in browser its own search → URL carries the full trip, but the page = bot check «Pardon Our Interruption» (HTTP 405, CAPTCHA). CAPTCHA not solved there. Owner's normal browser 9 Nov: same URL → results RUH→IST, Thu 10 – Thu 17 Dec, 3 passengers, first option SAR 4,417.50 economy, no bot check ✓. One-way and Arabic untested | **OWN LINK, round trip only** (one-way keeps Google; page in English) |

| Kuwait Airways | Its own form, DMM→IST RT 2+1 (its calendar opened on May 2027 and would not go back, so 15–21 May 2027 was used) | results URL = `digital.kuwaitairways.com/booking/availability/0`, carries no route, dates or party ✗ | keep Google |

Still to test: Oman Air, RJ, EgyptAir, Pegasus. Also retest Etihad in the owner's normal browser (private window; link in round 2).

Notes: flynas flies to SAW, not IST (a link would also need the airport
swap). The redirect must be a fresh page load (a hash change from inside
booking.flynas.com is ignored). Still to test:
Emirates, Etihad, flydubai, Gulf Air, Turkish, Kuwait, Oman Air, RJ,
EgyptAir, Pegasus. Saudia notice seen 8 Nov (owner's business call, not
code): «Riyadh flights update» — Saudia flights to/from Riyadh currently
operate via Al-Qassim (ELQ) and Dammam (DMM) with a Saudia bus to/from
Riyadh; its results show the airport and bus times. Test: a session-only
site (results URL carries nothing) = keep Google; check by opening the
results URL in a fresh tab. Tip: read the site's own search script for the
redirect URL (as done for flynas) instead of guessing names.
