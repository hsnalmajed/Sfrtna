#!/usr/bin/env python3
"""
One set of 1991–2020 monthly normals per destination, each figure from the
best source that has it:

  1. Official station normals — WMO Climatological Standard Normals
     1991–2020 submitted by the national meteorological service (NOAA NCEI
     accession 0253808, ≥ 24 years of data), from a station that represents
     the destination: within MAX_STATION_KM and MAX_STATION_ELEV_DIFF_M of
     its height. Used parameter by parameter, and only when the station has
     all twelve months of that parameter.
  2. Copernicus ERA5-Land 1991–2020 at the destination's coordinates
     (src/data/climate/era5land.json, from build_normals.py) — everything
     the station does not give (wind, snow cover, missing parameters).
  3. NASA POWER 1991–2020 (raw/power/, from fetch_power.py) — only for a
     destination ERA5-Land could not serve.

Each destination records which source gave each parameter, and the station
used (name, WMO id, distance, height), in `parameterSources` and `station`.

    python3 scripts/climate/merge_sources.py   → src/data/climate/normals.json, reports/stations.md

Conversions (stated, standard):
  - dew point from mean vapour pressure e (hPa): Td = b·ln(e/6.112) / (a − ln(e/6.112)),
    a = 17.62, b = 243.12 (WMO-No. 8, Annex 4.B);
  - relative humidity from e and the mean temperature: RH = 100·e / es(Tmean);
  - mean temperature, when the station gives none: (Tmax + Tmin) / 2.
"""
from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
RAW = HERE / "raw"
ERA5 = ROOT / "src/data/climate/era5land.json"
OUT = ROOT / "src/data/climate/normals.json"
REPORT = HERE / "reports" / "stations.md"

MAX_STATION_KM = 25.0
MAX_STATION_ELEV_DIFF_M = 150.0
# Without a known town height (a reference place), only a station this close.
MAX_STATION_KM_NO_ELEV = 15.0
MISSING = -99.9
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
A, B = 17.62, 243.12


def haversine_km(lat1, lon1, lat2, lon2):
    p1, p2 = math.radians(lat1), math.radians(lat2)
    x = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(x))


def es(t):
    return 6.112 * math.exp(A * t / (B + t))


def dew_from_vp(e):
    g = math.log(e / 6.112)
    return B * g / (A - g)


def load_wmo():
    src = json.loads((RAW / "wmo" / "source.json").read_text(encoding="utf-8"))
    tables = {}
    for el in ["TMAX", "TMIN", "TAVG", "PRCP", "DP01", "MNVP"]:
        p = RAW / "wmo" / f"{el}.csv"
        if not p.exists():
            continue
        df = pd.read_csv(p, skipinitialspace=True, dtype={"ID": str})
        df.columns = [c.strip() for c in df.columns]
        for c in ["ID", "WIGOS_ID", "Country", "Station"]:
            df[c] = df[c].astype(str).str.strip()
        tables[el] = {r["ID"]: r for _, r in df.iterrows()}
    stations = {}
    for el, rows in tables.items():
        for sid, r in rows.items():
            stations.setdefault(sid, {
                "id": sid,
                "wmoId": sid[-5:] if sid.startswith("000") else sid,
                "wigosId": None if pd.isna(r["WIGOS_ID"]) or r["WIGOS_ID"] in ("", "nan") else r["WIGOS_ID"],
                "name": r["Station"],
                "country": r["Country"].replace("_", " "),
                "latitude": float(r["Latitude"]),
                "longitude": float(r["Longitude"]),
                "elevationM": float(r["Elevation"]),
            })
    return src, tables, stations


