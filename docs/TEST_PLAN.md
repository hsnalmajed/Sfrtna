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
| 1.1 | Round trip, budget 8,000, no preferences | Pick card ≤ 20 s, plane bar until done, "remaining budget" correct (budget − price) | |
| 1.2 | Round trip, budget 8,000, direct | Every card ours shows «مباشرة»; tab and list too | |
| 1.3 | Round trip, budget 8,000, bags | Every card shows «الأمتعة مشمولة» | |
| 1.4 | Round trip, budget 8,000, direct + bags | Both on every card; no early "nothing matches" while matches are still loading | |
| 1.5 | Round trip, budget 300 (too low) | "None within budget" card on the page at once with cheapest found and how much over; dialog at the end; time noted | |
| 1.6 | Round trip, no budget | Our cards, title «أفضل رحلة لتواريخك», no budget lines | |
| 1.7 | One way, budget 3,000 | Pick card, one leg only on cards | |
| 1.8 | One way, no budget, direct | All shown direct | |
| 1.9 | Route with no direct flight (RUH → LIS), direct | Question on the page after ≥ 100 flights, dialog at the end, «نعم» shows others with the amber line, «لا» goes to the form filled in | |
| 1.10 | Multi-city 3 flights, budget 9,000 | 3 tabs; tab 1 live; «احجز» on tab 1 saves the fare; tab 2 shows "picked X · left Y" and its budget = 9,000 − X | |
| 1.11 | Multi-city form | Flight 2 can't be dated before flight 1; changing flight 1 later clears an earlier flight 2; calendar names the flight | |
| 1.12 | Old /multicity-results link | Forwards to tab 1 with all answers | |
| 1.13 | Discover round trip / one way / flight+hotel / hotel only | Destinations listed; «اعرض السعر الحي» carries budget + preferences | |
| 1.14 | Discover routes (2 and 3 countries) | Each flight button opens the multi-city tabs with the whole budget | |
| 1.15 | Children + infant (2 adults, 1 child, 1 infant) | Widget code `…211`; card says 4 travellers | |
| 1.16 | Past date in the link | "Date passed" notice, no search | |
| 1.17 | Price check | Our card price = the partner's price on its offer page (no click recorded as a booking: compare the widget card) | |
| 1.18 | Edit search | Opens the form with every answer filled (round trip, one way, multi-city legs) | |
| 1.19 | English page | Same as 1.1 and 1.10, left-to-right, English labels | |
| 1.20 | Domestic (RUH → JED) | No visa line, no currency line | |
| 1.21 | Phone 390 px | Header: trip card + one swipe line; tabs one line each; cards readable; nothing cut | |
| 1.22 | App (UA SfrtnaApp/Android, `html.in-app`) | Same as 1.21 with the tab bar; nothing hidden behind it | |
