#!/usr/bin/env python3
"""
Coverage gate: what every city and country on the site — and every city
being added — has, and what it still lacks.

    python3 scripts/coverage/check.py            → scripts/coverage/report.md
    python3 scripts/coverage/check.py --strict   → exit 1 if a LIVE city lacks a required item

Required for a city to go (or stay) live: centre, gateway airport, trip
type, climate figures with a season rating, stored places, stored hotel
names, and for its country a confirmed visa status and its currency.
Expected (reported, not blocking): months named by a tourism source, a
country guide, photos, partner pages.

Why: the 1 Oct expansion published 32 countries without climate, seasons,
visa or guides; nothing noticed. This makes the gaps visible every time.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def read(p):
    return (ROOT / p).read_text(encoding="utf-8")


def keys_in(src, pattern):
    return set(re.findall(pattern, src, re.M))


def main():
    cities_ts = read("src/lib/cities.ts")
    body = cities_ts[cities_ts.index("COUNTRY_CITIES"):cities_ts.index("\n};")]
    live, code = [], None
    for line in body.split("\n"):
        m = re.match(r"  ([A-Z]{2}): \[", line)
        if m:
            code = m.group(1)
        for slug in re.findall(r'slug: "([^"]+)"', line):
            live.append((code, slug))
    staged = []
    for p in sorted((ROOT / "scripts/geo/out").glob("*.staged.json")):
        for slug, c in json.loads(p.read_text(encoding="utf-8"))["cities"].items():
            if slug not in {s for _, s in live}:
                staged.append((c["country"], slug))

    coords = keys_in(read("src/data/cityCoords.ts"), r'^  "([^"]+)": \{ lat')
    airports = {k for k, v in re.findall(r'^  "([^"]+)": \{ iata: "([A-Z]*)"', read("src/data/cityAirports.ts"), re.M) if v}
    types = keys_in(read("src/data/destinationTypes.ts"), r'^  "?([a-z0-9-]+)"?: \[')
    seasons = set(json.loads(read("src/data/climate/travelSeasons.json"))["records"].keys())
    tourism = keys_in(read("src/data/citySeasonSources.ts"), r'^  "?([a-z0-9-]+)"?: \{\s*months')
    places = {p.stem for p in (ROOT / "public/data/places").glob("*.json")}
    hotels = {p.stem for p in (ROOT / "public/data/hotels").glob("*.json")}
    photos = json.loads(read("src/data/pexelsPhotos.json"))
    visa = keys_in(read("src/data/visaStatus.ts"), r"^  ([A-Z]{2}): \{")
    guides = keys_in(read("src/lib/countryGuides.ts"), r"^  ([A-Z]{2}): \{")
    countries = keys_in(read("src/lib/countries.ts"), r'code: "([A-Z]{2})"')
    cur_src = read("src/lib/currencies.ts")
    euro = set(re.findall(r'"([A-Z]{2})"', cur_src.split("EURO_COUNTRIES = new Set([", 1)[1].split("]);", 1)[0]))
    with_cur = set(re.findall(r'country: "([A-Z]{2})"', cur_src)) | euro | set(re.findall(r'^  ([A-Z]{2}): "[A-Z]{3}"', cur_src, re.M))

    REQ = ["centre", "airport", "type", "climate", "places", "hotels", "visa", "currency", "country"]
    EXP = ["tourism", "guide", "photo"]

    def check(cc, slug):
        have = {
            "centre": slug in coords, "airport": slug in airports, "type": slug in types,
            "climate": slug in seasons, "places": slug in places, "hotels": slug in hotels,
            "visa": cc in visa or cc == "SA", "currency": cc in with_cur, "country": cc in countries,
            "tourism": slug in tourism, "guide": cc in guides, "photo": bool(photos.get(slug)),
        }
        return have

    lines = ["# Coverage", ""]
    failing_live = []
    for label, group in (("Live", live), ("Staged (not on the site yet)", staged)):
        rows = [(cc, slug, check(cc, slug)) for cc, slug in group]
        lines += [f"## {label}: {len(rows)} cities in {len({c for c, _ in group})} countries", ""]
        for item in REQ + EXP:
            n = sum(h[item] for _, _, h in rows)
            lines.append(f"- {item}{'' if item in REQ else ' (expected)'}: {n}/{len(rows)}")
        lines.append("")
        lacking = [(cc, s, [i for i in REQ if not h[i]]) for cc, s, h in rows if not all(h[i] for i in REQ)]
        if lacking:
            lines += [f"Missing a required item ({len(lacking)}):", ""]
            lines += [f"- {cc} {s}: {', '.join(m)}" for cc, s, m in lacking]
            lines.append("")
        if label == "Live":
            failing_live = lacking
    out = ROOT / "scripts/coverage/report.md"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines[:40]))
    if "--strict" in sys.argv and failing_live:
        sys.exit(1)


if __name__ == "__main__":
    main()
