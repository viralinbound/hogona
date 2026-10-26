import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { planTrip, type TripResult } from '../algorithms/intercity';
import { buildNetwork, type Network } from '../algorithms/multimodal-router';
import { scoreJourneys, tagJourneys } from '../algorithms/journey-ranking';
import { transportData } from '../services/transport-data';
import { loadCommute, saveCommute, type Commute, type CommuteKind } from '../storage/commute';
import { loadFavourites, saveFavourites, samePlace, type Favourite } from '../storage/favourites';
import { loadPreferences, savePreferences } from '../storage/preferences';
import { addActivity, addRecent, loadActivity, loadRecents, saveRecents, type ActivityEntry, type RecentSearch } from '../storage/recent-journeys';
import { eraseAll } from '../storage/store';
import { DEFAULT_PREFERENCES, type Journey, type Place, type PlannerPreferences } from '../types/journey';

export interface PlanState {
  status: 'idle' | 'planning' | 'done' | 'error';
  result?: TripResult;
  error?: string;
  origin?: Place;
  destination?: Place;
  departAt?: number;
}

interface AppStateValue {
  ready: boolean;
  prefs: PlannerPreferences;
  setPrefs: (p: PlannerPreferences) => void;
  favourites: Favourite[];
  toggleFavourite: (place: Place, label?: string) => void;
  isFavourite: (place: Place) => boolean;
  removeFavourite: (id: string) => void;
  commute: Commute;
  setCommutePlace: (kind: CommuteKind, place: Place | null) => void;
  recents: RecentSearch[];
  clearRecents: () => void;
  activity: ActivityEntry[];
  logActivity: (e: Omit<ActivityEntry, 'id' | 'at'>) => void;
  origin: Place | null;
  destination: Place | null;
  setOrigin: (p: Place | null) => void;
  setDestination: (p: Place | null) => void;
  swap: () => void;
  /** null = leave now. */
  departAt: number | null;
  setDepartAt: (t: number | null) => void;
  plan: PlanState;
  runPlan: (o?: Place, d?: Place) => Promise<void>;
  getJourney: (id: string) => Journey | undefined;
  eraseData: () => Promise<void>;
}

const Ctx = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [prefs, setPrefsState] = useState<PlannerPreferences>(DEFAULT_PREFERENCES);
  const [favourites, setFavourites] = useState<Favourite[]>([]);
  const [commute, setCommute] = useState<Commute>({});
  const [recents, setRecents] = useState<RecentSearch[]>([]);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [departAt, setDepartAt] = useState<number | null>(null);
  const [plan, setPlan] = useState<PlanState>({ status: 'idle' });
  const network = useRef<Network | null>(null);

  useEffect(() => {
    void Promise.all([loadPreferences(), loadFavourites(), loadRecents(), loadActivity(), loadCommute()]).then(([p, f, r, a, c]) => {
      setCommute(c);
      setPrefsState(p);
      setFavourites(f);
      setRecents(r);
      setActivity(a);
      setReady(true);
    });
  }, []);

  const setPrefs = useCallback((p: PlannerPreferences) => {
    setPrefsState(p);
    void savePreferences(p);
    // Re-rank existing results with new weights without re-planning.
    setPlan((cur) => {
      if (cur.status !== 'done' || !cur.result) return cur;
      const journeys = cur.result.journeys.map((j) => ({ ...j }));
      scoreJourneys(journeys, p.weights);
      tagJourneys(journeys);
      return { ...cur, result: { ...cur.result, journeys } };
    });
  }, []);

  const isFavourite = useCallback((place: Place) => favourites.some((f) => samePlace(f.place, place)), [favourites]);

  const toggleFavourite = useCallback((place: Place, label?: string) => {
    setFavourites((list) => {
      const existing = list.find((f) => samePlace(f.place, place));
      const next = existing
        ? list.filter((f) => f !== existing)
        : [{ id: `${Date.now()}`, label: label ?? place.name, place: { ...place, kind: place.kind === 'current' ? 'map' : place.kind }, createdAt: Date.now() }, ...list];
      void saveFavourites(next);
      return next;
    });
  }, []);

  const removeFavourite = useCallback((id: string) => {
    setFavourites((list) => {
      const next = list.filter((f) => f.id !== id);
      void saveFavourites(next);
      return next;
    });
  }, []);

  const setCommutePlace = useCallback((kind: CommuteKind, place: Place | null) => {
    setCommute((cur) => {
      const next = { ...cur };
      if (place) next[kind] = { ...place, kind: place.kind === 'current' ? 'map' : place.kind };
      else delete next[kind];
      void saveCommute(next);
      return next;
    });
  }, []);

  const logActivity = useCallback((e: Omit<ActivityEntry, 'id' | 'at'>) => setActivity((list) => addActivity(list, e)), []);

  const runPlan = useCallback(
    async (o?: Place, d?: Place) => {
      const from = o ?? origin;
      const to = d ?? destination;
      if (!from || !to) {
        setPlan({ status: 'error', error: 'Choose both a start point and a destination.' });
        return;
      }
      const when = departAt ?? Date.now();
      setPlan({ status: 'planning', origin: from, destination: to, departAt: when });
      // Yield so the "planning" state renders before the CPU-bound search.
      await new Promise((r) => setTimeout(r, 30));
      try {
        network.current ??= buildNetwork(transportData);
        const result = planTrip(network.current, { origin: from, destination: to, departAt: new Date(when), prefs });
        setPlan({ status: 'done', result, origin: from, destination: to, departAt: when });
        setRecents((list) => addRecent(list, from, to));
      } catch (e) {
        setPlan({ status: 'error', error: `Journey planning failed: ${(e as Error).message}`, origin: from, destination: to });
      }
    },
    [origin, destination, departAt, prefs],
  );

  const getJourney = useCallback((id: string) => plan.result?.journeys.find((j) => j.id === id), [plan]);

  const eraseData = useCallback(async () => {
    await eraseAll();
    setPrefsState(DEFAULT_PREFERENCES);
    setFavourites([]);
    setCommute({});
    setRecents([]);
    setActivity([]);
  }, []);

  const value = useMemo<AppStateValue>(
    () => ({
      ready,
      prefs,
      setPrefs,
      favourites,
      toggleFavourite,
      isFavourite,
      removeFavourite,
      commute,
      setCommutePlace,
      recents,
      clearRecents: () => {
        setRecents([]);
        void saveRecents([]);
      },
      activity,
      logActivity,
      origin,
      destination,
      setOrigin,
      setDestination,
      swap: () => {
        setOrigin(destination);
        setDestination(origin);
      },
      departAt,
      setDepartAt,
      plan,
      runPlan,
      getJourney,
      eraseData,
    }),
    [ready, prefs, setPrefs, favourites, toggleFavourite, isFavourite, removeFavourite, commute, setCommutePlace, recents, activity, logActivity, origin, destination, departAt, plan, runPlan, getJourney, eraseData],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppStateValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppState must be used inside AppStateProvider');
  return v;
}
