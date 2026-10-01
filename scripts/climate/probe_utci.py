#!/usr/bin/env python3
"""
Can ERA5-HEAT (Copernicus "Thermal comfort indices derived from ERA5
reanalysis", derived-utci-historical) be fetched per destination for
1991–2020? One small request for one day at one point decides how — with an
area, or only as global files — and how long it takes. Writes
raw/utci_probe.json; nothing else.

    python3 scripts/climate/probe_utci.py
"""
from __future__ import annotations

import json
import time
import zipfile
from pathlib import Path

from fetch_era5land import credentials_file, log

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"
DATASET = "derived-utci-historical"


def attempt(client, req, target):
    t0 = time.time()
    try:
        client.retrieve(DATASET, req).download(str(target))
        size = target.stat().st_size
        names = []
        if zipfile.is_zipfile(target):
            with zipfile.ZipFile(target) as z:
                names = z.namelist()
        return {"ok": True, "seconds": round(time.time() - t0), "bytes": size, "files": names, "request": req}
    except Exception as e:
        return {"ok": False, "seconds": round(time.time() - t0), "error": repr(e)[:800], "request": req}


def main():
    import cdsapi

    cfg = credentials_file()
    client = cdsapi.Client(url=cfg["url"], key=cfg["key"], quiet=True)
    base = {
        "variable": ["universal_thermal_climate_index"],
        "version": "1_1",
        "product_type": "consolidated_dataset",
        "year": ["2020"],
        "month": ["07"],
        "day": ["15"],
    }
    out = {}
    out["withArea"] = attempt(client, {**base, "area": [24.8, 46.6, 24.6, 46.8]}, RAW / "utci_probe_area.zip")
    log("[utci] with area:", json.dumps(out["withArea"])[:400])
    if not out["withArea"]["ok"]:
        out["global"] = attempt(client, base, RAW / "utci_probe_global.zip")
        log("[utci] global:", json.dumps(out["global"])[:400])
    (RAW / "utci_probe.json").write_text(json.dumps(out, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