def load_station_pool():
    """Every official station with 1991–2020 normals, from the compact files
    the repository keeps (data/wmo_normals.json from compact_wmo.py,
    data/ghcn_normals.json from fetch_ghcn.py). WMO first: a GHCN station
    that is also a WMO normals station is left out."""
    wmo = json.loads((HERE / "data" / "wmo_normals.json").read_text(encoding="utf-8"))
    pool = {}
    for sid, s in wmo["stations"].items():
        pool[sid] = {**s, "kind": "wmo", "sourceText": wmo["source"]["source"], "url": wmo["source"]["sourceUrl"],
                     "files": wmo["source"].get("folder"), "retrievedAt": wmo["source"]["retrievedAt"]}
    gp = HERE / "data" / "ghcn_normals.json"
    if gp.exists():
        g = json.loads(gp.read_text(encoding="utf-8"))
        wmo_ids = {s.get("wmoId") for s in wmo["stations"].values()}
        for sid, s in g["stations"].items():
            if s.get("wmoId") and s["wmoId"] in wmo_ids:
                continue
            pool[f"ghcn:{sid}"] = {**s, "country": "", "kind": "ghcn", "sourceText": g["source"], "url": g["sourceUrl"],
                                   "files": None, "retrievedAt": g["retrievedAt"]}
    return pool


def months_of(row):
    if row is None:
        return None
    vals = [float(row[m]) for m in MONTHS]
    return None if any(v <= MISSING + 0.01 for v in vals) else vals


def power_normals(did):
    p = RAW / "power" / f"{did}.json"
    if not p.exists():
        return None, None
    data = json.loads(p.read_text(encoding="utf-8"))
    meta = json.loads((RAW / "power" / f"{did}.meta.json").read_text(encoding="utf-8"))
    fill = data["header"].get("fill_value", -999.0)
    par = data["properties"]["parameter"]
    df = pd.DataFrame({k: pd.Series(v) for k, v in par.items()})
    df.index = pd.to_datetime(df.index, format="%Y%m%d")
    df = df.mask(df == fill)
    out = []
    for mo in range(1, 13):
        sub = df[df.index.month == mo]
        yrs = sub.groupby(sub.index.year)
        complete = yrs.apply(lambda x: x["T2M_MAX"].notna().mean() >= 0.9)
        good = complete[complete].index
        sub = sub[sub.index.year.isin(good)]
        if len(good) < 24:
            out.append({k: None for k in ["highC", "lowC", "meanC", "precipMm", "precipDays", "dewPointC", "relativeHumidity", "windMs", "snowCoverPct"]})
            continue
        by = sub.groupby(sub.index.year)
        r1 = lambda x: None if pd.isna(x) else round(float(x), 1)
        out.append({
            "highC": r1(sub["T2M_MAX"].mean()),
            "lowC": r1(sub["T2M_MIN"].mean()),
            "meanC": r1(sub["T2M"].mean()),
            "precipMm": round(float(by["PRECTOTCORR"].sum().mean())),
            "precipDays": r1(by["PRECTOTCORR"].apply(lambda x: (x >= 1.0).sum()).mean()),
            "dewPointC": r1(sub["T2MDEW"].mean()),
            "relativeHumidity": round(float(sub["RH2M"].mean())),
            "windMs": r1(sub["WS10M"].mean()),
            "snowCoverPct": None,
            "yearsUsed": int(len(good)),
        })
    prov = {
        "kind": "nasa-power",
        "source": meta["source"],
        "dataset": "NASA POWER daily point data (MERRA-2), API " + data["header"]["api"]["version"],
        "datasetUrl": meta["sourceUrl"],
        "period": "1991–2020",
        "usedLat": data["geometry"]["coordinates"][1],
        "usedLon": data["geometry"]["coordinates"][0],
        "distanceKm": 0.0,
        "gridNote": "NASA POWER grid cell at the destination's coordinates (fallback: no ERA5-Land land cell)",
        "timezone": "local solar time (" + meta["timeStandard"] + ")",
        "retrievedAt": meta["retrievedAt"],
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "pipelineVersion": "1.0",
    }
    return out, prov


CAL_KM = 150.0
CAL_N = 3
CAL_MAX_ELEV_DIFF_M = 300.0
PARAMS = ["highC", "lowC", "meanC", "precipMm", "precipDays", "dewPointC", "relativeHumidity", "windMs", "snowCoverPct"]


