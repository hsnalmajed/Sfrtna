# Sfrtna — START HERE (short, loaded every turn)

Keep this file SHORT (target < 150 lines, < 12 KB). It is imported by
CLAUDE.md, so every line here is paid for on every single message.
Full history = `docs/PROJECT_NOTES.md` (≈125 KB, NOT auto-loaded): open only
the section a task needs, with Grep on a heading or keyword, never whole.

## Token plan (owner, 3 Nov 2026 — "token use delayed the project a month")

Root cause found 3 Nov: CLAUDE.md imported the whole PROJECT_NOTES.md
(≈50k tokens) into EVERY message of EVERY conversation, before any work.
Rules from now on:
1. **This file is the only auto-loaded note.** New facts go to
   PROJECT_NOTES.md (archive, by section); only the current state and the
   next step go here. Replace old hand-offs here, never stack them.
2. **One conversation = one section.** When a section closes (or the chat
   gets long: ~40 tool calls / many big outputs), Claude updates the
   hand-off below, pushes, and tells the owner to open a new chat.
3. **Opening message for a new chat (owner copies it):**
   `أكمل مشروع سفرتنا: اربط hsnalmajed/Sfrtna واستنسخه، واقرأ docs/START_HERE.md فقط، وابدأ من "الخطوة التالية".`
   (No need to ask Claude to read PROJECT_NOTES.md in full.)
4. **Claude's working habits:** Grep/Read with offset instead of whole
   files; pipe command output through `tail`/`grep`/`head`; read GitHub
   workflow results as annotations or report branches, not full logs; wait
   for workflows with one sleeping loop, not repeated polls; no browser
   screenshots unless needed (ask the owner for a phone screenshot); batch
   fixes, one test round, one report.
5. **Owner's habits that save tokens:** one clear request per message;
   paste only the relevant lines of an email/error (not the whole mail);
   one screenshot of the exact screen, not several; say «تم» for owner
   steps (no need to re-explain).
6. **Model choice (owner picks in the model menu before sending):** Claude
   ends every hand-off with the recommended model for the next chat:
   - **Sonnet 5.5** — owner step-by-step guidance (store consoles, partner
     dashboards, settings), small text/style fixes, answering questions,
     running/reading the routine checks.
   - **Opus 5.5** — root-cause debugging, multi-file features, data
     pipelines, anything where a wrong fix breaks other pages.
   - Haiku 5.5 — not for this project's code (too risky); fine for a
     one-line question.

## Owner's standing rules (must follow)

- Always reply in **Arabic**. Act as developer, reviewer, CX expert, designer.
- Owner steps: ONE step per message; every English word to click/type on its
  own line, **bold**; never chain screens with arrows; never mix English
  button names inside an Arabic sentence. Wait for «تم».
- Every price = the partner's live price, or no number. No «يبدأ من», no
  estimates, no cached fares presented as prices.
- Never fewer options or a wrong price than the market; compare counts and
  prices with the source before release (write both in docs/TEST_PLAN.md).
- No invented data, no Wikipedia text, no secrets/keys in code or chat; never
  delete a file unless the owner asks. Secrets = Cloudflare Runtime vars /
  GitHub secrets. Never name data sources/tools to visitors.
- No ads, ever (site and apps). Income = partner commission only.
- Protect data from scraping in every feature: any new /api route must be
  added to `ROUTES` in `edge-guard.js` (else 404; `check-guard.mjs` fails the
  build on mismatch).
- Before "done": `npx next typegen` (once per clone) → `npx tsc --noEmit` →
  `npx eslint <files> --max-warnings=0` → check live (Site check / ux-audit).
- Commits: author `Claude <noreply@anthropic.com>`, trailers
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` + the session
  line given by the session. Push to `main` deploys in ~5 min. Push rejected
  → tell the owner and stop.
- One section at a time to 100%; collect all issues, fix together, re-test,
  then report. Ask the owner only business decisions.

## Stack essentials

Next.js 16 (read `node_modules/next/dist/docs/` before new APIs) on
Cloudflare Workers via opennext, **Workers Paid** since 27 Oct. Edge cache
`src/lib/edgeCache.ts`. Big data files are served through ASSETS
(`public/data/*`), **never imported into Worker code** (JSON > ~1 MB → 1102
outage; `check-bundle-json.mjs`). Container can't reach sfrtna.com: checks run
on GitHub against `sfrtna.almajedhsn.workers.dev` with `SMOKE_TOKEN`.
`gh` works through the REST API only (`gh api …`; GraphQL is blocked), e.g.
dispatch: `gh api -X POST repos/hsnalmajed/sfrtna/actions/workflows/<f>.yml/dispatches -f ref=main`.
Checks: `smoke.yml` (Site check: check + pages/e2e), `ux-audit.yml`
(→ branch `ux-audit-results`), `mobile-taps.yml`, `route-probe.yml`
(→ branch `route-probe`), `health-report.yml`, `ios.yml` (→ `ios-shots`).
Apps: Capacitor shells loading sfrtna.com — Android `com.sfrtna.app`
(`android.yml`), iOS `mobile/ios` (`ios.yml`, uploads to App Store Connect).

## Where things are in PROJECT_NOTES.md (grep the heading)

Flights / Hotels / Measurement / Protection / Android app / Photos /
Discover / Partner audit / Trip services / Hotel names / Owner's notes of
13 Oct (section plan) / Coverage / Owner's notes of 20 Oct / Accounts /
City guide / Viator / Search Console / Status email / Feedback / Dashboard /
«رحلتي» / Google Play account / Workers Paid / Hotels like Booking /
iPhone app.

## ▶ Hand-off (3 Nov 2026, 03:45 KSA) — current state

Done 3 Nov: pre-launch round 1 (SPILL / TINY TAP / BLURRY) fixed, ux-audit
re-run clean (details: PROJECT_NOTES «Start here (hand-off 3 Nov 2026)»).

**Next step (Claude): route suggestion blocker.** Since 30 Oct (no code
change) «اقترح لي مسار» (multi-country) returns 0 routes for every search;
Site check `pages` job red on «suggest a route». route-probe 3 Nov: the
one-way home table (RUH, Travelpayouts `prices_for_dates` one_way, cached
6 h as `ow:v1:`) holds ~1 pool city; every ordering fails at flight 1.
Single «اقترح لي وجهة» still returns 24. Files: `src/lib/routeSuggest.ts`,
`src/lib/providers/travelpayouts.ts` (`oneWayFaresFrom`). Plan: add table
sizes to `RouteStats`, re-run route-probe, find thin data vs changed API
answer, then fix (e.g. round-trip fares for the first/last flight), re-run
Site check until green.

Then, in order: iPhone app checks on the simulator (Arabic, flight search,
partner link in Safari sheet, share/print) → App Store submission via the
ASC API key (listing ar+en, 6.9" screenshots, review notes; owner does App
Privacy + «Add for Review») → Android once Google verifies the owner's
identity (closed test 12 testers × 14 days).

Waiting on the owner: Google Play identity email; Stay22 address question;
one «احجز الرحلة» seen in Travelpayouts; Android APK on a real phone.

**Recommended model for the next chat: Opus 5.5** (root-cause debugging).
