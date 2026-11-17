// Package A1, step 1: Yale places (cached pages of events.yale.edu/api/2/places) → public/data/buildings.json
// Run: ./node_modules/.bin/tsx scripts/buildings.ts
import fs from 'fs';

export type Building = { name: string; lat: number; lng: number; addr: string; photoRaw: string | null; aliases?: string[] };

const BBOX = { latMin: 41.29, latMax: 41.34, lngMin: -72.95, lngMax: -72.9 };
const byName = new Map<string, Building>();

for (const i of [1, 2, 3, 4, 5]) {
  const f = `scripts/.cache/places${i}.json`;
  if (!fs.existsSync(f)) continue;
  for (const { place: p } of JSON.parse(fs.readFileSync(f, 'utf8')).places ?? []) {
    const lat = +p.geo?.latitude, lng = +p.geo?.longitude;
    if (!lat || !lng || lat < BBOX.latMin || lat > BBOX.latMax || lng < BBOX.lngMin || lng > BBOX.lngMax) continue;
    byName.set(p.name, { name: p.name, lat: +lat.toFixed(6), lng: +lng.toFixed(6), addr: (p.address || p.geo?.street || '').trim(), photoRaw: p.photo_url || null });
  }
}

// Corrections and places missing from the endpoint (coordinates checked by hand; Tsai CITY per PLAN.md §0).
const MANUAL: Building[] = [
  { name: 'Tsai CITY', lat: 41.3124, lng: -72.9249, addr: '17 Prospect Street, New Haven, CT', photoRaw: null },
  { name: 'Center for Engineering Innovation & Design', lat: 41.31275, lng: -72.92525, addr: '15 Prospect Street, New Haven, CT', photoRaw: null },
  { name: 'East Rock Park', lat: 41.3262, lng: -72.9072, addr: 'East Rock Road, New Haven, CT', photoRaw: null },
];
for (const m of MANUAL) byName.set(m.name, m);

const ALIASES: Record<string, string[]> = {
  'Sheffield-Sterling-Strathcona Hall': ['SSS'],
  'Linsly-Chittenden Hall': ['LC'],
  'W. L. Harkness Hall': ['WLH'],
  'Humanities Quadrangle': ['HQ'],
  'Yale Science Building': ['YSB'],
  'Watson Hall': ['AKW', 'Arthur K. Watson Hall'],
  'Dunham Laboratory': ['DL'],
  'Kline Tower': ['KT'],
  'Evans Hall': ['SOM', 'Yale School of Management'],
  'Center for Engineering Innovation & Design': ['CEID'],
  'Tsai CITY': ['Tsai Center for Innovative Thinking at Yale', '17 Prospect St'],
  'Yale Schwarzman Center': ['Schwarzman Center', 'Commons', 'The Underground', 'Good Life Center'],
  'Bass Library': ['Bass'],
  'Sterling Memorial Library': ['SML', 'Sterling'],
  'Watson Center': ['WTS'],
  'Luce Hall': ['Luce'],
  'Loria Center': ['Loria'],
  'Kroon Hall': ['Kroon'],
  'Leitner Observatory & Planetarium': ['Leitner Observatory', 'Leitner Family Observatory and Planetarium'],
  'Payne Whitney Gymnasium': ['Payne Whitney Gym', 'PWG'],
  'East Rock Park': ['East Rock'],
  'Becton Engineering and Applied Science Center': ['Becton', 'Becton Center', 'Davies Auditorium'],
  'Sloane Physics Laboratory': ['SPL'],
  'Wright Laboratory': ['Wright Lab'],
  'Mason Laboratory': ['ML', 'Mason Lab'],
};
for (const [n, a] of Object.entries(ALIASES)) { const b = byName.get(n); if (b) b.aliases = a; else console.warn('alias target missing:', n); }

const out = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
fs.writeFileSync('public/data/buildings.json', JSON.stringify(out, null, 1));
console.log('buildings', out.length);
