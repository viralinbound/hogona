# Feature status — what genuinely works vs. what needs external access

Checked 2026-10-22. "Verified" = exercised by unit tests and/or in the web preview.

## Working now (no keys, no backend)

| Feature | Status | How verified |
|---|---|---|
| Expo Router navigation: 5 tabs + place search, results, journey details | ✅ | Web preview |
| Place search over 85 stations + 1,677 stops (offline) | ✅ | Web preview |
| Address/landmark autocomplete (Photon, Bengaluru-only) with offline fallback message | ✅ (online) | Web preview (live results) |
| Graph journey planner: walk, metro, bus, walk+metro, walk+bus, bus+metro, metro+ride, bus+ride, walk+metro+bus, full ride, walk-only, multi-interchange metro | ✅ | 30 router tests + real-data regression + preview |
| Max-changes limit (exact), max-walk limit, mode toggles | ✅ | Unit tests |
| Metro interchanges at Majestic and RV Road on one ticket | ✅ | Unit + real-data regression test, preview |
| Metro slab fares (one ticket across interchanges) | ✅ estimate | Unit tests |
| BMTC stage fares ≤ 6 km, Shakti option; "not verified" beyond | ✅ estimate | Unit tests |
| Yellow Line hours (closed line avoided) + headway-based wait | ✅ reported data | Unit tests (fixture) |
| Late-night warning for lines with unverified hours | ✅ | Unit test |
| Sorting (balanced/fastest/cheapest/least walking/fewest changes), filters, adjustable weights with instant re-rank | ✅ | Unit tests + preview |
| Leg timeline: stops, intermediate stops, waits, durations, fares, basis tags | ✅ | Preview |
| Map: metro track geometry, stations, bus stops when zoomed, picked points, journey legs | ✅ | Preview (web/Leaflet) |
| Real walking/driving paths on details screen (OSRM) | ✅ (online) | Code path; falls back to dashed line |
| Uber deep link with pickup/drop | ✅ link built per docs | Unit tests; needs a device with Uber to see pre-fill |
| Rapido hand-off (open app/store, copy pickup/drop) | ✅ | Unit tests; needs device |
| Redirect to official Namma Metro / Namma BMTC apps from metro and bus legs (stations copied) | ✅ | Unit test (package ids) + preview; app launch needs device |
| Namma Metro WhatsApp hand-off (validated, "Hi" pre-filled, official number) | ✅ | Unit tests + preview dialog |
| Favourites, recent searches, hand-off log, preferences (AsyncStorage) + erase | ✅ | Preview |
| Location permission: granted / denied / unavailable / outside Bengaluru | ✅ handled | Code paths; needs device to exercise |
| Light/dark/system theme | ✅ | Preview (dark) |
| Dataset validation (structure, lengths, interchanges, fare tables) | ✅ | 9 data tests |

## Karnataka beyond Bengaluru (checked 2026-10-24)

| Feature | Status |
|---|---|
| Place search across Karnataka (Photon/OSM) | ✅ |
| Trips leaving/entering Bengaluru: real city part planned to/from Kempegowda Bus Station + official KSRTC booking (ksrtc.in, KSRTC AWATAR app `com.ksrtc.awatar.new`) | ✅ |
| Intercity / other-city bus routes, timings, fares (KSRTC, NWKRTC, KKRTC, Mysuru city, private) | ❌ No official open data exists. Unofficial scraped GTFS (KSRTC reservable services, HDBRTS, Davangere) was deliberately not bundled. |

## Needs a key, a device or a build

| Feature | Requirement |
|---|---|
| Android map tiles in a production/dev build | `GOOGLE_MAPS_ANDROID_API_KEY` (Expo Go works without) |
| Seeing Uber/Rapido/WhatsApp actually open | Physical device with those apps |
| Production-scale geocoding/routing/tiles | Self-hosted or commercial Photon/OSRM/tile URLs (public ones are fair-use) |

## Added 2026-10-24

| Feature | How it works / limits |
|---|---|
| Home & work commute card | Saved on the phone; one tap plans home→work (before 2 pm first) or work→home. Shows the nearest station's published frequency and estimated last train; Purple/Green say "not verified". |
| Get-off (stop) alert | Foreground GPS only while the journey screen is open, screen kept awake (expo-keep-awake), vibrates ~600 m before each metro/bus alighting stop. No background location, no notifications. |
| Last train / last bus warning | Yellow Line: estimated from the reported last departure + run time, warns within 45 min. Buses: last trip from first stop in the community GTFS, evenings only. |
| Share trip | System share sheet with a plain-text plan + Google Maps link of the destination. Nothing uploaded. |
| Hindi + Kannada | `src/i18n` (keys = English text, English fallback). Main screens, tabs, titles, new features translated; detailed data notes, booking flow and legal text are still English. Place names stay as published. |
| Airport buses | Vayu Vajra (KIA-*) routes to the airport from the community GTFS with trips/day and first–last times; plan to/from the airport bus bay. |
| Monthly cost calculator | Planned fares × trips; BMTC monthly/Vajra pass prices as *reported in the press* (`src/data/passes.json`, not officially confirmed). Ride fares excluded (app-only). |
| Rain notice | Open-Meteo 3-hour forecast at the start point (≥60% or ≥1 mm) on results with a metro option. Free tier is non-commercial — needs a paid plan or self-host for a commercial launch. |

**Not built:** offline map tiles (needs a tile provider that allows offline caching) and home-screen widgets (need native Android/iOS widget code; iOS needs a Mac). Journey planning, station/stop search and timings already work offline.

## Not available (no authorised source) — shown as unavailable, never faked

| Feature | Why |
|---|---|
| Live metro arrivals, live bus positions/ETAs, crowding | No public authorised API; would also need a backend |
| Metro service alerts | No machine-readable official feed found |
| Purple/Green Line first/last train times | bmrc.co.in timings page returned no table on 2026-10-22 |
| BMTC timetables | No official GTFS; import a licensed feed with `npm run data:gtfs` to enable average headways |
| BMTC routes not mapped in OSM | Coverage limited to 277 mapped route patterns |
| BMTC AC (Vajra/Vayu Vajra) fares, ordinary fares > 6 km | Full official stage table not found |
| Uber fare/ETA estimates | Uber estimates API needs server-side OAuth secret |
| Rapido pre-filled pickup/drop, fares | No documented public API/deep link |
| BMTC WhatsApp tickets | BMTC offers none |
| In-app ticketing/payment | Out of scope by design (no backend, no payment server) |
| Pink/Blue metro lines | Not open on 2026-10-22 (re-import when opened) |
| Step-free/accessibility routing | No verified station accessibility data |

## Tests

```powershell
npm test            # 9 suites, 86 tests
npm run typecheck
```

Suites: `dijkstra`, `multimodal-router` (fictional fixture network, clearly labelled), `fare-estimator`, `journey-ranking`, `external-links` (Uber/Rapido/WhatsApp), `data-validation` (bundled real data + validator on broken fixtures).

Not automated: device-only flows (location permission prompts, opening other apps, TalkBack). Manual checklist: deny location → message + typed fallback; airplane mode → stations/stops search still works, journey planning works, details screen shows dashed lines; uninstall WhatsApp → error snackbar suggests the Namma Metro app; TalkBack reads each journey card as one sentence (duration, arrival, fare, walk, changes).
