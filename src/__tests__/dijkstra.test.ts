import { dijkstra, MinHeap } from '../algorithms/dijkstra';
import { Graph } from '../algorithms/graph';

describe('MinHeap', () => {
  it('pops in priority order', () => {
    const h = new MinHeap<string>();
    [5, 1, 4, 2, 3].forEach((p) => h.push(p, `v${p}`));
    const out: number[] = [];
    while (h.size) out.push(h.pop()!.p);
    expect(out).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('dijkstra with boarding limit', () => {
  // s --walk 100--> t   (slow)
  // s --board--> v1 --ride 10--> v2 --alight--> t   (fast, one boarding)
  const g = new Graph();
  const s = g.addNode('s', { type: 'origin', refId: 's', lat: 0, lon: 0 });
  const t = g.addNode('t', { type: 'destination', refId: 't', lat: 0, lon: 0 });
  const v1 = g.addNode('v1', { type: 'metro-vehicle', refId: 'v1', lat: 0, lon: 0 });
  const v2 = g.addNode('v2', { type: 'metro-vehicle', refId: 'v2', lat: 0, lon: 0 });
  g.addEdge(s, { to: t, kind: 'walk', timeSec: 100, distanceM: 100 });
  g.addEdge(s, { to: v1, kind: 'board', timeSec: 0, distanceM: 0, mode: 'metro' });
  g.addEdge(v1, { to: v2, kind: 'ride', timeSec: 10, distanceM: 10, mode: 'metro' });
  g.addEdge(v2, { to: t, kind: 'alight', timeSec: 0, distanceM: 0, mode: 'metro' });
  const cost = (e: { kind: string; timeSec: number }) => (e.kind === 'board' ? 5 : e.timeSec);

  it('takes the vehicle when boardings are allowed', () => {
    const r = dijkstra({ source: s, target: t, nodeCount: g.nodes.length, neighbors: (u) => g.adj[u], cost, maxBoardings: 1 })!;
    expect(r.cost).toBe(15);
    expect(r.steps.map((x) => x.edge.kind)).toEqual(['board', 'ride', 'alight']);
  });

  it('falls back to walking when no boarding is allowed', () => {
    const r = dijkstra({ source: s, target: t, nodeCount: g.nodes.length, neighbors: (u) => g.adj[u], cost, maxBoardings: 0 })!;
    expect(r.cost).toBe(100);
  });

  it('returns null when the target is unreachable', () => {
    const r = dijkstra({ source: s, target: t, nodeCount: g.nodes.length, neighbors: () => [], cost, maxBoardings: 1 });
    expect(r).toBeNull();
  });

  it('skips edges with infinite cost', () => {
    const r = dijkstra({ source: s, target: t, nodeCount: g.nodes.length, neighbors: (u) => g.adj[u], cost: (e) => (e.kind === 'board' ? Infinity : e.timeSec), maxBoardings: 1 })!;
    expect(r.cost).toBe(100);
  });
});
