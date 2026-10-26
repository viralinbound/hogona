import type { Edge } from './graph';

/** Binary min-heap keyed by a numeric priority. */
export class MinHeap<T> {
  private items: { p: number; v: T }[] = [];

  get size() {
    return this.items.length;
  }

  push(p: number, v: T) {
    const a = this.items;
    a.push({ p, v });
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (a[parent].p <= a[i].p) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      i = parent;
    }
  }

  pop(): { p: number; v: T } | undefined {
    const a = this.items;
    if (!a.length) return undefined;
    const top = a[0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].p < a[m].p) m = l;
        if (r < a.length && a[r].p < a[m].p) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
}

export interface PathStep {
  from: number;
  edge: Edge;
}

export interface DijkstraOptions {
  source: number;
  target: number;
  /** Number of node ids in use (graph nodes plus any virtual query nodes). */
  nodeCount: number;
  /** Outgoing edges of a node (base graph plus any query-specific edges). */
  neighbors: (node: number) => Edge[];
  /** Generalised cost of traversing an edge; return Infinity to forbid it. */
  cost: (edge: Edge, from: number) => number;
  /** Maximum number of vehicle boardings (transfers + 1). */
  maxBoardings: number;
  /**
   * Optional A* heuristic: a lower bound on the remaining cost from a node to
   * the target. Must never overestimate, or the result may not be optimal.
   */
  heuristic?: (node: number) => number;
}

export interface DijkstraResult {
  cost: number;
  steps: PathStep[];
}

/**
 * Dijkstra (A* when a heuristic is given) over (node, boardings-so-far)
 * states, so a transfer limit is enforced exactly while still finding the
 * cheapest path under it. State arrays are typed for speed on the full
 * BMTC network (~200k nodes).
 */
/** Search buffers reused across calls (a query runs ~8 searches on ~1M states). */
let buf: { dist: Float64Array; prevState: Int32Array; prevEdge: (Edge | undefined)[] } | null = null;

export function dijkstra({ source, target, nodeCount, neighbors, cost, maxBoardings, heuristic }: DijkstraOptions): DijkstraResult | null {
  const layers = maxBoardings + 1;
  const size = nodeCount * layers;
  if (!buf || buf.dist.length < size) {
    buf = { dist: new Float64Array(size).fill(Infinity), prevState: new Int32Array(size).fill(-1), prevEdge: new Array(size) };
  }
  const { dist, prevState, prevEdge } = buf;
  const touched: number[] = [];
  const h = heuristic ?? (() => 0);
  try {
    return run();
  } finally {
    // Reset only what this search wrote, so the next search starts clean.
    for (const i of touched) {
      dist[i] = Infinity;
      prevState[i] = -1;
      prevEdge[i] = undefined;
    }
  }

  function run(): DijkstraResult | null {
  const heap = new MinHeap<number>();
  const start = source * layers;
  dist[start] = 0;
  touched.push(start);
  heap.push(h(source), start);

  while (heap.size) {
    const { p, v: state } = heap.pop()!;
    const node = Math.floor(state / layers);
    const g = dist[state];
    if (p > g + h(node) + 1e-9) continue; // stale heap entry
    const boardings = state % layers;
    if (node === target) {
      const steps: PathStep[] = [];
      let s = state;
      while (s !== start) {
        const from = Math.floor(prevState[s] / layers);
        steps.unshift({ from, edge: prevEdge[s]! });
        s = prevState[s];
      }
      return { cost: g, steps };
    }
    for (const edge of neighbors(node)) {
      const c = cost(edge, node);
      if (!Number.isFinite(c)) continue;
      const nb = edge.kind === 'board' || edge.kind === 'hail' ? boardings + 1 : boardings;
      if (nb > maxBoardings) continue;
      const ns = edge.to * layers + nb;
      const nd = g + c;
      if (nd < dist[ns]) {
        if (dist[ns] === Infinity) touched.push(ns);
        dist[ns] = nd;
        prevState[ns] = state;
        prevEdge[ns] = edge;
        heap.push(nd + h(edge.to), ns);
      }
    }
  }
  return null;
  }
}
