#!/usr/bin/env python3
"""
Adds a geocoded batch of cities to the site's data files:

  src/lib/cities.ts         the cities (names, slug, Wikipedia title)
  src/data/cityCoords.ts    their centres (Nominatim, see geocode_cities.py)
  src/data/cityAirports.ts  the airport each city flies into (OurAirports)
  src/lib/airports.ts       those airports, for the search forms' autocomplete

    python3 scripts/geo/apply_batch.py scripts/geo/batch1.json

Airports follow the rule written at the top of cityAirports.ts: the airport
airports.ts already lists for the city, else the nearest large airport with
scheduled service within 60 km, else the nearest medium one within 60 km,
else large within 150 km, else medium within 150 km. Idempotent: a city or
airport already present is left as it is.
"""
from __future__ import annotations

import csv
import json
import math
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
SKIP_IATA = {"DIA", "RML", "KCT"}


def hav(a, b, c, d):
    p1, p2 = math.radians(a), math.radians(c)
    x = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(d - b) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(x))


def main():
    batch_path = Path(sys.argv[1])
    batch = json.loads(batch_path.read_text(encoding="utf-8"))["countries"]
    geo = json.loads((HERE / "out" / f"{batch_path.stem}.geocoded.json").read_text(encoding="utf-8"))["cities"]
    countries = {
        m.group(1): (m.group(2), m.group(3))
        for m in re.finditer(r'\{ code: "([A-Z]{2})", nameAr: "([^"]+)", nameEn: "([^"]+)"', (ROOT / "src/lib/countries.ts").read_text(encoding="utf-8"))
    }

    airports = []
    with open(HERE / "out" / "airports.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["scheduled_service"] != "yes" or not r["iata_code"] or r["iata_code"] in SKIP_IATA:
                continue
            if r["type"] not in ("large_airport", "medium_airport"):
                continue
            airports.append(r)

    cities_ts = (ROOT / "src/lib/cities.ts").read_text(encoding="utf-8")
    coords_ts = (ROOT / "src/data/cityCoords.ts").read_text(encoding="utf-8")
    cair_ts = (ROOT / "src/data/cityAirports.ts").read_text(encoding="utf-8")
    air_ts = (ROOT / "src/lib/airports.ts").read_text(encoding="utf-8")
    listed_iata = set(re.findall(r'iata: "([A-Z]{3})"', air_ts))

    new_city_blocks, new_coords, new_cair, new_air = [], [], [], []
    for cc, cities in batch.items():
        lines = []
        for slug, ar, en, wiki in cities:
            if f'slug: "{slug}"' in cities_ts:
                continue
            g = geo[slug]
            pt = g[g["chosen"]] if g["chosen"] else None
            if not pt:
                print(f"skip {slug}: not geocoded")
                continue
            lines.append(f'    {{ slug: "{slug}", nameAr: "{ar}", nameEn: "{en}", wikiTitle: "{wiki}" }},')
            new_coords.append(f'  "{slug}": {{ lat: {pt["lat"]}, lon: {pt["lon"]}, code: "{cc}" }},')
            # Airport.
            best = None
            for kind, limit in (("large_airport", 60), ("medium_airport", 60), ("large_airport", 150), ("medium_airport", 150)):
                cands = [
                    (hav(pt["lat"], pt["lon"], float(a["latitude_deg"]), float(a["longitude_deg"])), a)
                    for a in airports
                    if a["type"] == kind
                ]
                cands = [c for c in cands if c[0] <= limit]
                if cands:
                    best = min(cands, key=lambda c: c[0])
                    break
            if best:
                km, a = best
                new_cair.append(f'  "{slug}": {{ iata: "{a["iata_code"]}", km: {round(km)} }},')
                if a["iata_code"] not in listed_iata:
                    listed_iata.add(a["iata_code"])
                    c_ar, c_en = countries[cc]
                    intl = "International" in a["name"]
                    name_ar = f"مطار {ar}{' الدولي' if intl else ''}"
                    new_air.append(
                        f'  {{ iata: "{a["iata_code"]}", nameAr: "{name_ar}", nameEn: "{a["name"]}", cityAr: "{ar}", cityEn: "{en}", countryAr: "{c_ar}", countryEn: "{c_en}" }},'
                    )
                print(f"{slug:16} → {a['iata_code']} {a['name']} ({round(km)} km)")
            else:
                new_cair.append(f'  "{slug}": {{ iata: "", km: null }},')
                print(f"{slug:16} → no airport within 150 km")
        if lines:
            if re.search(rf"^  {cc}: \[$", cities_ts, re.M):
                raise SystemExit(f"{cc} already has cities; merge by hand")
            new_city_blocks.append(f"  {cc}: [\n" + "\n".join(lines) + "\n  ],")

    if new_city_blocks:
        cities_ts = cities_ts.replace("\n};\n", "\n" + "\n".join(new_city_blocks) + "\n};\n", 1)
        (ROOT / "src/lib/cities.ts").write_text(cities_ts, encoding="utf-8")
    if new_coords:
        coords_ts = coords_ts.replace("\n};\n\n/** Curated landmarks", "\n" + "\n".join(new_coords) + "\n};\n\n/** Curated landmarks", 1)
        (ROOT / "src/data/cityCoords.ts").write_text(coords_ts, encoding="utf-8")
    if new_cair:
        idx = cair_ts.rstrip().rfind("};")
        cair_ts = cair_ts[:idx] + "\n".join(new_cair) + "\n};\n"
        (ROOT / "src/data/cityAirports.ts").write_text(cair_ts, encoding="utf-8")
    if new_air:
        idx = air_ts.find("\n];")
        air_ts = air_ts[:idx] + "\n  // Added with the country expansion (OurAirports, public domain)\n" + "\n".join(new_air) + air_ts[idx:]
        (ROOT / "src/lib/airports.ts").write_text(air_ts, encoding="utf-8")
    print(f"{len(new_coords)} cities, {len(new_air)} airports added")


if __name__ == "__main__":
    main()
