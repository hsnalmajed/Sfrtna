# Sfrtna — INBOX (the e-mail chat reads THIS file only)

The owner runs ONE chat for mail (partners, stores, support tickets) and
other chats for building. The mail chat reads this file, not the whole
project notes; the build chats never handle mail. Opening message:
`محادثة بريد سفرتنا: اربط hsnalmajed/Sfrtna واستنسخه، واقرأ docs/INBOX.md فقط، ثم انتظر رسالتي.`
Recommended model: **Sonnet 5.5** (reading mails, drafting replies, owner
steps). Switch to Opus only if a mail needs code changed — then write the
task under «For the build chat» below instead of coding here.

## How we work here
- **Owner 28 Nov: this chat is for MAIL ONLY.** A mail that needs build work
  (code, site, app, API) → write the task under «For the build chat» here
  (or in START_HERE hand-off), push, and tell the owner in one line:
  «هذا يحتاج محادثة بناء جديدة» + the build opening message + model Opus.
  Owner-side account steps (forms, dashboards, bank) stay in this chat.
- **Reply format for every mail (owner 18 Nov):** 1) مهمة / غير مهمة
  (one line why); 2) if important: the steps, one at a time, with every
  link to open written out; 3) if waiting is needed: say exactly how long
  or which mail to wait for; 4) end with «انتقل للإيميل التالي» when
  nothing is left now. Goal: fast, exact mail triage.
  **Owner 26 Nov: never postpone.** An important mail gets its solution
  steps NOW, starting with the first step in the same reply — no «later»,
  no «when convenient».
- Owner pastes only the relevant lines of a mail (sender, date, the ask) or
  ONE screenshot. Claude: what it means, what to do, a ready reply if one is
  needed (English or Arabic as the thread), and updates the table below.
- Owner steps: one per message, English button names bold on their own line,
  wait for «تم». Never send secrets in chat; never invent figures.
- Every change → this table (status + date + next step), then commit and push
  (`docs/INBOX.md`; partners also in `docs/PARTNERS.md`).
- A mail that needs code (a new partner link, a store fix…) → add a line to
  «For the build chat» with what and why; the owner pastes it there.

## Open threads (18 Nov 2026)

