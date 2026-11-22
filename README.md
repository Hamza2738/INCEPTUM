# SalinityShield

A farm-level decision platform that connects **water, energy and soil** in one place. For a plot, it tells the
farmer: is my water too salty for this crop, how much extra water must I leach through the root zone, how much
nitrogen to apply and when, what each m³ costs in energy (including blending with reverse-osmosis water),
whether solar pays back, and when to run the pump to avoid the expensive hours.

It has two sides, chosen at login:

| | Tunisia | Japan |
|---|---|---|
| Main problem | brackish groundwater, salt build-up, pumping cost and summer electricity peaks | over-fertilisation, nitrate reaching groundwater, salt build-up in greenhouses |
| Opening tab | salinity | nutrients |
| Languages | Arabic (RTL), French, English | Japanese, English |
| Units / currency | ha, kg/ha, TND | 10 a (tan), kg N/10 a, JPY |
| Reference | FAO-29 salt tolerance, STEG-style tariff | 10 mg/L nitrate standard, MIDORI strategy target |

Everything numeric is **computed by code** (FAO-56 water balance, FAO-29 leaching requirement, Maas-Hoffman
yield loss, a daily root-zone salt and nitrogen model, a linear program for the pump schedule, Monte Carlo for
payback and profit). The AI model only rephrases computed numbers, answers questions grounded on them, reads
lab-report photos and proposes causes for plant photos. It is never the source of a figure.

