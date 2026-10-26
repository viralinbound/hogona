export type EdgeKind =
  | 'walk' // on foot between two places
  | 'interchange' // walk between platforms of two metro lines inside the paid area
  | 'board' // step onto a metro line or bus route (cost includes the wait)
  | 'ride' // travel between consecutive stations/stops on one vehicle
  | 'alight'
  | 'hail'; // ride-hailing between the origin/destination and a station

export type VehicleMode = 'metro' | 'bus';

export interface Edge {
  to: number;
  kind: EdgeKind;
  /** Travel time in seconds (for 'board', the wait is added by the router at query time). */
  timeSec: number;
  distanceM: number;
  mode?: VehicleMode;
  /** Metro line id or bus route id for board/ride/alight edges. */
  serviceId?: string;
}

export type NodeType = 'station' | 'metro-vehicle' | 'stop' | 'bus-vehicle' | 'origin' | 'destination';

export interface NodeInfo {
  type: NodeType;
  /** Station or stop id. */
  refId: string;
  lat: number;
  lon: number;
  /** For vehicle nodes: the line/route and the position in its stop list. */
  serviceId?: string;
  seq?: number;
}

/** Adjacency-list graph with integer node ids. */
export class Graph {
  readonly nodes: NodeInfo[] = [];
  readonly adj: Edge[][] = [];
  private index = new Map<string, number>();

  addNode(key: string, info: NodeInfo): number {
    const existing = this.index.get(key);
    if (existing !== undefined) return existing;
    const id = this.nodes.length;
    this.nodes.push(info);
    this.adj.push([]);
    this.index.set(key, id);
    return id;
  }

  id(key: string): number | undefined {
    return this.index.get(key);
  }

  addEdge(from: number, edge: Edge): void {
    this.adj[from].push(edge);
  }

  addBidirectional(a: number, b: number, edge: Omit<Edge, 'to'>): void {
    this.addEdge(a, { ...edge, to: b });
    this.addEdge(b, { ...edge, to: a });
  }

  get edgeCount(): number {
    return this.adj.reduce((n, list) => n + list.length, 0);
  }
}