| # | With | Ref | Status | Waiting for / next step |
|---|------|-----|--------|-------------------------|
| 1 | Apple — App Review | submission e7a94ba9… | **27 Nov 10:38: 5.1.2(i) PASSED; rejected 5.1.1(ix) — air travel = regulated field → organization account required** (Apple: documentation cannot fix it). Plan: one-person LLC «شركة ذات مسؤولية محدودة من شخص واحد» (business.sa; NOT a مؤسسة — Apple treats sole proprietorships as individuals; one person may own only one such LLC) → D-U-N-S (Apple lookup tool, free, ≤5 business days + 2 days) → Developer Support «Membership and Account → Account Information Update» converts the individual account (app kept) → resubmit build 62. **27 Nov 16:22: reply sent (guide/price comparison, not a travel provider) + build 63 (partner prices only after ATT Allow) → WAITING FOR REVIEW.** If refused again → company path above. | Wait for Apple; if refused: company name, then business.sa |
| 2 | Google Play — closed test | app com.sfrtna.app, track «Alpha» | Setup done 16 Nov, 14 changes submitted for review | Google's review mail; owner adds 12+ testers (14-day clock) → production ~3 weeks |
| 3 | Google Play — account | tickets [7-5929000041524], [7-2716000041928] | Identity VERIFIED 13 Nov; ticket 7-2716000041928 CLOSED by Google 16 Nov («ID verification complete, you can publish») | Nothing — only if Google writes again |
| 4 | Partnerize ↔ Expedia | Partnerize #712452 SOLVED 18 Nov 19:07 (Eric) | **Answer:** «sfrtna-aeek» has NO Partnerize console login at all — access exists only on the Expedia Affiliate Hub (accounts.expediagroup.com partner login, link in Eric's mail; it also resets the password). Partnerize console = separate platform → Qatar/Emirates need our OWN Partnerize publisher account (owner said yes 11 Nov) | 1) DONE 18 Nov 22:35: owner is in the Expedia Creator Hub (13 clicks / 28 days, 0 bookings); 2) **19 Nov 03:23 SIGNED UP** own Partnerize account via Qatar's join page (username sfrtna_ksa, almajedhsn@gmail.com, Comparison/Review, address = SPL national address Al Mubarraz 36342) → verify e-mail → Qatar application pending → then Emirates; was: sign up our own Partnerize publisher account (say on sign-up that sfrtna.com also has an Expedia Hub account) → apply Qatar + Emirates |
| 5 | Qatar Airways programme | Partnerize / impact.com / CJ | **Partnerize REJECTED 21 Nov 03:30** (no reason) | Qatar button stays a direct link (no commission); re-apply via impact.com / CJ once active |
| 6 | Emirates programme | Partnerize + TradeTracker (Dubai form 8 Nov 10:58) | No reply yet | Compare replies → route button to the better one |
| 7 | impact.com | owner's Gmail account, sfrtna.com verified | «قيد المراجعة» since 11 Nov | Approved → apply Qatar, Skyscanner, Saudia/flyadeal/Turkish/Almosafer |
| 8 | Admitad (PID2605420) | ad space «Sfrtna» | Build chat fixed the checker 19 Nov (Bot Fight Mode off + no-UA rule, 43d571d) → **«Ad space successfully verified» 19 Nov 16:23**. Approved: Flyfi, Compensair, WoopDrive, Lennuabi. Rejected (before the fix): Mytrip, Kiwi, Gotogate, Omio, Flight Network. Others pending | 20 Nov: if still verified (no orange banner) → re-apply to the 5 rejected (or ask support to re-review) |
| 9 | CJ + Payoneer | Payoneer #261118-013230 (agent Luis) | 18 Nov 19:48 Luis offered MANUAL review: send ID + recent proof of residence → verification team updates name HASSAN ALI AHMED ALMAJED + address. **19 Nov 05:05 owner replied to Luis with ID (both sides) + Al Rajhi statement + SPL National Address PDF, and withdrew the 05:03 close request.** Ticket auto-closes after 5 days without reply | Wait for Payoneer (reminder Fri 20 Nov 18:00) → approved → CJ payment details → activate → Emirates (CJ) |
| 10 | Travelpayouts | ticket #254780 | Closed. 16 Nov 15:52 Ingmar: Riyadh restrictions still in place, no timeline; they will mail when RUH returns | Their mail only (no reply needed) |
| 11 | RateHawk | partner account «Linked» | Tax form review (Oct) | Confirm; hotel-price API study waits (owner 17 Nov) until notes list is done |
| 12 | Agoda (direct) | application Oct | No reply | Check inbox / reapply |
| 13 | Google Search Console | mail 9 Nov «pages not indexed» | Not studied | Owner pastes the mail lines → find the reason (build chat if code) |
| 14 | SerpApi | free plan 250/month | 101 left, renews 6 Dec (owner: no paid plan) | After 6 Dec: hotel live prices reopen |
| 15 | Our own trip mails | Resend, sfrtna.com | Built; real test not done | Owner: sign in → tick a flight → «احجز» → mail within ~1 h 17 m; check on the phone |

Closed: Stay22 (4 Nov, payout threshold $500 never met).

## For the build chat (paste there)
- **Before April 2027 (Apple ITMS-90725, mail 18 Nov 19:10 on build 51):** build the iOS app with the iOS 27 SDK / Xcode 27 (`ios.yml` runner image + xcode-select). Warning only; build 51 is valid.
- **Admitad programmes approved 19 Nov (wire them, route each service to the best payer, keep every company visible):** Flyfi (eSIM), WoopDrive (car rental), Compensair + Lennuabi (flight-delay compensation, next to AirHelp). Rates + rules in PARTNERS.md «Admitad programmes». More approvals will follow by mail.
- **ROOT FIX for Apple — BUILT 18 Nov in the mail chat (owner asked), commit
  0221491:** «iOS clean mode» (`src/lib/iosClean.ts`) + native WebKit rules +
  release gate `scripts/ios-clean-check.mjs`. Owner steps + reply + checklist:
  `docs/app-store/presubmit-checklist.md`, `docs/app-store/reply-2026-11-18.md`.
  Build chat: nothing to do unless the gate turns red. Small later idea: Aviasales opens in USD — try its currency parameter (SAR) in `/api/go/tp?b=aviasales`.
