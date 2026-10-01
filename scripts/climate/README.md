# Sfrtna climate pipeline

Produces the single source of truth for "when to travel":
`src/data/climate/travelSeasons.json` — one record per destination × month,
with the climate figures, scores, classification, reasons and full provenance.

```
cityCoords.ts ──► destinations.json ──► fetch_era5land.py ──► raw/<id>.csv (+ .meta.json)
                                                                   │
                                     build_normals.py ◄────────────┘
                                             │
                                             ▼
                           src/data/climate/normals.json (1991–2020 normals)
                                             │
     destinationTypes.ts + citySeasonSources.ts + travelSeason engine (config v1.0)
                                             │
                                  generate_seasons.mts
                                             ▼
                        src/data/climate/travelSeasons.json + reports/
```

## Source priority

1. **Official station normals** — WMO Climatological Standard Normals
   1991–2020 from each national meteorological service, published by NOAA
   NCEI (accession 0253808, files with ≥ 24 years: `fetch_wmo_normals.py`),
   from a station within 25 km and 150 m of the destination's height, used
   parameter by parameter when all 12 months exist (`merge_sources.py`).
2. **Copernicus ERA5-Land** 1991–2020 at the destination's coordinates —
   everything else (`fetch_era5land.py`, `build_normals.py` → `era5land.json`).
3. **NASA POWER** 1991–2020 — only where ERA5-Land has no data for the
   destination (`fetch_power.py`); a failed request falls through automatically.
4. **ERA5-HEAT (UTCI)** for thermal comfort — `probe_utci.py` checks access
   (the dataset has its own licence to accept on the CDS page).

`src/data/climate/normals.json` is the merged result; each destination lists
the station used and the source of every parameter (`parameterSources`).

## Data

- **Climate:** Copernicus Climate Change Service (C3S), **ERA5-Land hourly
  time-series** (`reanalysis-era5-land-timeseries`,
  https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land-timeseries),
  0.1° grid (~9 km), 1991-01-01 to 2020-12-31 — the WMO standard normal period
  (https://community.wmo.int/site/knowledge-hub/programmes-and-initiatives/climate-services/wmo-climatological-normals).
  Licence CC-BY 4.0: "Contains modified Copernicus Climate Change Service
  information". Citation: Muñoz Sabater et al. (2021), ESSD 13, 4349–4383.
- **Average high / low** are the monthly means of daily maxima / minima of the
  hourly 2 m temperature, per local calendar day — never the monthly mean
  temperature. See the docstring of `build_normals.py` for every formula.
- **Coasts and islands:** ERA5-Land has no values over the sea. When a
  destination's own cell is empty, the nearest land cell within 25 km is used
  and recorded (distance, cell). Beyond that, a station override is required.
- **Cell height:** a 9 km cell's average ground height can be far from the
  town's (a valley town whose cell reaches into the mountains reads several
  degrees too cold). `fetch_static.py` downloads the ERA5-Land orography and
  land-sea mask (ECMWF, ERA5-Land documentation page) and each destination's
  ground height (OpenTopoData, SRTM 90 m / ASTER 30 m); `check_cells.py`
  compares them and suggests a neighbouring land cell whose height is closer.
  Decisions go in `cell_overrides.json` with the reason: a cell to use
  instead, a reference place for islands whose stored coordinate is their
  interior (e.g. Bali → Denpasar), an accepted difference, or `withhold`.
  A destination whose best cell is still more than 400 m off, or that is
  withheld, is not published (listed in `travelSeasons.json` → `meta.withheld`)
  until a station override is added. Temperatures are never shifted by a
  lapse rate.
- **Known model bias:** ERA5-Land counts more ≥ 1 mm days than rain gauges
  (drizzle), most in the humid tropics and on wet coasts. The scoring leans on
  the monthly total more than on the day count; `reports/coverage.md` lists the
  months to check against a station.
- **Station overrides** (`station_overrides.json`, optional): official
  1991–2020 normals from a national met service / WMO / NOAA NCEI for a
  station that represents the city. Each entry must carry `stationName`,
  `stationId`, `latitude`, `longitude`, `distanceKm`, `period`, `source`,
  `url`, `retrievedAt` and 12 `months` in the normals format; the build fails
  otherwise. Never type figures from travel sites or blogs.
- **Tourism signal:** `src/data/citySeasonSources.ts` — months named by the
  tourism board (or, failing that, Lonely Planet / Rough Guides), with the URL
  read and the date. No source → `unavailable`, never invented.
- **Destination types:** `src/data/destinationTypes.ts` (editorial, versioned).

## Running it

Requires a free CDS account, the dataset's licence accepted on its page, and
the API key in `~/.cdsapirc` (or `CDSAPI_URL` / `CDSAPI_KEY`). The key is
never read or stored by these scripts and must never be committed.

```bash
pip install "cdsapi>=0.7.2" pandas numpy timezonefinder
node scripts/climate/export_destinations.mts
python3 scripts/climate/fetch_era5land.py --probe   # checks access, prints columns
python3 scripts/climate/fetch_era5land.py           # ~150 point requests; resumable
python3 scripts/climate/fetch_static.py             # orography, land-sea mask, town heights
pip install xarray netCDF4 && python3 scripts/climate/check_cells.py   # → raw/cell_check.json
#   decide in cell_overrides.json, then fetch_era5land.py again (downloads only the changed cells)
python3 scripts/climate/build_normals.py            # → src/data/climate/era5land.json; resumable; refuses incomplete files
python3 scripts/climate/fetch_wmo_normals.py        # official station normals → raw/wmo/
python3 scripts/climate/fetch_power.py              # NASA POWER for anything ERA5-Land could not serve
python3 scripts/climate/merge_sources.py            # → src/data/climate/normals.json + reports/stations.md
python3 scripts/climate/test_build_normals.py
node scripts/climate/generate_seasons.mts
node --test src/lib/travelSeason/*.test.ts
```

Downloads are cached in `raw/` (git-ignored); re-running only fetches what
is missing. Updating the baseline (e.g. to 2001–2030 later) means changing
`PERIOD` / `YEARS`, re-running, and bumping `PIPELINE_VERSION`.

## Checking any number on the site

```bash
node scripts/climate/diagnose.mts riyadh 7
```

prints the raw normals for that month, the grid cell or station and its
distance, the dataset and retrieval date, each profile's sub-scores, the caps
that fired, the tourism source and adjustment, and the final class — and
whether the stored record matches a live recompute.

## Changing the scoring

All weights, thresholds, caps and bonuses live in
`src/lib/travelSeason/config.ts`. Any change needs a new `version`; then
re-run `generate_seasons.mts`. `dataset.test.ts` fails when the stored file
no longer matches what the current config produces.
