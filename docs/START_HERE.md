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

## Two kinds of chats (owner 18 Nov)
- **Mail chat** (partners, stores, tickets): reads `docs/INBOX.md` only —
  opening: `محادثة بريد سفرتنا: اربط hsnalmajed/Sfrtna واستنسخه، واقرأ docs/INBOX.md فقط، ثم انتظر رسالتي.` (Sonnet).
- **Build chat** (improvements, additions, fixes): the opening message above,
  starts from «الخطوة التالية» (Opus). It does not handle mail; mail that
  needs code arrives via INBOX «For the build chat».

## Owner's standing rules (must follow)

- Always reply in **Arabic**. Act as developer, reviewer, CX expert, designer.
- **Owner 25 Nov: SHORT, useful replies** — long text distracts. A clear
  decision, not a list of proposals, when he asks for a root solution.
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
- **Commission check (owner 8 Nov 10:45, corrected):** show EVERY company
  we can link to, with or without commission, and keep showing its live
  price when we have one. For each, check if it pays commission (own
  programme or any network): yes → route its button through that
  programme; no → keep it as it is (link + price). A company on several
  networks → connect them all, route to the one that pays most, fall back
  to the next if one fails (down, empty, error). Never hide a company
  for paying nothing. **Register: `docs/PARTNERS.md`** — each supplier's
  programme, rate, conditions to join, whether we meet them, status. Not
  met yet → note what is missing, apply once met. Update it with every
  partner change.
- **DIRECT FIRST (owner 28 Nov, firm):** for flights, hotels, prices and every service, study the market site by site and connect to each company DIRECTLY (own affiliate programme + its data/API for results and prices in our site). A middleman network only when a direct link is impossible. Direct = more value, safety, trust, and no gaps like Aviasales missing Riyadh. Relying on middlemen first was a failure, not a detail.
- **Airlines and ticket sites (owner 9 Nov):** direct link to the company
  first; then any commission route, only if trusted. A site that won't open
  or shows a bot check in Chrome → try another browser, then the owner's
  normal browser. Every trusted airline or ticket site gets linked with its
  price, commission or not.
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
(→ branch `route-probe`), `health-report.yml`, `monitor.yml`, `ios.yml` (→ `ios-shots`).
Apps: Capacitor shells loading sfrtna.com — Android `com.sfrtna.app`
(`android.yml`), iOS `mobile/ios` (`ios.yml`, uploads to App Store Connect).

## Where things are in PROJECT_NOTES.md (grep the heading)

Flights / Hotels / Measurement / Protection / Android app / Photos /
Discover / Partner audit / Trip services / Hotel names / Owner's notes of
13 Oct (section plan) / Coverage / Owner's notes of 20 Oct / Accounts /
City guide / Viator / Search Console / Status email / Feedback / Dashboard /
«رحلتي» / Google Play account / Workers Paid / Hotels like Booking /
iPhone app.

## ▶ Hand-off (26 Nov 2026) — current state
Old hand-offs (15–26 Nov, every detail) = PROJECT_NOTES «Archived hand-offs»;
grep a keyword there, never read it whole.

**NOW (owner 28 Nov) — finish AGODA 100%, then the next company the same way
(direct first; order in INBOX «28 Nov 04:40»).** Done 28 Nov: Agoda Partners
ACTIVE, CID 1976542, Runtime secret `AGODA_API_KEY` set by owner, city hotel
button → /api/go/agoda (cid, smoke check green), bank submitted (1–2 days).
Trip.com done too: flights + hotels via /api/go/trip (AID 11517619/SID 337178549).
**Agoda API build 28 Nov (cbfa929…):** Hotel Data File → GitHub secret
`AGODA_HOTEL_FILE_URL`; `agoda-data.yml` builds `public/data/agoda/tiles`
(790,501 hotels around our cities, [id, cityId, lat, lng, name, stars]) +
`cities.json` (408/415; none: Russia, Cuba) via `scripts/agoda/build-index.py`.
`src/lib/providers/agoda.ts`: id match by place+name (probe: 53–57 of 60
hotels in Riyadh/Jeddah/Dubai/Istanbul) → `agodaId` on each hotel → named-hotel
Agoda button = /api/go/agoda on its own page (LIVE). Lite API client: endpoint
http://affiliateapi7643.agoda.com/affiliateservice/lt_v1, header
«siteId:key»; dailyRate = per night BEFORE taxes; city search max 30.
**API LIVE 28 Nov 06:55 (9883b19):** keys = Runtime secrets AGODA_API_KEY_2/_3
(old AGODA_API_KEY kept); the Partners copy button gives «siteId:key», the
code drops the prefix. Probe (`agoda-probe.yml`, 21 days out, 2 nights):
53–57/60 hotels matched, 23–28 with Agoda rates (SAR) per city; DataForSEO's
Google list had NO Agoda offer for any of them → Agoda prices are new.
Rates are shown NOWHERE yet (site check only, `agoda=1`).
**28 Nov 13:40 — ALL AGODA HOTELS LIVE (5062f3c, release green):**
`agoda-data.yml` (monthly) builds EN+AR bundle → GitHub release «agoda-data»
(77 MB zst, 620 MB, ~8.5k files), `release.yml` unpacks it into
public/data/agoda/ (NOT in git except tiles/). 445,929 hotels / 408 cities,
176k Arabic names from Agoda. `/api/agoda-hotels` (city list, 30/page, live
rates, q= AR/EN name, sort) + `/api/agoda-hotel` (photos, overview AR/EN,
address) → `AgodaCatalog` on hotel results (cards, show more, details,
Google Maps link, «عرض السعر في أجودا»). Price = per night before taxes and
fees (agoda.com shows the same; TEST_PLAN). Name search reads
`agoda/words/<3-letter key>` too (localHotels). Probe: `agoda-probe.yml`.
**NEXT (Opus):** default order «popular» = most reviews; consider rating ×
reviews; Agoda rate inside the Google list cards (has agodaId); then
Skyscanner direct.
Then: Skyscanner (impact.com + API), Klook direct, airlines.

