# External services and API setup

The app has **no backend** and needs **no secret**. Anything bundled into a mobile app can be extracted, so every value below is treated as public.

## Environment variables

Copy `.env.example` to `.env`. Expo inlines `EXPO_PUBLIC_*` values at bundle time — restart `npm start` after changing them.

| Variable | Default | Purpose | Disable with |
|---|---|---|---|
| `EXPO_PUBLIC_GEOCODER_URL` | `https://photon.komoot.io` | Address/landmark autocomplete + reverse geocoding (OSM data) | `""` → stations/stops search only |
| `EXPO_PUBLIC_WALK_ROUTING_URL` | `https://routing.openstreetmap.de/routed-foot` | Real walking paths on the journey screen (OSRM API) | `""` → dashed approximate lines |
| `EXPO_PUBLIC_DRIVE_ROUTING_URL` | `https://routing.openstreetmap.de/routed-car` | Road paths for Uber/Rapido legs | `""` |
| `EXPO_PUBLIC_MAP_TILE_URL` | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` | Web map tiles (Leaflet) | — |
| `EXPO_PUBLIC_UBER_CLIENT_ID` | empty | Optional Uber client id appended to deep links | — |
| `GOOGLE_MAPS_ANDROID_API_KEY` | empty | **Build-time** key for the Android map (react-native-maps plugin) | — |

### Fair-use services
Photon (komoot), FOSSGIS OSRM and the OSM tile server are free public instances with usage policies (no heavy/bulk use, attribution required). The app calls them only on user action (typing a search, opening a journey). For production, self-host Photon/OSRM or switch to a commercial provider by changing the URLs — no code changes needed.

## Google Maps key (Android map)

1. Google Cloud Console → create a project → enable **Maps SDK for Android**.
2. Create an API key → *Application restrictions: Android apps* → package `com.viralinbound.hogona` + your signing certificate SHA-1 (`eas credentials` or `keytool -list -v -keystore …`).
3. `GOOGLE_MAPS_ANDROID_API_KEY=…` in `.env` (or an EAS secret), then build. Expo Go on Android already includes a key for development.

iOS uses Apple Maps — no key.

## Uber

* Docs: https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction (checked 2026-10-22).
* The app opens `uber://?action=setPickup&pickup[latitude]=…&dropoff[latitude]=…&dropoff[nickname]=…` if Uber is installed, else the universal link `https://m.uber.com/looking?pickup=<json>&drop[0]=<json>`.
* Fare, ETA, driver and payment come from Uber. Uber's price/time estimate APIs require OAuth with a server-held secret, so they are intentionally **not** used (that would need a backend).

## Rapido

* No public API or documented deep link for pickup/drop. The app launches `com.rapido.passenger` (Android, via `expo-intent-launcher`), else the Play Store / App Store page, else rapido.bike, and copies "Pickup: … / Drop: …" to the clipboard.
* To add pre-fill later you need Rapido's written partner documentation — do not guess URL parameters.

## Other ride apps (verified 2026-10-22)

Configured in `src/data/operators.json → rideApps`; add or remove apps there, no code change.

| App | Android package | Pre-fill pickup + drop | Opens |
|---|---|---|---|
| Uber | `com.ubercab` | ✅ documented (`m.uber.com/looking`) | **inside Hogona** (in-app browser) or Uber app |
| Ola | `com.olacabs.customer` | ✅ documented web link `book.olacabs.com/?lat&lng&drop_lat&drop_lng&pickup_name&drop_name` | **inside Hogona** (in-app browser) |
| Rapido | `com.rapido.passenger` | ❌ none documented | app; trip copied |
| Namma Yatri | `in.juspay.nammayatri` | ❌ none documented | app; trip copied |
| inDrive | `sinet.startup.inDriver` | ❌ none documented | app; trip copied |
| Quick Ride | `com.disha.quickride` | ❌ none documented | app; trip copied |

Left out: BluSmart (shut down Apr 2025), Meru/Alyte (not in Bengaluru), Yulu/Bounce (rentals). "Inside Hogona" uses `expo-web-browser` (Chrome Custom Tab / SFSafariViewController): the user signs in and confirms on the company's own page; Hogona cannot read or fill anything on it beyond the link.

## Official operator apps (ticket redirects)

Every bookable leg redirects to the operator's own app; nothing is booked or paid inside Hogona.

| Leg | Button | Android | iOS | Web |
|---|---|---|---|---|
| Metro | **Namma Metro app** | launches `com.aum.nammametro` (BMRCL), else Play Store | App Store id6740857835 | bmrc.co.in |
| Metro | **Ticket on WhatsApp** | official chat +91 81055 56677 | same | wa.me |
| Bus | **Namma BMTC app** | launches `com.bmtc.bmtcavls`, else Play Store | BMTC website (App Store id not verified) | mybmtc.karnataka.gov.in |
| Ride | **Uber** | `uber://` with pickup/drop, else m.uber.com | same | m.uber.com |
| Ride | **Rapido** | launches `com.rapido.passenger`, else Play Store | App Store id1198464606 | rapido.bike |

Stations or pickup/drop are copied to the clipboard before opening apps that cannot be pre-filled. Package ids were checked against the Play Store listings on 2026-10-22 and live in `src/data/operators.json`.

## WhatsApp ticketing

* Enabled **only** for Namma Metro's official chatbot: `+91 81055 56677` (launched Nov 2022, still listed by BMRCL in July 2025).
* The app shows operator, ticket type, stations and passenger count, validates them, then opens `whatsapp://send?phone=918105556677&text=Hi` (fallback `https://wa.me/918105556677?text=Hi`). The user presses send and completes the menu-driven flow and UPI payment in WhatsApp. The ticket exists only when the chat sends the QR.
* BMTC has no WhatsApp ticketing → not offered. To add another operator, verify its number from the operator's own site, then add it to `src/data/operators.json` with `supported: true` and sources.

## Location

`expo-location` foreground permission only, requested when the user taps **Locate**. Denied/unavailable/outside-Bengaluru states each have a message and a typed-address fallback.