- **DONE 19 Nov (build chat): root cause = Bot Fight Mode challenged Mitgo's no-UA checker (3.126.213.103); fix in PARTNERS «Site verification» → owner adds the custom rule + turns Bot fight mode off, then Verify.** Old note: Admitad/Mitgo verification keeps dropping (18 Nov); 19 Nov 5 programmes rejected within 15 min, likely because of it:** ad space «Sfrtna»
  went Active 15:57 → «Not verified» 16:09. `edge-worker.js` answers «/» with
  the `mitgo-verification` tag only when the UA matches /mitgo|admitad/;
  every other visitor to «/» is redirected to /ar. Read Cloudflare logs /
  Security Events for requests to «/» around 15:40–16:10 KSA 18 Nov to find
  the checker's real UA (and any WAF/bot block), then make «/» always carry
  the tag for it (e.g. widen the match, or put the tag in the «/» redirect
  response body). Then owner presses Verify again.
- **26 Nov (mail chat): Mitgo ticket «Declined requests… re-review» answered 25 Nov 15:09: they give NO reasons, only their help article. 13 declined (Trip.com, Flight Network, Kiwi.com, Infobus, Gotogate, Eurowings, Global YO, Mytrip, VisatoSinga…). No reply needed. Next: re-apply each one from the Admitad programmes page where a join button shows again; keep ad space verified.**
- **26 Nov 04:0x (mail chat) — partner access check (owner's screens):** Admitad Trip.com WW = «Blocked by advertiser», reason «not interested in cooperation» (final there). Travelpayouts: 25 joined (incl. **Kiwi.com 3%**, Klook, Tiqets, Aviasales 40%, GetRentacar, Localrent…); 20 LOCKED for traffic — Booking, **Trip.com 1–5.5%**, Viator, Agoda, Expedia, GetYourGuide, Tripadvisor, DiscoverCars, Traveloka, Omio, 12Go, Hotels.com, Vrbo, Vio, Rakuten… TP rule: «stable monthly traffic for at least three consecutive months» → «Submit for review» NOT pressed (would be refused now). Next: Trip.com's OWN programme (open to everyone, trip.com/partners). **For the build chat:** TP shows 6,572 clicks / 0 bookings in Nov (Klook 3,219, Tiqets 3,104, spike ~14 Nov) — check whether our own checks/bots click partner links (would hurt our standing); TP project «Sfrtna» shows a red «!» warning — owner to open it.
- **26 Nov 04:16: Trip.com OWN affiliate programme — APPLIED, «Account under review» (1–14 business days).** Wait for Trip.com mail; then Bank Details + links. Row in PARTNERS.
- **28 Nov 04:40 owner rule: each company's OWN programme first, networks second** (lesson: Trip.com direct approved in 1 day while TP/Admitad blocked it). Order: 1) Agoda direct (partners.agoda.com, applied Oct — check status), 2) Skyscanner (impact.com, manual review; also asks about flight API), 3) Klook direct (affiliate.klook.com, now via TP), 4) Booking.com = no own programme since 2025, only CJ/Awin by region, 5) flynas/Saudia/flyadeal, KAYAK, DiscoverCars, Omio, 12Go, Hostelworld. Prices/results inside our site need each company's API — granted case by case, ask in each application.
- **28 Nov 05:56: Admitad — Planetofhotels WW REJECTED (no reason).** Low value: it is itself a middleman redirecting to Booking/Expedia/Agoda/Trip.com and pays nothing on Expedia, Trip.com, Agoda, Hotels.com (we have those direct). No action.
- **28 Nov 04:45: Agoda direct = ACTIVE (CID 1976542). Owner added Cloudflare Runtime secret `AGODA_API_KEY`.** Agoda city-search button now via /api/go/agoda (cid). **For the build chat (Opus):** Agoda Affiliate Lite API v2 (doc in Partners › Tools › API; needs hotel/city ids from Tools › Hotel Data File) → Agoda hotels with live prices inside our hotel results; named-hotel Agoda button still via Stay22 Allez → switch to Agoda hotel URL + cid once ids are mapped.
- **27 Nov 04:52: Trip.com affiliate APPROVED — AID 11517619.** Owner: log in to the Affiliate Platform → Bank Details → copy SID/link format. **For the build chat:** route every Trip.com button (hotels, flights, transfers) through the affiliate link. **Format confirmed 27 Nov 16:32:** append `Allianceid=11517619&SID=337178549&trip_sub1=<our tag>&trip_sub3=D21620272` to any trip.com URL (e.g. `https://www.trip.com/?Allianceid=11517619&SID=337178549&trip_sub1=&trip_sub3=D21620272`). trip_sub1 = optional tracking tag (use page/feature name). Language selector on the platform: English (try `locale=ar-XX`/Arabic site param in build chat).
