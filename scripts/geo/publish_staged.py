#!/usr/bin/env python3
"""
Publishes the staged cities that are complete: moves them from
scripts/geo/out/*.staged.json into the site's data files

  src/lib/cities.ts         the city (names, slug, Wikipedia title)
  src/data/cityCoords.ts    its centre (Nominatim, checked at staging)
  src/data/cityAirports.ts  its gateway airport (owner's list, OurAirports)
  src/lib/airports.ts       that airport, for the search forms, when missing

    python3 scripts/geo/publish_staged.py            # dry run: what would go live
    python3 scripts/geo/publish_staged.py --apply    # write the files

A city goes live only when every item scripts/coverage/check.py requires is
there (trip type, climate + season record not withheld, stored places, stored
hotels, a confirmed visa status for its country, currency, country) and it is
not on HOLD below. Idempotent: a city already in cities.ts is skipped.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent

# Complete on paper, but a figure we know to be off — kept back until fixed.
HOLD = {
    "cusco": "regional climate correction reads ~3 °C cold at 3,400 m; needs SENAMHI normals",
    "paro": "regional climate correction reads ~5 °C cold in summer at 2,270 m; needs NCHM Bhutan normals",
}


def read(p: str) -> str:
    return (ROOT / p).read_text(encoding="utf-8")


def keys(src: str, pattern: str) -> set[str]:
    return set(re.findall(pattern, src, re.M))


def main() -> None:
    apply = "--apply" in sys.argv
    staged: dict[str, dict] = {}
    for p in sorted((HERE / "out").glob("*.staged.json")):
        staged.update(json.loads(p.read_text(encoding="utf-8"))["cities"])

    cities_ts = read("src/lib/cities.ts")
    coords_ts = read("src/data/cityCoords.ts")
    cair_ts = read("src/data/cityAirports.ts")
    air_ts = read("src/lib/airports.ts")
    live = set(re.findall(r'slug: "([^"]+)"', cities_ts))

    types = keys(read("src/data/destinationTypes.ts").split("QA_DESTINATION_TYPES")[0], r'^  "?([a-z0-9-]+)"?: \[')
    seasons_file = json.loads(read("src/data/climate/travelSeasons.json"))
    seasons = set(seasons_file["records"].keys())
    withheld = set((seasons_file["meta"].get("withheld") or {}).keys())
    places = {p.stem for p in (ROOT / "public/data/places").glob("*.json")}
    # Staged hotels are collected into scripts/hotels/cities/; build-index.ts
    # writes public/data/hotels/ only for live cities, so it runs after --apply.
    hotels = {p.stem for p in (ROOT / "public/data/hotels").glob("*.json")} | {
        p.stem for p in (ROOT / "scripts/hotels/cities").glob("*.json") if p.stat().st_size > 2
    }
    visa = keys(read("src/data/visaStatus.ts"), r"^  ([A-Z]{2}): \{") | {"SA"}
    countries = {
        m.group(1): (m.group(2), m.group(3))
        for m in re.finditer(r'\{ code: "([A-Z]{2})", nameAr: "([^"]+)", nameEn: "([^"]+)"', read("src/lib/countries.ts"))
    }
    cur_src = read("src/lib/currencies.ts")
    euro = set(re.findall(r'"([A-Z]{2})"', cur_src.split("EURO_COUNTRIES = new Set([", 1)[1].split("]);", 1)[0]))
    overrides = cur_src.split("COUNTRY_CURRENCY_OVERRIDES", 1)[1].split("};", 1)[0]
    with_cur = set(re.findall(r'country: "([A-Z]{2})"', cur_src)) | euro | set(re.findall(r'^  ([A-Z]{2}): "', overrides, re.M))
    listed_iata = set(re.findall(r'iata: "([A-Z]{3})"', air_ts))

    ready, waiting = [], []
    for slug, c in staged.items():
        if slug in live:
            continue
        cc = c["country"]
        missing = [
            name
            for name, ok in (
                ("type", slug in types),
                ("climate", slug in seasons and slug not in withheld),
                ("places", slug in places),
                ("hotels", slug in hotels),
                ("visa", cc in visa),
                ("currency", cc in with_cur),
                ("country", cc in countries),
                ("airport", bool((c.get("airport") or {}).get("iata"))),
                ("review", not c.get("flags")),
            )
            if not ok
        ]
        if slug in HOLD:
            missing.append(f"hold: {HOLD[slug]}")
        (waiting if missing else ready).append((slug, c, missing))

    print(f"ready: {len(ready)}   waiting: {len(waiting)}")
    for slug, c, m in waiting:
        print(f"  wait {c['country']} {slug}: {', '.join(m)}")
    if not apply:
        for slug, c, _ in ready:
            print(f"  go   {c['country']} {slug} → {c['airport']['iata']}")
        return

    by_cc: dict[str, list[str]] = {}
    new_coords, new_cair, new_air = [], [], []
    for slug, c, _ in ready:
        cc = c["country"]
        ar, en, wiki = c["nameAr"], c["nameEn"], c.get("wikiTitle") or c["nameEn"]
        by_cc.setdefault(cc, []).append(f'    {{ slug: "{slug}", nameAr: "{ar}", nameEn: "{en}", wikiTitle: "{wiki}" }},')
        new_coords.append(f'  "{slug}": {{ lat: {c["lat"]}, lon: {c["lon"]}, code: "{cc}" }},')
        a = dict(c["airport"], name=c["airport"]["name"].replace('"', ""))
        new_cair.append(f'  "{slug}": {{ iata: "{a["iata"]}", km: {round(a["km"])} }},')
        if a["iata"] not in listed_iata:
            listed_iata.add(a["iata"])
            c_ar, c_en = countries[cc]
            name_ar = f"مطار {ar}{' الدولي' if 'International' in a['name'] else ''}"
            new_air.append(
                f'  {{ iata: "{a["iata"]}", nameAr: "{name_ar}", nameEn: "{a["name"]}", cityAr: "{ar}", cityEn: "{en}", countryAr: "{c_ar}", countryEn: "{c_en}" }},'
            )

    for cc, lines in by_cc.items():
        # A one-line block ("  MV: [{ … }],") is opened up first.
        cities_ts = re.sub(rf"^  {cc}: \[(\{{.*\}})\],$", rf"  {cc}: [\n    \1,\n  ],", cities_ts, flags=re.M)
        m = re.search(rf"^  {cc}: \[\n", cities_ts, re.M)
        if m:  # the country already has cities: append to its block
            end = cities_ts.index("\n  ],", m.end())
            cities_ts = cities_ts[:end] + "\n" + "\n".join(lines) + cities_ts[end:]
        else:
            cities_ts = cities_ts.replace("\n};\n", f"\n  {cc}: [\n" + "\n".join(lines) + "\n  ],\n};\n", 1)
    (ROOT / "src/lib/cities.ts").write_text(cities_ts, encoding="utf-8")

    coords_ts = coords_ts.replace("\n};\n\n/** Curated landmarks", "\n" + "\n".join(new_coords) + "\n};\n\n/** Curated landmarks", 1)
    (ROOT / "src/data/cityCoords.ts").write_text(coords_ts, encoding="utf-8")
    idx = cair_ts.rstrip().rfind("};")
    cair_ts = cair_ts[:idx] + "\n".join(new_cair) + "\n};\n"
    (ROOT / "src/data/cityAirports.ts").write_text(cair_ts, encoding="utf-8")
    if new_air:
        idx = air_ts.find("\n];")
        air_ts = air_ts[:idx] + "\n  // Coverage batch 2 gateways (owner's list, confirmed in OurAirports)\n" + "\n".join(new_air) + air_ts[idx:]
        (ROOT / "src/lib/airports.ts").write_text(air_ts, encoding="utf-8")
    print(f"published {len(ready)} cities, {len(new_air)} airports added")


if __name__ == "__main__":
    main()