def station_months(s, el):
    v = s.get(el)
    return v if v and len(v) == 12 and all(x is not None for x in v) else None


def calibration(did, rec, pool, era5, town):
    """Month-by-month correction of ERA5-Land highs and lows from the official
    stations around a city that has none of its own: for each station within
    CAL_KM (and within CAL_MAX_ELEV_DIFF_M of the town's height when known)
    whose position ERA5-Land was also downloaded at, the difference station −
    ERA5-Land, weighted by inverse distance. Returns None when no station
    qualifies."""
    lat, lon = rec["latitude"], rec["longitude"]
    near = []
    for sid, s in pool.items():
        if not (station_months(s, "TMAX") and station_months(s, "TMIN")):
            continue
        d = haversine_km(lat, lon, s["lat"], s["lon"])
        if d > CAL_KM:
            continue
        if town is not None and abs(s["elev"] - town) > CAL_MAX_ELEV_DIFF_M:
            continue
        point = era5["destinations"].get("st-" + sid.replace(":", "-"))
        if not point or any(m["highC"] is None or m["lowC"] is None for m in point["months"]):
            continue
        near.append((d, sid, s, point))
    near.sort(key=lambda x: x[0])
    near = near[:CAL_N]
    if not near:
        return None
    w = [1.0 / max(d, 5.0) for d, *_ in near]
    tw = sum(w)
    off_hi = [round(sum(wi * (station_months(s, "TMAX")[m] - pt["months"][m]["highC"]) for wi, (d, sid, s, pt) in zip(w, near)) / tw, 2) for m in range(12)]
    off_lo = [round(sum(wi * (station_months(s, "TMIN")[m] - pt["months"][m]["lowC"]) for wi, (d, sid, s, pt) in zip(w, near)) / tw, 2) for m in range(12)]
    return {
        "highOffsetC": off_hi,
        "lowOffsetC": off_lo,
        "stations": [{"id": sid, "name": s["name"], "kind": s["kind"], "km": round(d, 1), "elevationM": s["elev"]} for d, sid, s, _ in near],
        "method": f"ERA5-Land corrected by the inverse-distance-weighted difference (official station − ERA5-Land at the station) of up to {CAL_N} stations within {CAL_KM:g} km"
        + (f" and {CAL_MAX_ELEV_DIFF_M:g} m of the town's height" if town is not None else ""),
    }


