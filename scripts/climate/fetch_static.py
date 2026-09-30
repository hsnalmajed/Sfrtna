#!/usr/bin/env python3
"""
Static inputs for choosing each destination's grid cell well:

1. ERA5-Land orography (geopotential, m² s⁻²) and land-sea mask, 0.1°, the
   invariant fields ECMWF publishes with the ERA5-Land documentation
   (https://confluence.ecmwf.int/display/CKB/ERA5-Land:+data+documentation).
   Cell elevation = geopotential / 9.80665.
2. Each destination's own ground elevation from OpenTopoData
   (https://www.opentopodata.org), SRTM 90 m, with ASTER 30 m where SRTM has
   no data (north of 60°N).

    python3 scripts/climate/fetch_static.py

Writes raw/era5land_geopotential.nc, raw/era5land_lsm.nc, raw/elevations.json.
No credentials needed.
"""
from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"
UA = {"User-Agent": "Sfrtna climate pipeline (https://sfrtna.com)"}
FILES = {
    "era5land_geopotential.nc": "https://confluence.ecmwf.int/download/attachments/140385202/geo_1279l4_0.1x0.1.grib2_v4_unpack.nc?version=1&modificationDate=1591983422003&api=v2",
    "era5land_lsm.nc": "https://confluence.ecmwf.int/download/attachments/140385202/lsm_1279l4_0.1x0.1.grb_v4_unpack.nc?version=1&modificationDate=1591983422208&api=v2",
}
TOPO = "https://api.opentopodata.org/v1/srtm90m,aster30m"


def get(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
        return r.read()


def main():
    RAW.mkdir(exist_ok=True)
    for name, url in FILES.items():
        out = RAW / name
        if out.exists() and out.stat().st_size > 1_000_000:
            print(name, "already downloaded")
            continue
        data = get(url)
        out.write_bytes(data)
        print(name, f"{len(data):,} bytes")

    dests = json.loads((HERE / "destinations.json").read_text(encoding="utf-8"))["destinations"]
    points = []
    for d in dests:
        lat, lon = d.get("latitude"), d.get("longitude")
        if lat is None:  # QA places: coordinates from their download metadata
            mp = RAW / f"{d['id']}.meta.json"
            try:
                m = json.loads(mp.read_text(encoding="utf-8"))
                lat, lon = m["requestedLatitude"], m["requestedLongitude"]
            except Exception:
                continue
        points.append((d["id"], lat, lon))

    result = {
        "source": "OpenTopoData — SRTM 90 m, ASTER 30 m fallback",
        "sourceUrl": "https://www.opentopodata.org",
        "retrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "elevations": {},
    }
    for i in range(0, len(points), 100):
        chunk = points[i : i + 100]
        locs = "|".join(f"{lat},{lon}" for _, lat, lon in chunk)
        res = json.loads(get(f"{TOPO}?locations={urllib.parse.quote(locs, safe=',|')}"))
        for (pid, lat, lon), r in zip(chunk, res["results"]):
            result["elevations"][pid] = {"latitude": lat, "longitude": lon, "elevationM": r.get("elevation"), "dataset": r.get("dataset")}
        time.sleep(1.2)
    (RAW / "elevations.json").write_text(json.dumps(result, indent=1), encoding="utf-8")
    print(f"elevations for {len(result['elevations'])} places")


if __name__ == "__main__":
    main()
