import { Linking, Platform } from 'react-native';

export interface OpenResult {
  opened: boolean;
  via?: string;
  error?: string;
}

/**
 * Tries each target in order and stops at the first one that opens.
 * - `https://` links always open (browser fallback).
 * - Custom schemes (uber://, whatsapp://, market://) are attempted directly;
 *   `openURL` rejects when no app handles them, so we move on. (We avoid
 *   `canOpenURL`, which needs extra manifest entries on Android 11+.)
 * - `android-package:<id>` launches an installed Android app by package name.
 */
export async function openFirst(targets: string[]): Promise<OpenResult> {
  for (const url of targets) {
    try {
      if (Platform.OS === 'web') {
        if (!url.startsWith('https://')) continue;
        // window.open returns null when a popup blocker stops it ('noopener' would always return null).
        const w = window.open(url, '_blank');
        if (!w) return { opened: false, error: 'The browser blocked the new tab. Allow pop-ups for this site and try again.' };
        w.opener = null;
        return { opened: true, via: url };
      }
      if (url.startsWith('android-package:')) {
        if (Platform.OS !== 'android') continue;
        const IntentLauncher = await import('expo-intent-launcher');
        await IntentLauncher.openApplication(url.slice('android-package:'.length));
        return { opened: true, via: url };
      }
      await Linking.openURL(url);
      return { opened: true, via: url };
    } catch {
      // Not installed / not handled: try the next target.
    }
  }
  return { opened: false, error: 'No app or browser on this device could open the link.' };
}
