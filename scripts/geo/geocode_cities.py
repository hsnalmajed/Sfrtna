#!/usr/bin/env python3
"""
City centres for a batch of new cities, the same way src/data/cityCoords.ts
was made: OpenStreetMap Nominatim, the English name restricted to the
country, then again restricted to settlements (featureType=city); the
settlement answer is kept when there is one. Also downloads OurAirports'
public-domain airport list for choosing each city's airport.

    python scripts/geo/geocode_cities.py scripts/geo/batch1.json
        → scripts/geo/out/<batch>.geocoded.json, scripts/geo/out/airports.csv

Nominatim's usage policy: at most one request per second, a real User-Agent.
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "out"
UA = {"User-Agent": "Sfrtna travel site geocoding (https://sfrtna.com)"}
AIRPORTS = "https://davidmegginson.github.io/ourairports-data/airports.csv"


def get(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
        return r.read()


def plain_name(q: str) -> str:
    """A Wikipedia title as a place name: "Krabi (town)" → "Krabi",
    "Livingstone, Zambia" → "Livingstone" (the country is already the
    countrycodes filter)."""
    q = re.sub(r"\s*\(.*?\)", "", q).strip()
    if q.endswith(", D.C."):
        return q
    return q.split(",")[0].strip()


def nominatim(q: str, cc: str, feature: str | None):
    return nominatim_raw(plain_name(q), cc, feature)


def nominatim_raw(q: str, cc: str, feature: str | None):
    params = {"q": q, "countrycodes": cc.lower(), "format": "jsonv2", "limit": 1, "accept-language": "en"}
    if feature:
        params["featureType"] = feature
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(params)
    res = json.loads(get(url))
    time.sleep(1.2)
    if not res:
        return None
    top = res[0]
    return {
        "lat": round(float(top["lat"]), 5),
        "lon": round(float(top["lon"]), 5),
        "display_name": top.get("display_name"),
        "osm_type": top.get("osm_type"),
        "osm_id": top.get("osm_id"),
        "type": top.get("type"),
        "url": url,
    }


def main():
    batch_path = Path(sys.argv[1])
    batch = json.loads(batch_path.read_text(encoding="utf-8"))["countries"]
    OUT.mkdir(exist_ok=True)
    out = {"source": "OpenStreetMap Nominatim", "retrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"), "cities": {}}
    overrides = json.loads(batch_path.read_text(encoding="utf-8")).get("geocodeQueries", {})
    for cc, cities in batch.items():
        for slug, _ar, en, query in cities:
            # A query a reviewer corrected (see the batch's geocodeNote) is
            # sent as written, with the country code given beside it.
            q, qcc = overrides.get(slug, (query, cc))
            if slug in overrides:
                plain = nominatim_raw(q, qcc, None)
                city = nominatim_raw(q, qcc, "city")
            else:
                plain = nominatim(q, qcc, None)
                city = nominatim(q, qcc, "city")
            chosen = city or plain
            out["cities"][slug] = {"country": cc, "query": query, "plain": plain, "city": city, "chosen": "city" if city else "plain" if plain else None}
            print(slug, (chosen or {}).get("lat"), (chosen or {}).get("lon"), (chosen or {}).get("display_name", "NOT FOUND")[:80], flush=True)
    (OUT / f"{batch_path.stem}.geocoded.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    data = get(AIRPORTS)
    (OUT / "airports.csv").write_bytes(data)
    print(f"airports.csv: {len(data):,} bytes from {AIRPORTS}")


if __name__ == "__main__":
    main()
