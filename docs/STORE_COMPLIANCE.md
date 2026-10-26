# App Store & Google Play compliance

Checked against Apple's App Store Review Guidelines / Human Interface Guidelines and Google Play's Developer Policy and Android 16 (API 36) requirements, as known on **2026-10-22**. Store rules change — re-read both before each submission.

## Done in the code

| Requirement | Apple | Android | Where |
|---|---|---|---|
| Privacy manifest (no tracking, no data collected, required-reason APIs declared) | ✅ | — | `app.config.ts → ios.privacyManifests` (libraries ship their own too) |
| Export compliance: only standard HTTPS | ✅ `ITSAppUsesNonExemptEncryption = false` | — | `app.config.ts` |
| Clear purpose string for location, foreground only | ✅ `NSLocationWhenInUseUsageDescription` | ✅ coarse + fine, user can choose approximate | `app.config.ts` |
| No background location / foreground service | ✅ disabled | ✅ `ACCESS_BACKGROUND_LOCATION` removed from the manifest | `blockedPermissions`, expo-location options |
| Location asked only after a user action | ✅ | ✅ | "Use my location" button |
| Works if location is denied | ✅ | ✅ | typed search + messages in `useCurrentLocation` |
| Privacy policy reachable inside the app | ✅ | ✅ | Settings → "Read the full privacy policy" (`src/app/about.tsx`) |
| Delete user data | ✅ | ✅ | Settings → "Erase everything on this phone" (no accounts exist) |
| No login required | ✅ | ✅ | — |
| iPad: all orientations, Split View | ✅ `UIRequiresFullScreen = false`, orientation unlocked | — | `app.config.ts` |
| Large screens, foldables, dual-screen (Android 16 ignores orientation locks ≥ 600 dp) | — | ✅ responsive two-column layouts, hinge-wide gap | `src/hooks/useLayout.ts` |
| Edge-to-edge (mandatory from Android 15/16) | ✅ safe areas | ✅ tab bar sizes itself to system bars | `SafeAreaProvider`, tabs layout |
| Predictive back (Android 16) | — | ✅ `enableOnBackInvokedCallback = true` | `predictiveBackGestureEnabled` |
| Target latest API level | — | ✅ Expo SDK 58 targets API 36 | Expo default |
| 16 KB memory page support | — | ✅ Expo SDK 58 native libraries | Expo default |
| Minimum text size 11 pt, 44 pt touch targets, screen-reader labels | ✅ | ✅ | `src/components/ui.tsx`, cards' `accessibilityLabel` |
| Dynamic Type / font scaling not disabled | ✅ | ✅ | no `allowFontScaling={false}` anywhere |
| App icon: full-bleed 1024 (iOS), adaptive + monochrome themed icon (Android 13+) | ✅ | ✅ | `assets/` |
| No misleading affiliation; trademarks not in the app name | ✅ | ✅ | name "Hogona"; disclaimer in About |
| No fake live data or fake confirmations | ✅ | ✅ | all values labelled; hand-offs logged as "not a booking" |

## You must do in the store consoles

1. **Privacy policy URL** — host `docs/PRIVACY_POLICY.md` (any public page) and paste the URL in both consoles. Fill in a support email (`EXPO_PUBLIC_SUPPORT_EMAIL`).
2. **Apple → App Privacy ("nutrition label")** — answer **"Data Not Collected"**. Reason: nothing leaves the device to us; geocoding/routing requests go to third-party services only to answer the user's request in real time and are not linked to an identity (Apple's definition of "collect" excludes this). If you later add analytics or crash reporting, update this.
3. **Google → Data safety** — "Does your app collect or share any of the required user data types?" → **No**. Encryption in transit: Yes (HTTPS). Users can request deletion: data is on-device; "Erase everything" deletes it.
4. **Google → App content** — Target audience 13+ (general travel); Ads: **No**; Government app: **No** (not affiliated); News app: No.
5. **Content rating** — complete the IARC questionnaire (no user-generated content, no violence) → expected "Everyone / 4+".
6. **Location permission declaration** (Play) — foreground only; feature: "set start point and show nearby stations".
7. **Screenshots** — iPhone 6.9″ and iPad 13″ (Apple), phone + 7″ and 10″ tablet (Play). Use real app screens only.
8. **Review notes (Apple)** — "No login needed. Plan a trip e.g. Indiranagar → Electronic City. Buttons open Uber/Rapido/WhatsApp/official transit apps; the app itself books nothing." This avoids guideline 2.1/4.2 questions.
9. **Developer accounts** — Google Play $25 one-time; Apple Developer Program $99/year. New personal Play accounts must run a closed test with testers for 14 days before production.

## iPhone Duo (foldable, iOS 27.1, on sale 23 Oct 2026)

- Apple: apps not rebuilt with the latest SDK "can remain inside a narrow portion of the inner display". **Build iOS with Xcode 27.1 / iOS 27.1 SDK** — `eas.json` uses `"image": "latest"` for iOS; confirm the EAS build log shows Xcode 27.1 and that Expo SDK 58 supports it (upgrade Expo if not).
- Layout already follows Apple's guidance: columns come from the available width (`useLayout`), not from device type or orientation; content stays in safe areas; it works at half width in 50/50 Split View.
- Test in Xcode 27.1's iPhone Duo simulator (Device Hub: fold, unfold, rotate, Split View) before submitting.

## Watch-outs

- **Guideline 4.2 (minimum functionality):** the app does real on-device planning, maps, timings and booking hand-offs, so it is not a thin wrapper — keep it that way.
- **Guideline 5.2 (IP):** don't use BMRCL/BMTC/Uber/Rapido logos or say "official".
- **Fair-use services:** Photon, OSRM (FOSSGIS) and OSM tiles are free for light use. With many users, switch to your own or paid providers via the `EXPO_PUBLIC_*` settings — otherwise those services may block the app.
- **Google Maps key (Android map):** restrict it to `com.viralinbound.hogona` + your signing SHA-1.
