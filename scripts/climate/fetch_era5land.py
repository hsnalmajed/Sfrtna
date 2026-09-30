#!/usr/bin/env python3
"""
Download hourly ERA5-Land time series, 1991-01-01 to 2020-12-31, for every
destination in destinations.json — one point request per destination to the
Copernicus Climate Data Store dataset "reanalysis-era5-land-timeseries".

    pip install "cdsapi>=0.7.2" pandas
    python3 scripts/climate/fetch_era5land.py            # all destinations
    python3 scripts/climate/fetch_era5land.py riyadh     # just these ids
    python3 scripts/climate/fetch_era5land.py --probe    # one small request, to check access

Credentials: the CDS API key is read by cdsapi from ~/.cdsapirc (or the
CDSAPI_URL / CDSAPI_KEY environment variables). It is never read, written or
stored by this script, and must never be committed.

Output (raw/, git-ignored): <id>.csv (hourly, UTC) and <id>.meta.json with
the exact request, the grid point used and when it was retrieved.

Coasts and islands: ERA5-Land is a land-only model, so a grid cell over the
sea has no values. When the destination's own cell is empty, the nearest
cells are tried in rings of 0.1° (about 11 km) up to MAX_SEARCH_KM, nearest
first, and the first with data is used; the distance is recorded. Nothing
further away is ever used — a destination with no land cell nearby is left
for a station override (see README.md) rather than given another place's
climate.

Elevation: a cell whose average height is far from the town's (a valley town
whose 9 km cell reaches into the mountains) reads too cold. check_cells.py
compares heights and suggests a better neighbouring cell; the chosen ones go,
with the reason, in cell_overrides.json, and this script then downloads
exactly that cell instead of searching (refetching when the stored download
came from another cell).
"""
from __future__ import annotations

import io
import os
import json
import math
import sys
import time
import urllib.parse
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"
DATASET = "reanalysis-era5-land-timeseries"
DATASET_URL = "https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land-timeseries"
PERIOD = "1991-01-01/2020-12-31"
VARIABLES = [
    "2m_temperature",
    "2m_dewpoint_temperature",
    "total_precipitation",
    "10m_u_component_of_wind",
    "10m_v_component_of_wind",
    "snow_cover",
]
GRID = 0.1
MAX_SEARCH_KM = 25.0
USER_AGENT = "Sfrtna climate pipeline (https://sfrtna.com)"


def log(*args):
    """Print, and keep a copy in run.log next to this script."""
    msg = " ".join(str(a) for a in args)
    print(msg, flush=True)
    with open(Path(__file__).resolve().parent / "run.log", "a", encoding="utf-8") as f:
        f.write(msg + "\n")


def haversine_km(lat1, lon1, lat2, lon2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def snap(x):
    return round(round(x / GRID) * GRID, 2)


def geocode(query: str):
    """OpenStreetMap Nominatim, once per QA place (1 request/second policy)."""
    url = "https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(
        {"q": query, "format": "jsonv2", "limit": 1}
    )
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as r:
        res = json.load(r)
    time.sleep(1.1)
    if not res:
        raise RuntimeError(f"Nominatim found nothing for {query!r}")
    top = res[0]
    return float(top["lat"]), float(top["lon"]), {
        "query": query,
        "osm_type": top.get("osm_type"),
        "osm_id": top.get("osm_id"),
        "display_name": top.get("display_name"),
        "url": url,
    }


def candidates(lat, lon):
    """The destination's own cell, then neighbouring cells nearest first."""
    c0 = (snap(lat), snap(lon))
    seen = {c0}
    out = [c0]
    rings = int(math.ceil(MAX_SEARCH_KM / 11.0)) + 1
    for k in range(1, rings + 1):
        for i in range(-k, k + 1):
            for j in range(-k, k + 1):
                if max(abs(i), abs(j)) != k:
                    continue
                c = (round(c0[0] + i * GRID, 2), round(c0[1] + j * GRID, 2))
                if c not in seen and haversine_km(lat, lon, *c) <= MAX_SEARCH_KM:
                    seen.add(c)
                    out.append(c)
    out[1:] = sorted(out[1:], key=lambda c: haversine_km(lat, lon, *c))
    return out


