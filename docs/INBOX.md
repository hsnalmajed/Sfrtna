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
| 1 | Apple — App Review + Developer Support | case 30000017675096; submission e7a94ba9… | **2nd 5.1.2(i) note 19 Nov 23:55** («still contacts third-party tracking domains»). Cause found 20 Nov by `ios-prod-audit.yml` on sfrtna.com (staging hid it): Cloudflare Web Analytics beacon on every page (owner DISABLED it 16:09) + Google sign-in script racing the app flag on account/my-map (fixed 508010a). Live audit now: images only. release.yml runs the iOS check on sfrtna.com — GREEN 21 Nov (run 44846121241; blank Cloudflare bot-check frame = ours, allowed). China forms still listed; Resubmit greyed | Owner pastes `docs/app-store/reply-2026-11-20.md` in the thread; then try Resubmit / ios-review.yml submit=yes |
| 2 | Google Play — closed test | app com.sfrtna.app, track «Alpha» | Setup done 16 Nov, 14 changes submitted for review | Google's review mail; owner adds 12+ testers (14-day clock) → production ~3 weeks |
| 3 | Google Play — account | tickets [7-5929000041524], [7-2716000041928] | Identity VERIFIED 13 Nov; ticket 7-2716000041928 CLOSED by Google 16 Nov («ID verification complete, you can publish») | Nothing — only if Google writes again |
| 4 | Partnerize ↔ Expedia | Partnerize #712452 SOLVED 18 Nov 19:07 (Eric) | **Answer:** «sfrtna-aeek» has NO Partnerize console login at all — access exists only on the Expedia Affiliate Hub (accounts.expediagroup.com partner login, link in Eric's mail; it also resets the password). Partnerize console = separate platform → Qatar/Emirates need our OWN Partnerize publisher account (owner said yes 11 Nov) | 1) DONE 18 Nov 22:35: owner is in the Expedia Creator Hub (13 clicks / 28 days, 0 bookings); 2) **19 Nov 03:23 SIGNED UP** own Partnerize account via Qatar's join page (username sfrtna_ksa, almajedhsn@gmail.com, Comparison/Review, address = SPL national address Al Mubarraz 36342) → verify e-mail → Qatar application pending → then Emirates; was: sign up our own Partnerize publisher account (say on sign-up that sfrtna.com also has an Expedia Hub account) → apply Qatar + Emirates |
| 5 | Qatar Airways programme | Partnerize / impact.com / CJ | Waits on 4 or impact.com / CJ approval | Apply once one network is active |
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
