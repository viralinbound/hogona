import { Platform } from 'react-native';
import operators from '../../data/operators.json';

export type AppOperatorId = 'namma-metro' | 'bmtc' | 'rapido' | 'ksrtc' | 'irctc';

interface OperatorApp {
  name: string;
  androidPackage: string;
  playStore: string;
  iosAppStore: string | null;
}

export function operatorApp(id: AppOperatorId): OperatorApp & { website: string } {
  const op = operators.operators[id] as { app: OperatorApp; website: string };
  return { ...op.app, website: op.website };
}

/**
 * Targets that open an operator's official app, in order of preference:
 * Android — launch the installed app by package, else its Play Store page;
 * iOS — the App Store page (shows "Open" when installed), else the website;
 * web — the website. Booking and payment then happen in that app.
 */
export function operatorAppLinks(id: AppOperatorId): string[] {
  const app = operatorApp(id);
  if (Platform.OS === 'android') return [`android-package:${app.androidPackage}`, `market://details?id=${app.androidPackage}`, app.playStore];
  if (Platform.OS === 'ios') return [...(app.iosAppStore ? [app.iosAppStore] : []), app.website];
  return [app.website];
}
