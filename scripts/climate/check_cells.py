#!/usr/bin/env python3
"""
Is each destination's ERA5-Land cell at the right height?

ERA5-Land cells are ~9 km across, so a cell's average ground height can be far
from the town's own: a valley town's cell can reach up into the mountains and
read several degrees too cold. For every downloaded destination this compares

  - the town's ground elevation (OpenTopoData, raw/elevations.json), and
  - the ERA5-Land elevation of the cell used and of its land neighbours
    within NEIGHBOUR_KM (orography = geopotential / g, land-sea mask ≥ 0.5,
    raw/era5land_*.nc),

and recommends re-fetching from the neighbour whose height is closest to the
town's when that is a real improvement. Nothing is adjusted: temperatures are
never shifted by a lapse rate; the choice is only which real cell to use.

    pip install xarray netCDF4
    python3 scripts/climate/check_cells.py      → raw/cell_check.json
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
import xarray as xr

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw"
G = 9.80665
NEIGHBOUR_KM = 15.0
MISMATCH_M = 200.0  # own cell this far off → look for a better one
MIN_GAIN_M = 150.0  # …and switch only if the neighbour is this much closer


def haversine_km(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    a = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(a))


def open_field(name):
    ds = xr.open_dataset(RAW / name)
    var = [v for v in ds.data_vars][0]
    da = ds[var]
    if "time" in da.dims:
        da = da.isel(time=0)
    if "valid_time" in da.dims:
        da = da.isel(valid_time=0)
    return da


def main():
    z = open_field("era5land_geopotential.nc")
    lsm = open_field("era5land_lsm.nc")
    lat_name = "latitude" if "latitude" in z.dims else "lat"
    lon_name = "longitude" if "longitude" in z.dims else "lon"
    lon_max = float(z[lon_name].max())

    def cell(lat, lon):
        lon360 = lon % 360 if lon_max > 180 else lon
        sel = {lat_name: lat, lon_name: lon360}
        zz = float(z.sel(sel, method="nearest"))
        ll = float(lsm.sel(sel, method="nearest"))
        return zz / G, ll

    elev = json.loads((RAW / "elevations.json").read_text(encoding="utf-8"))
    out = {"method": __doc__.strip().split("\n\n")[1], "destinations": {}}
    for mp in sorted(RAW.glob("*.meta.json")):
        try:
            meta = json.loads(mp.read_text(encoding="utf-8"))
        except ValueError:
            continue
        did = meta["id"]
        town = elev["elevations"].get(did, {}).get("elevationM")
        rlat, rlon = meta["requestedLatitude"], meta["requestedLongitude"]
        ulat, ulon = round(meta["usedLatitude"], 2), round(meta["usedLongitude"], 2)
        used_elev, used_lsm = cell(ulat, ulon)
        rec = {
            "townElevationM": town,
            "usedCell": [ulat, ulon],
            "usedCellElevationM": round(used_elev),
            "usedCellLandFraction": round(used_lsm, 2),
            "differenceM": None if town is None else round(used_elev - town),
            "recommendation": "keep",
        }
        if town is not None and abs(used_elev - town) > MISMATCH_M:
            best = None
            for i in range(-2, 3):
                for j in range(-2, 3):
                    clat, clon = round(round(rlat, 1) + i * 0.1, 2), round(round(rlon, 1) + j * 0.1, 2)
                    d = haversine_km(rlat, rlon, clat, clon)
                    if d > NEIGHBOUR_KM:
                        continue
                    ce, cl = cell(clat, clon)
                    if cl < 0.5:
                        continue
                    if best is None or abs(ce - town) < abs(best[2] - town):
                        best = (clat, clon, ce, d)
            if best and abs(used_elev - town) - abs(best[2] - town) >= MIN_GAIN_M:
                rec["recommendation"] = "refetch"
                rec["betterCell"] = {"latitude": best[0], "longitude": best[1], "elevationM": round(best[2]), "distanceKm": round(best[3], 1)}
            else:
                rec["recommendation"] = "review"
                if best:
                    rec["bestNeighbour"] = {"latitude": best[0], "longitude": best[1], "elevationM": round(best[2]), "distanceKm": round(best[3], 1)}
        out["destinations"][did] = rec
        print(f"{did:18} town {town!s:>6} m  cell {used_elev:7.0f} m  Δ {rec['differenceM']!s:>6}  {rec['recommendation']}"
              + (f" → {rec['betterCell']}" if rec["recommendation"] == "refetch" else ""))
    (RAW / "cell_check.json").write_text(json.dumps(out, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
