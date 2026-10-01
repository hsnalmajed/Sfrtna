#!/usr/bin/env python3
"""
How big can one ERA5-HEAT (derived-utci-historical) request be? Tries, for
one small box (Riyadh): a whole year, then ten years. Writes
raw/utci_scale.json — whether each was accepted, how long it took and its
size — so the full download can be sized from facts, not guesses.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

from fetch_era5land import credentials_file, log

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"


def main():
    import cdsapi

    cfg = credentials_file()
    client = cdsapi.Client(url=cfg["url"], key=cfg["key"], quiet=True)
    days = [f"{d:02d}" for d in range(1, 32)]
    months = [f"{m:02d}" for m in range(1, 13)]
    out = {}
    for label, years in (("oneYear", ["2020"]), ("tenYears", [str(y) for y in range(2011, 2021)])):
        req = {
            "variable": ["universal_thermal_climate_index"],
            "version": "1_1",
            "product_type": "consolidated_dataset",
            "year": years,
            "month": months,
            "day": days,
            "area": [24.8, 46.6, 24.6, 46.8],
        }
        target = RAW / f"utci_scale_{label}.zip"
        t0 = time.time()
        try:
            client.retrieve("derived-utci-historical", req).download(str(target))
            out[label] = {"ok": True, "seconds": round(time.time() - t0), "bytes": target.stat().st_size}
        except Exception as e:
            out[label] = {"ok": False, "seconds": round(time.time() - t0), "error": repr(e)[:600]}
        log("[utci-scale]", label, json.dumps(out[label])[:300])
        (RAW / "utci_scale.json").write_text(json.dumps(out, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
