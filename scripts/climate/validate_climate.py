#!/usr/bin/env python3
"""
How accurate are the published figures? Measured, not assumed.

    python3 scripts/climate/validate_climate.py   → scripts/climate/reports/accuracy.md (+ exit 1 below target)

Cities with an official station of their own publish the station's figures,
so their accuracy is the station's. The question is the cities without one,
whose ERA5-Land figures are corrected from stations around them. That method
is tested on the cities that DO have a station: each is treated as if its
own station did not exist (every station within 10 km of it is left out),
its figures are rebuilt the calibrated way from the other stations, and the
result is compared with its real station. Target (owner, 13 Oct 2026): at
least 90 % of city-months within ±2 °C for the average high and the average
low.
"""
from __future__ import annotations

import json
import statistics as st
import sys
from pathlib import Path

from merge_sources import CAL_KM, haversine_km, load_station_pool, station_months, calibration

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
TARGET_SHARE = 0.90
TOL_C = 2.0
EXCLUDE_KM = 10.0


def main():
    era5 = json.loads((ROOT / "src/data/climate/era5land.json").read_text(encoding="utf-8"))
    normals = json.loads((ROOT / "src/data/climate/normals.json").read_text(encoding="utf-8"))["destinations"]
    elev_path = HERE / "raw" / "elevations.json"
    elev = json.loads(elev_path.read_text(encoding="utf-8"))["elevations"] if elev_path.exists() else {}
    pool = load_station_pool()

    raw_err = {"high": [], "low": []}
    cal_err = {"high": [], "low": []}
    rows = []
    for did, rec in normals.items():
        st_info = rec.get("station") or {}
        if "Tmax" not in (st_info.get("parameters") or []):
            continue
        base = era5["destinations"].get(did)
        if not base:
            continue
        own = pool.get(st_info["id"])
        if not own:
            continue
        truth_hi, truth_lo = station_months(own, "TMAX"), station_months(own, "TMIN")
        # The city without its own station(s).
        hidden = {sid: s for sid, s in pool.items() if haversine_km(own["lat"], own["lon"], s["lat"], s["lon"]) > EXCLUDE_KM}
        town = (elev.get(did) or {}).get("elevationM")
        calib = calibration(did, {"latitude": base["latitude"], "longitude": base["longitude"]}, hidden, era5, town)
        e_hi = [m["highC"] for m in base["months"]]
        e_lo = [m["lowC"] for m in base["months"]]
        if any(v is None for v in e_hi + e_lo):
            continue
        for m in range(12):
            raw_err["high"].append(e_hi[m] - truth_hi[m])
            raw_err["low"].append(e_lo[m] - truth_lo[m])
        if calib:
            c_hi = [e_hi[m] + calib["highOffsetC"][m] for m in range(12)]
            c_lo = [e_lo[m] + calib["lowOffsetC"][m] for m in range(12)]
            for m in range(12):
                cal_err["high"].append(c_hi[m] - truth_hi[m])
                cal_err["low"].append(c_lo[m] - truth_lo[m])
            rows.append((did, round(st.mean(abs(c_hi[m] - truth_hi[m]) for m in range(12)), 2), round(st.mean(abs(e_hi[m] - truth_hi[m]) for m in range(12)), 2)))

    def summary(errs):
        if not errs:
            return "—", 0.0
        share = sum(abs(e) <= TOL_C for e in errs) / len(errs)
        return f"MAE {st.mean(abs(e) for e in errs):.2f} °C, within ±{TOL_C:g} °C: {share:.0%} ({len(errs) // 12} cities)", share

    lines = ["# Accuracy of the climate figures", "",
             f"Method: leave-own-station-out. Stations within {EXCLUDE_KM:g} km of each tested city are hidden; its figures are rebuilt from "
             f"stations within {CAL_KM:g} km and compared with its real station. Target: {TARGET_SHARE:.0%} of city-months within ±{TOL_C:g} °C.", ""]
    ok = True
    for k in ("high", "low"):
        rtxt, _ = summary(raw_err[k])
        ctxt, share = summary(cal_err[k])
        lines += [f"- Average {k}: ERA5-Land as it is — {rtxt}", f"- Average {k}: station-calibrated — {ctxt}"]
        ok = ok and share >= TARGET_SHARE
    lines += ["", "| City | Calibrated MAE (high) | Raw MAE (high) |", "|---|---|---|"]
    lines += [f"| {d} | {a} | {b} |" for d, a, b in sorted(rows, key=lambda r: -r[1])]
    out = HERE / "reports" / "accuracy.md"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines[:8]))
    print("TARGET MET" if ok else "BELOW TARGET")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
