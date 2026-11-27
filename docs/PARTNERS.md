# Sfrtna — Partners register (owner 8 Nov 2026)

Goal: more trusted partners and suppliers = more value for travellers.

## Rule (owner, confirmed 8 Nov 10:48)

1. Show every trusted supplier with its live price, commission or not.
2. For each one find: does it have a commission programme (own or via a
   network)? What are the conditions to join (traffic, site type, market,
   app, content…)?
3. Write the conditions here and compare with our site today:
   - we meet them → apply now;
   - not yet → write what is missing and when to re-check; apply as soon
     as it is met.
4. Approved → route its button through the commission link; a supplier on
   several networks → all of them, best payer first, next one as fallback.
5. A condition we could not confirm = «needs confirmation», never a guess.

Status words: **Active** (tracked link live + payout set) · **Applied** ·
**Asked** (question sent) · **Locked** (conditions not met yet) ·
**To check** (programme not looked up yet) · **None** (confirmed no programme).

## Register

| Supplier | Need | Programme / network | Rate (source) | Conditions to join | We meet? | Status | Next |
|---|---|---|---|---|---|---|---|
| Aviasales | Flights widget | Travelpayouts (`wl_id=22604`, marker 778874) | 40% (TP dashboard, 10 Oct) | — | ✓ | Active (bank USD) | Riyadh: Aviasales does not show RUH flights (4 Nov) |
| 23 TP programmes (Klook, Tiqets, WeGoTrip, Go City, KKday, Kiwitaxi, Welcome Pickups, intui, GetTransfer, Airalo, Yesim, GigSky, AirHelp, Localrent, GetRentacar, Economybookings, QEEQ, AutoEurope, BikesBooking, Radical Storage, Kiwi.com…) | Activities, transfers, eSIM, cars | Travelpayouts | per TP dashboard (10 Oct list in PROJECT_NOTES «Partner audit») | — | ✓ | Active (open) | — |
| Booking, Agoda, Trip.com, Expedia, GetYourGuide, Viator, Tripadvisor Exp., DiscoverCars, Omio, 12Go, Hostelworld, Vrbo, Ticketmaster | Hotels, activities, cars, transport | Travelpayouts | per TP dashboard | 3 months of stable traffic (TP, 10 Oct) | not yet — needs confirmation of the exact traffic figure | Locked | re-check in the TP dashboard monthly |
| Expedia | Hotels, flights | Partnerize (`camref`) via `/api/go/expedia` | needs confirmation | — | ✓ | Active (bank) — **login lost**, support mailed 8 Nov | restore login |
| Stay22 | Hotels (Allez, LinkSwap) | own (aid `sfrtna`) | needs confirmation | payout min $500 wire / $100 PayPal-ACH | — | Active, payout threshold not met (4 Nov) | — |
| RateHawk / ZenHotels | Hotels | own (`partner_slug`) | needs confirmation | W-8BEN | needs confirmation | Linked (tax form was under review, Oct) | confirm review done; **24 Nov: Affiliate API = hotel list source** — keys only via account manager (site + integration + booking flow described), sandbox key → build → certification → production key; per-key query limit (raise needs booking record); docs.emergingtravel.com «Affiliate API» includes guest/card booking calls → ASK whether search + deeplink to ZenHotels (booking on their site) is allowed |
| Agoda (direct) | Hotels | own | needs confirmation | manual site review | needs confirmation | Applied (Oct) | check reply |
| GetYourGuide (direct) | Activities | own (`partner_id=NNJW64J`) | needs confirmation | — | ✓ | Active (bank, 2FA) | — |
| Viator (direct) | Activities | own | 8% (TP figure) | ID + selfie verification | ✓ | Linked 21 Oct | — |
| Qatar Airways | Flights (own link live) | Partnerize / impact.com / CJ (qatarairways.com affiliates page) | needs confirmation | needs confirmation | needs confirmation | **Partnerize: REJECTED 21 Nov 03:30** (no reason given) | keep own link (no commission); apply via impact.com / CJ when active; optional: ask nmankala@qatarairways.com.qa for the reason |
| Emirates | Flights (own link live) | Partnerize; TradeTracker (campaigns by market: AE, UK…) | 1.25–2.5%, cookie 30 d (Travelpayouts blog, not official) | needs confirmation; Saudi market coverage asked | needs confirmation | Asked Partnerize 8 Nov 10:43; TradeTracker mail BOUNCED (contact on its campaign page no longer exists) → asked via tradetracker.com/ae/contact-us form 8 Nov 10:58 | compare replies → best first, other = fallback |
| Etihad | Flights (own link, round trip) | To check | — | — | — | To check | own link passed in owner's private window 9 Nov |
| Saudia, flynas, flyadeal | Flights (Google link) | To check | — | — | — | To check | — |
| flydubai | Flights (own link live) | Tradedoubler, CJ (Travelpayouts blog, not official) | 0.80%, cookie 30 d (same blog, updated 2022–25, not official) | needs confirmation | needs confirmation | Not applied | confirm on the network, then apply |
| Gulf Air, Turkish, Kuwait, Oman Air, RJ, EgyptAir, Pegasus | Flights | To check | — | — | — | To check | own-link test done 9 Nov (Turkish, Kuwait, Oman Air, RJ, EgyptAir: keep Google; Gulf Air: own link, no public programme found 9 Nov; Pegasus: own link, no public programme found in a web search 9 Nov) |
| Almosafer | Flights, hotels | none on its own site (24 Nov: only «Almosafer Business»; old Kwanko/CJ listings closed or paused) | — | — | — | **Hotels LINKED 24 Nov, no commission** (`extraHotelSites`, city + dates + party) | ask Almosafer directly for an affiliate programme |
| DataForSEO | Hotel prices source (Google Hotels: list + every site's price per hotel) | none — paid data source, prepaid per request | Live: $0.004 per Hotel Searches page (≤18 hotels) and per Hotel Info hotel (dataforseo.com pricing, 24 Nov) | account + deposit (minimum not on the pricing page) | owner to sign up | **CODE READY 24 Nov** (`src/lib/providers/dataforseo.ts`, used first by `/api/hotel-prices` when DATAFORSEO_LOGIN + DATAFORSEO_PASSWORD are Runtime secrets; SerpApi stays the fallback) | owner: account + deposit + 2 secrets → Claude checks a live answer |
| Scrapingdog | Flight prices source #2 (Google Flights: every option + price, covers RUH + Saudi airlines that Aviasales lacks) | none — paid data source, prepaid per request | 5 credits a search; PAYG $10 = 25,000 credits = 5,000 searches (~$0.002 each); free trial credits, no card (scrapingdog.com docs/pricing, 25 Nov) | account + key | owner to sign up | **CODE READY 25 Nov** (`src/lib/providers/scrapingdog.ts`, used first by `/api/flight-fallback` + budget advisor when SCRAPINGDOG_KEY is a Runtime secret; SerpApi stays the fallback; check = `flight-source-check.yml`) | owner: account + secret → Claude runs the check |
| Wego | Hotels (meta) | Admitad (company.wego.com/affiliate-program) | 3% of hotel booking incl. tax (Wego's page, 24 Nov) | no brand bidding, no pop-ups, no coupons | ✓ once our Admitad space is Active | **Hotels LINKED 24 Nov, plain link** (city code, dates, guests `2:5:9`; cities with own airport ≤40 km) | apply to Wego in Admitad → swap to the Admitad deep link; API partner = mail Wego |
| Local hotel sites (batch 2) | Hotels | per site — list + marks in doc «دراسة مواقع الفنادق المحلية» | — | — | — | Planned | Traveloka, tiket, MakeMyTrip, Rakuten, Jalan, Yanolja, Etstur, Tatil, Travelstart, Ostrovok, Despegar, Rehlat, Cleartrip: check deep link + programme while linking |
| Trip.com (OWN programme, Trip.com Affiliate Platform) | Hotels 5.5%, flights 1%, transfers/cars 5% (Admitad card rates; own platform «up to 7%») | Trip.com direct | up to 7% | open to everyone (no traffic minimum) | yes | **APPROVED 27 Nov 04:52 — Alliance ID (AID) 11517619, SID 337178549, link params `Allianceid=11517619&SID=337178549&trip_sub1=&trip_sub3=D21620272`.** Next: log in, Bank Details, get SID + link format → build chat routes Trip.com buttons. Was: Applied 26 Nov 04:16 — «Account under review», 1–14 business days** (Affiliate Partner, Individual, Content Website, Others market, USD, Saudi Arabia; name Hassan Ali Ahmed Almajed as bank; secondary mail info@sfrtna.com). Admitad = blocked by advertiser; TP = locked (3 months traffic) | approved → route Trip.com buttons via its own links; then Bank Details tab |
| Skyscanner, KAYAK, Trip.com (flights) | Flights, hotels, cars | To check | — | — | — | To check | — |
| Google Flights / Google Hotels | Flights, hotels | To check (no programme known) | — | — | — | To check | — |

## Networks — conditions to join

| Network | Conditions (source) | We meet? | Account |
|---|---|---|---|
| TradeTracker | no traffic minimum stated; active site with fresh content, clear audience, professional look; "any committed publisher" (tradetracker.com/ae/publisher-qualifications, 8 Nov) | ✓ likely | none yet — Dubai office form tradetracker.com/ae/contact-us, tel +971 4 375 6240 |
| Partnerize | needs confirmation | ✓ (Expedia active) | «sfrtna-aeek», login lost |
| Travelpayouts | open programmes now; 13 big brands after 3 months of stable traffic | partly | active |

## Network map (11 Nov, owner: «connect impact.com, CJ and any other»)

Root cause of the Qatar delay: our only Partnerize login belongs to an
account made by Expedia's hub; neither Partnerize nor Expedia will hand it
back (Expedia ticket 00045017, 11 Nov). Fix = every network account is
opened by us directly, owner's email, password manager + 2FA, and listed
under «Accounts» below (login URL, email, who manages it). Never again an
account made through someone else's hub.

| Network | Brands confirmed on it (source) | Order |
|---|---|---|
| Partnerize (own account) | Qatar (qatarairways.com affiliates), Emirates (TP blog), **Etihad** (etihad.com affiliate page: «in collaboration with the Partnerize network», managed by DigitasLBi, affiliate@etihad.ae) | 1 — most airlines |
| impact.com | Qatar (official page), Skyscanner (Skyscanner partner support: programme on impact.com) | 2 |
| Admitad | flynas (Admitad's own flynas case study), Jazeera Airways | 3 — MENA brands |
| CJ | Qatar (official page) | 4 |
| TradeTracker | Emirates AE | form sent 8 Nov |
| Arabclicks | MENA network; our brands not confirmed | after 1–4 |

Not found on any public page yet: Saudia, flyadeal, Turkish, Almosafer →
search each network's marketplace once our accounts exist. Rates are shown
only to signed-in publishers: write them here when seen.

**Site verification for networks (11 Nov):** Cloudflare (Bot Fight Mode,
AI Labyrinth) hides the site from verifier bots. When a verify fails, read
Security → Analytics → Events at the click time: path + user agent show what
the checker asked for. impact.com: tag in layout.tsx + edge-worker.js answers
`/impact<id>.html` and `/` for UA «Impact-SiteVerifier» → verified 13:08
(channel «متصل»). Do the same for CJ / Admitad (no need to turn protection off).
Admitad (11 Nov 14:20): ad space «Sfrtna», https://sfrtna.com, Content website,
categories Travel + Transportation, countries SA/AE/KW/QA/BH; meta tag
`mitgo-verification` in [locale]/layout.tsx + edge-worker.js answers `/` for UA
matching mitgo|admitad. Verify fails → read Cloudflare Events for the real UA. 15:03: account
activated, ad space «Under review» → when Active: join flynas + Jazeera. **18 Nov 15:57: ad space ACTIVE.**
**19 Nov ROOT CAUSE of «Not verified» (Security Events, 18 Nov):** Mitgo's
re-check = GET «/», NO user agent, HTTP/1.1, from ONE address
3.126.213.103 (AWS Frankfurt, AS16509), every ~2 min 15:22–16:52 KSA; all
48 sampled (≈96) got Bot Fight Mode «Managed Challenge» 403, so the Worker
never ran (and its UA match /mitgo|admitad/ would not have fired anyway).
Bot Fight Mode cannot be skipped by WAF rules on Free; it does NOT trigger
when an IP Access rule matches. IP Access rules are NOT offered in the new dashboard
until a zone has one (Cloudflare docs), so: (1) owner 19 Nov: custom rule
«Challenge empty user agent (not home)» = `(len(http.user_agent) eq 0 and
len(http.request.uri.path) gt 1)` → Managed Challenge (quotes pasted as curly
failed), THEN Bot fight mode OFF + Browser integrity check OFF (16:19)
(AI Labyrinth + AI-bot block rule stay; /api has edge-guard);
(2) edge-worker.js answers «/» with the tag (200) for an EMPTY user agent
too; (3) monitor.mjs: «mitgo-tag» (no-UA «/» → 200 + tag) and
«mitgo-blocked» (any challenged no-UA «/» request in the last hour → mail
with the address).
CJ (11 Nov 16:30): account made, agreements accepted, user + Network Profile
(budget-first text) + property «Sfrtna – Trip budget planner & travel
comparison» id 101926504 (Website; Content + Comparison) + Account info
(Riyadh, USD). LEFT: tax form W-8BEN (individual), payment method, then
ACTIVATE ACCOUNT, then apply to Qatar.
12 Nov: W-8BEN SUBMITTED (individual, no treaty claim). CJ Payments has no
Saudi bank country → Payoneer (CJ's official partner): owner opened Payoneer
12 Nov 15:40 (owner's Gmail, individual, sfrtna.com, ID selfie + address
doc) — «verifying». Payoneer shows the name read from the ID as «HASSAN AU
AHMED ALMAJED» («AU» looks like a misread of ALI) ≠ CJ «HASSAN ALI A ALMAJED».
Once approved: fix the Payoneer name with its support if wrong, then put CJ
bank country UNITED STATES + Payoneer USD receiving details, payee name =
Payoneer's account-holder name exactly (resubmit W-8BEN if it changes).
**Owner 12 Nov 15:50 (corrects 15:44): Saudi ID English name = «ALMAJED,
HASSAN ALI A» (two S).** CJ name HASSAN ALI A ALMAJED is right; only
Payoneer («HASSAN AU AHMED ALMAJED») needs support to correct it.
Payoneer customer ID 108323605. 18 Nov: new ticket #261118-013230 (name → HASSAN ALI AHMED ALMAJED + Al Ahsa national address). 12 Nov 16:00 «we need more info»: address doc
rejected — the page requires the doc to show the WRONG name «HASSAN AU AHMED
ALMAJED» + «Olaya Street, Riyadh, 11465», issued < 6 months. 16:28 owner asked
support to correct the name to HASSAN ALI A ALMAJED (ticket #261112-010093,
My Payoneer Account › Change Account Details › change name). After the fix:
upload a stc bank statement < 6 months whose address = Olaya St, 11465.
12 Nov 17:29 Payoneer answer: self-service — Settings › Profile settings ›
Name and email › Edit › Request name change › reason › Submit, then upload
the requested docs in Verification Center. Postal code typed 11456 vs 11465 on
Google profile: owner to confirm.

**Profile texts used on impact.com (reuse on other networks):** description
= Arabic-first planning + comparison site for Saudi/Gulf travellers (also
English); start from budget → suggested destinations → compare live
flight/hotel prices → book on the provider's site via our links; guides
(season, visa, currency, sights, checklist); saved trips + reminders; no
coupon/cashback/incentive traffic, no brand-keyword bidding; iOS/Android
apps in store review. Tags: budget travel, trip budget planner, flights,
hotels, price comparison, airline tickets, hotel booking, travel planning,
destination guides, visa information, Saudi Arabia, GCC travellers, Arabic,
family travel, eSIM, car rental.

## Accounts (where each login lives)

| Network | Login URL | Email used | Managed by | 2FA |
|---|---|---|---|---|
| Payoneer | payoneer.com (Sign in) | owner's Gmail | owner | — |
| CJ (CID 8124541) | members.cj.com (Login, email + password) | owner's Gmail | owner (Superuser) | — |
| Admitad (PID2605420) | store.admitad.com (publisher, «Sign up via» Google) | owner's Gmail | owner | — |
| impact.com (Account ID 8176167; applied 11 Nov, answer ~72 h) | app.impact.com/login.user (Partner, «Sign in with Google») | owner's Gmail | owner | Google 2-step | 
| Partnerize «sfrtna-aeek» | console.partnerize.com/account/signin («Forgotten Details») | unknown | Expedia hub (lost); Expedia help names a dedicated desk: expediaaffiliates.support@partnerize.com (not tried yet) | — |

## How to add a supplier

Look up its official affiliate/partner page first, then the networks
(Partnerize, impact.com, CJ, Awin, TradeTracker, Travelpayouts…). Write the
source of every rate and condition. Update this table in the same commit as
any button change.

- **Partnerize (own account, 19 Nov 2026):** signed up through Qatar Airways' join page — username `sfrtna_ksa`, e-mail almajedhsn@gmail.com, partner type Comparison/Review, vertical Travel, address = SPL national address (Al Mubarraz 36342). Separate from the Expedia Hub account «sfrtna-aeek» (that one has no Partnerize console login — Partnerize #712452). Publisher ID 1100l442602 (e-mail verified, logged in 19 Nov 03:27). Profile completed (6 Gulf countries, Comparison/Review, Travel, SAR). **Qatar Airways Affiliates Global (USD) — APPLIED 19 Nov 03:39** (contact nmankala@qatarairways.com.qa), waiting for approval mail. **REJECTED 21 Nov 03:30 (Partnerize alert, no reason).** Next: Emirates; Qatar again via impact.com / CJ.
- **Emirates (19 Nov):** not listed in our Partnerize «Join campaigns» (only Qatar shows; brands there are invite/join-link only). Public listings: Emirates runs on CJ, Partnerize, Awin and Admitad (uppromote directory); Partnerize listing 1.25 %, cookie 30 days (affi.io). Plan: join Emirates through **Admitad** (ad space Active since 18 Nov) together with flynas + Jazeera; CJ when active; Partnerize only if Emirates sends a join link.
- **Admitad programmes (19 Nov 2026, owner joining from the Black Friday deals page):**
  - **Mytrip.com WW** — **REJECTED 19 Nov 12:49 (no reason given)**; likely the ad space showing «unvalidated» and/or a new site with little traffic. Re-apply only after the Mitgo verification fix is live and the site has traffic. Was APPLIED 19 Nov 04:25 (awaiting advertiser, avg 1.1 d). CPA 12 € per paid order, max 85 €/booking; approval 97 %; cookie 30 d; hold ~37 d. Regions incl. Saudi + all Gulf. Content site allowed; SEM, brand bidding, cashback, coupon sites FORBIDDEN. **Rule for the build chat:** never show a Mytrip link next to these airline names: American Airlines, Thai Smile, Delta, Air Canada, IndiGo, Air France, KLM, United, Alaska, Hawaiian, Ryanair. Nov promo +20 % if GMV grows ≥15 %.
  - **Gotogate WW** — APPLIED 19 Nov 04:27. 12 € per paid order (flight tickets only); approval 98 %; regions ALL; cookie 30 d; same Etraveli rules as Mytrip (no brand bidding; airline-name list above).
  - **Flight Network WW** — APPLIED 19 Nov 04:28. 12 $ per confirmed sale (flights only); approval 100 %; regions incl. UAE (+ many); Etraveli group; deeplink tool.
  - **NH-Hotels Many GEOs** — APPLIED 19 Nov 04:29. 9.10 % per paid order; approval 90 %; hold ~110 d; **regions = Europe + Americas only (no Saudi/Gulf)** → low priority, don't rely on it until traffic GEO is confirmed.
  - **Kiwi.com Many GEOs** — APPLIED 19 Nov 04:30. 3 % per paid order; approval 93 %; regions ALL; EPC 19 €, CR ~2 %; avg moderation 3 d; forbidden: brand bidding, pop-under, adult. Note: virtual interlining — show as an alternative, not first choice.
  - **QEEQ WW** (car rental) — APPLIED 19 Nov 04:32. 4.22 % per paid order; **approval only 44 %**; hold ~63 d; regions incl. UAE + many; brand keywords forbidden. Also on Travelpayouts → compare before routing.
  - **19 Nov 04:52 — 19 more applied** (catalog filtered Region = Saudi Arabia + Travel & Tourism → 30 programmes; owner: join everything useful). Commission as shown in the catalog card:
    | Programme | Service | Commission |
    |---|---|---|
    | Etihad [CPS] WW | airline — **commission only for these origins (POS), others 0 %:** Saudi = RUH, JED, MED, ELQ (**not DMM**); also AUH, India + Indonesia cities, many EU/US/Asia hubs (list on the programme page, upd 3 Apr 2026). Cookie 30 d, deeplinks allowed, no brand SEM. Approval 38 %, hold ~93 d | 1.08 % |
    | Traveloka [CPS] Many Geo | flights + hotels Asia | 0.31–3.15 % |
    | Airpaz [CPS] Many Geos | flights Asia | 1.75 % |
    | Eurowings WW | airline Europe | 1.53 % — **REJECTED 21 Nov 00:52 («advertiser not interested»)** |
    | Expedia AE SA | hotels/flights Gulf (conf. 8 % shown) | 0.70–4.20 % |
    | Planetofhotels WW | hotels (conf. 23 %) | 4.93 % |
    | Omio Many Geos | trains/buses Europe | 0.64–3.24 % |
    | Italiarail [CPS] Many GEOs | trains Italy | 2.60–6.50 % — **APPROVED 21 Nov 00:51** |
    | Infobus [CPS] WW | intercity buses | 0.76–6.15 % — **REJECTED 20 Nov 18:20 (no reason)** |
    | KKday WW | activities Asia | 7.80 % |
    | Memphis Tours WW | tours Egypt | 30 $ |
    | Global YO WW | eSIM | 13 % |
    | Flyfi WW | eSIM (auto-approved, joined) | 4 % |
    | DiscoverCars WW | car rental (conf. 19 %) | 1.93–4.50 % |
    | Myrentacar WW | car rental | 6.65 % |
    | WoopDrive WW | car rental | 4.20–6 % |
    | Compensair | flight compensation | 5–12 € |
    | Lennuabi Many GEOs | flight compensation | 20 € |
    | VisatoSingapore Many GEOs | Singapore visa | 20 % — **REJECTED 20 Nov 20:45 (no reason)** |
    Skipped: City.Travel (join disabled), Palazzo Versace Dubai, Vegas, Sanatoriums, HostelPass.
  - **REJECTED 19 Nov 12:49–13:04 (no reason, within 15 min):** Mytrip, Kiwi.com, Gotogate, Omio, Flight Network. Pattern = systematic → most likely the ad space shown «unvalidated» (Mitgo re-check fails). Fix verification first (build chat, PRIORITY), then ask Admitad support for the reason and re-apply.
  - **APPROVED (Joined, link ready) 19 Nov 05:01:** Flyfi WW (eSIM 4 %), Compensair (flight compensation 5–12 €), WoopDrive WW (car rental 4.20–6 %), Lennuabi Many GEOs (flight compensation 20 €). Build chat can wire these now (Admitad deeplink per programme). All others = awaiting advertiser.
  - **APPROVED 23 Nov:** DiscoverCars WW (car rental 1.93–4.50 %) — link: https://naiawork.com/g/wqjhitsyjqef079120635ea594bb46/ — wire in car rental button (build chat).
  - 19 Nov 04:58: catalog search (no region, no status filter) → **Emirates, flynas, Jazeera: 0 results on Admitad for our account** (Etihad only). Remaining routes: Emirates via CJ / TradeTracker / Partnerize join link; flynas + Jazeera: ask Admitad support whether the programmes still exist (earlier note «join flynas, Jazeera» came from Admitad's public list) or look for the airlines' own programmes. Approvals arrive by mail → build chat wires each one (route to the best payer per service). Skipped: Skyluxtravel (US/CA only), AirHelp PT/BR (geo-limited; AirHelp already via Travelpayouts).
  - **21 Nov 04:55: orange «unvalidated» banner GONE** (owner's screenshot). Rejected cards have no Join button (no direct re-apply). Reasons: Trip.com = «advertiser not interested»; Flight Network = none given. **Mitgo support ticket #20102 (21 Nov 05:02)** asks to re-review Mytrip, Kiwi.com, Gotogate, Omio, Flight Network. Wait for the reply by mail.
  - **21 Nov 05:04 «Declined» filter = 13:** Trip.com, Flight Network, Kiwi.com, Infobus, Gotogate, Eurowings, Global YO, Mytrip, VisatoSingapore, Omio, KKday, QEEQ, Etihad. Approved = 5 (Flyfi, WoopDrive, Compensair, Lennuabi, Italiarail). Likely real cause beyond the 19 Nov validation: a new ad space with no traffic/sales history (advertisers screen new publishers). Ticket #20102 extended with the full list + ask for the concrete reason.
  - Applying works while the ad space shows «unvalidated» (Mitgo re-check drops it; build-chat fix in INBOX).
