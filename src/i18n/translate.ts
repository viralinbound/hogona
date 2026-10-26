import { hi } from './hi';
import { kn } from './kn';

export type Language = 'en' | 'hi' | 'kn';

export const LANGUAGES: { id: Language; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'hi', label: 'हिन्दी' },
  { id: 'kn', label: 'ಕನ್ನಡ' },
];

/**
 * Dictionaries are keyed by the English text, so an untranslated string simply
 * shows in English. Place, station and route names are data and are never translated.
 */
const DICTS: Record<Exclude<Language, 'en'>, Record<string, string>> = { hi, kn };

export function translate(lang: Language, text: string, vars?: Record<string, string | number>): string {
  let out = lang === 'en' ? text : (DICTS[lang][text] ?? text);
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replace(`{${k}}`, String(v));
  return out;
}
