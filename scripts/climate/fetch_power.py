#!/usr/bin/env python3
"""
Last-resort climate source: NASA POWER (MERRA-2 based, 0.5° × 0.625°),
daily 1991-01-01 to 2020-12-31 at the destination's coordinates — used only
for a destination that ERA5-Land could not serve (no land cell within the
search radius, or a request that failed), never in place of it.

    python3 scripts/climate/fetch_power.py            # every destination without ERA5-Land data
    python3 scripts/climate/fetch_power.py male       # just these ids

Writes raw/power/<id>.json (the API's own response) and <id>.meta.json.
https://power.larc.nasa.gov/docs/services/api/temporal/daily/
No credentials needed.
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
RAW = HERE / "raw"
OUT = RAW / "power"
UA = {"User-Agent": "Sfrtna climate pipeline (https://sfrtna.com)"}
API = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMS = ["T2M_MAX", "T2M_MIN", "T2M", "PRECTOTCORR", "T2MDEW", "WS10M", "RH2M"]


def log(*a):
    msg = " ".join(str(x) for x in a)
    print(msg, flush=True)
    with open(HERE / "run.log", "a", encoding="utf-8") as f:
        f.write("[power] " + msg + "\n")


def needs_fallback(did: str) -> bool:
    meta = RAW / f"{did}.meta.json"
    csv = RAW / f"{did}.csv"
    return not (meta.exists() and meta.stat().st_size > 0 and csv.exists())


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    dests = json.loads((HERE / "destinations.json").read_text(encoding="utf-8"))["destinations"]
    ids = [a for a in sys.argv[1:] if not a.startswith("--")]
    todo = [d for d in dests if (d["id"] in ids if ids else needs_fallback(d["id"]))]
    for d in todo:
        lat, lon = d.get("latitude"), d.get("longitude")
        if lat is None:
            log(f"{d['id']}: no stored coordinate, skipped")
            continue
        q = {
            "parameters": ",".join(PARAMS),
            "community": "AG",
            "latitude": lat,
            "longitude": lon,
            "start": "19910101",
            "end": "20201231",
            "format": "JSON",
            "time-standard": "LST",
        }
        url = f"{API}?{urllib.parse.urlencode(q)}"
        for attempt in range(3):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=300) as r:
                    data = r.read()
                break
            except Exception as e:  # rate limits, timeouts
                log(f"{d['id']}: attempt {attempt + 1} failed: {e!r}")
                if attempt == 1 and "time-standard" in q:
                    q.pop("time-standard")  # older API versions reject it; daily then defaults to UTC
                    url = f"{API}?{urllib.parse.urlencode(q)}"
                time.sleep(15 * (attempt + 1))
        else:
            log(f"{d['id']}: NASA POWER unavailable — no climate data for this destination")
            continue
        (OUT / f"{d['id']}.json").write_bytes(data)
        meta = {
            "id": d["id"],
            "countryCode": d["countryCode"],
            "name": d["name"],
            "requestedLatitude": lat,
            "requestedLongitude": lon,
            "coordinateSource": d.get("coordinateSource"),
            "source": "NASA POWER (Prediction Of Worldwide Energy Resources), MERRA-2 based",
            "sourceUrl": "https://power.larc.nasa.gov",
            "request": url,
            "timeStandard": q.get("time-standard", "UTC"),
            "retrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
        (OUT / f"{d['id']}.meta.json").write_text(json.dumps(meta, indent=1, ensure_ascii=False), encoding="utf-8")
        log(f"{d['id']}: {len(data):,} bytes")
        time.sleep(2)


if __name__ == "__main__":
    main()
