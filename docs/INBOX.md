# Sfrtna — INBOX (the e-mail chat reads THIS file only)

The owner runs ONE chat for mail (partners, stores, support tickets) and
other chats for building. The mail chat reads this file, not the whole
project notes; the build chats never handle mail. Opening message:
`محادثة بريد سفرتنا: اربط hsnalmajed/Sfrtna واستنسخه، واقرأ docs/INBOX.md فقط، ثم انتظر رسالتي.`
Recommended model: **Sonnet 5.5** (reading mails, drafting replies, owner
steps). Switch to Opus only if a mail needs code changed — then write the
task under «For the build chat» below instead of coding here.

## How we work here
- **Reply format for every mail (owner 18 Nov):** 1) مهمة / غير مهمة
  (one line why); 2) if important: the steps, one at a time, with every
  link to open written out; 3) if waiting is needed: say exactly how long
  or which mail to wait for; 4) end with «انتقل للإيميل التالي» when
  nothing is left now. Goal: fast, exact mail triage.
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
| 1 | Apple — App Review + Developer Support | case 30000017675096; submission e7a94ba9… | Root fix live (0221491); build 51 attached + tested; notes saved; China removed from availability (22:15, the 2 China-only compliance forms should drop ≤24 h); **reply SENT 18 Nov 22:29**; Resubmit button greyed out | 19 Nov 22:20 reminder: App Compliance check → press Resubmit (`docs/app-store/presubmit-checklist.md`) |
| 2 | Google Play — closed test | app com.sfrtna.app, track «Alpha» | Setup done 16 Nov, 14 changes submitted for review | Google's review mail; owner adds 12+ testers (14-day clock) → production ~3 weeks |
| 3 | Google Play — account | tickets [7-5929000041524], [7-2716000041928] | Identity VERIFIED 13 Nov; ticket 7-2716000041928 CLOSED by Google 16 Nov («ID verification complete, you can publish») | Nothing — only if Google writes again |
| 4 | Partnerize ↔ Expedia | Partnerize #712452 SOLVED 18 Nov 19:07 (Eric) | **Answer:** «sfrtna-aeek» has NO Partnerize console login at all — access exists only on the Expedia Affiliate Hub (accounts.expediagroup.com partner login, link in Eric's mail; it also resets the password). Partnerize console = separate platform → Qatar/Emirates need our OWN Partnerize publisher account (owner said yes 11 Nov) | 1) DONE 18 Nov 22:35: owner is in the Expedia Creator Hub (13 clicks / 28 days, 0 bookings); 2) **19 Nov 03:23 SIGNED UP** own Partnerize account via Qatar's join page (username sfrtna_ksa, almajedhsn@gmail.com, Comparison/Review, address = SPL national address Al Mubarraz 36342) → verify e-mail → Qatar application pending → then Emirates; was: sign up our own Partnerize publisher account (say on sign-up that sfrtna.com also has an Expedia Hub account) → apply Qatar + Emirates |
| 5 | Qatar Airways programme | Partnerize / impact.com / CJ | Waits on 4 or impact.com / CJ approval | Apply once one network is active |
| 6 | Emirates programme | Partnerize + TradeTracker (Dubai form 8 Nov 10:58) | No reply yet | Compare replies → route button to the better one |
| 7 | impact.com | owner's Gmail account, sfrtna.com verified | «قيد المراجعة» since 11 Nov | Approved → apply Qatar, Skyscanner, Saudia/flyadeal/Turkish/Almosafer |
| 8 | Admitad (PID2605420) | ad space «Sfrtna» | 19 Nov night: **25 programmes applied** (list + rates in PARTNERS.md «Admitad programmes»); **approved now: Flyfi, Compensair, WoopDrive, Lennuabi**; Emirates/flynas/Jazeera NOT in our catalog. Ad space flips to «unvalidated» (build-chat fix) but applying still works | Approval mails → record each in PARTNERS.md → build chat wires them |
| 9 | CJ + Payoneer | Payoneer #261118-013230 | 18 Nov 19:12 Payoneer: cannot change name/address; upload page demands wrong name «HASSAN AU AHMED» + Olaya → dead end. **19 Nov 05:03 owner asked them to CLOSE the unapproved application** and confirm when he may re-register with ID name + national address (Al Mubarraz 36342). Do NOT open a 2nd account before they confirm | Wait for Payoneer (1–2 work days; reminder Fri 20 Nov 18:00) → re-register → upload Al Rajhi statement → CJ payment → activate → Emirates (CJ) |
| 10 | Travelpayouts | ticket #254780 | Closed. 16 Nov 15:52 Ingmar: Riyadh restrictions still in place, no timeline; they will mail when RUH returns | Their mail only (no reply needed) |
| 11 | RateHawk | partner account «Linked» | Tax form review (Oct) | Confirm; hotel-price API study waits (owner 17 Nov) until notes list is done |
| 12 | Agoda (direct) | application Oct | No reply | Check inbox / reapply |
| 13 | Google Search Console | mail 9 Nov «pages not indexed» | Not studied | Owner pastes the mail lines → find the reason (build chat if code) |
| 14 | SerpApi | free plan 250/month | 101 left, renews 6 Dec (owner: no paid plan) | After 6 Dec: hotel live prices reopen |
| 15 | Our own trip mails | Resend, sfrtna.com | Built; real test not done | Owner: sign in → tick a flight → «احجز» → mail within ~1 h 17 m; check on the phone |

Closed: Stay22 (4 Nov, payout threshold $500 never met).

## For the build chat (paste there)
- **Admitad programmes approved 19 Nov (wire them, route each service to the best payer, keep every company visible):** Flyfi (eSIM), WoopDrive (car rental), Compensair + Lennuabi (flight-delay compensation, next to AirHelp). Rates + rules in PARTNERS.md «Admitad programmes». More approvals will follow by mail.
- **ROOT FIX for Apple — BUILT 18 Nov in the mail chat (owner asked), commit
  0221491:** «iOS clean mode» (`src/lib/iosClean.ts`) + native WebKit rules +
  release gate `scripts/ios-clean-check.mjs`. Owner steps + reply + checklist:
  `docs/app-store/presubmit-checklist.md`, `docs/app-store/reply-2026-11-18.md`.
  Build chat: nothing to do unless the gate turns red. Small later idea: Aviasales opens in USD — try its currency parameter (SAR) in `/api/go/tp?b=aviasales`.
- **Admitad/Mitgo verification keeps dropping (18 Nov):** ad space «Sfrtna»
  went Active 15:57 → «Not verified» 16:09. `edge-worker.js` answers «/» with
  the `mitgo-verification` tag only when the UA matches /mitgo|admitad/;
  every other visitor to «/» is redirected to /ar. Read Cloudflare logs /
  Security Events for requests to «/» around 15:40–16:10 KSA 18 Nov to find
  the checker's real UA (and any WAF/bot block), then make «/» always carry
  the tag for it (e.g. widen the match, or put the tag in the «/» redirect
  response body). Then owner presses Verify again.
