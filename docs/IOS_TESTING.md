# Hogona — iOS / iPad / iPhone Duo testing guide

**Status:** the app has been built and tested on Android only. **iOS has never been built.** Treat the first iOS build as a smoke test and report anything odd.

- Bundle ID: `com.viralinbound.hogona` · Expo SDK 58 · React Native 0.88 · expo-router
- Repo: https://github.com/viralinbound/hogona (branch `master`)
- EAS project: `@gunanit/hogona` (id in `app.config.ts`)
- Needs **Xcode 27.1** (EAS `latest` image = `macos-tahoe-26.6-xcode-27.1`). iPhone Duo needs the iOS 27.1 SDK or the app is letterboxed on the inner display.

## Run it (needs a Mac)

```bash
git clone https://github.com/viralinbound/hogona.git && cd hogona
npm install
npx expo run:ios            # simulator, or: npx expo run:ios --device
```

## Or build in the cloud (no Mac needed for the build)

```bash
npm i -g eas-cli && eas login
eas build -p ios --profile ios-simulator    # .app for the simulator (no Apple account needed)
eas build -p ios --profile production       # signed build for TestFlight (needs an Apple Developer account)
```

Drag the simulator `.app` onto a Simulator window. For a device or iPhone Duo use TestFlight.

## Please check

**Launch and layout**
- App starts on the Plan tab with the logo; five text tabs at the bottom.
- iPad portrait and landscape: landscape (≥ 840 pt wide) shows two columns. Try Split View and Slide Over.
- iPhone Duo: inner display fills the screen (no letterbox); with the fold, content does not sit under the hinge (two columns have an 88 pt gap for it). Try both orientations and folding while the app is open.
- App must work with no scene-lifecycle crash on iOS 27 (see Expo build-infrastructure docs: Xcode 27 images need the UIKit scene lifecycle).

**Features**
- Home: set Home and Work, tap "Go to work" → results appear (planning can take 20–30 s on slower phones).
- Search "Mysuru" from Indiranagar → door-to-door options with a **Train** step; "See trains & book" opens the train list in the in-app browser.
- "Use my location" → permission prompt text is the one in `app.config.ts`; stop alert ("Alert me before my stop") keeps the screen awake and vibrates. iOS vibration is a short buzz only.
- Share trip opens the system share sheet.
- Settings → Language: English / हिन्दी / ಕನ್ನಡ (labels switch; place names stay as published).
- Uber / Ola buttons open their in-app browser page; other ride apps open the store page if not installed (`LSApplicationQueriesSchemes`: uber, whatsapp, comgooglemaps).
- Map tab and journey map (iOS uses the native map; Android uses Leaflet).

**Known limits (not bugs)**
- Times and fares are estimates, not live. Bus data is an unofficial community dataset. Train times/fares come from the booking site.
- No iOS widget, no offline map tiles.
- Metro hours for Purple/Green lines are intentionally "not verified".

Report: device + iOS version, steps, screenshot.
