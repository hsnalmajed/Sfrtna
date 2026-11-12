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
| RateHawk / ZenHotels | Hotels | own (`partner_slug`) | needs confirmation | W-8BEN | needs confirmation | Linked (tax form was under review, Oct) | confirm review done |
| Agoda (direct) | Hotels | own | needs confirmation | manual site review | needs confirmation | Applied (Oct) | check reply |
| GetYourGuide (direct) | Activities | own (`partner_id=NNJW64J`) | needs confirmation | — | ✓ | Active (bank, 2FA) | — |
| Viator (direct) | Activities | own | 8% (TP figure) | ID + selfie verification | ✓ | Linked 21 Oct | — |
| Qatar Airways | Flights (own link live) | Partnerize / impact.com / CJ (qatarairways.com affiliates page) | needs confirmation | needs confirmation | needs confirmation | Asked (Partnerize, 8 Nov 09:58) | wait for support reply |
| Emirates | Flights (own link live) | Partnerize; TradeTracker (campaigns by market: AE, UK…) | 1.25–2.5%, cookie 30 d (Travelpayouts blog, not official) | needs confirmation; Saudi market coverage asked | needs confirmation | Asked Partnerize 8 Nov 10:43; TradeTracker mail BOUNCED (contact on its campaign page no longer exists) → asked via tradetracker.com/ae/contact-us form 8 Nov 10:58 | compare replies → best first, other = fallback |
| Etihad | Flights (own link, round trip) | To check | — | — | — | To check | own link passed in owner's private window 9 Nov |
| Saudia, flynas, flyadeal | Flights (Google link) | To check | — | — | — | To check | — |
| flydubai | Flights (own link live) | Tradedoubler, CJ (Travelpayouts blog, not official) | 0.80%, cookie 30 d (same blog, updated 2022–25, not official) | needs confirmation | needs confirmation | Not applied | confirm on the network, then apply |
| Gulf Air, Turkish, Kuwait, Oman Air, RJ, EgyptAir, Pegasus | Flights | To check | — | — | — | To check | own-link test done 9 Nov (Turkish, Kuwait, Oman Air, RJ, EgyptAir: keep Google; Gulf Air: own link, no public programme found 9 Nov; Pegasus: own link, no public programme found in a web search 9 Nov) |
| Almosafer | Flights, hotels | To check | — | — | — | To check | — |
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
activated, ad space «Under review» → when Active: join flynas + Jazeera.
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
**Owner 12 Nov 15:44: Saudi ID English name = «ALMAJED, HASAN ALI A» (HASAN,
ONE S).** So the legal name everywhere = HASAN ALI A ALMAJED: fix CJ Account
info + resubmit W-8BEN; ask Payoneer support to correct «HASSAN AU AHMED» →
«HASAN ALI A». Possible cause of the Google Play ID rejection too (payments
profile written «HASSAN»): check when Google answers. Postal code typed 11456 vs 11465 on
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
| CJ | members.cj.com (Login, email + password) | owner's Gmail | owner (Superuser) | — |
| Admitad (PID2605420) | store.admitad.com (publisher, «Sign up via» Google) | owner's Gmail | owner | — |
| impact.com | app.impact.com/login.user (Partner, «Sign in with Google») | owner's Gmail | owner | Google 2-step | 
| Partnerize «sfrtna-aeek» | console.partnerize.com/account/signin («Forgotten Details») | unknown | Expedia hub (lost); Expedia help names a dedicated desk: expediaaffiliates.support@partnerize.com (not tried yet) | — |

## How to add a supplier

Look up its official affiliate/partner page first, then the networks
(Partnerize, impact.com, CJ, Awin, TradeTracker, Travelpayouts…). Write the
source of every rate and condition. Update this table in the same commit as
any button change.
