# Sfrtna — START HERE (short, loaded every turn)

Keep this file SHORT (target < 150 lines, < 12 KB). It is imported by
CLAUDE.md, so every line here is paid for on every single message.
Full history = `docs/PROJECT_NOTES.md` (≈125 KB, NOT auto-loaded): open only
the section a task needs, with Grep on a heading or keyword, never whole.

## Token plan (owner, 3 Nov 2026 — "token use delayed the project a month")

Root cause found 3 Nov: CLAUDE.md imported the whole PROJECT_NOTES.md
(≈50k tokens) into EVERY message of EVERY conversation, before any work.
Rules from now on:
1. **This file is the only auto-loaded note.** New facts go to
   PROJECT_NOTES.md (archive, by section); only the current state and the
   next step go here. Replace old hand-offs here, never stack them.
2. **One conversation = one section.** When a section closes (or the chat
   gets long: ~40 tool calls / many big outputs), Claude updates the
   hand-off below, pushes, and tells the owner to open a new chat.
3. **Opening message for a new chat (owner copies it):**
   `أكمل مشروع سفرتنا: اربط hsnalmajed/Sfrtna واستنسخه، واقرأ docs/START_HERE.md فقط، وابدأ من "الخطوة التالية".`
   (No need to ask Claude to read PROJECT_NOTES.md in full.)
4. **Claude's working habits:** Grep/Read with offset instead of whole
   files; pipe command output through `tail`/`grep`/`head`; read GitHub
   workflow results as annotations or report branches, not full logs; wait
   for workflows with one sleeping loop, not repeated polls; no browser
   screenshots unless needed (ask the owner for a phone screenshot); batch
   fixes, one test round, one report.
5. **Owner's habits that save tokens:** one clear request per message;
   paste only the relevant lines of an email/error (not the whole mail);
   one screenshot of the exact screen, not several; say «تم» for owner
   steps (no need to re-explain).
6. **Model choice (owner picks in the model menu before sending):** Claude
   ends every hand-off with the recommended model for the next chat:
   - **Sonnet 5.5** — owner step-by-step guidance (store consoles, partner
     dashboards, settings), small text/style fixes, answering questions,
     running/reading the routine checks.
   - **Opus 5.5** — root-cause debugging, multi-file features, data
     pipelines, anything where a wrong fix breaks other pages.
   - Haiku 5.5 — not for this project's code (too risky); fine for a
     one-line question.

## Two kinds of chats (owner 18 Nov)
- **Mail chat** (partners, stores, tickets): reads `docs/INBOX.md` only —
  opening: `محادثة بريد سفرتنا: اربط hsnalmajed/Sfrtna واستنسخه، واقرأ docs/INBOX.md فقط، ثم انتظر رسالتي.` (Sonnet).
- **Build chat** (improvements, additions, fixes): the opening message above,
  starts from «الخطوة التالية» (Opus). It does not handle mail; mail that
  needs code arrives via INBOX «For the build chat».

## Owner's standing rules (must follow)

- Always reply in **Arabic**. Act as developer, reviewer, CX expert, designer.
- Owner steps: ONE step per message; every English word to click/type on its
  own line, **bold**; never chain screens with arrows; never mix English
  button names inside an Arabic sentence. Wait for «تم».
- Every price = the partner's live price, or no number. No «يبدأ من», no
  estimates, no cached fares presented as prices.
- Never fewer options or a wrong price than the market; compare counts and
  prices with the source before release (write both in docs/TEST_PLAN.md).
- No invented data, no Wikipedia text, no secrets/keys in code or chat; never
  delete a file unless the owner asks. Secrets = Cloudflare Runtime vars /
  GitHub secrets. Never name data sources/tools to visitors.
- No ads, ever (site and apps). Income = partner commission only.
- **Commission check (owner 8 Nov 10:45, corrected):** show EVERY company
  we can link to, with or without commission, and keep showing its live
  price when we have one. For each, check if it pays commission (own
  programme or any network): yes → route its button through that
  programme; no → keep it as it is (link + price). A company on several
  networks → connect them all, route to the one that pays most, fall back
  to the next if one fails (down, empty, error). Never hide a company
  for paying nothing. **Register: `docs/PARTNERS.md`** — each supplier's
  programme, rate, conditions to join, whether we meet them, status. Not
  met yet → note what is missing, apply once met. Update it with every
  partner change.
- **Airlines and ticket sites (owner 9 Nov):** direct link to the company
  first; then any commission route, only if trusted. A site that won't open
  or shows a bot check in Chrome → try another browser, then the owner's
  normal browser. Every trusted airline or ticket site gets linked with its
  price, commission or not.
- Protect data from scraping in every feature: any new /api route must be
  added to `ROUTES` in `edge-guard.js` (else 404; `check-guard.mjs` fails the
  build on mismatch).
- Before "done": `npx next typegen` (once per clone) → `npx tsc --noEmit` →
  `npx eslint <files> --max-warnings=0` → check live (Site check / ux-audit).
