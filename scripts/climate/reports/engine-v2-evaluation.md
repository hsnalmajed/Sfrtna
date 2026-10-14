# Season engine v2 (Holiday Climate Index) — evaluated 14 Oct 2026, not adopted

Question: does rating months with the published Holiday Climate Index
(HCI:Urban, Scott et al. 2016; HCI:Beach, Rutty et al. 2020; `hci.py`,
`build_hci.py` → hci.json) pick the months tourism boards and guides name
better than the current engine (v1.1, `src/lib/travelSeason`)?

Test: the 75 cities with a city-level source naming 1–11 months
(`citySeasonSources.ts`, `broad` excluded). Climate-only scores (v1's
tourism bonus left out — otherwise the test is circular). Two measures per
city, averaged: AUC (chance a named month scores above an unnamed one) and
top-k precision (k = number of named months).

| Model | AUC | top-k |
|---|---|---|
| v1.1 on the old normals | 0.812 | 0.599 |
| v1.1 on the new normals (14 Oct) | 0.812 | 0.611 |
| HCI by type (beach/tropical → HCI:Beach, else Urban) | 0.802 | 0.595 |
| HCI by type + v1 safety caps | 0.801 | 0.597 |
| 0.3·v1 + 0.7·HCI(capped) | 0.819 | 0.607 |
| 0.7·v1 + 0.3·HCI(capped) | 0.816 | 0.614 |

By zone (HCI + caps vs v1.1 new): tropics (|lat| < 23.5°, 19 cities)
0.776 vs 0.823 — HCI worse; outside (56) 0.810 vs 0.808 — equal.
Salalah: both rate the khareef (Jun–Sep) low; no climate index captures
its appeal, the tourism-board signal does.

Decision: keep v1.1, feed it the new normals (station calibration,
regional correction, elevation-matched cells). Blends gain ≤ 0.007 AUC —
inside the noise of 75 cities — and would add a second rating to explain.
hci.json stays in the pipeline as a reference, not used by the site.
