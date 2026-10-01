#!/usr/bin/env python3
"""
Official 1991–2020 station normals — the first-priority climate source.

WMO Climatological Standard Normals 1991–2020, as submitted by each country's
national meteorological service and published by NOAA NCEI (accession
0253808, https://www.ncei.noaa.gov/products/wmo-climate-normals). The
"composite primary parameters, min24" files hold, for every station, normals
computed from at least 24 of the 30 years (the WMO completeness rule):

    TMAX  mean daily maximum temperature, °C
    TMIN  mean daily minimum temperature, °C
    TAVG  mean temperature, °C
    PRCP  precipitation total, mm
    DP01  days with precipitation ≥ 1 mm
    MNVP  mean vapour pressure, hPa
    MSLP, TSUN (not used)

    python3 scripts/climate/fetch_wmo_normals.py      → raw/wmo/*.csv + raw/wmo/source.json

No credentials needed. The script finds the newest archive version by
reading the archive's own directory listing, so no version number is typed
by hand; every URL it read is recorded in source.json.
"""
from __future__ import annotations

import json
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "raw" / "wmo"
UA = {"User-Agent": "Sfrtna climate pipeline (https://sfrtna.com)"}
ARCHIVE = "https://www.ncei.noaa.gov/data/oceans/archive/arc0216/0253808/"
ELEMENTS = ["TMAX", "TMIN", "TAVG", "PRCP", "DP01", "MNVP"]
DIRS = ["data_composite_primary_parameters_min24", "data-composite-primary-parameters-min24"]


def log(*a):
    msg = " ".join(str(x) for x in a)
    print(msg, flush=True)
    with open(HERE / "run.log", "a", encoding="utf-8") as f:
        f.write("[wmo] " + msg + "\n")


def get(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r:
        return r.read()


def links(url: str) -> list[str]:
    html = get(url).decode("utf-8", "replace")
    return re.findall(r'href="([^"?#]+)"', html)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    versions = sorted(
        {l.strip("/") for l in links(ARCHIVE) if re.fullmatch(r"\d+(\.\d+)*/?", l.strip("/") + "/")},
        key=lambda v: [int(x) for x in v.split(".")],
    )
    if not versions:
        raise SystemExit(f"no versions listed at {ARCHIVE}")
    version = versions[-1]
    base = f"{ARCHIVE}{version}/data/0-data/"
    names = [l.strip("/") for l in links(base)]
    folder = next((d for d in DIRS if d in names), None)
    if not folder:
        raise SystemExit(f"no composite min24 folder in {base}: {names}")
    src = {
        "source": "WMO Climatological Standard Normals 1991–2020 (national meteorological services), NOAA NCEI accession 0253808",
        "sourceUrl": "https://www.ncei.noaa.gov/products/wmo-climate-normals",
        "archiveVersion": version,
        "folder": f"{base}{folder}/",
        "retrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "files": {},
    }
    listing = [l.rsplit("/", 1)[-1] for l in links(f"{base}{folder}/")]
    log(f"listing of {folder}: {listing}")
    for el in ELEMENTS:
        # e.g. wmo_normals_9120_TMAX.csv (the readme's name); tolerate prefixes/suffixes.
        fname = next((l for l in listing if l.lower().endswith(".csv") and re.search(rf"(^|[_-]){el.lower()}([_.-])", l.lower())), None)
        if not fname:
            log(f"{el}: not in {folder}")
            continue
        url = f"{base}{folder}/{fname}"
        data = get(url)
        (OUT / f"{el}.csv").write_bytes(data)
        src["files"][el] = {"url": url, "bytes": len(data)}
        log(f"{el}: {len(data):,} bytes from {url}")
    (OUT / "source.json").write_text(json.dumps(src, indent=1), encoding="utf-8")
    log("WMO normals done")


if __name__ == "__main__":
    main()