def read_csv_payload(path: Path):
    """The service returns a CSV or a zip of CSVs; return one merged DataFrame."""
    import pandas as pd

    data = path.read_bytes()
    frames = []
    if data[:2] == b"PK":
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            for name in z.namelist():
                if name.endswith(".csv"):
                    frames.append(pd.read_csv(z.open(name)))
    else:
        frames.append(pd.read_csv(io.BytesIO(data)))
    if not frames:
        raise RuntimeError("no CSV in response")
    df = frames[0]
    for f in frames[1:]:
        keys = [c for c in ("valid_time", "latitude", "longitude") if c in df.columns and c in f.columns]
        df = df.merge(f, on=keys, how="outer", suffixes=("", "_dup"))
    return df


def has_land_data(df) -> bool:
    col = next((c for c in df.columns if c in ("t2m", "2m_temperature")), None)
    return col is not None and df[col].notna().mean() > 0.95


def retrieve(client, lat, lon, target: Path, date=PERIOD):
    req = {
        "variable": VARIABLES,
        "location": {"latitude": lat, "longitude": lon},
        "date": [date],
        "data_format": "csv",
    }
    client.retrieve(DATASET, req).download(str(target))
    return req


def cell_overrides() -> dict:
    p = HERE / "cell_overrides.json"
    if not p.exists():
        return {}
    return {
        k: v
        for k, v in json.loads(p.read_text(encoding="utf-8"))["overrides"].items()
        if "latitude" in v or "referenceGeocode" in v
    }


