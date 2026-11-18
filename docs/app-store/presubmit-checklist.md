# iPhone app — pre-submit checklist (owner, 18 Nov 2026: «حل جذري»)

Rule: **no resubmission until every line is ✅.** One complete reply, one
resubmission — never piecemeal. Every guideline Apple has raised so far is
here; add any new one the day it arrives.

| # | Guideline (when) | What Apple wants | Our answer | How it is checked | Status |
|---|---|---|---|---|---|
| 1 | 4.3(a)(b) Spam + 4.2.6 template (13 Nov) | Not a copy of other apps / a web wrapper | iPhone-only features: keep a plan offline, prayer + trip alerts in the city's time, add the plan to the iPhone calendar, PDF to the share sheet, Sign in with Apple | Owner tested on TestFlight 17 Nov (calendar, Apple sign-in) | ✅ built; listed in review notes |
| 2 | 4.8 Login services | Sign in with Apple when another sign-in is offered | Black Apple button first on the sign-in screen | TestFlight 17 Nov | ✅ |
| 3 | 5.1.1(v) Account deletion | Delete the account inside the app; revoke the Apple token | Account page «Delete my account»; Apple token revoked (key H67V5U9Z2X) | `/api/health?apple=1` = 400 invalid_grant (Apple accepts our secret) | ✅ |
| 4 | 5.1.2(i) Tracking (18 Nov) | No cookies/tracking without ATT, or remove them | «iOS clean mode» (`src/lib/iosClean.ts`): no GA4, no cookie banner, no third-party script or frame; flights + Stay22 list open in the Safari sheet; native WebKit rules block third-party scripts/frames and cookies | `scripts/ios-clean-check.mjs` in release.yml (gate) — must be green on the release that is live | ✅ release d04bec8 green 18 Nov (guard 8/8, control sees banner + widget in a browser) |
| 5 | 5.1.2 App Privacy label | Label matches the app | «Data Not Used to Track You»; collected types match (email for the account, saved plans, search history — not linked to third parties) | Owner checks App Store Connect › App Privacy (screenshot to Claude) | ⬜ |
| 6 | 2.1 Information needed (18 Nov) | Which companies provide the services; owner's relationship | `reply-2026-11-18.md` | Partner list matches what the app links to | ✅ text ready |
| 7 | 2.1.0 App Completeness | Review must be able to use every feature | Review notes: steps for each iPhone-only feature, no login needed | Review notes in listing.json | ✅ (re-paste after edit) |
| 8 | Hidden compliance forms (17 Nov) | `SECURITYASF395E`, `AIGENERATEFD1DE` blocked submission | 18 Nov 21:54 seen: both forms are for **China mainland only** (Security Assessment, AI Generated Content — «Missing Info»). **China mainland REMOVED 18 Nov 22:15** (174 countries; Apple: takes effect within 24 h). 22:16: the China ICP box already gone, the 2 forms still listed → re-check ~19 Nov 22:15 | `ios-review.yml` shows no PENDING_COLLECT after the change | ⬜ |
| 9 | New build | The fixed shell (native rules) is in the build Apple reviews | **Build 51** (ios.yml run 51, uploaded 18 Nov) — attach to 1.0 | TestFlight: owner opens it once: no cookie prompt, flights open in a Safari sheet | ⬜ owner |

## Order of owner steps (one at a time, in the mail chat)
1. ~~Release green~~ ✅ (d04bec8, production live).
2. App Store Connect › **App Compliance** → fill both forms (screenshot first).
3. **App Privacy** → screenshot → Claude says what to change.
4. TestFlight: install the new build → open a flight search → screenshot.
5. Version 1.0 → attach the new build → Review Notes = `listing.json` reviewNotes.
6. App Review thread → paste `reply-2026-11-18.md` (BUILD filled in) → **Resubmit to App Review**.
