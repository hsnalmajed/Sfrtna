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
python3 scripts/climate/build_normals.py
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
