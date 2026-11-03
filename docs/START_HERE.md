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

## ▶ Hand-off (3 Nov 2026, evening) — current state

**▶ CURRENT SECTION (owner, 3 Nov 15:13): no error may reach visitors —
prevent, don't just detect.** Details: PROJECT_NOTES «Release gate».
1. «next-step tabs» flake: tests now name the cause on failure and the tabs
   have scroll margins (pushed 3 Nov). **Next step:** after the next Site
   check, if it fails again read the cause in the annotation and fix the
   page (banner over the tab) or the test; no failure in ~10 runs = closed.
2. **Release gate — route B (second Worker `sfrtna-staging`): BUILT, runs on
   staging since 3 Nov 16:50; production not gated yet.** `.github/workflows/release.yml` (build once → deploy to
   staging → smoke + e2e on it → same build to production if green; skips
   itself, green, until the secrets exist), `scripts/make-staging-config.mjs`
   (staging config from `wrangler.jsonc`, own rate-limit ids). Details +
   secret names: PROJECT_NOTES «Release gate» → Step 2 built.
   **Done 3 Nov:** (a) GitHub secrets `CLOUDFLARE_API_TOKEN` +
   `CLOUDFLARE_ACCOUNT_ID` set; staging Worker exists; the workflow copies
   `SMOKE_TOKEN` to it itself. Run 41647903785: smoke on staging fails ONLY
   the 3 partner-link checks (Klook/Tiqets/Airalo) = staging lacks
   `TRAVELPAYOUTS_TOKEN` (`/api/go/tp`); e2e not reached yet.
   **Next steps, owner ONE at a time:** (b) add `TRAVELPAYOUTS_TOKEN` as a
   *Secret* on `sfrtna-staging` in the Cloudflare dashboard (value from the
   Travelpayouts dashboard, never in chat), then re-dispatch Release with
   production unticked: `gh api -X POST repos/hsnalmajed/sfrtna/actions/workflows/release.yml/dispatches -f ref=main -F 'inputs[production]=false'`;
   add other staging secrets only if smoke/e2e then name them (the 14 names
   in PROJECT_NOTES are the full candidate list); (c) DONE 3 Nov 19:30 — run 41673807379 green
   on staging (`TRAVELPAYOUTS_TOKEN` set by the owner was the only secret
   needed). Gate does NOT cover: the live flight widget (returns no flights on
   the workers.dev host → warning «check by hand on sfrtna.com») and RUH
   «suggest a route» (known external);
   (d) DONE 4 Nov: Cloudflare «Build variables and secrets» is empty, so no
   override of `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_TRAVELPAYOUTS_MARKER`
   (build cmd there: `npx opennextjs-cloudflare build`, deploy `npx wrangler deploy`);
   (d2) DONE 4 Nov: run 41719665474 (production ticked) green end to end —
   staging checks → production deployed → quick check of production green;
   (e) DONE 4 Nov 00:28: owner switched «Disable builds» ON for the Cloudflare
   Git build of `sfrtna` (repo shown there: old name `hsnalmajed/itravel`;
   NOT disconnected — undo = switch it off). Release is now the only way to
   production; (f) DONE: `push` trigger removed from `smoke.yml` (schedule
   every 2 h + manual stay). Gate section CLOSED once the first push run
   (4 Nov, commit after 2bece7f) is green and shows one deploy only.
3. Riyadh «suggest a route» is now «known external» in `e2e.mjs`
   (warning in the mail, does not block); remove the flag when RUH fares return.
Recommended model: Sonnet 5.5 for the owner steps (a)–(f); Opus 5.5 only if
the first staging run shows a real failure to debug.

**iPhone app submitted to App Review** (3 Nov 14:45, version 1.0, build
27, status «Waiting for Review», up to 48 h). Listing, 8+8 captioned
screenshots, App Privacy, content rights and review contact are done
(PROJECT_NOTES «iPhone app» → 3 Nov entries). Store texts:
`docs/app-store/listing.json`; upload: `ios-store.yml` (input `only`).
**Next step:** when Apple's email arrives — approved: point the site's
«حمّل التطبيق» banner / AppStoreButtons at the App Store link, then add
the native rating prompt (SKStoreReviewController, once after a good
moment, e.g. 3rd search); rejected: read the reason and fix.
Offered to the owner (his decision): Apple Search Ads.

Riyadh fares still missing at the flight partner (PROJECT_NOTES «Route
suggestions — Riyadh missing at the partner»; probe 3 Nov 08:17: homeSize
4, routes 0). **Travelpayouts replied 3 Nov 17:20 (ticket #254780, closed):
limited flight data is due to the regional situation; data expected back
as conditions improve, NO date given → not a bug on our side, no fix to wait
for.** «suggest a route» (RUH) is only a warning now (known external).
**Owner's business decision pending: the Google-fares plan for Riyadh
routes, or wait.** When data lands: route-probe (`after`),
then Site check. The store's flight screenshot uses Jeddah for this reason
(retake from Riyadh later: ios.yml dispatch input `shots`).

Stay22: payout address fixed and all steps Done 3 Nov; waiting for
Madeleine's clearance («Missing payout method» should disappear).
Cloudflare Observability pricing (1 Dec): usage ≈1 % of the allowance,
nothing to do.

Waiting on the owner: Apple review email; Travelpayouts reply / Google-fares
plan; Google Play identity check (owner sent his ID, waiting — may take days); Stay22 clearance; Android APK on a real
phone.

**Recommended model for the next chat: Sonnet 5.5** (owner steps for the
gate, Apple review email); Opus 5.5 if the first staging run needs debugging.
