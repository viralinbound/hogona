// Dev smoke test on real data: npx tsx scripts/smoke.ts
import { buildNetwork, planJourneys } from '../src/algorithms/multimodal-router';
import { transportData } from '../src/services/transport-data';
import { DEFAULT_PREFERENCES } from '../src/types/journey';
import { dataIssues } from '../src/services/transport-data';
const t0 = Date.now();
const net = buildNetwork(transportData);
console.log('build ms', Date.now() - t0, 'nodes', net.graph.nodes.length, 'edges', net.graph.edgeCount);
console.log('issues', dataIssues().filter(i=>i.level==='error').slice(0,5), dataIssues().length);
const P = (name: string, lat: number, lon: number) => ({ name, lat, lon, kind: 'address' as const });
const cases = [
  [P('Indiranagar 100ft Rd', 12.9719, 77.6412), P('Electronic City Ph1', 12.8452, 77.6602)],
  [P('Whitefield ITPL', 12.9877, 77.7370), P('Majestic', 12.9767, 77.5713)],
  [P('Jayanagar 4th Block', 12.9250, 77.5838), P('Hebbal', 13.0358, 77.5970)],
  [P('Cubbon Park', 12.9763, 77.5929), P('MG Road', 12.9756, 77.6066)],
];
const dep = new Date('2026-10-22T09:15:00+05:30');
for (const [o, d] of cases) {
  const t = Date.now();
  const r = planJourneys(net, { origin: o, destination: d, departAt: dep, prefs: DEFAULT_PREFERENCES });
  console.log(`\n== ${o.name} -> ${d.name} (${Date.now() - t} ms)`, r.notices);
  for (const j of r.journeys) console.log(`  [${j.tags.join(',')}] ${j.title} | ${Math.round(j.durationSec/60)} min | walk ${Math.round(j.walkM)} m | xfer ${j.transfers} | fare ${j.fare.known}${j.fare.complete?'':'+?('+j.fare.unknownParts.join(',')+')'} | score ${j.score?.total.toFixed(2)}\n     ` + j.legs.map(l => `${l.mode}${l.line?'('+l.line.name+')':''}${l.route?'('+l.route.ref+')':''} ${l.from.name}→${l.to.name} ${Math.round(l.durationSec/60)}m`).join(' ; '));
}
