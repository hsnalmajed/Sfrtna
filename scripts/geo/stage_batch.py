#!/usr/bin/env python3
"""
Stages a geocoded batch of cities WITHOUT touching the site's data files.

    python3 scripts/geo/stage_batch.py scripts/geo/batch2.json
        → scripts/geo/out/<batch>.staged.json

For each city: its centre (geocode_cities.py, Nominatim) and its gateway
airport. The gateway is the one named in the batch's `gateways` map (the
owner's list) when OurAirports confirms it — an airport with that IATA code,
large or medium, with scheduled service — and its distance from the centre
is recorded. When the named code is missing, unscheduled or unknown, the
nearest-airport rule of cityAirports.ts is used instead and the city is
flagged for review, so no airport is ever taken on trust.

A staged city is published (moved into cities.ts, cityCoords.ts,
cityAirports.ts, airports.ts) only once scripts/coverage/check.py finds every
data item it needs.
"""
from __future__ import annotations

import csv
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SKIP_IATA = {"DIA", "RML", "KCT"}


def hav(a, b, c, d):
    p1, p2 = math.radians(a), math.radians(c)
    x = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(d - b) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(x))


def main():
    batch_path = Path(sys.argv[1])
    batch = json.loads(batch_path.read_text(encoding="utf-8"))
    geo = json.loads((HERE / "out" / f"{batch_path.stem}.geocoded.json").read_text(encoding="utf-8"))["cities"]
    by_iata, usable = {}, []
    with open(HERE / "out" / "airports.csv", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r["iata_code"]:
                by_iata[r["iata_code"]] = r
            if (
                r["scheduled_service"] == "yes"
                and r["iata_code"]
                and r["iata_code"] not in SKIP_IATA
                and r["type"] in ("large_airport", "medium_airport")
            ):
                usable.append(r)

    out, review = {}, []
    for cc, cities in batch["countries"].items():
        for slug, ar, en, wiki in cities:
            g = geo.get(slug) or {}
            pt = g.get(g.get("chosen") or "") if g.get("chosen") else None
            entry = {"country": cc, "nameAr": ar, "nameEn": en, "wikiTitle": wiki, "flags": []}
            if not pt:
                entry["flags"].append("not geocoded")
                out[slug] = entry
                review.append(slug)
                continue
            entry.update(lat=pt["lat"], lon=pt["lon"], geocode=pt.get("display_name"))
            named = batch.get("gateways", {}).get(slug)
            a = by_iata.get(named or "")
            ok = a and a["scheduled_service"] == "yes" and a["type"] in ("large_airport", "medium_airport")
            if ok:
                km = hav(pt["lat"], pt["lon"], float(a["latitude_deg"]), float(a["longitude_deg"]))
                entry["airport"] = {
                    "iata": named, "name": a["name"], "km": round(km), "source": "owner list, confirmed in OurAirports",
                    "lat": float(a["latitude_deg"]), "lon": float(a["longitude_deg"]), "type": a["type"],
                }
                if km > 150:
                    entry["flags"].append(f"gateway {round(km)} km away")
            else:
                entry["flags"].append(f"named gateway {named!r} not a scheduled large/medium airport in OurAirports")
                best = None
                for kind, limit in (("large_airport", 60), ("medium_airport", 60), ("large_airport", 150), ("medium_airport", 150)):
                    cands = [(hav(pt["lat"], pt["lon"], float(x["latitude_deg"]), float(x["longitude_deg"])), x) for x in usable if x["type"] == kind]
                    cands = [c for c in cands if c[0] <= limit]
                    if cands:
                        best = min(cands, key=lambda c: c[0])
                        break
                if best:
                    km, x = best
                    entry["airport"] = {
                        "iata": x["iata_code"], "name": x["name"], "km": round(km), "source": "nearest-airport rule",
                        "lat": float(x["latitude_deg"]), "lon": float(x["longitude_deg"]), "type": x["type"],
                    }
            if entry["flags"]:
                review.append(slug)
            out[slug] = entry
            print(f"{slug:22} {entry.get('airport', {}).get('iata', '—'):4} {entry.get('airport', {}).get('km', '')!s:>5} km  {'; '.join(entry['flags'])}")

    (HERE / "out" / f"{batch_path.stem}.staged.json").write_text(
        json.dumps({"batch": batch_path.name, "cities": out, "review": review}, indent=1, ensure_ascii=False), encoding="utf-8"
    )
    print(f"{len(out)} staged, {len(review)} to review")


if __name__ == "__main__":
    main()
