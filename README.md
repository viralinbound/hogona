# Hogona — Bengaluru multimodal journey planner

React Native + Expo (SDK 58) + TypeScript app that plans door-to-door journeys inside Bengaluru by combining **walking, Namma Metro, BMTC buses and Uber/Rapido**, compares them on time, fare, walking and changes, and hands off to the official apps for booking. There is **no custom backend**: routing runs on the device over bundled datasets; bookings happen in Uber, Rapido or the official Namma Metro WhatsApp chat.

> Nothing in this app is live. Every time, wait and fare is labelled **Estimate**, **Assumed**, **Published** or **Routed**, and unverified values are shown as "not verified" instead of being made up.

## Quick start (Windows PowerShell)

```powershell
cd C:\Users\admin\Desktop\Projects\Apps\Mobile\namma-route
npm install
Copy-Item .env.example .env        # optional — defaults work without it
npm run web                        # browser at http://localhost:8095
npm start                          # Expo dev server (press a for Android)
npm test                           # 64 unit tests
npm run typecheck
```

Android device/emulator: see [docs/ANDROID_BUILD.md](docs/ANDROID_BUILD.md). The map on Android needs a Google Maps SDK key at build time ([docs/API_SETUP.md](docs/API_SETUP.md)); everything else works without keys.

## What it does

| Area | Implementation |
|---|---|
| Home | Locate (permission-aware), From/To with swap, leave-now/later, nearby stations & stops, favourites, recents, shortcuts, data-freshness note |
| Search | Bundled stations/stops (offline) + Photon/OSM geocoder (online, Bengaluru-only) |
| Planner | Graph router (Dijkstra over node × boardings states) with metro, bus, walk, interchange and ride-hail edges; 6–10 alternatives per query |
| Compare | Balanced / Fastest / Cheapest / Least walking / Fewest changes, mode filters, user-adjustable weights |
| Metro | 3 open lines, 85 stations, along-track distances, interchanges at Majestic and RV Road, single-ticket slab fares, Yellow-line hours/frequency |
| BMTC | 277 OSM-mapped routes, 1,677 stops, stop sequences, bus↔metro walking links, verified short-stage fares, Shakti option |
| Uber | Official deep link (`m.uber.com/looking`, `uber://`) with pickup/drop pre-filled |
| Rapido | Opens the app/store page; pickup/drop copied to clipboard (Rapido documents no pre-fill link) |
| WhatsApp | Official Namma Metro chat (+91 81055 56677) with "Hi" pre-filled after a validation/explanation screen. BMTC has no WhatsApp ticketing, so it is not offered |
| Map | react-native-maps on device, Leaflet + OSM tiles on web; metro track geometry, stop-to-stop bus paths, routed walking/driving paths on the details screen (OSRM), dashed lines when only approximate |
| Storage | AsyncStorage: preferences, favourites, recent searches, hand-off log; "Erase all local data" |

Full working-vs-blocked list: [docs/FEATURE_STATUS.md](docs/FEATURE_STATUS.md).

## Architecture

```
src/
  app/                    Expo Router screens
    (tabs)/index|map|saved|activity|settings.tsx
    place-search.tsx      modal place picker
    results.tsx           journey alternatives
    journey/[id].tsx      map + timeline + hand-offs
  algorithms/
    graph.ts              adjacency-list graph, node/edge kinds
    dijkstra.ts           binary heap + boarding-limited Dijkstra
    multimodal-router.ts  network build, query edges, profiles, legs, journeys
    fare-estimator.ts     metro slabs (one ticket across interchanges), BMTC stages
    journey-ranking.ts    balanced score, sorting, tags
  components/             JourneyCard, JourneyTimeline, TransportLeg, RouteFilters,
                          MapView(.web).tsx, OriginDestinationForm, DataFreshnessLabel, …
  features/               location, metro (hours/headways), ride (assumptions),
                          uber, rapido, whatsapp, handoff
  services/               transport-data (load + validate), geocoding, maps/routing,
                          external-links, config (EXPO_PUBLIC_*)
  storage/                preferences, favourites, recent-journeys
  data/                   bundled JSON datasets + manifest (sources, licences, dates)
  __tests__/              unit tests + fictional fixture network
scripts/
  import-osm.mjs          rebuilds metro/BMTC data from OpenStreetMap
  import-gtfs.mjs         replaces BMTC data from a GTFS feed you are licensed to use
```

### Routing model

* **Nodes:** metro station (street side), metro-in-vehicle per station, bus stop, bus-in-vehicle per (route, stop index), plus virtual origin/destination per query.
* **Edges:** `walk` (stop↔stop ≤250 m, station↔stop ≤350 m, +90 s station-gate time), `interchange` (between lines, 4 min, keeps the ticket), `board` (wait + transfer penalty, computed at query time from line hours/headway), `ride` (between consecutive stations/stops), `alight`, `hail` (Uber/Rapido to/from stations ≤12 km).
* **Search:** Dijkstra over `(node, boardings)` so the max-changes preference is exact. Several profiles (metro-only, bus-only, combined, less-walking, few-changes, metro+ride, plus a "avoid the services just used" alternative) give genuinely different journeys; bus journeys with a long first/last walk also get a ride variant; walking-only (≤5 km) and full-ride options are added.
* **Time:** metro run time = along-track distance at 34 km/h + 30 s dwell; metro wait = half the published headway (Yellow) or an assumed 5 min; bus = 14 km/h assumed + 10 min assumed wait (or half the GTFS headway if a licensed feed is imported); rides = 18 km/h over 1.35× straight distance + 5 min pickup. All labelled.
* **Hours:** Yellow Line has reported first/last trains → closed lines are avoided. Purple/Green hours are unverified → late-night journeys get a warning, not a fake schedule.
* **Fares:** metro slab table by total metro distance (one ticket across interchanges); BMTC ordinary stages ≤6 km only; AC bus and ride fares are never estimated.
* **Ranking:** see the formula in `src/algorithms/journey-ranking.ts`. Unknown fares are never treated as cheap.

## Limitations (by design — no backend, no fabricated data)

* No live train/bus positions, arrivals, crowding or service alerts (no authorised public feed).
* BMTC coverage is limited to routes mapped in OpenStreetMap (277 of BMTC's ~2,000+ schedules); no official BMTC GTFS exists.
* No in-app booking or payment; no Uber/Rapido fares or ETAs (Uber's estimates API needs server-side OAuth; Rapido has no public API).
* Purple/Green Line timetables could not be verified from bmrc.co.in on 2026-10-22.
* No accessibility (lift/step-free) data.
* Public geocoder/routing/tile servers are fair-use; self-host or use a commercial provider for production traffic.

## Data freshness

Every dataset's source, licence, snapshot and update command is in [`src/data/dataset-manifest.json`](src/data/dataset-manifest.json) and shown in Settings → Data sources. Refresh with `npm run data:import`. Details: [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md).

Map and route data © OpenStreetMap contributors, ODbL 1.0. Not affiliated with BMRCL, BMTC, Uber or Rapido.