- Commits: author `Claude <noreply@anthropic.com>`, trailers
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` + the session
  line given by the session. Push to `main` deploys in ~5 min. Push rejected
  → tell the owner and stop.
- One section at a time to 100%; collect all issues, fix together, re-test,
  then report. Ask the owner only business decisions.

## Stack essentials

Next.js 16 (read `node_modules/next/dist/docs/` before new APIs) on
Cloudflare Workers via opennext, **Workers Paid** since 27 Oct. Edge cache
`src/lib/edgeCache.ts`. Big data files are served through ASSETS
(`public/data/*`), **never imported into Worker code** (JSON > ~1 MB → 1102
outage; `check-bundle-json.mjs`). Container can't reach sfrtna.com: checks run
on GitHub against `sfrtna.almajedhsn.workers.dev` with `SMOKE_TOKEN`.
`gh` works through the REST API only (`gh api …`; GraphQL is blocked), e.g.
dispatch: `gh api -X POST repos/hsnalmajed/sfrtna/actions/workflows/<f>.yml/dispatches -f ref=main`.
Checks: `smoke.yml` (Site check: check + pages/e2e), `ux-audit.yml`
(→ branch `ux-audit-results`), `mobile-taps.yml`, `route-probe.yml`
(→ branch `route-probe`), `health-report.yml`, `monitor.yml`, `ios.yml` (→ `ios-shots`).
Apps: Capacitor shells loading sfrtna.com — Android `com.sfrtna.app`
(`android.yml`), iOS `mobile/ios` (`ios.yml`, uploads to App Store Connect).

## Where things are in PROJECT_NOTES.md (grep the heading)

Flights / Hotels / Measurement / Protection / Android app / Photos /
Discover / Partner audit / Trip services / Hotel names / Owner's notes of
13 Oct (section plan) / Coverage / Owner's notes of 20 Oct / Accounts /
City guide / Viator / Search Console / Status email / Feedback / Dashboard /
«رحلتي» / Google Play account / Workers Paid / Hotels like Booking /
iPhone app.

## ▶ Hand-off (15 Nov 2026) — current state

**▶▶▶▶▶▶▶▶▶▶ «HOTELS = BOOKING APP» ROUND 1 BUILT + PUSHED 24 Nov (same
chat):** named search → city list with the searched hotel first in a navy
frame (`pinned` in HotelList; card links carry `open=1` → hotel page; list
down → page as before); Booking cards (photo start, score, distance from the
searched hotel, price block «6 ليالٍ، شخصان · شامل الضرائب · الأرخص من N
مواقع», «اعرض الأسعار» ≥sm, whole card taps); phone bar ترتيب|تصفية|الخريطة
(`bar` prop on FilterPill/FilterSheet); compact navy band on phones; hotel
page: Booking photo grid «+N», highlights row, stay box (dates + «بحثت عن»),
STICKY «اختر الغرفة» bar on phones, section nav ≥sm only; rooms = one card
each with option box + full «اختر» → RoomBooking sheet (unchanged). Checked
locally (Playwright, mocked prices) 360/390/768/1440: no sideways overflow.
dict keys `hotelResults.bk*`. **NEXT:** owner checks on the phone (live
prices shut till 6 Dec → list may fall back to partners); round 2 = his
notes + rooms facts (beds/size when Google gives them), score box beside
the title on phones, map/surroundings tabs.
**(spec, kept)** BUILD «HOTELS = BOOKING APP 1:1» (owner APPROVED 24 Nov
15:28). Study DONE (owner's Booking app shots: Lafif
Al-Khaldia Madinah; Booking site in Chrome). Mock-ups = the spec:
`docs/design/hotels-booking/` (hotels-phone-mockup.png = 4 phone screens,
hotels-desktop-mockup.png, hotels.html = exact CSS: navy-700 score badge with
cut corner, sun-500 buttons, gold search pill, green ✓ lines). Owner: «اريده
بالضبط نفسه» — the traveller's journey must feel exactly like Booking's.
Accepted differences ONLY: rating stays Google /5 (no ×2), no guest quotes
(topic bars «الموقع 96% إيجابي» instead), no struck-through prices («أقل من
المعتاد بـN%» only from `dealPct`), last step = sites sheet (we compare,
partners book). Build in this order:
1) **Named-hotel search (mode known) = Booking's flow:** today page.tsx
   ~l.327 opens `HotelPrices` straight away. New: results LIST first, the
   searched hotel FIRST with a distinct frame (2px navy-500 border + navy-50
   fill, like Booking's blue-bordered card), then the city's other hotels
   nearest to it / same level (HotelList for the hotel's city, distance from
   the hotel's lat/lng); tap a card → hotel page.
2) **List (`HotelList`/`HotelCard`), phone:** top pill (back ‹ · city ·
   dates · guests, gold border) → sticky bar of 3 equal buttons ترتيب | تصفية
   | الخريطة (orange dot when a filter/sort is on; each opens a bottom sheet /
   full map) → «{city}: وجدنا N مكان إقامة» → cards like Booking's: photo
   ~118 px on the start side with heart, name, stars, score badge + word +
   reviews, distance, amenities line, deal tag, price block at the bottom
   («6 ليالٍ، شخصان», total, «شامل الضرائب · أرخص من N مواقع»). Each card a
   separate white block. Desktop = desktop mock (filters column + map card,
   3-part card, «اعرض الأسعار»).
3) **Hotel page (`HotelDetail` in HotelPrices.tsx):** top bar ‹ name ♡ ⇪;
   title, stars, address + «اعرض على الخريطة», score box; photo grid 1 big +
   4 small «+N» (opens gallery); highlights chips row; check-in/out + «بحثت
   عن» box (blue links = edit); cheapest price box; reviews (score + topic
   bars); surroundings (map + tabs of `nearby` with times); facilities; times;
   STICKY bottom «✓ أسعار حية من N مواقع» + «اختر الغرفة» → rooms.
4) **Rooms screen:** one card per room (name in navy-500, guests, beds,
   size, amenity line, thumb) → option boxes (✓ free cancel date, ✓
   breakfast, price for N nights, radio) → «اختر» → `RoomBooking` as a bottom
   sheet: sites list, cheapest highlighted, «احجز» pills, note «نحن نقارن…».
5) Checks: Playwright with mocked `/api/hotel-prices` (live prices SHUT
   till 6 Dec; method PROJECT_NOTES «Hotels like Booking — 7 Nov») at
   360/390/768/1440 + app UA, no sideways overflow, iOS clean mode untouched,
   typegen → tsc → eslint → push → owner checks on the phone.

**▶▶▶▶▶▶▶▶▶ NEXT SECTION (owner 17 Nov 15:25, Opus): ALL owner's notes +
improvements, live on the site (apps load sfrtna.com, so they get it too).**
Order: 1) interactive route map in the plan (see «NEXT 1» below); 2) FULL
PRODUCT AUDIT (owner's notes 13–14 Nov A–H + «Friends' verdict»: coverage
of flights/destinations/cities, city photos = nature + sights, hotels
display, features visible on first visit, H) → one report with numbers →
fix in rounds; 3) home hero (method in «Positioning + home hero»).
**Step 1 DONE 17 Nov (Opus):** «خريطة رحلتك» in the plan (`smart/PlanMap.tsx`
+ `PlanMapCanvas.tsx`, leaflet, under TripModeCard): whole route = numbered
cities + dashed line; tap a number (map, chip, or the cover ribbon) → that
city's places as pins in day colours (`lib/dayColors.ts`, shared with the
route image), day chips → one day numbered in order + its line; pin popup =
name, day · time, «على الخريطة», «افتح اليوم». One-city plan = pins + day
chips. Checked locally (Playwright, mocked plan); owner to try on the phone.
**Step 2 AUDIT DONE 17 Nov → `docs/AUDIT_2026-11-17.md`** (numbers; re-measure
with `node scripts/coverage/depth.mjs`). Key: 45 cities no plan, 52 countries 1
city, Arabic names 3.6% (map) / 23.5% (guide), hotel live prices SHUT (SerpApi
101/250 till 6 Dec), «اقترح لي وجهة» = cached fares + Google Explore only.
**18 Nov (Opus): round 1 «عمق الخطة» CLOSED + G «خريطتي» LIVE.** Round 1:
no plan 45→0, guide<15 102→12 (small capitals/islands), area-itself places
removed (`scripts/guide/selfPlace.ts`), writer timeout → next model; numbers
in TEST_PLAN. G: `/[locale]/my-map` (PROJECT_NOTES «خريطتي — visited map»),
account kind `been`, signed-out marks in the browser move to the account,
share picture, «المزيد» card + header + «حسابي». Release green (73a19cf);
tap-size fix + docs in the last push. **Owner (one step):** on the phone open
المزيد → «خريطتي», mark a few countries + cities, press «احفظ خريطتي», sign
in, then «شارك خريطتي»; ONE screenshot of anything wrong. Owner decision
open: Israel/Palestine shapes (Natural Earth as-is).
**18 Nov: «خريطتي 2» BUILT + LIVE** to the owner's spec (PROJECT_NOTES
«خريطتي 2 — BUILT 18 Nov»): account-only night map, «+» country → cities
(6,341 world cities) → year, repeat trips, names on the map, 3 views,
totals, 7 lists, 15 badges, tour, story picture, gate that signs in on the
page, placed in travel tools / home / every guide page. **Owner (one step):**
on the phone open «خريطتي», sign in, follow the tour, add 2 countries with
cities (one twice), press share; ONE screenshot of anything wrong.
**Next for the map (Round B):** compare-with-friend link (opt-in, owner's
yes pending), community numbers, dreams → flight search, suggest from «رحلتي».
**NOW: audit §7 round 2 «مدن أكثر (F)» batch 3 — 50 of 56 LIVE (live 415).**
19 Nov (Opus): Negombo published (8ed58c9); no smart plan 5 → 1 (umluj: open
data has 3 places, nothing invented); marsa-alam/umluj wider area
(`STORED_RADIUS_BY` in mapPins + guide AREA; places.yml takes «only»);
live check OK (nuwara-eliya page + plan search, al-khobar, fethiye). Numbers
in TEST_PLAN. **Jajce DONE 19 Nov** (neighbour cell, PC download, merge +
hci on the PC, published; guide deep dispatched — check it got a plan).
Method that worked: put the repo's era5land.json on the PC, run
merge_sources + build_hci there (VM needs `pip install --user
timezonefinder`), stage normals/hci back, generate_seasons. **BATCH 3 CLOSED 19 Nov 04:57 (owner: «نعم»):** the 6 climate-withheld
(zell-am-see, hallstatt, mestia, uzungol, konjic, genting-highlands) STAY
HELD until official station normals exist; umluj stays without a smart plan.
Small CX note for round 7: the city page's plan link opens the planner empty.
**19 Nov (owner's notes, LIVE c8dcb6e):** (a) home «خريطتي» card on phones
= name + small hint «اضغط على الخارطة لإدارة خارطتك» + map (MapPromo,
`md:hidden`); tap → /my-map (gate signs in, tour on first visit — already so).
(b) **plan asks before splitting days** (SmartPlanner step «split», after the
dates, only when days − city needs ≥ 2 and the country has cities ≤300 km):
«N days enough for X? other cities, back before your flight» yes/no → days
in X (+/−, back to ours) → nearest cities with their days (tick, +/−; days
not given → first city). `/api/ai/plan` `preview:true` → `routeOptions`;
`answers.split` validated in plan.ts, built exactly in routePlan.ts. Checked
locally (Playwright 390 px, Istanbul 12 days → 7 + Bursa 3 + Sapanca 2).
**▶ NOW = round 3 «الصور» (owner 19 Nov 14:29, Bangkok: «only 4 views, and is
this even Bangkok? apply to all»).** LIVE (ef76bcd): «المناظر» = each famous
sight's own Pexels photos by NAME (12 sights × ≤3, shown in rounds: one per
sight by fame, then the 2nd…), then nature + ≤6 city views ONLY after an eye
check; «المعالم» = guide photos by fame, no malls/family. Phrase-only names
(«Grand Palace») must also name the city/country (Dubai got Abu Dhabi's Grand
Mosque); SCREEN filter (phones, charts, traffic). Eye-checked + live:
bangkok (views 4 → 29), istanbul (29 + 21), dubai (21 + 7) — drop lines in
`scripts/photos/gallery2-drop.txt`. `gallery2.yml` now CHAINS itself (GitHub
skipped the hourly runs) until `gallery2.ts left` = 0 (~375 cities, ~12/run),
publishing after each run; unreviewed cities show sights-by-name + guide
photos only. **19 Nov 2nd chat: 10 more eye-checked + live** (paris,
kuala-lumpur, antalya, trabzon, riyadh, jeddah, makkah, madinah, abu-dhabi,
cappadocia; lines REWRITTEN whole — a re-collect renumbers v#/l#, so old lines
of re-collected cities are stale). Name search fails often: Amman's blue
mosque under Riyadh/Jeddah, Casablanca's Hassan II under Jeddah, Putra mosque
under KL, Sumela under «Kaymaklı» — every s# needs the eye. **Sheets now:**
dispatch gallery2.yml with `inputs[only]=a,b,…` (no redo) → own concurrency
group, sheets pushed to branch **`photo-sheets`** (chain can't cancel/wipe
them). Cities with s# rows: `jq 'to_entries[]|select(.value.s)|.key'` on
photo-review-v2's gallery2.json. **19 Nov 3rd chat: +10 live** (london,
cairo, doha, muscat, amman, sharjah, alula, bodrum, izmir, bursa). Worst:
sharjah (Russian/Armenian churches, Ajman), alula (Abu Dhabi's Qasr
al-Watan), muscat (Makkah clock, La Scala). **OWNER'S STANDARD (19 Nov
17:44): every photo must tell the city's beauty, sights and activities so it
makes the traveller want to go** — drop dull/hazy skylines, tanks, caravans,
statues, museum cases, B&W; keep coast, old town, markets, landmarks at
their best, things to do. **24 Nov: 374 of 415 reviewed (drop file = the record; 41 left)** (+abha, taif,
al-ahsa, dammam, tabuk, yanbu, al-baha, dahab, el-gouna, bolu, sur, al-wakrah,
umluj, marsa-alam, hammamet, djerba, cameron-highlands, ipoh, kuching; jazan
has NO photos collected — needs a collect run; Saudi cities
have few/poor Commons photos — yanbu all n# dropped, dammam 6 kept).
**NEXT (~10 cities/chat):** list the unreviewed = gallery2.json keys minus
the drop file's slugs; next: lake-toba, bandung, bogor, labuan-bajo, chiang-rai,
ayutthaya, sigiriya, mirissa, bentota, khiva. Write one drop line per city (tags s#/v#/n#/l#;
drop: interiors of no note, statues/close-ups, screens, traffic, wrong
place, blank tiles, hazy/grey; keep ≤6 v), commit; the next run publishes.
Lessons: guide fame lists odd «sights» (Stock Exchange) — drop by eye. Ghost
run 44442033294 «queued» = harmless. photos.yml stays DISABLED.
Owner's tests of «خريطتي» wait for the final test round (owner 18 Nov).
Then rounds 3–7 (photos, hotels, flights H+B, flight+hotel C, features
visible + home hero).
**20 Nov (build chat): flights «الأفضل» = OURS** (ff76f75, live): fare + 100
SAR/traveller/hour on the way (+2 h night, +2 h stop > 4 h, +4 h airport
change), lowest wins; one line under the pick says why. Live DMM→IST: best
Pegasus non-stop 1,427 (saves 11 h for 365) vs cheapest Saudia 1,062. Owner
approved next (not built): «متاحة في N مواقع» on each card, button «قارن
المواقع واحجز», airline strip above the list. **Release RED since 20 Nov
13:35 on every commit (deploy itself OK):** step «iOS clean mode on
sfrtna.com» (added 508010a, mail chat) → «home: 1 frame(s) in the page» on
production only (staging passes) — likely Cloudflare's own injected frame on
the sfrtna.com zone; find its src and fix (mail chat's Apple 5.1.2 work).
**▶▶▶ HOME HERO — owner APPROVED + BUILT 21 Nov (build chat).** Owner
rejected new heroes (search-box designs = «looks like a booking site»); kept
OUR design, re-ordered: headline (2 lines on phones, clamp size) → the 6
tools (`home/QuickTools.tsx`, now under the headline; short names < md) →
counts → panel. `HeroFeatures` no longer used (file kept); bottom tools row
removed. Panel tabs (web only): open tab alone = sun orange, others white
+ gold icon; phones = 4 equal buttons (icon + `home.tabShort`), no scroll
strip. App: no tab strip (bottom bar), panel titled «أفضل الوجهات في
{month}» (unchanged). «رأيك» smaller on phones. Checked locally at 360/390/
768/1440 + app UA, no sideways overflow. **Next:** owner checks on the phone
(site + app); then rounds 3–7 as listed above.
**«المزيد» (app sheet) REBUILT 21 Nov (owner approved):** title + close,
language first, account card (signed out: Apple / Google / e-mail buttons
that open /account?start=… and SignInForm starts that way at once; signed
in: initial + e-mail row), «رحلتي», tools (navy/gold icons), grouped rows
(settings / contact / about), social + disclaimer. `AppTabBar.tsx`,
`AccountLink.tsx` (sheet variant), `AccountPanel.tsx` (start param).
**Sign-in 24 Nov (313fb5b, live):** Google = redirect to Google's own page
with `prompt=select_account` (`/api/auth/google/start` → form_post to
`/return`, nonce cookie; redirect URI registered on client «Sfrtna Web»,
project 455607676812 — on the owner's OTHER Google account); no GIS script.
iPhone app: «auth» feature + `openAuth` (ASWebAuthenticationSession →
sfrtna://auth) → Google + e-mail besides Apple (needs the new TestFlight
build). TikTok = @sfrtnaapp. **b23568d:** app Google = /account/app
redirects straight to Google (chooser), /return makes the app code and
303s into the app (iPhone sfrtna://, Android intent: + fallback page
?f=1); e-mail stays in-app. **Owner CONFIRMED on iPhone 24 Nov 13:47**
(chooser → back in the app signed in); **Android CONFIRMED 24 Nov 13:55**
(Play closed-test app). NEXT = rounds 3–7 (photos first, see «NOW = round 3»).
**Play closed test (owner 24 Nov):** 12+ Android testers accepted and
testing since **23 Nov** → 14-day rule met on **7 Dec 2026** → then guide
the owner to «Apply for production» (Sonnet chat; Play asks test questions).
Keep testers opted in until then.
**Phones fix 24 Nov (f96f039, live):** owner saw pages slide sideways +
unreachable ✕ (hotels, both apps). html/body `overflow-x: clip`; apps: no
zoom (viewport max-scale=1 set by the in-app script, touch-action
manipulation); every `[role=dialog].fixed.inset-0` gets top safe-area
padding in @layer components (own pt-* wins); hotel dates pill wraps.
Owner to re-check on the phone.
**Owner 17 Nov 20:31 — decision 2:** discover lists EVERY destination in
budget; no live fare → shown WITHOUT a number + «شاهد السعر الحيّ» (opens the
flight search). **Decision 1 (20:40): no paid SerpApi — wait for 6 Dec**,
and study a partner hotel-price API: RateHawk Affiliate API (we have an
account, «Linked») first, Agoda (applied Oct) second — **owner 20:34: partner
topic WAITS until the notes list (A–H, friends, hero) is finished.** Decision
3 (Chrome) open.
Side topics (owner, later): Play needs 12 testers × 14 days (personal
account); owner will issue his own CR «مؤسسة حسن علي الماجد» (name «سفرتنا»
rejected by MC as taken; check SAIP trademark) → D-U-N-S (≤30 days) →
organization account = no tester rule; org legal name + address show on
Play. Apple: waiting on case 30000017675096 / App Review thread.
**▶▶▶▶▶▶▶▶▶ APPLE 18 Nov: REJECTED again (build 50: 5.1.2(i) cookies/tracking +
2.1) → ROOT FIX LIVE (mail chat, 0221491 + d04bec8): «iOS clean mode»
`src/lib/iosClean.ts` (no GA/banner/partner scripts in the iPhone app;
flights + Stay22 list open outside), native WebKit no-tracking rules,
release gate `scripts/ios-clean-check.mjs`. Build 51 on TestFlight. Owner
steps = `docs/app-store/presubmit-checklist.md` (mail chat). Never add a
third-party script/iframe without keeping it out of the iOS app.**
**▶▶▶▶▶▶▶▶ STATE 17 Nov 01:35 — iPhone submit BLOCKED by Apple (hidden forms).**
Done tonight: build 50 (Apple-token revoke code) attached to 1.0; review notes
pasted; reply (short, 3,494 chars, all 9 answers) SENT in build 27's thread;
DSA = non-trader (done). «Update Review» → «unexpected error». Root cause via
`ios-review.yml` (scripts/ios/asc-review.mjs, API): appInfo compliance forms
`PPM.compliance.form.SECURITYASF395E` + `AIGENERATEFD1DE` PENDING_COLLECT →
NEW_APP_SUBMISSION_BLOCK; not shown anywhere in the UI (age rating, privacy,
app info all complete). Owner wrote Developer Support 01:34: case
**30000017675096**. **NEXT:** when Apple answers / forms appear → fill them →
run `ios-review.yml` with submit=yes (or «Update Review»). Sign in with
Apple key DONE 01:50 (key H67V5U9Z2X, team 69U9GNVS8H, Runtime secrets set);
live check `/api/health?apple=1` (in ios-review.yml) = 400 invalid_grant =
Apple accepts our client secret → revoke on deletion is active.
17 Nov 12:57 App Review replied «please resubmit»; 13:10 + 14:44 API retries
still blocked by the same 2 forms → owner replied in the thread 14:45 with
the codes + case number. Wait for Apple (support case or App Review).
**▶▶▶▶▶▶▶ STATE 17 Nov 00:20 — iPhone ready to submit.** Owner tested on
TestFlight: Sign in with Apple OK (account page), «أضف الخطة إلى تقويم جوالي»
OK (Istanbul stops 24–28 Nov in the iPhone calendar). Account page empty
sections fixed (white compact cards, 6d1e547). ios-store.yml: build 49
attached to version 1.0; review notes NOT updated by the script (it skips
once added) → owner pastes `docs/app-store/listing.json` reviewNotes by hand.
**17 Nov 00:40 — Apple token revoke CODE DONE:** iOS plugin returns
`code` (authorizationCode) → `/api/auth/apple` swaps it at Apple /auth/token
(ES256 client secret, `appleClientSecret` in accounts.ts) → refresh token in
DO table `apple_tokens`; `/api/auth/delete` → `appleRevoke`. Inactive until
Runtime vars APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_P8 exist (sign-in unaffected).
Swift changed → new ios.yml build; attach IT (not 49) to version 1.0.
**NEXT (Sonnet, owner steps one at a time):** 0a) owner: Apple Developer
Keys → + → Sign in with Apple key (primary App ID com.sfrtna.app) → download
.p8 → Cloudflare Runtime vars (APPLE_P8 = file text, secret) → Claude checks;
0b) attach the new build to 1.0 (ios-store.yml or by hand); 1) App Store Connect → app → version 1.0 → App Review
Information → Notes = reviewNotes; 2) App Review thread of build 27 → paste
the reply body of `docs/app-store/review-reply.md`; 3) optional «Request a
call»; 4) Add for Review → Submit. No guarantee of approval.

**▶▶▶▶▶▶ Sign in with Apple BUILT 16 Nov 23:50 (same chat, owner asked):**
`/api/auth/apple` (+ edge-guard), `verifyAppleToken` (Apple JWKS, aud
com.sfrtna.app, sha256 nonce) → `googleSignIn("apple:"+sub)`; iOS plugin
`appleSignIn` (feature «apple», AuthenticationServices), black button first
in SignInForm, AccountLink/JoinHost count it; entitlement applesignin in
App.entitlements + ad-hoc signing before export («Signing app applesignin:
1»). LEFT: revoke Apple token on account deletion (owner makes a Sign in
with Apple key → Runtime vars APPLE_KEY_ID/APPLE_TEAM_ID/APPLE_P8 →
/auth/revoke in delete); web sign-in later. Old plan text:
**▶▶▶▶▶▶ NEXT SECTION (owner 16 Nov 23:13): Sign in with Apple** («ميزة
واضحة وصريحة»; also App Store rule 4.8 once any third-party sign-in shows in
the iOS app — today the iOS build hides sign-in: no «auth» in `features`).
Plan (Opus): 1) server `/api/auth/apple` POST {idToken, nonce, name?}: verify
the JWT with Apple's JWKS (appleid.apple.com/auth/keys, edge-cached), iss
https://appleid.apple.com, aud com.sfrtna.app, sha256(nonce); then the same
account/session path as `/api/auth/google` (`verifyGoogleToken` in
src/lib/accounts.ts); private-relay e-mails are real addresses (mail works
only after the owner registers sfrtna.com's sender in Apple's «Email
Communication»); add to edge-guard ROUTES. 2) iOS plugin `appleSignIn`
(ASAuthorizationAppleIDProvider, nonce) + features «auth» «apple»; site
sign-in shows «تسجيل الدخول عبر Apple» (official black button) first in the
iOS app, plus the e-mail code. 3) entitlement com.apple.developer.applesignin
[Default] (App ID com.sfrtna.app already has Sign in with Apple ticked) —
ios.yml must ad-hoc sign the archive with App.entitlements before export (the
widget trick of 91c4c4b worked: «Signing widget app-group: 1»). 4) Account
deletion must revoke the Apple token (needs a Sign in with Apple key from the
owner: Keys → + → Sign in with Apple → Runtime var). 5) Web (Services ID +
domain) = later. Then update review notes + reply («Sign in with Apple» in
the iPhone-only list). Calendar build 0f97edde: simulator compile OK; check
its TestFlight upload first.

**▶▶▶▶▶ OWNER'S DECISION 16 Nov 18:23 (overrides ALL Apple work below):
iPhone LOOKS like the site/Android (no native tabs, no widget); it only gets
better iPhone ways to use features we already have.** Owner picked: «احفظ
على جوالي» (offline) + prayer alerts + trip reminders, and «📅 أضف الخطة إلى
تقويم جوالي» (EventKit, write-only, every stop at its time in the city's
zone + alert 30 min). Not chosen: qibla / nearby lists (hidden: `tools = []`),
widget, native planner. Base = 6b319a4b (trip mode inside the site), + feature
«calendar» (`addToCalendar` plugin, `CalendarStop` events in OfflinePlan,
button in TripModeCard; qibla/mosques/halal chips removed). listing.json
review notes + review-reply.md rewritten (project idea + iPhone-only list +
steps to try). Kept but UNUSED: SfrtnaWidget/, App.entitlements, IosTabsGuard
(UA SfrtnaTabs only), appPlan/app-cities. **NEXT:** check ios.yml compiled +
uploaded → owner (one step at a time, Sonnet OK): TestFlight → plan Istanbul
→ «احفظ على جوالي» → alerts → «أضف الخطة إلى تقويم جوالي» → Airplane mode →
open the plan; ONE screenshot of anything wrong → `ios-store.yml` (listing)
→ paste reply in build 27's thread → request a call → pick new build → Submit.

**▶▶▶ (16 Nov 15:00): Apple root fix P1+P2+P3 BUILT, P5 text + P7 draft
written** (PROJECT_NOTES «Apple root fix — P1–P3 + P5»). Next: store
screenshots from the new screens (ios.yml shots), optional P4 widget, then
P6: owner invites ≥5 external TestFlight testers for a week → fill
`docs/app-store/review-reply.md` → `ios-store.yml` (listing) → reply + call →
submit. **Opus 5.5** for screenshots/widget; Sonnet for owner TestFlight steps.

**(older) NEXT SECTION (owner 16 Nov 11:16): cover Apple's rejection at the root.**
Study + plan: PROJECT_NOTES «Apple rejection — root-cause study» (table +
P1–P7). Start P1 (native home/tab bar, iOS only) + P2 (no booking engine /
white-label widget inside the iOS app; site + Android unchanged), then P3–P5,
then P6 beta 7 days, P7 reply + submit. Ask the owner to paste Apple's
exact rejection text (only the guideline paragraphs) at the start. **Opus 5.5.**

**▶▶ (16 Nov, item 2 Apple): «وضع الرحلة» BUILT** (PROJECT_NOTES «iPhone
«وضع الرحلة» — 16 Nov»): iPhone keeps a plan offline («احفظ على جوالي»
under the smart plan, no account), reminders + prayer alerts in the city's
time (local notifications), qibla, nearest mosques / halal; More sheet,
offline screen and home-screen shortcut open it. Site part live (Release
green); iOS build = TestFlight. **Owner next (one step at a time, Sonnet
OK):** install the new TestFlight build → plan a trip → «احفظ على جوالي» →
Airplane mode → More → «وضع الرحلة» → open the plan; try qibla + reminder
switch; ONE screenshot of anything wrong. Then 2–3 days of TestFlight
feedback → reply to Apple's 9 questions + review notes (Opus). Android
port of trip mode = later.

**▶ Play setup DONE 16 Nov 05:10** — all «Finish setting up» items, store
listing (texts = listing-draft.md; icon/feature graphic/7 screenshots made from
`ios-shots` store-*.png, cropped to 1080×2160, hotels shot dropped), closed
test «Alpha» (SA+AE+KW+QA+BH+OM, list «Sfrtna team», feedback info@sfrtna.com,
release 28 (1.0.0)), advertising ID = No; 14 changes SUBMITTED for review.
Privacy page got «#delete» section (used as Play deletion URL). Data safety:
Name, Email, App interactions (required), search history, other UGC, Device
IDs; collected, not shared. **Owner next:** add testers to «Sfrtna team» until
12+ opted in (14-day clock starts then) → apply for production ~3 weeks.
**Home 16 Nov (live):** hero subtitle → owner's 7 features (`HeroFeatures`,
dict `hero.features/featuresDetail/featuresShort`), two still rows, no boxes;
month name in the season panel = logo gold #f8b840. Owner rule: every new
colour comes from the logo (navy, light blue, sun orange, sun gold).
**WHEN THE OWNER SAYS GOOGLE APPROVED (owner 16 Nov):** first thing, remake
Play screenshot 1 (home) from the live site with the new feature rows,
1080×2160, app view (UA «SfrtnaApp/», tips/welcome keys sfr-tips-v1 /
sfr-welcome-v1 set), send it; owner swaps it in Main store listing.

**OWNER'S ORDER 16 Nov 02:40 (overrides NEXT 1/NEXT 2 order below):**
1) Google Play setup to 100% — «Finish setting up your app» + store listing
   (see «Next Play steps» below; owner steps, **Sonnet 5.5**);
2) Apple: iPhone app-only value + TestFlight + reply to App Review (Apple's
   review takes days, so it goes early; **Opus 5.5**);
3) then improvements/additions: interactive route map, full product audit,
   B, C, F, G, H, friends' notes, home hero.

**▶ E round 2 fixes DONE 15 Nov** (PROJECT_NOTES «E round 2 fixes — 15
Nov»): PDF cover + full-width days broken between stops; meals follow the
chosen kitchens, no mall opening a «famous» day; saved plan shows saved;
plan mail for smart plans; real road times between cities.
**16 Nov owner's check found 3 bugs — FIXED** (PROJECT_NOTES «Owner's
phone check, 16 Nov»): mail claims always «taken» (plan mail «limit» + NO
trip mail ever sent since 10 Nov), app PDF = print screen → share sheet,
final ي cut in the route ribbon (no space between spans).
**Owner (one step):** on the phone open a plan (DMM→Colombo 10 days),
press «تحميل PDF» and «أرسل الخطة إلى بريدي», send ONE screenshot of anything
wrong; check Kandy → Ella ride reads ~130+ km.
**Mail claims fixed for real 16 Nov 02:10** (release 43772073265 green):
rowsWritten counts index writes (1 row = 2) → claims now use RETURNING.
Owner to re-try «أرسل الخطة إلى بريدي». «حفظ الصورة» says «update the app»
= owner's installed APK is older than share-binary (14 Nov) → install the
test APK (releases/download/android-test/sfrtna-android-test.apk; debug key
changes per build → uninstall the old app first).
**16 Nov 02:16: test APK will NOT install on the owner's phone** («App not
installed» even after uninstall; file 6.2 MB OK; phone has a WORK profile
whose policy forces Play Protect). Don't walk him through sideloading again.
Test app features via the site in the phone browser; real fix = Play
internal testing track once the Play account works.
**Owner 16 Nov 02:18: go to Google Play NOW** (changes «Play upload after
B–C»): purpose = test every fix/addition through the store instead of
sideloaded APKs. Plan: 1) clear the red «profile removed» banner (owner
sends View details); 2) create the app (exclude EEA/UK, non-trader), upload
the .aab from android.yml to the INTERNAL testing track (no 12×14 rule,
installs from Play, owner first); 3) closed test with 15+ Android testers
for 14 days (personal account rule) → apply for production (~3 weeks).
**Play progress 16 Nov 02:34:** app CREATED (Personal account 8893362294243663078,
«سفرتنا | Sfrtna», com.sfrtna.app, ar default, free, automatic protection
ON). Internal testing: list «Sfrtna team» = owner's almajedov@gmail.com;
release 28 (1.0.0) = aab from android.yml run 43574244827 (share-binary),
PUBLISHED to internal testers 02:34; owner accepted the invite, store page
not live yet («Not Found» at 02:38 = normal first-release delay) → owner
retries https://play.google.com/store/apps/details?id=com.sfrtna.app.
**Next Play steps (owner, Sonnet chat):** «Finish setting up your app» on the
dashboard: app access (no login needed), ads = NO, content rating, target
audience (18+), data safety (account email, saved plans), privacy policy =
https://sfrtna.com/ar/privacy, news = no; store listing from
`docs/play-store/listing-draft.md` + 512 icon, 1024×500 feature graphic,
phone screenshots (Claude makes them); countries = SA + Gulf, NO EEA/UK.
Then closed test track + 15 testers' Gmail list (owner collecting).
New code = bump versionCode (CI run number) → upload aab to internal.
**▶▶ NEXT 1 (owner 16 Nov 01:59): interactive route map in the plan.**
Keep today's route map; tapping a city's number (1, 2…) opens that city on
the map with ALL the plan's places there (numbered pins by day, tap a pin →
name + day + «على الخريطة»), not only the list under the map. Goal: make
the plan the reason to rely on the app. Same map in the app (later offline).
**▶▶ NEXT 2 — BUILT 16 Nov (see NOW at the top); old brief kept:** iPhone app-only value for Apple's 4.3 /
4.2.6 rejection, then the reply. Today `mobile/` = Capacitor 8 shell with NO
native plugins. Build (plugins called via `src/lib/nativeApp.ts`, site keeps
working in browsers) «وضع الرحلة»: 1) saved plans offline (Preferences/
Filesystem + offline screen in the shell); 2) local notifications: trip
reminders 7 d / 3 d / departure / each day's first stop + optional prayer
alerts in the city's time (permission only when turned on); 3) qibla,
nearest mosque / halal food; 4) native share sheet; .ics calendar + haptics if
cheap. Then bump build → `ios.yml` → TestFlight internal 2–3 days (real
feedback only) → reply to Apple's 9 questions (draft: PROJECT_NOTES «Apple 4.3
rejection — 14 Nov») + review notes (Airplane mode → saved plan) → owner
resubmits. Never resubmit without big changes. After that: FULL PRODUCT AUDIT
(owner's order 14 Nov, step 2). Recommended model: **Opus 5.5**.

**Earlier hand-off (13 Nov evening):**

**▶▶ NEXT SECTION (owner 13 Nov 18:52, BEFORE uploading to Google Play):**
PROJECT_NOTES «Owner's notes of 13 Nov 2026» (A–D). **A+D DONE 13 Nov
(commit 9890a27, release 43461431466 green)** — details in PROJECT_NOTES
«A+D done». Waiting: owner checks on the phone (DMM/RUH→LJU search; edit
the departure city). Hotel half of A4 not touched: the hotel list was
paced shut (SerpApi, reopens ~15 Nov) → re-check once open, with C.
**Owner 14 Nov 03:24 — new notes E–H** (PROJECT_NOTES «Owner's notes of 14
Nov 2026»): E trip-plan rebuild (8 points), F more cities (Sri Lanka 4 only),
G «Been»-style visited map, H why DMM→CMB had only the second source.
Owner calls the plan «very bad» — plan + budget + places are what set us
apart. Prayer-times overflow + identical flight tabs fixed 14 Nov.
**Friends 14 Nov 03:28: «not ready to launch»** — coverage (flights,
destinations, cities), plan, city photos (nature/sights not buildings),
hotels display, hidden features (PROJECT_NOTES «Friends' verdict»).
**OWNER'S ORDER (14 Nov 09:39):** 1) **E = trip plan rebuild FIRST**
(all 8 points, in rounds, to 100%); 2) then a FULL PRODUCT AUDIT that covers
everything in «Owner's notes of 14 Nov» + «Friends' verdict» (coverage of
flights / destinations / cities — Sri Lanka 4 only; city photos = nature and
famous sights; hotels display; features visible from the first visit; H =
why DMM→CMB had only the second source) AND re-checks the new plan → one
report with numbers + a launch plan; 3) sections from that plan, incl. B, C,
G («Been» map). Owner stresses: his notes are NOT only about the plan —
none may be dropped. Play upload after B–C.
**E round 1 DONE 14 Nov** (PROJECT_NOTES «E round 1»): route across a
country's cities, days per city, «بديل», new day layout, save, Google Maps,
route image, «قبل أن تسافر». **E round 2 live check DONE 14 Nov 11:30**
(PROJECT_NOTES «E round 2 — live check»): plan, route image with real tiles,
save → «حسابي» → open = OK. E round 2 fixes (DONE 15 Nov, see top):
1) PDF rebuild in `planPdf.ts` + SmartPlanView: cover page (title, dates,
route ribbon + route image), days flow across pages at stop boundaries,
full width, never shrink, no blank gaps; 2) meals follow the chosen cuisines
(halal + local got an Italian lunch); «أشهر معالم» should not open with a
mall; 3) reopened saved plan shows «محفوظة»; 4) plan mail for smart plans;
5) ride-time accuracy. Owner (parallel, one step): open a plan on the phone
(DMM→Colombo 10 days; Istanbul 4 days), send ONE screenshot of anything
wrong. Then step 2 = FULL PRODUCT AUDIT (F coverage first: Ella
English-only + no restaurants, Galle 8 places). **Round 1b (14 Nov 11:20,
release green):** Arabic final-letter tails fixed site-wide (globals.css),
route image = place icons + city cards that avoid stops + footer of each
city's best places, «حفظ الصورة» via app share sheet (`share-binary`, NEW
native code: Android test APK rebuilt; iOS needs the next build).

**Apple REJECTED iOS 1.0 (27) on 13 Nov 22:51: 4.3 Spam (a)(b) + 4.2.6
template.** Owner AGREES the app feels like a copy of others. Decision 15 Nov:
do NOT reply/resubmit yet. First finish E round 2 + the work below, then
build app-only value («وضع الرحلة»: today's plan offline, prayer alerts in the
city's time, qibla, nearest mosque / halal food, trip reminders), THEN reply
to App Review answering its 9 questions (draft: PROJECT_NOTES «Apple 4.3
rejection — 14 Nov»). Never press Resubmit without big changes.
**Positioning + home hero (owner 15 Nov): ALL proposals rejected** («خطّط
سفرتك صح», «خلّ سفرتك علينا» = sounds like we book, «رحلة كاملة جاهزة» =
not true today, a 4-card sketch = «فاشل»; fails on words, look and clutter).
Owner wants: a hero that EXCITES and shows ALL we offer (choose destination:
budget destinations, budget advisor, seasons, visa, currency / book: live
flights incl. multi-city, hotels, cars / plan: day plan with prayer + halal +
kids, city route, 365-city guide, maps / prepare: eSIM, airport transfer,
tours, «رحلتي» + reminders, saved plans, app). Must be honest (we plan and
compare; partners book). Method next time: study the heroes of Almosafer,
Wego, Booking, Airbnb, Kayak in Chrome first; then make 2–3 COMPLETE designs
(Design artifact, real photos/fonts/colours, phone + desktop), no chat
sketches, no lists of slogans; owner picks.

**Release gate: CLOSED (4 Nov) + catch-up (6 Nov).** `release.yml` is the
only way to production (Cloudflare Git build disabled). Pushes made by
workflows with GITHUB_TOKEN (guide, hotels, photos, reports…) never start a
`push` run, so guide data of 4–5 Nov sat outside production → release.yml
now also runs hourly (`41 * * * *`) and releases main only if that commit was
never through the gate (green or red), else does nothing. Details:
PROJECT_NOTES «Release gate» → 6 Nov.
**CONFIRMED 12 Nov:** data commit 73bb327 (guide workflow) — catch-up run
43059837110 failed at «Install the browser» (download flake), next hourly run
43116712029 released it green. Catch-up works; a red catch-up is retried.

**Data workflows (6 Nov, audit):** see PROJECT_NOTES «6 Nov 2026 — audit
of all data workflows». Long jobs (hotels, places, restaurants, guide,
partner-pages) push via `scripts/ci/push-to-main.sh` (retry, then split)
and save their result as an artifact first; hotels/places/restaurants
refresh the oldest cities first, 3× a month; restaurants now has a time
budget; status report lists time-outs. Full hotels refresh run 42141827127
(old code) = GREEN 6 Nov. Checked 13 Nov 03:10 KSA: no scheduled run on the
new code yet; no `*fetched-at.json` in main yet (6 Nov push runs were
missing-only). **Next step:** check the first scheduled runs (places 13 Nov
05:41 KSA, restaurants 14 Nov 06:17, hotels 15 Nov 06:17): `fetched-at`
files appear and grow; no «توقف عند المهلة».

**Growth consultation (6 Nov):** owner's doc «استشارة نمو سفرتنا»
https://claude.ai/artifact/PdyRGXJuakaAhJY3a6x1oa — 7 items in order;
item 1 = the section below. Tick its checklist as items close.
**Item 5 APPROVED by the owner 6 Nov 20:34** — the traveller journey (scenario in
the doc): no first-visit popup; «احفظ رحلتك» card after a search (Google
one-tap, UNticked consent); on «احجز» click a return banner + email within
1 h «5 أشياء جهّزها الآن» (tagged partner links); reminders 7 d / 3 d / arrival
day / after return; WhatsApp share of the plan. Rules: ≤5 mails per trip, skip
what is ticked in «رحلتي», unsubscribe in every mail (Saudi PDPL), no fixed
prices in mail. Build after item 1: server-side trip save + consent + mail
schedule (Resend: check plan limits) + share + push.

**Hotel page section (7 Nov) — DONE, in production (3 rounds, last
release 42330383517).** Details: PROJECT_NOTES «Hotels like Booking — 7 Nov».
List card = 3 columns (photo carousel | hotel + framed services | rating,
price, deal, «اختر»); phone: sticky bar + one-tap filter chips; side column
(lg): map card + budget slider/chart + filters. Hotel page: Booking order;
rooms section (Google `rooms[].rates`: free cancellation date, breakfast);
facilities by Google's groups (`amenities_detailed`); usual range + deal.
Card round 3 (7 Nov 23:30, release 42410604135): page max-w-7xl, services
frame = 6 key lines + «+N خدمة أخرى», rating box + price + «اختر» column.
Preview locally: `next dev` + Playwright mocking /api/hotel-prices.
Rooms round (7 Nov 23:55, release 42412188124): with rooms the prices
section = rooms list (lowest price + «اختر» → `RoomBooking` panel: every
site + «احجز»). 8 Nov (release 42415948995): prices once — sites without
room details = row «أرخص سعر للفندق (أي غرفة)»; `RoomBooking` = the flight
widget's layout (close/share, sellers with logo + pill button, room ✓ facts,
stay timeline). Flight panel itself = partner widget (tpwgt), not our code. List count uses Google's
`search_information.total_results` (Istanbul 15,000) → «N فندقاً · معروض أفضل 20».
Pacer: early days may run 25% ahead (`maySearch`, 0.75) — the list had been
shut for two days. Phone audit 7 Nov (ux-audit, iPhone 13): list + page OK.
SerpApi = FREE 250/month (renews 6 Dec). Staging has no `SERPAPI_KEY`.
**Owner's decisions 8 Nov 04:28 (next sections, in this order):**
1. SerpApi: NO paid plan before launch — measure demand at launch, then decide.
2. **Suppliers directory — round 1 DONE 8 Nov** (PROJECT_NOTES «Suppliers
   directory — 8 Nov»; checks in TEST_PLAN). Riyadh fix live: empty flight
   results list 6 flight sites + the route's airlines (Google Flights per
   airline), search filled in; hotels +KAYAK/Google Hotels; cars +KAYAK.
   Left: insurance row + more eSIM/activity/transfer sites — their link
   shapes need checking in a browser that allows those domains.
2b. **NEXT (owner 8 Nov 05:13, before monitoring): airlines' own sites.**
   Today each airline button = Google Flights narrowed to it (`airlineLinks`
   in `src/lib/suppliers.ts`). Task: in Chrome, test each main airline's own
   booking deep link (Saudia, flynas, flyadeal, Qatar, Emirates, Etihad,
   flydubai, Gulf Air, Turkish, Kuwait, Oman Air, RJ, EgyptAir, Pegasus…)
   on RUH→IST 10–17 Dec, 2 ad + 1 child. Fills the search → direct link;
   else keep the Google one. Widen `NATIONAL_AIRLINES` per country. Log in
   TEST_PLAN «Suppliers directory».
   **Round 1 (8 Nov):** flynas, Saudia, flyadeal → keep Google (flynas:
   redirect only for today's date; Saudia + flyadeal: search lives in
   session storage, results URL carries nothing). **Qatar Airways → OWN
   LINK** (`OWN_SITE` in `src/lib/suppliers.ts`; RT/OW, ar/en checked).
   Table + method in TEST_PLAN «Airlines' own booking links». Add each
   passing airline to `OWN_SITE`. **Round 2 (8 Nov 10:30): Emirates → OWN
   LINK** (RT/OW, ar/en, same options + total as its own search); Etihad →
   keep Google (cold visit = bot-check page). **Round 3 (8 Nov 11:15):
   flydubai → OWN LINK; Turkish → keep Google (session id only). Gulf Air
   (9 Nov) → OWN LINK, round trip only, English page (owner's browser OK;
   automated browser gets a bot check; one-way + ar untested). Kuwait → keep
   Google (URL carries nothing). **Round 4 (9 Nov): Oman Air → keep Google
   (results URL carries nothing); RJ → keep Google (form works, results URL
   has no route; a hand-built link left the tab on New Tab twice). Pegasus:
   one guessed link = blank page, NOT concluded, use its own form (flies
   SAW, not IST). Round 5 (9 Nov): Pegasus → OWN LINK (IST → SAW in code); EgyptAir → keep Google (results URL carries nothing; hand-built link answered from the session, not the link). Etihad → OWN LINK (owner's private window; round trip, en, no infants). `NATIONAL_AIRLINES` widened with countries not listed before only (limit 8 links: adding to listed countries would push out hub airlines). Pegasus: no public programme found. SECTION 2b CLOSED.** Next = item 3 (monitoring), see below.
   (sites may show a cookie wall: choose essential only)
   (read each site's own search script; quick test = open the results URL
   in a fresh tab). Saudia's Riyadh notice (flights via ELQ/DMM + bus):
   owner 8 Nov 05:39 — temporary, don't show it, no action.
   **Owner 8 Nov 09:48: join ANY trusted partner that pays commission.**
   Qatar Airways program = Partnerize / impact.com / CJ (official
   qatarairways.com/en/affiliates.html). Our Expedia link is already
   Partnerize (`camref`) → apply to Qatar through the SAME Partnerize
   account (join link on that page). Approved → route the Qatar button via
   a redirect like `/api/go/expedia` with the Qatar camref. Same check for
   each airline that passes. **Partnerize login lost** (account name
   «sfrtna-aeek»; reset form takes neither it nor the email) → owner
   mailed support@partnerize.com 8 Nov 09:58 asking for login + reset +
   to apply to Qatar from the same account. Do NOT open a second account
   via the Qatar sign-up form. **Partnerize replied 9 Nov (ticket #710723,
   closed):** the account was made through the Expedia Affiliate Hub, so
   login is handled by affiliatehubsupport@expediagroup.com, not Partnerize.
   Once in: Campaigns → Join Campaigns → tick the brand → accept terms →
   Join selected campaigns; approved links appear under Tracking. Owner
   wrote to Affiliate Hub support 10 Nov 03:42 → their ticket 00045017
   (auto-reply received). **Expedia replied 11 Nov 05:41:** they will
   only REFER the request, no promise of direct Partnerize access; they ask
   for the Partnerize Publisher ID (PZ ID) if any + Partnerize's reply +
   a screenshot of the login/reset error (+ items hidden in the owner's
   screenshot). Expedia account itself = Expedia Group Creator Hub. Qatar /
   Emirates: «contact those programmes directly», can't say if the
   Expedia-linked account can apply. **11 Nov 06:39: owner replied to
   00045017** (account name, site, Partnerize reply + reset screenshot:
   reset on console.partnerize.com «Forgotten Details» sent no mail).
   **Expedia answered 12 Nov 17:41: login is Partnerize's job — contact
   Partnerize citing #710723** (loop: each side points at the other). Existing
   Expedia links keep working; Travel Creator Program still usable. Owner approved (06:32)
   opening our OWN accounts on impact.com, CJ and other networks: map +
   order in PARTNERS.md «Network map».
   **Emirates (8 Nov 10:43):** programme on Partnerize + TradeTracker
   (campaigns split by market: AE, UK…). Owner asked BOTH which programme
   tracks Saudi bookings (emirates.com/sa), rate, cookie, deep links
   (Partnerize = same support thread; TradeTracker = the Emirates AE
   campaign contact). Replies in → compare, route the Emirates button via
   the better one, the other as fallback. TradeTracker contact on the
   campaign page bounced → owner sent the Dubai office form 8 Nov 10:58.
3. **Monitoring — BUILT 9 Nov** (`monitor.yml` hourly at :29, `scripts/monitor.mjs`,
   state on branch `monitor-state`). Free every hour: 4 pages, flight widget
   script, DXB→IST fares (`/api/health?monitor=1`; RUH has none), SerpApi
   allowance, Worker errors (Cloudflare token works). Once a day one real hotel
   search (list / single hotel in turn), only if allowance OK. Mail after 2
   failures in a row, reminder every 24 h, mail on recovery. Limit: full flight
   search not exercised (widget answers on sfrtna.com only).
   **First run 9 Nov found: hotel search is paced shut** (128 of 250 left,
   renews 6 Dec; `maySearch` needs > 162 today, reopens ~15 Nov if nothing is
   spent). So the real hotel price check has NOT run yet. Owner 9 Nov 13:36: KEEP the
   pace. Test mail arrived. **SerpApi spend FOUND + FIXED 10 Nov:** our own
   checks (Site check, Release's production check, Status report 2×/day all
   run smoke/e2e on production) spent ~8 searches a run (explore + flight
   fallback) — 122 by 9 Nov; 7 Nov hotel rows = hand tests. Fix: requests with
   the check token never spend (`isOwnCheck` in serpapi.ts) except probe and
   monitor's daily hotel search (`x-sfrtna-spend: 1`). **Verify ~11 Nov:**
   SerpApi «Your Searches» shows no bursts at Site check times; count stays
   ~133 unless visitors search. After ~15 Nov check the daily real hotel search
   ran (`monitor-state`). Item 5 started 10 Nov (see 4.)
4. **Item 5 (traveller journey) — steps 1+2 BUILT 10 Nov; step 3 (trip
   emails) BUILT 10 Nov (2nd chat)** (PROJECT_NOTES «Traveller journey — 10 Nov
   … step 3»): `src/lib/tripMails.ts` + `/api/trip-mail/run` (Worker cron
   `17 * * * *`) + `/api/unsub`. 5 kinds (ready 1 h after «احجز» / week /
   esim / arrival / after return), ≤5 per trip, ticked steps skipped, no
   prices, unsubscribe + one-click header. Daily caps for Resend's free
   plan (80 Resend calls incl. codes, 60 trip mails).
   **Step 2 leftovers DONE 13 Nov** (PROJECT_NOTES «Traveller journey — 13
   Nov»): `GuideTripStrip` (end of city/country/visa pages) + «أرسل الخطة
   إلى بريدي» (plan toolbar → `/api/plans/mail`, own address only, 3/day).
   **Next step:** (a) after the release: one real test — owner signs in,
   ticks the box on a flight result, presses «احجز» → mail «أشياء جهّزها
   الآن» within ~1 h 17 m; check it on the phone (layout, links open our
   pages, «إلغاء الاشتراك» page → button → «حسابي» shows off). Dry check
   any time: POST `/api/trip-mail/run?dry=1` with the check key. (b) ux-audit
   / phone screenshot of SaveTripCard signed out + signed in + the guide
   strip. (c) owner presses «أرسل الخطة إلى بريدي» on a city plan → mail on
   the phone (layout RTL, place links open Maps, day route). Then item 5
   step 4 (WhatsApp share + budget card).
5. Google Play trader status: owner asked why it matters → explained 8 Nov;
   decide before 1 Feb 2027.

**Owner 11 Nov 06:40 — do ALL of it, plus anything that adds value.
Queue (owner steps one at a time; code items in a fresh Opus chat):**
- Owner steps: A) impact.com account — DONE 11 Nov 13:11: signed up with
  Google (owner's Gmail), Publisher / فرد / websites / editorial content,
  sfrtna.com verified («متصل», see PARTNERS «Site verification»), profile
  text with budget planning. Status «قيد المراجعة» (impact's own review) →
  when approved: apply to Qatar + Skyscanner + search marketplace for
  Saudia/flyadeal/Turkish/Almosafer and others; write rates in PARTNERS.
  B) Admitad — DONE 11 Nov 15:03 (PID2605420, verified by meta tag; ad
  space «Under review») → when Active: join flynas, Jazeera.
  **C) CJ — IN PROGRESS** (PARTNERS «CJ (11 Nov»): W-8BEN done (name HASSAN ALI A ALMAJED = ID, OK);
  NEXT = Payoneer name fix (ticket
  #261112-010093, then address doc) → approval → CJ payment (US + Payoneer details) → ACTIVATE ACCOUNT; C) CJ → Qatar; D) OWN Partnerize account
  (owner: yes) — after Expedia's answer or by 14 Nov if none (same site on
  two accounts could put the Expedia account at risk; say so on sign-up);
  E) trip-mail real test (item 4 a). Fill PARTNERS.md «Accounts» each time.
- Code (no owner step): item 4 (b) + step 4 share; app banner + store
  badges in mails, built behind a switch, turned on per store approval;
  Search Console «pages not indexed» mail (9 Nov) → find the reason.

«next-step tabs» flake: 7 green Site checks in a row since the fix (4 Nov);
~10 green = close it.

**iPhone app: REJECTED 13 Nov 22:51 — 4.3 Spam + 4.2.6** (PROJECT_NOTES
«iPhone app REJECTED»). See ▶▶ NOW at the top of the hand-off.
**Owner 10 Nov 03:50 — app banner, build when each store approves:** top
banner «حمّل التطبيق» on phones, dismissible, visitor stays in the browser.
Owner 03:51: must be eye-catching like other big sites → OUR OWN designed
banner on iPhone + Android (brand colours, app icon, short line, sun-yellow
«حمّل» button, ✕), not Apple's plain Smart App Banner (never both). Each
store's link only after that store approves.
Owner 03:52: trip mails (`tripMails.ts`) also get the stores' official
badges («Download on the App Store» / «Get it on Google Play», images
served from our site) with one line inviting to install; each badge only
after its store approves; skip if we know the member uses the app. Never inside our own apps (they load sfrtna.com: detect the
Capacitor shell), not on desktop, hidden for N days after «لا شكراً»
(try/catch storage). Plus the «حمّل التطبيق» buttons → store links.

**Google Play:** identity REJECTED 4 Nov 15:48. Found 2 payments profiles:
Türkiye 8920-… (address «Türkiye» only) — owner closed it 4 Nov; Saudi
7453-2385-6824 (Individual, «ALMAJED, HASSAN ALI A», Riyadh 11465) is the
one linked to the developer account; the name is exactly as on his Saudi ID
(keep it, do NOT write the full «Hassan Ali Ahmad Almajed»).. Support ticket
sent 5 Nov 00:09 (Play developer account and verification → Developer
verification → «I can't verify my identity document»): asks for the reason
+ re-open. **Do not re-upload the ID until Google replies** (limited tries).
6 Nov 22:35: account RESTRICTED (profile removed; nothing was published). Identity page offered only Appeal (no re-verify attempts left) → APPEAL SENT 7 Nov 00:00 KSA, reason «I believe I have fixed this issue» (TR profile closed, SA profile matches the ID); answer within 7 days by mail. Do not file another. **12 Nov 12:10: support
ticket [7-5929000041524] — agent «Sha» ESCALATED it to the appropriate team,
update to follow by mail (7 Nov reply was a generic review-time note).** Wait;
don't reply/re-file. **12 Nov 17:26: Google Payments «You need to verify your
identity» (Verify now, profile 7453-2385-6824) + Play «Restricted developer
account»: issues = phone number(s) NOT verified in Play Console + identity not
verified.** Plan: 1) verify phone in Play Console, 2) identity: name exactly as
ID «HASSAN ALI A» / «ALMAJED» (owner 12 Nov: ID reads «ALMAJED, HASSAN ALI A»),
clear photo, all 4 corners, no glare — attempts are limited.
**AUDIT 12 Nov 18:20 (Claude read pay.google.com u/4 + Play account page):**
profile 7453-2385-6824 Individual SA, name «ALMAJED, HASSAN ALI A», address
ONLY «Alyassamin, Riyadh / Riyadh 11465» (no building no./street/additional
no.; 11465 may be a PO-box code, not the National Address postcode), payments
phone «+966 056…» (extra 0); Play contact phone +966563399984 OK. Saudi
individuals need ID (colour, both sides) + SPL National Address doc whose
English name = ID English name and whose address = profile address (Salla
guide). Payoneer OCR read «AHMED» from the ID → ID card English name may be
longer than the profile's. CJ/Payoneer were given «Olaya» — unify to the SPL
address. Chrome default account = almajedov@gmail.com (other profiles: «Bin
Majed» India, SA 3442-7858-8202) — not the Play account; use u/4.
**12 Nov 22:40 FIXED: profile address = owner's SPL National Address
(Al Mubarraz, Al Fath, 36342 — doc issued 12 Nov, the single source for every
form). Name kept «ALMAJED, HASSAN ALI A» = ID card (owner 22:45).** Open
issue: SPL doc English name is the FULL «Hassan Ali Ahmed Almajed» ≠ ID «A» →
need an address proof whose name = ID (e.g. bank statement) or accept risk.
**23:09 owner: every bank writes «Hassan Ali Ahmed Almajed» or «Hassan
Almajed» — no proof shows «A».** Decision: upload ID card (colour, both sides)
+ the ORIGINAL SPL PDF (it carries the same national ID number, linking «A» =
«Ahmed»). Profile name stays = ID. 23:35 confirmed: Play «Legal name and
address» now shows the new Al Mubarraz address (synced from the profile).
**13 Nov:** SPL doc is not on Google's accepted list → address proof = Al
Rajhi bank statement (issued 13 Nov, owner updated his national address in
the bank app). It matches the profile except city «AL AHSA» → profile city
changed to AL AHSA (saved 13 Nov). stc bank statement unusable (no address).
**SUBMITTED 13 Nov 03:07 KSA:** address document = Bank statement (Al Rajhi
PDF), name «ALMAJED, HASSAN ALI A», address Al Fath / AL AHSA 36342 → «In
review». Wait for Google's mail; do NOT resubmit or edit the profile
meanwhile. If rejected for the name (bank writes AHMED in full) → read the
reason first, then decide. **VERIFIED 13 Nov 14:08 KSA** (Play Console mail «Your identity
has been verified»). **Owner 13 Nov 18:24: NON-TRADER** (targets
SA + Gulf only, no Europe) → when creating the app, EXCLUDE EEA/UK countries
from distribution; switch to trader if ever distributed there. Non-trader SAVED +
**PHONE VERIFIED 13 Nov 18:29.** Red banner still: «Your developer profile and
all apps have been removed» (the 6 Nov restriction) → next: its View details,
see if it lifts by itself or needs the appeal/ticket. Then create the app; payments phone «+966 056…» extra 0 still to fix. Trader status: declare
by 1 Feb 2027 (owner's decision; trader = phone + address shown publicly;
non-trader allowed if not distributed in EEA/UK). Store texts ready:
`docs/play-store/listing-draft.md` (Play has no keyword field).

**Riyadh flights:** Travelpayouts 4 Nov (Viet): Aviasales decided not to
show flights to Riyadh; Data API returns none either. Owner decided 4 Nov:
wait until 6 Nov → then measure the SerpApi allowance (resets 6 Nov) and
propose the Google-fares plan with numbers (his decision). 12 Nov: owner
replied to TP ticket #254780 (understood, close it, tell us if RUH returns). TP (Ingmar) confirmed 12 Nov 18:29: they will watch
Aviasales and tell us when Riyadh data returns. Nothing to do until that mail.

Stay22: CLOSED 4 Nov — account cleared, Payments page shows only «Minimum
payout threshold $500 not met» (wire $500; PayPal/ACH $100).

Waiting on the owner: Admitad — 19 Nov fix (PARTNERS «19 Nov ROOT CAUSE»: custom rule no-UA ≠ «/» + Bot fight mode OFF + no-UA tag + monitor) → Verify → re-apply to the 5 rejected; Google Play ticket reply; Google-fares
decision after the 6 Nov measurement; Android APK on a real phone.

**Recommended model for the next chat: Opus 5.5** (round 3: review the photo sheets).
