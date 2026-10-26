# Transport data: sources, verification and import

All bundled data lives in `src/data/`. `dataset-manifest.json` records the source, licence, import date and OSM snapshot for each dataset and is shown in the app (Settings → Data sources). Values were checked on **2026-10-22**.

## BMTC data in the app (since 2026-10-24)

The bundled bus data now comes from the **community BMTC GTFS** <https://github.com/Vonter/bmtc-gtfs> (ODbL-1.0, feed version 2026-09-07), imported with `npm run data:gtfs`:
7,473 route patterns, 9,948 stops, average headways for 4,363 patterns, and the BMTC fare matrix (45,759 zone pairs + 108 route-specific tables).
It also contains ~69 KSRTC intercity patterns (Bengaluru ↔ Mysuru, Hubballi, Kalaburagi…), tagged `operator: 'KSRTC'`.
It is **unofficial**, scraped from the Namma BMTC app, which the author notes has inaccurate timetables; only routes with live tracking are included. The app labels it as community data everywhere it is shown.
The previous OSM-derived bus files are kept in `.tools/osm-bmtc-backup/`; `npm run data:import` regenerates OSM data if you want to switch back.

## Datasets

| File | Content | Source | Licence | Update |
|---|---|---|---|---|
| `metro-stations.json` | 85 stations: name (EN/KN), coordinates, along-track chainage | OSM relations 7841331 (Purple), 7842287 (Green), 19421944 (Yellow) | ODbL 1.0 | `npm run data:import` |
| `metro-lines.json` | 3 lines, station order, per-segment track geometry (simplified 10 m) | Same, track graph from both directions' relations | ODbL 1.0 | same |
| `metro-transfers.json` | Interchanges: Majestic (Purple↔Green), RV Road (Green↔Yellow) | Derived: stations of different lines < 350 m apart | ODbL 1.0 | same |
| `bmtc-stops.json` | 1,677 stops (same-name nodes within 80 m merged) | OSM bus route relations, network/operator BMTC | ODbL 1.0 | same |
| `bmtc-routes.json` | 277 route patterns with ordered stops (≥5 named stops) | same | ODbL 1.0 | same, or `npm run data:gtfs` |
| `bmtc-schedules.json` | Planning assumptions; per-route average headways only after a GTFS import | — | — | `npm run data:gtfs` |
| `fare-tables.json` | Metro slab fares (from 2025-02-09), BMTC ordinary stages ≤6 km, Shakti rule | News reports of BMRCL/BMTC notifications (URLs inside the file) | facts | edit by hand after checking |
| `metro-service.json` | Yellow Line hours & headway (reported); Purple/Green marked unverified; planning speeds | Deccan Herald (URL in file); bmrc.co.in timings page did not load | facts | edit by hand |
| `operators.json` | Official websites, Namma Metro WhatsApp number & flow, Uber link format, Rapido package/store links | BMRCL announcement coverage, Uber developer docs, store listings (URLs in file) | facts | edit by hand |

### Verification notes (2026-10-22)

* **Open lines:** Purple (Challaghatta–Whitefield/Kadugodi), Green (Madavara–Silk Institute), Yellow (RV Road–Delta Electronics Bommasandra, opened Aug 2025). **Pink** (Kalena Agrahara–Tavarekere) had its safety inspection on 6–8 Oct 2026 but was not open; **Blue** not open. When they open: OSM mappers usually add the relation within days → add it to `METRO_LINES` in `scripts/import-osm.mjs` and re-import.
* **Metro fares:** 2025 slab table. BMRCL hand-adjusted ~600 station pairs, and a 5% hike announced on 2026-02-05 is "in abeyance" — so the app labels metro fares as estimates.
* **Purple/Green hours:** bmrc.co.in/metro-timings showed no table; only unofficial sites list hours, so the app does not bundle them.
* **BMTC:** no official GTFS; no WhatsApp ticketing. Full post-Jan-2025 stage table not found in an official source → only stages up to 6 km are used.
* **Rapido:** no documented deep link for pickup/drop.

## Re-importing OpenStreetMap data

```powershell
npm run data:import          # fetches from overpass-api.de (≈ 1–3 min)
npm run data:import:cached   # reuses scripts/.cache/*.json
npm test                     # validates the new data (structure, line lengths, interchanges, fares)
```

The importer prints line lengths and warns about stations more than 150 m from the mapped track. Set `OVERPASS_URL` to use another Overpass instance.

## Importing a BMTC GTFS feed (only if you are licensed to use it)

```powershell
npm run data:gtfs -- "C:\path\to\gtfs-folder" "ODbL 1.0 (see feed README)" "https://github.com/Vonter/bmtc-gtfs"
npm test
```

This replaces the OSM bus data and stores average headways per route (bus waits then become "half the average timetable headway", labelled as estimates). Read the feed's licence first: the community `Vonter/bmtc-gtfs` feed is ODbL but notes that some contents are BMTC's copyright and that timetables are inaccurate.

## What must never be added

Invented routes, stops, timetables, vehicle positions, fares, ride prices, driver ETAs or WhatsApp numbers. If a value cannot be verified, store `null` and let the UI say "not verified".