**NOW — Unsplash in the city galleries (BUILT 26 Nov, 6d27623 + 9c7948d).**
`gallery2.ts unsplash` (one «City Country» search a city, ≤20 kept: those
naming the city first («Al Ula» = «AlUla»), then unnamed ones (Unsplash's
captions rarely name it), never one naming another country, no people/food/
insides; log lists reasons; `uv`=3 rows only), `usheets`, `uping`. `gallery-unsplash.yml` hourly
:47 (≤38 searches + ≤8 pings; Demo key 50/h; ~11 runs for 415 cities):
candidates → `photo-review-v2` gallery2.json `row.u`; sheets →
branch **`unsplash-sheets`** `u-<slug>.jpg`. A city shows Unsplash ONLY once
listed in `scripts/photos/unsplash-drop.txt` (eye check, tags u#; format in
the file); then the next run publishes (after each sight's own photos, ≤15)
and pings. Viewer: «📷 name · Unsplash» with referral tags.
**26 Nov: first 35 cities eye-checked + LIVE (9ef4914, release green):** 264
Unsplash photos in 31 galleries; none fit al-wakrah (= Doha), al-ahsa, taif,
umluj — small Saudi cities' searches return Madinah/Makkah, so «unnamed»
results need the eye. Built galleries pushed straight from the chat (build
needs no key); pings (≤8/run) catch up in later runs.
**NEXT (Opus):** review each new batch: `git fetch --depth 1 origin
+unsplash-sheets:refs/remotes/origin/unsplash-sheets` (the + matters:
photo-review-v2 is force-pushed, so always fetch with +), read the sheets of
cities not yet in unsplash-drop.txt, append lines with a keep-list script
(see 26 Nov commit), build from photo-review-v2's gallery2.json, push
gallery + drop file. If no run in 2 h, dispatch gallery-unsplash.yml.
**Owner step pending:** apply for Unsplash **Production** (31 cities live;
needs a screenshot of the credit line in a city's photo viewer) → 1,000/h.
Then Pixabay API, Saudi Tourism media bank (ask permission).

**Open, in owner's order (details: PROJECT_NOTES archive):**
- Apple 27 Nov 16:22: build 63 + reply (not a travel provider) → **Waiting for Review**; flight prices in iOS show after ATT Allow.
- Apple 27 Nov: 5.1.2(i) PASSED (ATT); NEW rejection **5.1.1(ix)** — air
  travel = regulated field → must be an ORGANIZATION account (no document
  fixes it). Root fix: one-person LLC (business.sa; a «مؤسسة» = sole
  proprietorship, Apple refuses it) → free D-U-N-S (Apple lookup) →
  Developer Support converts THIS account (app kept) → resubmit build 62.
  Same entity → Play organization account. Steps in INBOX row 1.
- Flights: Skyscanner via Scrapingdog as flight source #1 (spec: archive
  «KEY FINDING … Skyscanner Search»); no paid plan before launch; owner to
  regenerate the Scrapingdog key after the build is checked.
- Hotels: site-by-site study of owner's file v3 (ask him to attach
  «Global_Hotel_Flight_Platforms_Database_v3.xlsx»), doc «دراسة مواقع
  الفنادق المحلية» https://claude.ai/artifact/BBaHrWVqm8pef81eAevLsj.
  DataForSEO live (balance ~$55); RateHawk reply → INBOX.
- Play: 12+ testers since 23 Nov → «Apply for production» on **7 Dec**
  (Sonnet chat).
- SerpApi free allowance renews 6 Dec; no paid plan (owner).
- Owner phone checks waiting for the final test round («خريطتي», hotels
  Booking-style, home hero, plan map).
- Release gate: green again (26 Nov 01:30).

**Recommended model for the next chat: Opus 5.5** (Agoda API build).