def main():
    era5 = json.loads(ERA5.read_text(encoding="utf-8"))
    dests = json.loads((HERE / "destinations.json").read_text(encoding="utf-8"))["destinations"]
    elev_path = RAW / "elevations.json"
    elev = json.loads(elev_path.read_text(encoding="utf-8"))["elevations"] if elev_path.exists() else {}
    overrides = json.loads((HERE / "cell_overrides.json").read_text(encoding="utf-8"))["overrides"]
    pool = load_station_pool()
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    wmo_meta = json.loads((HERE / "data" / "wmo_normals.json").read_text(encoding="utf-8"))["source"]

    out = {
        "meta": {
            **era5["meta"],
            "sources": [
                {"priority": 1, "source": wmo_meta["source"], "url": wmo_meta["sourceUrl"], "retrievedAt": wmo_meta["retrievedAt"]},
                {"priority": 2, "source": "NOAA NCEI GHCN-Daily station records, 1991–2020 normals computed with WMO-No. 1203 rules", "url": "https://www.ncei.noaa.gov/products/land-based-station/global-historical-climatology-network-daily"},
                {"priority": 3, "source": era5["meta"]["source"] + " — corrected by nearby official stations where the city has none", "url": era5["meta"]["datasetUrl"]},
                {"priority": 4, "source": "NASA POWER (MERRA-2), daily point API", "url": "https://power.larc.nasa.gov"},
            ],
            "stationRule": f"Official station (WMO normals first, then GHCN-Daily) within {MAX_STATION_KM:g} km and {MAX_STATION_ELEV_DIFF_M:g} m of the destination's ground height "
            f"({MAX_STATION_KM_NO_ELEV:g} km when that height is unknown); a parameter is taken from the station only when all 12 months are present. "
            f"Otherwise ERA5-Land highs and lows are corrected by up to {CAL_N} stations within {CAL_KM:g} km.",
            "mergedAt": now,
        },
        "destinations": {},
        "missing": [],
    }
    report = ["# Station normals used", "", f"Rule: {out['meta']['stationRule']}", "",
              "| Destination | Station | Source | Distance | Height station / town | Parameters from station | ERA5-Land − station, mean high °C |",
              "|---|---|---|---|---|---|---|"]
    calib_report = ["", "# Cities calibrated from nearby stations", "", "| Destination | Stations | Mean high correction °C |", "|---|---|---|"]

    for d in dests:
        did = d["id"]
        if d.get("station"):
            continue  # a calibration point, not a destination
        base = era5["destinations"].get(did)
        if base is None:
            pm, pprov = power_normals(did)
            if pm is None:
                out["missing"].append({"id": did, "why": "no ERA5-Land land cell and no NASA POWER data"})
                continue
            base = {
                "countryCode": d["countryCode"],
                "latitude": d["latitude"],
                "longitude": d["longitude"],
                "coordinateSource": d.get("coordinateSource"),
                "months": pm,
                "provenance": pprov,
            }
        rec = json.loads(json.dumps(base))
        months = rec["months"]
        base_kind = rec["provenance"]["kind"]
        sources = {k: base_kind for k in PARAMS}
        era_high = [m["highC"] for m in months]
        era_low = [m["lowC"] for m in months]
        era_dew = [m["dewPointC"] for m in months]

        lat, lon = rec["latitude"], rec["longitude"]
        is_reference = bool(rec.get("reference"))
        town = None if is_reference else (elev.get(did) or {}).get("elevationM")
        accepted = bool(overrides.get(did, {}).get("accept"))
        best = None
        for sid, s in pool.items():
            dist = haversine_km(lat, lon, s["lat"], s["lon"])
            if dist > MAX_STATION_KM:
                continue
            s_elev_ok = s["elev"] > -450  # below the Dead Sea is a typo in the station list
            if town is None or accepted or not s_elev_ok:
                if dist > MAX_STATION_KM_NO_ELEV:
                    continue
                dz = None
            else:
                dz = s["elev"] - town
                if abs(dz) > MAX_STATION_ELEV_DIFF_M:
                    continue
            tmax, tmin, prcp = station_months(s, "TMAX"), station_months(s, "TMIN"), station_months(s, "PRCP")
            if not (tmax and tmin) and not prcp:
                continue
            key = (0 if tmax and tmin else 1, 0 if s["kind"] == "wmo" else 1, dist)
            if best is None or key < best[0]:
                best = (key, sid, s, dist, dz)

        station_info = None
        if best:
            _, sid, s, dist, dz = best
            g = lambda el: station_months(s, el)
            tmax, tmin, tavg, prcp, dp01, mnvp = g("TMAX"), g("TMIN"), g("TAVG"), g("PRCP"), g("DP01"), g("MNVP")
            used = []
            if tmax and tmin:
                for i, m in enumerate(months):
                    m["highC"], m["lowC"] = tmax[i], tmin[i]
                    m["meanC"] = tavg[i] if tavg else round((tmax[i] + tmin[i]) / 2, 1)
                sources.update(highC="station", lowC="station", meanC="station" if tavg else "station (Tmax+Tmin)/2")
                used += ["Tmax", "Tmin", "Tmean" if tavg else "Tmean=(Tmax+Tmin)/2"]
            if prcp:
                for i, m in enumerate(months):
                    m["precipMm"] = round(prcp[i])
                sources["precipMm"] = "station"
                used.append("rain mm")
                if dp01:
                    for i, m in enumerate(months):
                        m["precipDays"] = dp01[i]
                    sources["precipDays"] = "station"
                    used.append("rain days ≥ 1 mm")
            if mnvp and all(v > 0 for v in mnvp):
                for i, m in enumerate(months):
                    m["dewPointC"] = round(dew_from_vp(mnvp[i]), 1)
                    if m["meanC"] is not None:
                        m["relativeHumidity"] = round(min(100.0, 100 * mnvp[i] / es(m["meanC"])))
                sources.update(dewPointC="station (vapour pressure)", relativeHumidity="station (vapour pressure)")
                used.append("humidity")
            station_info = {
                "id": sid,
                "wmoId": s.get("wmoId"),
                "name": s["name"],
                "country": s.get("country", ""),
                "latitude": s["lat"],
                "longitude": s["lon"],
                "elevationM": s["elev"],
                "kind": s["kind"],
                "distanceKm": round(dist, 1),
                "elevationDifferenceM": None if dz is None else round(dz),
                "source": s["sourceText"],
                "url": s["url"],
                "files": s.get("files"),
                "retrievedAt": s["retrievedAt"],
                "parameters": used,
            }
            diff = None
            if tmax and all(x is not None for x in era_high) and base_kind == "era5-land":
                diff = round(sum(e - t for e, t in zip(era_high, tmax)) / 12, 1)
                station_info["era5MinusStationHighC"] = diff
            report.append(
                f"| {did} | {s['name']} ({sid}) | {s['kind'].upper()} | {dist:.1f} km | "
                f"{s['elev']:.0f} m / {'—' if town is None else f'{town:.0f} m'} | {', '.join(used)} | {'—' if diff is None else diff} |"
            )

        calib = None
        if sources["highC"] == "era5-land":
            calib = calibration(did, rec, pool, era5, town)
            if calib:
                for i, m in enumerate(months):
                    if m["highC"] is not None:
                        m["highC"] = round(m["highC"] + calib["highOffsetC"][i], 1)
                    if m["lowC"] is not None:
                        m["lowC"] = round(m["lowC"] + calib["lowOffsetC"][i], 1)
                    if m["meanC"] is not None:
                        m["meanC"] = round(m["meanC"] + (calib["highOffsetC"][i] + calib["lowOffsetC"][i]) / 2, 1)
                sources.update(highC="era5-land, station-calibrated", lowC="era5-land, station-calibrated", meanC="era5-land, station-calibrated")
                names = ", ".join("%s (%s km)" % (c["name"], c["km"]) for c in calib["stations"])
                calib_report.append(f"| {did} | {names} | {sum(calib['highOffsetC']) / 12:+.1f} |")

        # What the HCI build must add to each day's ERA5-Land high and low so
        # its days agree with the published monthly figures.
        rec["era5OffsetC"] = {
            "high": [None if e is None or m["highC"] is None else round(m["highC"] - e, 2) for e, m in zip(era_high, months)],
            "low": [None if e is None or m["lowC"] is None else round(m["lowC"] - e, 2) for e, m in zip(era_low, months)],
            "dew": [None if e is None or m["dewPointC"] is None else round(m["dewPointC"] - e, 2) for e, m in zip(era_dew, months)],
        } if base_kind == "era5-land" else None
        rec["station"] = station_info
        rec["calibration"] = calib
        rec["parameterSources"] = sources
        out["destinations"][did] = rec

    with_station = [k for k, v in out["destinations"].items() if v.get("station")]
    calibrated = [k for k, v in out["destinations"].items() if v.get("calibration")]
    report += ["", f"{len(with_station)} of {len(out['destinations'])} destinations use station normals for at least one parameter; "
               f"{len(calibrated)} are calibrated from nearby stations.", ""]
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1, allow_nan=False) + "\n", encoding="utf-8")
    REPORT.parent.mkdir(exist_ok=True)
    REPORT.write_text("\n".join(report + calib_report) + "\n", encoding="utf-8")
    print("\n".join(report[-3:]))
    print(f"→ {OUT.relative_to(ROOT)}; missing: {[m['id'] for m in out['missing']]}")


if __name__ == "__main__":
    main()
