#!/usr/bin/env python3
"""
Checks the arithmetic of build_normals.py on a small made-up hourly series
(test input only — never written anywhere the site reads).

    python3 scripts/climate/test_build_normals.py
"""
import tempfile
from pathlib import Path

import numpy as np
import pandas as pd

import build_normals as bn


def synthetic(path: Path, years=range(1991, 2021)):
    t = pd.date_range(f"{min(years)}-01-01", f"{max(years)}-12-31 23:00", freq="h", tz="UTC")
    hour_local = (t.hour + 3) % 24  # Asia/Riyadh, UTC+3, no DST
    # 10 °C at 03:00 local rising to 30 °C at 15:00 local: daily max 30, min 10, mean 20.
    temp_c = 20 - 10 * np.cos((hour_local - 3) / 24 * 2 * np.pi)
    df = pd.DataFrame(
        {
            "valid_time": t.strftime("%Y-%m-%d %H:%M:%S"),
            "t2m": temp_c + 273.15,
            "d2m": np.full(len(t), 5 + 273.15),
            # 2 mm in the hour ending 00:00 UTC (= 03:00 local) every day.
            "tp": np.where(t.hour == 0, 0.002, 0.0),
            "u10": np.full(len(t), 3.0),
            "v10": np.full(len(t), 4.0),
            "snowc": np.zeros(len(t)),
        }
    )
    df.to_csv(path, index=False)


def main():
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / "x.csv"
        synthetic(p)
        months = bn.normals_for(p, "Asia/Riyadh")
        jan = months[0]
        assert abs(jan["highC"] - 30) < 0.2, jan  # daily max, not the monthly mean
        assert abs(jan["lowC"] - 10) < 0.2, jan
        assert abs(jan["meanC"] - 20) < 0.2, jan
        assert jan["highC"] != jan["meanC"]
        assert abs(jan["precipMm"] - 62) <= 1, jan  # 2 mm × 31 days
        assert abs(jan["precipDays"] - 31) < 0.6, jan
        assert abs(jan["windMs"] - 5.0) < 0.05, jan  # √(3² + 4²)
        assert jan["yearsUsed"] == 30

        # Too few years: normals are null, not 0.
        p2 = Path(d) / "short.csv"
        synthetic(p2, years=range(1991, 2001))
        short = bn.normals_for(p2, "Asia/Riyadh", full_period=False)
        assert short[0]["highC"] is None and short[0]["precipMm"] is None, short[0]
    print("build_normals arithmetic: all checks passed")


if __name__ == "__main__":
    main()
