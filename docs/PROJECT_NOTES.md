# Sfrtna — project notes for a new session

Read this first. It replaces re-explaining the project. Last updated 6 Oct 2026.

## Owner's standing rules (must follow)

- **Always reply in Arabic.** Act as developer, reviewer, CX expert and designer.
- **Every price on the site = the partner's live price, or no number at all.**
  No «يبدأ من», no estimates, no cached fares presented as prices.
- No invented data, no Wikipedia content, **no secrets/API keys in code or chat**,
  never delete a file without the owner asking.
- Secrets live in Cloudflare **Runtime** variables (not Build). Never repeat IDs,
  IBANs or keys seen in screenshots. Never use or store the CDS key.
- Hide internal sources/methodology from visitors.
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
| Google Places (`GOOGLE_PLACES_KEY`) | Hotel-name suggestions | **owner still creating the key** (project "Sfrtna", Places API (New), daily cap 300). Until then OpenStreetMap/Photon answers |

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

## Next, in order

1. Google Search Console + Google Analytics — first design a **tracking plan**
   with the owner (he is a data analyst): events (search, booking click, budget
   change…) and KPIs (search → booking-click rate).
2. Android app, then iPhone app (Stay22 has a Mobile SDK worth checking).
3. Marketing plan before launch.
4. When Agoda is approved: Arabic hotel list from Agoda's API.
5. Owner asked for: a glossary of technical terms (offered as a doc) and a full
   map of every system used (front end, data, analytics) explained for a data
   analyst.
