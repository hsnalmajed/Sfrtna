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

## ▶ Hand-off (10 Nov 2026, 2nd chat — trip emails) — current state

**Release gate: CLOSED (4 Nov) + catch-up (6 Nov).** `release.yml` is the
only way to production (Cloudflare Git build disabled). Pushes made by
workflows with GITHUB_TOKEN (guide, hotels, photos, reports…) never start a
`push` run, so guide data of 4–5 Nov sat outside production → release.yml
now also runs hourly (`41 * * * *`) and releases main only if that commit was
never through the gate (green or red), else does nothing. Details:
PROJECT_NOTES «Release gate» → 6 Nov.
**Next step:** after the next data commit by a workflow, confirm a
`schedule` Release run deployed it (notice «Catch-up» in the run).

**Data workflows (6 Nov, audit):** see PROJECT_NOTES «6 Nov 2026 — audit
of all data workflows». Long jobs (hotels, places, restaurants, guide,
partner-pages) push via `scripts/ci/push-to-main.sh` (retry, then split)
and save their result as an artifact first; hotels/places/restaurants
refresh the oldest cities first, 3× a month; restaurants now has a time
budget; status report lists time-outs. Full hotels refresh dispatched 6 Nov
~04:30 KSA (run 42141827127, old code). **Next step:** check that run and
the first runs on the new code (places 13 Nov, restaurants 14 Nov, hotels
15 Nov): `fetched-at` files appear and grow; no «توقف عند المهلة».

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
   Owner: WAIT for Expedia's answer before any other mail (incl. the
   expediaaffiliates.support@partnerize.com desk). Owner approved (06:32)
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
   **Next step:** (a) after the release: one real test — owner signs in,
   ticks the box on a flight result, presses «احجز» → mail «أشياء جهّزها
   الآن» within ~1 h 17 m; check it on the phone (layout, links open our
   pages, «إلغاء الاشتراك» page → button → «حسابي» shows off). Dry check
   any time: POST `/api/trip-mail/run?dry=1` with the check key. (b) ux-audit
   / phone screenshot of SaveTripCard signed out + signed in. (c) step 2
   leftovers: guide-page strip «مسافر إلى …؟» and «أرسل الخطة إلى بريدي».
   Then item 5 step 4 (WhatsApp share + budget card).
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
- Code (no owner step): item 4 (b)(c) + step 4 share; app banner + store
  badges in mails, built behind a switch, turned on per store approval;
  Search Console «pages not indexed» mail (9 Nov) → find the reason.

«next-step tabs» flake: 7 green Site checks in a row since the fix (4 Nov);
~10 green = close it.

**iPhone app:** «Waiting for Review» since 3 Nov 14:45 (still waiting 5 Nov
19:09). Approved → point «حمّل التطبيق» / AppStoreButtons at the App Store
link, then the native rating prompt; rejected → read the reason, fix. Still
waiting ~6 Nov evening → offer the owner an expedited review request.
**Expedited review ACCEPTED by Apple 10 Nov 03:48** («We'll expedite review
for Sfrtna»); a rejection + resubmit returns to the expedited queue.
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
6 Nov 22:35: account RESTRICTED (profile removed; nothing was published). Identity page offered only Appeal (no re-verify attempts left) → APPEAL SENT 7 Nov 00:00 KSA, reason «I believe I have fixed this issue» (TR profile closed, SA profile matches the ID); answer within 7 days by mail. Do not file another. Trader status: declare
by 1 Feb 2027 (owner's decision; trader = phone + address shown publicly;
non-trader allowed if not distributed in EEA/UK). Store texts ready:
`docs/play-store/listing-draft.md` (Play has no keyword field).

**Riyadh flights:** Travelpayouts 4 Nov (Viet): Aviasales decided not to
show flights to Riyadh; Data API returns none either. Owner decided 4 Nov:
wait until 6 Nov → then measure the SerpApi allowance (resets 6 Nov) and
propose the Google-fares plan with numbers (his decision). 12 Nov: owner
replied to TP ticket #254780 (understood, close it, tell us if RUH returns).

Stay22: CLOSED 4 Nov — account cleared, Payments page shows only «Minimum
payout threshold $500 not met» (wire $500; PayPal/ACH $100).

Waiting on the owner: Apple review; Google Play ticket reply; Google-fares
decision after the 6 Nov measurement; Android APK on a real phone.

**Recommended model for the next chat: Sonnet 5.5** for the network sign-ups (Admitad, CJ) and the trip-mail test; Opus 5.5 for the code queue (banner, badges, share, Search Console).
