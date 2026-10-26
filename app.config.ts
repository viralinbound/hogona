import type { ExpoConfig } from 'expo/config';

/**
 * Store-compliance notes live in docs/STORE_COMPLIANCE.md.
 *
 * GOOGLE_MAPS_ANDROID_API_KEY is read at build time (not EXPO_PUBLIC_) and
 * written into the Android manifest by the react-native-maps plugin. Map keys
 * end up inside the APK, so restrict the key to this package + signing SHA-1
 * in Google Cloud Console. See docs/API_SETUP.md.
 */
const androidMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

const LOCATION_REASON =
  'Hogona uses your location only when you tap “Use my location” (to set your start point and show nearby stations) or turn on a stop alert (to vibrate before your stop while the app is open). It is never stored or sent anywhere.';

const config: ExpoConfig = {
  // Home-screen name. Store listing title: "Hogona: Bengaluru Commute" (≤30 chars on both stores).
  name: 'Hogona',
  slug: 'hogona',
  version: '1.0.0',
  // 'default' = rotate freely. iPad multitasking and Android 16 large screens expect no orientation lock.
  orientation: 'default',
  icon: './assets/icon.png',
  scheme: 'hogona',
  userInterfaceStyle: 'light',
  backgroundColor: '#F3EFE6',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.viralinbound.hogona',
    buildNumber: '1',
    // Only standard HTTPS — exempt from US export-compliance paperwork.
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      // Lets Linking open these apps directly.
      LSApplicationQueriesSchemes: ['uber', 'whatsapp', 'comgooglemaps'],
      NSLocationWhenInUseUsageDescription: LOCATION_REASON,
      // iPad Split View / Slide Over.
      UIRequiresFullScreen: false,
    },
    /**
     * App-level privacy manifest (Apple, required since May 2024). No tracking,
     * no data collected by us. Required-reason APIs are declared for the
     * storage and file APIs used by AsyncStorage / Expo modules.
     */
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [],
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1'] },
      ],
    },
  },
  android: {
    package: 'com.viralinbound.hogona',
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: '#1F5A43',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    // Foreground location only (precise is optional — the user can grant approximate). VIBRATE is for the stop alert.
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'VIBRATE'],
    // Never request background location or other sensitive permissions.
    blockedPermissions: ['android.permission.ACCESS_BACKGROUND_LOCATION', 'android.permission.RECORD_AUDIO', 'android.permission.SYSTEM_ALERT_WINDOW'],
    // Android 16 predictive back animation.
    predictiveBackGestureEnabled: true,
  },
  web: {
    favicon: './assets/favicon.png',
    output: 'single',
  },
  plugins: [
    'expo-router',
    'expo-font',
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 260, resizeMode: 'contain', backgroundColor: '#F3EFE6' }],
    [
      'expo-location',
      {
        locationWhenInUsePermission: LOCATION_REASON,
        isIosBackgroundLocationEnabled: false,
        isAndroidBackgroundLocationEnabled: false,
        isAndroidForegroundServiceEnabled: false,
      },
    ],
    ['react-native-maps', androidMapsKey ? { androidGoogleMapsApiKey: androidMapsKey } : {}],
    [
      'expo-build-properties',
      {
        android: {
          // R8 strips classes that AndroidX WorkManager/Room create by reflection,
          // which crashed the release build on launch (WorkDatabase_Impl).
          extraProguardRules: [
            '-keep class androidx.work.impl.** { *; }',
            '-keep class * extends androidx.room.RoomDatabase { *; }',
            '-keep class androidx.room.** { *; }',
            '-keep class androidx.startup.** { *; }',
          ].join('\n'),
        },
      },
    ],
  ],
  extra: {
    // Lets the app pick Google Maps on Android only when a key was provided.
    hasGoogleMapsKey: Boolean(androidMapsKey),
    eas: { projectId: '016d5187-7bc2-4eb1-aa11-3b5c76c22478' },
  },
  experiments: {
    typedRoutes: false,
  },
};

export default config;
