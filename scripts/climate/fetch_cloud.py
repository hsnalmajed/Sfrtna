#!/usr/bin/env python3
"""
Monthly mean total cloud cover, 1991–2020, at every destination — the
"aesthetic" facet of the Holiday Climate Index (hci.py). ERA5-Land has no
cloud cover, so it comes from ERA5 (the same Copernicus reanalysis family,
0.25° grid), monthly averaged reanalysis:

  dataset  reanalysis-era5-single-levels-monthly-means
           https://cds.climate.copernicus.eu/datasets/reanalysis-era5-single-levels-monthly-means
  variable total_cloud_cover (fraction 0–1 → %)

    pip install "cdsapi>=0.7.2" xarray netCDF4
    python3 scripts/climate/fetch_cloud.py          → raw/cloud/era5_tcc_<decade>.nc, raw/cloud.json

Three global requests (one per decade), then each destination reads its
nearest grid cell. Credentials: cdsapi reads ~/.cdsapirc itself; this script
never reads, writes or stores the key. Resumable: a decade already
downloaded is not requested again.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"
OUT_DIR = RAW / "cloud"
DATASET = "reanalysis-era5-single-levels-monthly-means"
DATASET_URL = f"https://cds.climate.copernicus.eu/datasets/{DATASET}"
DECADES = [(1991, 2000), (2001, 2010), (2011, 2020)]


def log(*a):
    msg = " ".join(str(x) for x in a)
    print(msg, flush=True)
    with open(HERE / "run.log", "a", encoding="utf-8") as f:
        f.write("[cloud] " + msg + "\n")


def download():
    import cdsapi

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    c = cdsapi.Client()
    for a, b in DECADES:
        target = OUT_DIR / f"era5_tcc_{a}_{b}.nc"
        if target.exists() and target.stat().st_size > 1_000_000:
            log(f"{target.name}: already here")
            continue
        req = {
            "product_type": ["monthly_averaged_reanalysis"],
            "variable": ["total_cloud_cover"],
            "year": [str(y) for y in range(a, b + 1)],
            "month": [f"{m:02d}" for m in range(1, 13)],
            "time": ["00:00"],
            "data_format": "netcdf",
            "download_format": "unarchived",
        }
        log(f"requesting {a}–{b} …")
        c.retrieve(DATASET, req, str(target) + ".part")
        Path(str(target) + ".part").rename(target)
        log(f"{target.name}: {target.stat().st_size:,} bytes")


def sample():
    import xarray as xr

    dests = json.loads((HERE / "destinations.json").read_text(encoding="utf-8"))["destinations"]
    files = sorted(OUT_DIR.glob("era5_tcc_*.nc"))
    if len(files) != len(DECADES):
        sys.exit(f"expected {len(DECADES)} cloud files, found {len(files)} — run the download first")
    ds = xr.open_mfdataset([str(f) for f in files], combine="by_coords")
    tcc = ds["tcc"]
    tname = "valid_time" if "valid_time" in tcc.dims else "time"
    out = {}
    for d in dests:
        lat, lon = d.get("latitude"), d.get("longitude")
        if lat is None or lon is None:
            continue
        cell = tcc.sel(latitude=lat, longitude=lon % 360 if float(ds.longitude.max()) > 180 else lon, method="nearest")
        vals = cell.load()
        series = {}
        for t, v in zip(vals[tname].values, vals.values):
            ts = str(t)[:7]  # YYYY-MM
            series[ts] = round(float(v) * 100.0, 1)
        out[d["id"]] = {
            "usedLat": float(cell.latitude),
            "usedLon": float(cell.longitude),
            "monthlyPct": series,
        }
    (RAW / "cloud.json").write_text(
        json.dumps(
            {
                "source": "Copernicus Climate Change Service (C3S), ERA5 monthly averaged reanalysis on single levels",
                "dataset": DATASET,
                "datasetUrl": DATASET_URL,
                "variable": "total_cloud_cover",
                "period": "1991–2020",
                "retrievedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "destinations": out,
            }
        ),
        encoding="utf-8",
    )
    log(f"cloud cover for {len(out)} destinations → raw/cloud.json")


if __name__ == "__main__":
    if "--sample-only" not in sys.argv:
        download()
    sample()
