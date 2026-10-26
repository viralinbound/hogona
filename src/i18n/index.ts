import { useCallback } from 'react';
import { useAppState } from '../state/AppState';
import { translate } from './translate';

export { LANGUAGES, translate, type Language } from './translate';

/** `tr('Find journeys')` in the user's chosen language. */
export function useT() {
  const { prefs } = useAppState();
  const lang = prefs.language;
  return useCallback((text: string, vars?: Record<string, string | number>) => translate(lang, text, vars), [lang]);
}