def fetch_one(client, d):
    RAW.mkdir(exist_ok=True)
    out_csv = RAW / f"{d['id']}.csv"
    out_meta = RAW / f"{d['id']}.meta.json"
    override = cell_overrides().get(d["id"])
    if out_csv.exists() and out_meta.exists() and out_meta.stat().st_size > 0:
        old = json.loads(out_meta.read_text(encoding="utf-8"))
        if override is None:
            same = True
        elif "latitude" in override:
            same = abs(old["usedLatitude"] - override["latitude"]) < 0.051 and abs(old["usedLongitude"] - override["longitude"]) < 0.051
        else:
            same = (old.get("reference") or {}).get("query") == override["referenceGeocode"]
        if same:
            log(f"  {d['id']}: already downloaded")
            return
    geo = None
    lat, lon = d.get("latitude"), d.get("longitude")
    if lat is None:
        old_meta = json.loads(out_meta.read_text(encoding="utf-8")) if out_meta.exists() and out_meta.stat().st_size > 0 else None
        if old_meta:  # geocoded before: keep the same point
            lat, lon, geo = old_meta["requestedLatitude"], old_meta["requestedLongitude"], old_meta.get("geocode")
        else:
            lat, lon, geo = geocode(d["geocode"])
    reference = None
    if override and "referenceGeocode" in override:
        # The destination is an island or region whose stored coordinate is its
        # interior; visitors stay in a named place, whose climate is used.
        lat, lon, reference = geocode(override["referenceGeocode"])
    tried = []
    cells = [(override["latitude"], override["longitude"])] if override and "latitude" in override else candidates(lat, lon)
    for (clat, clon) in cells:
        tmp = RAW / f"{d['id']}.{os.getpid()}.part"
        req = retrieve(client, clat, clon, tmp)
        df = read_csv_payload(tmp)
        tried.append({"latitude": clat, "longitude": clon, "hasData": bool(has_land_data(df))})
        if not has_land_data(df):
            tmp.unlink(missing_ok=True)
            continue
        df.to_csv(out_csv, index=False)
        tmp.unlink(missing_ok=True)
        used_lat = float(df["latitude"].iloc[0]) if "latitude" in df.columns else clat
        used_lon = float(df["longitude"].iloc[0]) if "longitude" in df.columns else clon
        dist = haversine_km(lat, lon, used_lat, used_lon)
        meta = {
            "id": d["id"],
            "countryCode": d["countryCode"],
            "name": d["name"],
            "requestedLatitude": lat,
            "requestedLongitude": lon,
            "coordinateSource": d.get("coordinateSource") or "OpenStreetMap Nominatim (geocoded by this script)",
            "geocode": geo,
            "usedLatitude": used_lat,
            "usedLongitude": used_lon,
            "distanceKm": round(dist, 2),
            "gridNote": "elevation-matched ERA5-Land cell (cell_overrides.json)" if override and "latitude" in override
            else ("reference place's own grid cell" if len(tried) == 1 else "nearest ERA5-Land land cell to the reference place") if reference
            else "destination's own grid cell" if len(tried) == 1 else "nearest ERA5-Land land cell",
            "reference": reference,
            "cellOverrideReason": override.get("reason") if override else None,
            "cellsTried": tried,
            "dataset": DATASET,
            "datasetUrl": DATASET_URL,
            "request": req,
            "retrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        }
        out_meta.write_text(json.dumps(meta, indent=1, ensure_ascii=False), encoding="utf-8")
        log(f"  {d['id']}: {len(df):,} hours from ({used_lat}, {used_lon}), {dist:.1f} km away")
        return
    (RAW / f"{d['id']}.nodata.json").write_text(json.dumps({"id": d["id"], "tried": tried}, indent=1), encoding="utf-8")
    log(f"  {d['id']}: NO LAND CELL within {MAX_SEARCH_KM} km — needs a station override")


def credentials_file() -> dict | None:
    """Read the CDS url and key from the user's own config file, tolerating
    what Notepad does (a .txt suffix, a byte-order mark). Logs only whether
    the file and its two entries exist — never their values."""
    import os

    if os.environ.get("CDSAPI_URL") and os.environ.get("CDSAPI_KEY"):
        log("credentials: from CDSAPI_URL / CDSAPI_KEY environment variables")
        return {"url": os.environ["CDSAPI_URL"], "key": os.environ["CDSAPI_KEY"]}
    home = Path.home()
    rc = Path(os.environ["CDSAPI_RC"]) if os.environ.get("CDSAPI_RC") else home / ".cdsapirc"
    if not rc.exists():
        for alt in (home / ".cdsapirc.txt", home / ".cdsapirc.txt.txt", HERE.parent.parent / ".cdsapirc"):
            if alt.exists():
                rc = alt
                break
    if not rc.exists():
        log(f"credentials: {rc} not found")
        return None
    text = rc.read_text(encoding="utf-8-sig", errors="replace").replace("\ufeff", "")
    cfg = {}
    for line in text.splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            cfg[k.strip().lower()] = v.strip()
    log(f"credentials: {rc} - has url: {bool(cfg.get('url'))}, has key: {bool(cfg.get('key'))}")
    return cfg if cfg.get("url") and cfg.get("key") else None


def main():
    import cdsapi

    cfg = credentials_file()
    if not cfg:
        log("credentials: missing - put url and key in %USERPROFILE%\\.cdsapirc")
        sys.exit(1)
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    client = cdsapi.Client(url=cfg["url"], key=cfg["key"], quiet=True)
    if "--probe" in sys.argv:
        tmp = HERE / "probe.csv"
        try:
            retrieve(client, 24.6, 46.7, tmp, date="2020-01-01/2020-01-02")
        except Exception as e:
            log("probe FAILED:", repr(e))
            sys.exit(1)
        df = read_csv_payload(tmp)
        log("probe OK — columns:", list(df.columns), "rows:", len(df))
        log(df.head(3).to_string())
        tmp.unlink(missing_ok=True)
        return
    dests = json.loads((HERE / "destinations.json").read_text(encoding="utf-8"))["destinations"]
    if args:
        dests = [d for d in dests if d["id"] in args]
    part = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--part=")), None)
    if part:  # --part=k/n: every n-th destination from k, for parallel runs
        k, n = (int(x) for x in part.split("/"))
        dests = [d for i, d in enumerate(dests) if i % n == k]
    if "--reverse" in sys.argv:
        dests = dests[::-1]
    for i, d in enumerate(dests, 1):
        log(f"[{i}/{len(dests)}] {d['id']}")
        for attempt in range(3):
            try:
                fetch_one(client, d)
                break
            except Exception as e:  # network hiccups, queue timeouts
                log(f"  error: {e!r}")
                time.sleep(20 * (attempt + 1))


if __name__ == "__main__":
    main()
