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
| Etihad | Flights (Google link) | To check | — | — | — | To check | own link: cold visit hits bot check |
| Saudia, flynas, flyadeal | Flights (Google link) | To check | — | — | — | To check | — |
| flydubai | Flights (own link live) | Tradedoubler, CJ (Travelpayouts blog, not official) | 0.80%, cookie 30 d (same blog, updated 2022–25, not official) | needs confirmation | needs confirmation | Not applied | confirm on the network, then apply |
| Gulf Air, Turkish, Kuwait, Oman Air, RJ, EgyptAir, Pegasus | Flights | To check | — | — | — | To check | own-link test pending (Turkish done: keep Google) |
| Almosafer | Flights, hotels | To check | — | — | — | To check | — |
| Skyscanner, KAYAK, Trip.com (flights) | Flights, hotels, cars | To check | — | — | — | To check | — |
| Google Flights / Google Hotels | Flights, hotels | To check (no programme known) | — | — | — | To check | — |

## Networks — conditions to join

| Network | Conditions (source) | We meet? | Account |
|---|---|---|---|
| TradeTracker | no traffic minimum stated; active site with fresh content, clear audience, professional look; "any committed publisher" (tradetracker.com/ae/publisher-qualifications, 8 Nov) | ✓ likely | none yet — Dubai office form tradetracker.com/ae/contact-us, tel +971 4 375 6240 |
| Partnerize | needs confirmation | ✓ (Expedia active) | «sfrtna-aeek», login lost |
| Travelpayouts | open programmes now; 13 big brands after 3 months of stable traffic | partly | active |

## How to add a supplier

Look up its official affiliate/partner page first, then the networks
(Partnerize, impact.com, CJ, Awin, TradeTracker, Travelpayouts…). Write the
source of every rate and condition. Update this table in the same commit as
any button change.
