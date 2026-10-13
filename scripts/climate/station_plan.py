#!/usr/bin/env python3
"""
Which official station represents each city, and which stations calibrate
the cities that have none.

    python3 scripts/climate/station_plan.py   → scripts/climate/data/station_plan.json

Measured on 13 Oct 2026 against 94 cities with an official station: ERA5-Land
daily highs read 1.7 °C colder than the station on average (only 46 % of
city-months within ±1.5 °C). So:

  1. direct     an official station — WMO 1991–2020 normals first, else
                NOAA GHCN-Daily (fetch_ghcn.py) — within DIRECT_KM of the city
                (merge_sources.py then also checks height) — its normals are
                the city's figures.
  2. calibrate  otherwise, up to CAL_N stations within CAL_KM: ERA5-Land is
                downloaded at each of them too, and the city's ERA5-Land
                figures are corrected by their month-by-month difference
                (station − ERA5-Land at the station), weighted by inverse
                distance (merge_sources.py). The correction is validated by
                leaving each direct city's own station out (validate_climate.py).
  3. none       no station within CAL_KM: ERA5-Land as it is, flagged, and the
                city keeps lower confidence.

Cities: src/data/cityCoords.ts (the site's) + scripts/geo/out/*.staged.json
(cities being added).
"""
from __future__ import annotations

import json
import math
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
DIRECT_KM = 25.0
CAL_KM = 150.0
CAL_N = 3


def hav(a, b, c, d):
    p1, p2 = math.radians(a), math.radians(c)
    x = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(d - b) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(x))


def cities():
    src = (ROOT / "src/data/cityCoords.ts").read_text(encoding="utf-8")
    block = src.split("export const CITY_COORDS", 1)[1].split("\n};", 1)[0]
    out = {m[0]: {"lat": float(m[1]), "lon": float(m[2]), "country": m[3], "staged": False}
           for m in re.findall(r'^  "([a-z0-9-]+)": \{ lat: (-?[\d.]+), lon: (-?[\d.]+), code: "([A-Z]{2})" \}', block, re.M)}
    for p in sorted((ROOT / "scripts/geo/out").glob("*.staged.json")):
        for slug, c in json.loads(p.read_text(encoding="utf-8"))["cities"].items():
            if "lat" in c and slug not in out:
                out[slug] = {"lat": c["lat"], "lon": c["lon"], "country": c["country"], "staged": True}
    return out


def main():
    stations = {sid: {**s, "source": "wmo"} for sid, s in json.loads((HERE / "data/wmo_normals.json").read_text(encoding="utf-8"))["stations"].items()}
    ghcn_path = HERE / "data/ghcn_normals.json"
    if ghcn_path.exists():
        # GHCN-Daily stations, unless the same station already has WMO normals.
        wmo_ids = {s.get("wmoId") for s in stations.values()}
        for sid, s in json.loads(ghcn_path.read_text(encoding="utf-8"))["stations"].items():
            if s.get("wmoId") and s["wmoId"] in wmo_ids:
                continue
            stations[f"ghcn:{sid}"] = {**s, "source": "ghcn", "country": ""}
    # WMO first: at equal distance the official normal wins.
    tmax = sorted(((sid, s) for sid, s in stations.items() if s.get("TMAX") and s.get("TMIN")), key=lambda x: x[1]["source"] != "wmo")
    plan, fetch = {}, {}
    for slug, c in cities().items():
        near = sorted(((hav(c["lat"], c["lon"], s["lat"], s["lon"]), sid, s) for sid, s in tmax), key=lambda x: x[0])
        direct = [(d, sid, s) for d, sid, s in near if d <= DIRECT_KM]
        cal = [(d, sid, s) for d, sid, s in near if d <= CAL_KM][:CAL_N]
        entry = {
            "lat": c["lat"], "lon": c["lon"], "country": c["country"], "staged": c["staged"],
            "direct": [{"id": sid, "source": s["source"], "km": round(d, 1), "elev": s["elev"], "name": s["name"]} for d, sid, s in direct[:3]],
            "calibrate": [{"id": sid, "source": s["source"], "km": round(d, 1), "elev": s["elev"], "name": s["name"]} for d, sid, s in cal],
        }
        plan[slug] = entry
        for d, sid, s in cal:
            fetch["st-" + sid.replace(":", "-")] = {"lat": s["lat"], "lon": s["lon"], "elev": s["elev"], "name": s["name"], "source": s["source"]}
    out = {
        "rules": {"directKm": DIRECT_KM, "calibrateKm": CAL_KM, "calibrateN": CAL_N},
        "cities": plan,
        "stationPoints": fetch,
    }
    (HERE / "data/station_plan.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    n = len(plan)
    nd = sum(1 for e in plan.values() if e["direct"])
    nc = sum(1 for e in plan.values() if not e["direct"] and e["calibrate"])
    print(f"{n} cities: {nd} with a station within {DIRECT_KM:.0f} km, {nc} calibrated from stations within {CAL_KM:.0f} km, "
          f"{n - nd - nc} without; {len(fetch)} station points for ERA5-Land")


if __name__ == "__main__":
    main()