> **Honest status.** This is a hackathon prototype. The structure and equations are standard, but many
> coefficients are labelled `ASSUMPTION` in the code and in the app. Nothing here has been validated against
> field measurements. Read [What to verify before you present](#what-to-verify-before-you-present).

---

## Quick start (development)

Needs Python 3.10+ and Node 18+.

```bash
# 1. backend
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                                   # then edit it (see "Configuration")
python run.py                                          # http://127.0.0.1:5000

# 2. frontend (second terminal)
cd frontend
npm install
npm run dev                                            # http://localhost:5173 (proxies /api to Flask)
```

Open http://localhost:5173. On the login screen pick a side, then press the demo button. Demo accounts
(created when `SEED_DEMO=1`):

| Account | Password |
|---|---|
| `demo.tn@salinityshield.app` | `demo1234` |
| `demo.jp@salinityshield.app` | `demo1234` |
| `admin@salinityshield.app` | `admin` |

An account belongs to one country. Logging into the other side shows a "this account belongs to the other
country" message instead of silently switching.

### Development with Docker (backend + frontend, with reload)

Needs Docker Desktop. From the project root:

```bash
cp backend/.env.example backend/.env    # once, then edit it
npm run dev                             # = docker compose -f docker-compose.dev.yml up --build
```

Open http://localhost:5173. The Flask API runs on port 5000 and restarts when a Python file changes; Vite reloads
the page when a frontend file changes. The SQLite database stays in `backend/instance/`, the same one used without
Docker. Stop with Ctrl+C (or `npm run dev:down`). Rebuild is automatic with `npm run dev`; it only matters after
changing `requirements.txt` or `package.json`.

### One-process production build

```bash
cd frontend && npm run build          # creates frontend/dist
cd ../backend && gunicorn -b 0.0.0.0:5000 -w 2 run:app
```

Flask serves `frontend/dist` as a single-page app when that folder exists. A `Dockerfile` and
`docker-compose.yml` do the same (`cp backend/.env.example backend/.env && docker compose up --build`).
They were written but **not built or run** where this project was generated, so expect to fix a detail.

### Tests

```bash
cd backend && python -m pytest -q tests       # 26 tests: engine maths + API
cd frontend && npm run check:i18n             # every key used exists in en; fr/ar/ja coverage
```

---

## Configuration (`backend/.env`)

| Variable | Meaning |
|---|---|
| `SECRET_KEY` | JWT signing key. Set a long random value in production. |
| `GEMINI_API_KEY` | Needed for: advisor chat and rewriting, plant scanner, and lab-report extraction. Without it, rule-based advisor advice still works and Gemini-powered features display a clear unconfigured or demo state. |
| `GEMINI_MODEL` | Gemini model used for text and image analysis. Default `gemini-3-flash-preview`. |
| `OFFLINE_MODE` | `1` = never call Open-Meteo; use `data/weather_cache` or a synthetic climatology, labelled as such in the UI. Use this for a demo with unreliable wifi. |
| `SCANNER_DEMO` | `1` = without an API key, the scanner returns a fixed example result with a visible "DEMO RESULT" banner. Never presented as an analysis of the photo. |
| `SEED_DEMO` | `1` creates the two demo accounts and their plots. Set `0` in production. |
| `DATABASE_URL` | Default SQLite in `backend/instance/`. Any SQLAlchemy URL works. |
| `CORS_ORIGINS` | Comma-separated origins allowed in development. |

---

## Reliability of values: can they be guaranteed?

No. No automatic source can guarantee the exact condition of a real plot. SalinityShield separates values into three levels:

| Level | Examples | Reliability rule | User-facing label |
|---|---|---|---|
| Measured | Soil/lab EC, pH, N/P/K, water EC, irrigation volume, pump depth entered by or provided by the farmer | Relies on the measurement method and instrument; no external API can certify it | `Measured` / replace with real measurement |
| Observed | Open-Meteo/JMA weather, Sentinel vegetation, FAO WaPOR evapotranspiration, crop/area boundaries from official parcel sources | Strong for the source itself, but may have grid resolution or retrieval delays | `Observed data` with source and timestamp |
| Estimated/modelled | SoilGrids texture, synthetic weather fallback, crop coefficients, irrigation needs, salinity impact, fertilizer recommendation | A numerical estimate, not a guarantee | `Estimate` or `Model estimate` |

The application must use an explicit source, timestamp and confidence indicator whenever a value is shown. Before automatic values are treated as farm-ready, validate them against:

1. A soil laboratory test.
2. An EC meter or accredited water analysis for the actual water source.
3. A calibrated weather station or field observation.
4. The grower's sowing date, crop variety, irrigation method and recent operations.
5. Official parcel boundaries and crop declarations.

Gemini image and text conclusions are **hypotheses**, never diagnoses or guaranteed agronomic prescriptions. Gemini must not add numbers that are absent from the deterministic model output.

### Real-data integration links

- Open-Meteo forecasts and weather data: https://open-meteo.com/en/docs
- Open-Meteo historical archive: https://open-meteo.com/en/docs/historical-weather-api
- NASA POWER agroclimatology: https://power.larc.nasa.gov/docs/services/api/
- ERA5-Land: https://cds.climate.copernicus.eu/datasets/reanalysis-era5-land
- Japan Meteorological Agency AMeDAS: https://www.jma.go.jp/jma/en/Activities/amedas/amedas.html
- JMA developer data: https://www.data.jma.go.jp/developer/index.html
- ISRIC SoilGrids: https://rest.isric.org/soilgrids/v2.0/docs
- Harmonized World Soil Database: https://www.fao.org/soils-portal/data-hub/soil-maps-and-databases/harmonized-world-soil-database-v20/fr/
- FAO WaPOR: https://www.fao.org/in-action/remote-sensing-for-water-productivity/wapor-data/
- FAO WaPOR data access: https://www.fao.org/in-action/remote-sensing-for-water-productivity/wapor-data-access/en
- ESA WorldCover: https://worldcover2021.esa.int/
- Copernicus Data Space: https://documentation.dataspace.copernicus.eu/
- Copernicus Sentinel Hub/openEO: https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/OpenEO.html
- Google Earth Engine Sentinel catalog: https://developers.google.com/earth-engine/datasets/tags/sentinel
- Google Earth Engine Landsat catalog: https://developers.google.com/earth-engine/datasets/tags/landsat
- NASA SMAP: https://smap.jpl.nasa.gov/
- Tunisia open agricultural data: https://catalog.agridata.tn/
- Tunisia national open data: https://data.gov.tn/
- Tunisia national statistics: https://www.ins.tn/
- FAO AQUASTAT Tunisia: https://www.fao.org/aquastat/fr/countries-and-basins/country-profiles/country/TUN/index.html
- Japan MAFF statistics: https://www.maff.go.jp/j/tokei/index.html
- Japan MAFF MIDORI Strategy: https://www.maff.go.jp/j/kanbo/kankyo/seisaku/midori/index.html
- Japan WAGRI farmland and soil API: https://wagri.naro.go.jp/wagri_api/fieldinfo-localgovernmentcd/
- Japan MLIT groundwater survey: https://nlftp.mlit.go.jp/kokjo/inspect/landclassification/water/f9_exp.html
- OpenStreetMap/Nominatim: https://nominatim.org/release-docs/latest/api/Overview/
- Gemini API image understanding: https://ai.google.dev/gemini-api/docs/image-understanding

For exact plot boundaries, crop declarations and registered land records, use an official cadastral or agricultural registry integration; no public satellite or weather API can replace them.

---

## Where to put your data

The code is finished. These are the files that make results real. Nothing here needs code changes.

| What | Where | Notes |
|---|---|---|
| **Yields, prices, variable costs** (profitability simulator) | `backend/data/agridata/yields_prices.csv` | Format in `backend/data/agridata/README.md` and `yields_prices.sample.csv`. When a row exists for a (region, crop), it replaces the built-in assumption and the UI stops marking it as one. Keep originals and URLs under `agridata/raw/` + `SOURCES.txt`. |
| **Electricity tariffs, solar capex, nitrogen price, nitrate limit, MIDORI targets** | `backend/data/regions.json` | Per country: `tariff.hours` (24 prices, local currency per kWh), `tariff.peak_hours`, `pv.capex_per_kw`, `n_price_per_kg`, `standards`, `policy`, map centre, demo plots. |
| **Crop parameters** (Kc by stage, root depth, depletion fraction p, salt threshold and slope, N demand, Ky, frost and heat limits) | `backend/data/crops.json` | 14 crops. Add crops by copying an entry and adding its id to `crops` in `regions.json`. |
| **Soil parameters** (field capacity, wilting point) | `backend/data/soils.json` | |
| **Lab report samples** (to test the extractor) | `backend/data/lab_samples/` + `expected.json` | Then run `python backend/scripts/eval_extraction.py` to get an honest "X/N values correct". |
| **Plant photos** (to test the scanner) | `backend/data/scan_samples/` | Ideally annotated by an agronomist. |
| **Weather cache** (offline demo) | `backend/data/weather_cache/` | Filled automatically when Open-Meteo is reachable. Keep the files you want for an offline demo. |

Folders `lab_samples/`, `scan_samples/` and `agridata/raw/` are git-ignored on purpose: do not commit farmers'
reports or photos.

---

## Project layout

```
backend/
  run.py  requirements.txt  .env.example
  app/
    engine/       pure functions, no Flask: water, salinity, nutrients, energy, optimizer, economics, health, advice, config
    services/     data loading, Open-Meteo connector, analysis orchestrator, LLM (Claude), scanner guardrails
    routes/       plots, analysis, economics, ai, meta
    auth.py models.py seed.py config.py
  data/           regions.json crops.json soils.json + agridata/ lab_samples/ scan_samples/ weather_cache/
  scripts/eval_extraction.py
  tests/
frontend/
  src/
    pages/        Login (TN/JP split), Dashboard, Plots, PlotDetail (+ sections/), MapPage, Economics, Scanner, Advisor, About, Report
    components/   ui, charts, Advice, Layout, MapPicker, PlotForm, Logo
    i18n/         en.js (master) fr.js ar.js ja.js
    styles.css    colour tokens and layout
```

### API summary

`/api/health` · `/api/regions` (public) · `/api/auth/{register,login,me}` · `/api/plots` (CRUD, `/plots/demo`,
`/plots/:id/analysis`, `/plots/:id/whatif`, `/plots/:id/tests`, `/plots/:id/journal`) · `/api/dashboard` ·
`/api/map/{overview,measurements}` · `/api/economics/{defaults,simulate}` ·
`/api/ai/{status,advice,chat,scan,scans,extract-lab}`.

### Changing the look

Colour tokens are CSS variables at the top of `frontend/src/styles.css`. The Tunisia theme (`data-theme="tn"`:
deep green, teal, sand, amber) and the Japan theme (`data-theme="jp"`: indigo, cool blue, off-white) share the
same structure, so a new palette is a change of values only. Status is always colour **plus** icon **plus** word.
Chart colours were checked for colour-blind separation; re-check them if you change them.

### Adding a language or a string

Add the key to `frontend/src/i18n/en.js`, then to `fr.js`, `ar.js`, `ja.js`, and run `npm run check:i18n`.
RTL is set from the language, per page and on the login panels.

---

## What the app does, tab by tab

* **Water**: FAO-56 daily balance, irrigation trigger and depth, 16-day forecast from Open-Meteo.
* **Salinity**: leaching requirement, expected relative yield with and without leaching, verdict
  (OK / RISKY / NOT SUITABLE), blended brackish + RO water when the verdict is not OK.
* **Nutrients**: recommended nitrogen range (crop demand minus soil supply, with uncertainty), current dose vs
  recommended plan, simulated nitrate in drainage water against the Japanese 10 mg/L reference, the trade-off
  between leaching salt and washing out nitrate.
* **Energy**: kWh per m³ (pumping + RO), annual energy, solar sizing and payback with P10/P50/P90 from Monte Carlo.
* **Schedule**: 7-day hourly pumping plan by linear programming, avoiding forbidden hours for the irrigation
  type and expensive tariff hours; shown with and without solar.
* **What-if**: change crop, water EC, irrigation type, fertiliser dose and see the verdict move.
* **Map**: stress, moisture, salinity, leaching, solar (and nitrate in Japan) layers, plus the user's own
  measurements.
* **Profitability**: margin, NPV, tornado (±20 % on price, yield, costs), scenarios, Monte Carlo.
* **Scanner**: photo quality gate, then possible causes with a confidence capped at 85 %, no pesticide doses,
  EXIF location stripped before anything is sent.
* **Advisor**: at most three prioritised, rule-computed actions; free-text chat grounded on the computed JSON.
* **Report**: a printable one-page summary per plot.

---

## What to verify before you present

Every item below is a placeholder or a simplification. A judge who knows the field will ask.

1. **Electricity tariffs** (`regions.json` → `tariff`): invented shape, not the real STEG or Japanese utility tariff.
2. **RO energy curve** (`engine/config.py` → `RO_CURVE`), recovery 75 %, permeate EC 0.2: typical-looking
   values, verify against one supplier datasheet.
3. **Solar capex** and the fallback irradiance: ask an installer; the Open-Meteo irradiance is used when reachable.
4. **Nitrogen model**: `N_AVAILABLE_FRACTION`, `NUE`, `OM_MINERAL_KG_PER_PCT`, leaching scale, volatilisation,
   salt rise per kg N. These are simplified; the nitrate concentrations are order-of-magnitude, which the UI says.
   The Japanese demo plots show nitrate far above 10 mg/L partly because the demo doses are deliberately high.
5. **Irrigation efficiency, effective rain, initial depletion**: typical values.
6. **Crop parameters** (`crops.json`): salt thresholds and slopes come from the FAO-29 style tables as remembered
   by the author of this prototype, not copied from the source. Check each crop you will show.
7. **Yields, prices, costs**: all `ASSUMPTION` until you drop in `yields_prices.csv`.
8. **Japan nitrate reference**: confirm the 10 mg/L standard is for nitrate-nitrogen, as noted in `regions.json`.
   Confirm the MIDORI figures (−20 % by 2030, −30 % by 2050 for chemical fertiliser) at the MAFF source.
9. **Translations**: French, Arabic and Japanese were written by an AI model. Have a native speaker read the
   screens you will demo, especially the Arabic and Japanese advice sentences.
10. **Never tested here**: the Claude-powered features with a real API key (chat, scanner, lab extraction),
    live Open-Meteo calls, OpenStreetMap tiles when offline, and the Docker build. The rule-based paths, the
    scanner's quality gate, the demo scanner result and the "not configured" messages were tested.

Things the platform deliberately does **not** do: no pesticide doses, no diagnosis, no yield promise, no
automatic control of pumps. It is decision support, and the app says so.

## Licence and data

Open-Meteo is used under its terms for non-commercial use; check them before a commercial launch. Map tiles
are from OpenStreetMap contributors. The demo data is invented.
