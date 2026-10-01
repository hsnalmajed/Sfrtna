#!/usr/bin/env python3
"""
ERA5-HEAT — Copernicus "Thermal comfort indices derived from ERA5
reanalysis" (derived-utci-historical, consolidated dataset, version 1.1):
hourly Universal Thermal Climate Index (UTCI), 0.25°, 1991–2020, for every
destination.

The CDS accepts at most one year per request, so the destinations are
grouped into small boxes (utci_boxes.json) and each request is one box ×
one year. As soon as a year arrives, the hourly UTCI at the grid cell
nearest each destination in the box is written to
raw/utci/<id>/<year>.csv (UTC time, °C, one decimal) and the download is
deleted, so the disk never holds more than one year's file per worker.

    python3 scripts/climate/fetch_utci.py --worker=0/6   # this worker's share; resumable

Run several workers at once (run_utci.bat starts six). Everything is
logged to run.log with the prefix [utci k]. Credentials: the same CDS
configuration as fetch_era5land.py; the dataset licence must be accepted
on its page.
"""
from __future__ import annotations

import json
import shutil
import sys
import tempfile
import time
import zipfile
from pathlib import Path

from fetch_era5land import credentials_file, log as base_log

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"
OUT = RAW / "utci"
DATASET = "derived-utci-historical"
YEARS = range(1991, 2021)


def main():
    import cdsapi
    import numpy as np
    import xarray as xr

    if sys.platform == "win32":
        # Keep Windows from going to sleep while this runs (ES_CONTINUOUS | ES_SYSTEM_REQUIRED);
        # released automatically when the process ends.
        import ctypes

        ctypes.windll.kernel32.SetThreadExecutionState(0x80000000 | 0x00000001)

    worker = next((a.split("=", 1)[1] for a in sys.argv if a.startswith("--worker=")), "0/1")
    k, n = (int(x) for x in worker.split("/"))
    log = lambda *a: base_log(f"[utci {k}]", *a)

    boxes = json.loads((HERE / "utci_boxes.json").read_text(encoding="utf-8"))["boxes"]
    jobs = [(b, y) for b in boxes for y in YEARS]
    jobs = [j for i, j in enumerate(jobs) if i % n == k]
    cfg = credentials_file()
    client = cdsapi.Client(url=cfg["url"], key=cfg["key"], quiet=True)
    days = [f"{d:02d}" for d in range(1, 32)]
    months = [f"{m:02d}" for m in range(1, 13)]

    for idx, (box, year) in enumerate(jobs, 1):
        members = box["members"]
        targets = [OUT / m["id"] / f"{year}.csv" for m in members]
        if all(t.exists() and t.stat().st_size > 0 for t in targets):
            continue
        log(f"({idx}/{len(jobs)}) {box['box']} {year} → {', '.join(m['id'] for m in members)}")
        req = {
            "variable": ["universal_thermal_climate_index"],
            "version": "1_1",
            "product_type": "consolidated_dataset",
            "year": [str(year)],
            "month": months,
            "day": days,
            "area": box["area"],
        }
        for attempt in range(4):
            tmp = Path(tempfile.mkdtemp(prefix=f"utci_{box['box']}_{year}_", dir=RAW))
            try:
                t0 = time.time()
                z = tmp / "download.zip"
                client.retrieve(DATASET, req).download(str(z))
                with zipfile.ZipFile(z) as zf:
                    zf.extractall(tmp)
                files = sorted(p for p in tmp.rglob("*.nc"))
                series = {m["id"]: ([], []) for m in members}
                cells = {}
                for fp in files:  # one file per day; opened one at a time (no dask needed)
                    with xr.open_dataset(fp) as ds:
                        var = [v for v in ds.data_vars][0]
                        lat_name = "latitude" if "latitude" in ds.dims else "lat"
                        lon_name = "longitude" if "longitude" in ds.dims else "lon"
                        time_name = "time" if "time" in ds.dims else "valid_time"
                        lon_max = float(ds[lon_name].max())
                        for m in members:
                            lon = m["longitude"] % 360 if lon_max > 180 else m["longitude"]
                            s_ = ds[var].sel({lat_name: m["latitude"], lon_name: lon}, method="nearest").load()
                            cells[m["id"]] = (float(s_[lat_name]), float(s_[lon_name]))
                            series[m["id"]][0].extend(s_[time_name].values.tolist() if s_[time_name].ndim else [s_[time_name].values])
                            series[m["id"]][1].extend((np.atleast_1d(s_.values) - 273.15).tolist())
                for m, target in zip(members, targets):
                    times, vals = series[m["id"]]
                    cell = cells[m["id"]]
                    target.parent.mkdir(parents=True, exist_ok=True)
                    with open(target, "w", encoding="utf-8") as f:
                        f.write(f"# ERA5-HEAT UTCI v1.1 consolidated, grid cell {cell[0]:.2f},{cell[1]:.2f}, degrees C\n")
                        f.write("time_utc,utci_c\n")
                        for t, v in zip(times, vals):
                            ts = np.datetime_as_string(np.datetime64(t, "ns"), unit="h")
                            f.write(f"{ts},{'' if v != v else f'{v:.1f}'}\n")
                log(f"   {box['box']} {year}: {len(files)} days in {round(time.time() - t0)} s")
                break
            except Exception as e:
                log(f"   {box['box']} {year}: attempt {attempt + 1} failed: {e!r}"[:500])
                time.sleep(60 * (attempt + 1))
            finally:
                shutil.rmtree(tmp, ignore_errors=True)
        else:
            log(f"   {box['box']} {year}: GAVE UP after 4 attempts — rerun later to fill it")
    log("worker done")


if __name__ == "__main__":
    main()
