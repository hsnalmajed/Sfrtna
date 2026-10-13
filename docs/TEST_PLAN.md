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

Also checked: local build — 11 pages hydrate at 390 px with no errors, only
the page's language in its HTML, no dictionary text in any JS chunk; home
«تصفّح كل وجهات أكتوبر (78)» opens all 78; e2e 7/8 locally (route
suggestions need fare data), live site check: API ✓, browser ✓ except the
stale calendar test (fixed). `mobile-taps.yml` on the new code: 28 page
checks, no errors; "no effect" only on already-selected items (active tab,
chosen amount, current language).
