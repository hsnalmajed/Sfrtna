#!/usr/bin/env python3
"""
Every station of the WMO 1991–2020 normals (raw/wmo/*.csv, from
fetch_wmo_normals.py) in one compact file the repository can keep:

    python3 scripts/climate/compact_wmo.py   → scripts/climate/data/wmo_normals.json

{ "source": {...source.json}, "stations": { id: {name, country, lat, lon,
elev, TMAX: [12] | null, TMIN, TAVG, PRCP, DP01, MNVP} } }

A parameter is kept only when all twelve months are present (the same rule
merge_sources.py applies). The raw CSVs stay git-ignored; this file lets the
station matching, the bias check and their validation run anywhere.
"""
from __future__ import annotations

import json
from pathlib import Path

from merge_sources import load_wmo, months_of

HERE = Path(__file__).resolve().parent
OUT = HERE / "data" / "wmo_normals.json"


def main():
    src, tables, stations = load_wmo()
    out = {}
    for sid, s in stations.items():
        rec = {
            "name": s["name"],
            "country": s["country"],
            "wmoId": s["wmoId"],
            "lat": round(s["latitude"], 4),
            "lon": round(s["longitude"], 4),
            "elev": s["elevationM"],
        }
        any_param = False
        for el, rows in tables.items():
            vals = months_of(rows.get(sid))
            rec[el] = [round(v, 1) for v in vals] if vals else None
            any_param = any_param or bool(vals)
        if any_param:
            out[sid] = rec
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"source": src, "stations": out}, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    print(f"{len(out)} stations → {OUT} ({OUT.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
