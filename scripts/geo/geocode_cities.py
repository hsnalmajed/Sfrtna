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


def nominatim(q: str, cc: str, feature: str | None):
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
    for cc, cities in batch.items():
        for slug, _ar, en, query in cities:
            plain = nominatim(query, cc, None)
            city = nominatim(query, cc, "city")
            chosen = city or plain
            out["cities"][slug] = {"country": cc, "query": query, "plain": plain, "city": city, "chosen": "city" if city else "plain" if plain else None}
            print(slug, (chosen or {}).get("lat"), (chosen or {}).get("lon"), (chosen or {}).get("display_name", "NOT FOUND")[:80], flush=True)
    (OUT / f"{batch_path.stem}.geocoded.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    data = get(AIRPORTS)
    (OUT / "airports.csv").write_bytes(data)
    print(f"airports.csv: {len(data):,} bytes from {AIRPORTS}")


if __name__ == "__main__":
    main()
