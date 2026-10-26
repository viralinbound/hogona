# Android: development and production builds (Windows PowerShell)

## 1. Development in Expo Go (fastest)

```powershell
cd C:\Users\admin\Desktop\Projects\Apps\Mobile\namma-route
npm install
npm start
```

Scan the QR code with Expo Go (same Wi-Fi) or press `a` with an emulator running. All modules used (maps, location, AsyncStorage, clipboard, intent-launcher) are in Expo Go.

## 2. Development build on a device/emulator (local)

Requires Android Studio (SDK 36), JDK 17 and `ANDROID_HOME`.

```powershell
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.14.7-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:GOOGLE_MAPS_ANDROID_API_KEY = "<your restricted key>"
npx expo prebuild --platform android --clean
npx expo run:android
```

`android/` is generated (Continuous Native Generation) and git-ignored — configure native settings in `app.config.ts`, never by hand.

## 3. Cloud builds with EAS

```powershell
npm install -g eas-cli
eas login
eas build:configure
eas env:create --name GOOGLE_MAPS_ANDROID_API_KEY --value "<key>" --environment production --visibility sensitive
eas build --platform android --profile preview      # installable APK for testing
eas build --platform android --profile production   # AAB for Google Play
```

`eas.json` in the repo defines `development`, `preview` (APK) and `production` (AAB) profiles.

## 4. Local release APK without EAS

```powershell
npx expo prebuild --platform android --clean
cd android
.\gradlew.bat assembleRelease
# output: android\app\build\outputs\apk\release\app-release.apk
```

Configure a release keystore in `android/gradle.properties` (or use EAS credentials) before publishing.

## Checklist before Play Store

* Restricted Google Maps key for the release SHA-1.
* Re-run `npm run data:import` and `npm test` so data is fresh; update dates in `fare-tables.json` / `metro-service.json` after re-checking sources.
* Privacy policy: location used on demand only; searches go to the configured geocoder; no accounts or server.
