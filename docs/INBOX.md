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
| 1 | Apple — App Review + Developer Support | case 30000017675096; build 27 thread | Submit blocked by 2 hidden compliance forms (SECURITYASF395E, AIGENERATEFD1DE); owner replied in the thread 17 Nov 14:45 | Apple's answer → fill the forms → `ios-review.yml` submit=yes (build chat) |
| 2 | Google Play — closed test | app com.sfrtna.app, track «Alpha» | Setup done 16 Nov, 14 changes submitted for review | Google's review mail; owner adds 12+ testers (14-day clock) → production ~3 weeks |
| 3 | Google Play — account | ticket [7-5929000041524] | Identity VERIFIED 13 Nov; old «profile removed» banner | Only if Google writes again |
| 4 | Partnerize ↔ Expedia (login lost) | Partnerize #710723, Expedia Affiliate Hub 00045017 | Loop: each says the other handles login (12 Nov) | Decide: own new Partnerize account (owner said yes) vs keep waiting |
| 5 | Qatar Airways programme | Partnerize / impact.com / CJ | Waits on 4 or impact.com / CJ approval | Apply once one network is active |
| 6 | Emirates programme | Partnerize + TradeTracker (Dubai form 8 Nov 10:58) | No reply yet | Compare replies → route button to the better one |
| 7 | impact.com | owner's Gmail account, sfrtna.com verified | «قيد المراجعة» since 11 Nov | Approved → apply Qatar, Skyscanner, Saudia/flyadeal/Turkish/Almosafer |
| 8 | Admitad | PID2605420 | Ad space «Verifying» (14 Nov); Mitgo mail 14 Nov 14:30 «not verified yet, complete verification» (seen 18 Nov); meta tag `mitgo-verification` still in layout.tsx | 18 Nov 15:21: owner ticked + Finish (meta tag matches abfa1f5d…) → wait ~15 min, check status → Active → join flynas, Jazeera |
| 9 | CJ + Payoneer | Payoneer ticket #261112-010093 | W-8BEN done; Payoneer name read wrong («HASSAN AU AHMED») | Payoneer fixes name → CJ payment details (US + Payoneer) → activate → Qatar |
| 10 | Travelpayouts | ticket #254780 | Closed: Aviasales shows no Riyadh flights; TP will mail when RUH returns | Their mail only |
| 11 | RateHawk | partner account «Linked» | Tax form review (Oct) | Confirm; hotel-price API study waits (owner 17 Nov) until notes list is done |
| 12 | Agoda (direct) | application Oct | No reply | Check inbox / reapply |
| 13 | Google Search Console | mail 9 Nov «pages not indexed» | Not studied | Owner pastes the mail lines → find the reason (build chat if code) |
| 14 | SerpApi | free plan 250/month | 101 left, renews 6 Dec (owner: no paid plan) | After 6 Dec: hotel live prices reopen |
| 15 | Our own trip mails | Resend, sfrtna.com | Built; real test not done | Owner: sign in → tick a flight → «احجز» → mail within ~1 h 17 m; check on the phone |

Closed: Stay22 (4 Nov, payout threshold $500 never met).

## For the build chat (paste there)
- (empty)
