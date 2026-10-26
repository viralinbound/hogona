import { scoreJourneys, sortJourneys, tagJourneys } from '../algorithms/journey-ranking';
import type { Journey, LegMode } from '../types/journey';

const j = (id: string, min: number, fare: number | null, walkM: number, transfers: number, modes: LegMode[] = ['metro']): Journey => ({
  id,
  title: id,
  legs: [],
  departAt: 0,
  arriveAt: min * 60000,
  durationSec: min * 60,
  walkM,
  walkSec: 0,
  waitSec: 0,
  transfers,
  fare: fare === null ? { known: 0, complete: false, unknownParts: ['ride'] } : { known: fare, complete: true, unknownParts: [] },
  modes,
  warnings: [],
  tags: [],
});

const W = { time: 1, cost: 1, walking: 1, transfers: 1 };

describe('balanced scoring', () => {
  it('gives the best-in-everything journey a score of 1', () => {
    const list = [j('best', 30, 20, 0, 0), j('worse', 60, 40, 800, 2)];
    scoreJourneys(list, W);
    expect(list[0].score!.total).toBeCloseTo(1);
    expect(list[1].score!.total).toBeGreaterThan(1);
  });

  it('follows the weights', () => {
    const fast = j('fast', 30, 80, 0, 0);
    const cheap = j('cheap', 60, 10, 0, 0);
    scoreJourneys([fast, cheap], { time: 5, cost: 0, walking: 0, transfers: 0 });
    expect(sortJourneys([cheap, fast], 'recommended')[0].id).toBe('fast');
    scoreJourneys([fast, cheap], { time: 0, cost: 5, walking: 0, transfers: 0 });
    expect(sortJourneys([fast, cheap], 'recommended')[0].id).toBe('cheap');
  });

  it('never treats an unknown ride fare as cheaper than known fares', () => {
    const transit = j('transit', 40, 60, 300, 1);
    const ride = j('ride', 25, null, 0, 0, ['ride']);
    scoreJourneys([transit, ride], W);
    expect(ride.score!.cost).toBeGreaterThan(transit.score!.cost);
  });
});

describe('sorting and tags', () => {
  const list = () => [j('a', 50, 30, 900, 1), j('b', 35, 60, 200, 0), j('c', 45, null, 0, 0, ['ride']), j('walk', 70, 0, 4000, 0, ['walk'])];

  it('sorts by each criterion', () => {
    expect(sortJourneys(list(), 'fastest')[0].id).toBe('b');
    expect(sortJourneys(list(), 'cheapest')[0].id).toBe('walk');
    expect(sortJourneys(list(), 'least-walking')[0].id).toBe('c');
    expect(sortJourneys(list(), 'cheapest').at(-1)!.id).toBe('c');
  });

  it('only tags "cheapest" among paid journeys with complete fares', () => {
    const l = list();
    scoreJourneys(l, W);
    tagJourneys(l);
    expect(l.find((x) => x.tags.includes('cheapest'))!.id).toBe('a');
    expect(l.find((x) => x.tags.includes('fastest'))!.id).toBe('b');
    expect(l.filter((x) => x.tags.includes('recommended'))).toHaveLength(1);
  });
});
