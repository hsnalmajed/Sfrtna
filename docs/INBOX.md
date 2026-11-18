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
| 3 | Google Play — account | tickets [7-5929000041524], [7-2716000041928] | Identity VERIFIED 13 Nov; ticket 7-2716000041928 CLOSED by Google 16 Nov («ID verification complete, you can publish») | Nothing — only if Google writes again |
| 4 | Partnerize ↔ Expedia (login lost) | Partnerize #710723, Expedia 00045017 (auto-CLOSED 16 Nov, no fix) | Loop: each says the other handles login | 18 Nov 16:28 owner MAILED Partnerize Expedia desk → ticket **#712452** opened 16:29 (auto-ack) → wait for reply; no fix in ~5 work days → own new Partnerize account (owner said yes) |
| 5 | Qatar Airways programme | Partnerize / impact.com / CJ | Waits on 4 or impact.com / CJ approval | Apply once one network is active |
| 6 | Emirates programme | Partnerize + TradeTracker (Dubai form 8 Nov 10:58) | No reply yet | Compare replies → route button to the better one |
| 7 | impact.com | owner's Gmail account, sfrtna.com verified | «قيد المراجعة» since 11 Nov | Approved → apply Qatar, Skyscanner, Saudia/flyadeal/Turkish/Almosafer |
| 8 | Admitad | PID2605420 | Ad space ACTIVE 18 Nov 15:57, then **Not verified** again at 16:09 (Mitgo re-checks; its checker likely fails on «/» → redirect to /ar) | 16:40 status «Verifying» after re-verify (mail «successfully verified» 15:55 was for the first pass); build chat fix below; Admitad store login (admitad.com) also failed to open for the owner |
| 9 | CJ + Payoneer | Payoneer NEW ticket **#261118-013230** (18 Nov 18:06, Support Center form; auto-ack «reply within 2 business days»; 18:14 owner replied with screenshot «no Settings in menu»; reminder set Fri 20 Nov 18:00); old #261112-010093 closed | Address doc «Reopened»: page demands wrong name «HASSAN AU AHMED ALMAJED» + Olaya St 11465; Settings missing (not approved). Asked: name HASSAN ALI AHMED ALMAJED + national address (Al Ahsa) | Wait for Payoneer's mail (1–2 work days) → upload Al Rajhi statement → CJ payee name = Payoneer name (resubmit W-8BEN if needed) → CJ payment → activate → Qatar |
| 10 | Travelpayouts | ticket #254780 | Closed. 16 Nov 15:52 Ingmar: Riyadh restrictions still in place, no timeline; they will mail when RUH returns | Their mail only (no reply needed) |
| 11 | RateHawk | partner account «Linked» | Tax form review (Oct) | Confirm; hotel-price API study waits (owner 17 Nov) until notes list is done |
| 12 | Agoda (direct) | application Oct | No reply | Check inbox / reapply |
| 13 | Google Search Console | mail 9 Nov «pages not indexed» | Not studied | Owner pastes the mail lines → find the reason (build chat if code) |
| 14 | SerpApi | free plan 250/month | 101 left, renews 6 Dec (owner: no paid plan) | After 6 Dec: hotel live prices reopen |
| 15 | Our own trip mails | Resend, sfrtna.com | Built; real test not done | Owner: sign in → tick a flight → «احجز» → mail within ~1 h 17 m; check on the phone |

Closed: Stay22 (4 Nov, payout threshold $500 never met).

## For the build chat (paste there)
- **Admitad/Mitgo verification keeps dropping (18 Nov):** ad space «Sfrtna»
  went Active 15:57 → «Not verified» 16:09. `edge-worker.js` answers «/» with
  the `mitgo-verification` tag only when the UA matches /mitgo|admitad/;
  every other visitor to «/» is redirected to /ar. Read Cloudflare logs /
  Security Events for requests to «/» around 15:40–16:10 KSA 18 Nov to find
  the checker's real UA (and any WAF/bot block), then make «/» always carry
  the tag for it (e.g. widen the match, or put the tag in the «/» redirect
  response body). Then owner presses Verify again.
