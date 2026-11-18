// Package A1 — Yale places (PLAN.md §4.1 source 2) → public/data/buildings.json
// Alias table is by hand: short names students say, mapped to an exact `name` in the file.
import fs from 'fs';
import path from 'path';

export type Building = {
  name: string;
  lat: number;
  lng: number;
  addr: string;
  photoRaw: string | null;
};

const UA = 'campus-events-hackathon/1.0 (yale-orbit; educational hackathon)';
const OUT = 'public/data/buildings.json';
const CACHE = 'scripts/.cache/places.json';

/**
 * Hand alias table. Values are exact `name`s written to buildings.json.
 * SSS, LC, WLH, HQ, YSB, AKW, DL, KT, SOM / Evans Hall, CEID (inside Becton),
 * Tsai CITY (17 Prospect St — the places API pin is wrong), Schwarzman / Commons,
 * Bass, Sterling (SML), Watson Center (WTS), Luce, Loria, Kroon, Leitner,
 * Payne Whitney, East Rock, and the 14 residential colleges.
 */
export const ALIASES: Record<string, string> = {
  SSS: 'Sheffield-Sterling-Strathcona Hall',
  LC: 'Linsly-Chittenden Hall',
  WLH: 'W. L. Harkness Hall',
  HQ: 'Humanities Quadrangle',
  YSB: 'Yale Science Building',
  AKW: 'Watson Hall',
  DL: 'Dunham Laboratory',
  KT: 'Kline Tower',
  SOM: 'Evans Hall',
  'Evans Hall': 'Evans Hall',
  CEID: 'Center for Engineering Innovation & Design',
  'Tsai CITY': 'Tsai CITY',
  Schwarzman: 'Yale Schwarzman Center',
  Commons: 'Yale Schwarzman Center',
  Bass: 'Bass Library',
  SML: 'Sterling Memorial Library',
  Sterling: 'Sterling Memorial Library',
  WTS: 'Watson Center',
  'Watson Center': 'Watson Center',
  'Luce Hall': 'Luce Hall',
  Loria: 'Loria Center',
  Kroon: 'Kroon Hall',
  Leitner: 'Leitner Observatory & Planetarium',
  'Payne Whitney': 'Payne Whitney Gymnasium',
  'East Rock': 'East Rock Park',
  Berkeley: 'Berkeley College',
  Branford: 'Branford College',
  Davenport: 'Davenport College',
  'Ezra Stiles': 'Ezra Stiles College',
  'Jonathan Edwards': 'Jonathan Edwards College',
  'Benjamin Franklin': 'Benjamin Franklin College',
  'Grace Hopper': 'Grace Hopper College',
  Morse: 'Morse College',
  Pierson: 'Pierson College',
  Saybrook: 'Saybrook College',
  Silliman: 'Silliman College',
  'Timothy Dwight': 'Timothy Dwight College',
  Trumbull: 'Trumbull College',
  'Pauli Murray': 'Pauli Murray College',
};

const COLLEGES = [
  'Berkeley College',
  'Branford College',
  'Davenport College',
  'Ezra Stiles College',
  'Jonathan Edwards College',
  'Benjamin Franklin College',
  'Grace Hopper College',
  'Morse College',
  'Pierson College',
  'Saybrook College',
  'Silliman College',
  'Timothy Dwight College',
  'Trumbull College',
  'Pauli Murray College',
];

type RawPlace = {
  name?: string;
  address?: unknown;
  photo_url?: string | null;
  geo?: { latitude?: number | string | null; longitude?: number | string | null };
};

function asAddr(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return [o.street, o.city, o.state, o.zip].filter((x) => typeof x === 'string').join(', ');
  }
  return '';
}

function fromApi(raw: RawPlace): Building | null {
  const lat = Number(raw.geo?.latitude);
  const lng = Number(raw.geo?.longitude);
  if (!raw.name || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    name: raw.name,
    lat,
    lng,
    addr: asAddr(raw.address),
    photoRaw: raw.photo_url || null,
  };
}

async function fetchPlaces(): Promise<Building[]> {
  const all: Building[] = [];
  for (let page = 1; page <= 4; page++) {
    const url = `https://events.yale.edu/api/2/places?pp=100&page=${page}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`places page ${page} HTTP ${res.status}`);
    const data = (await res.json()) as { places?: { place?: RawPlace }[] };
    const rows = data.places ?? [];
    if (!rows.length) break;
    for (const row of rows) {
      const b = fromApi(row.place ?? (row as unknown as RawPlace));
      if (b) all.push(b);
    }
    console.log(`places page ${page}: ${rows.length}`);
  }
  return all;
}

/** One Overpass request, exactly the bbox from PLAN.md §9 A1. East Rock usually sits north of it. */
async function overpassEastRock(): Promise<Building | null> {
  const query = `[out:json][timeout:25];(way["building"]["name"](41.300,-72.940,41.326,-72.912);relation["building"]["name"](41.300,-72.940,41.326,-72.912););out center tags;`;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      elements?: { tags?: { name?: string }; lat?: number; lon?: number; center?: { lat: number; lon: number } }[];
    };
    const hit = (data.elements ?? []).find((e) => /east rock/i.test(e.tags?.name ?? ''));
    if (!hit) return null;
    const lat = hit.center?.lat ?? hit.lat;
    const lng = hit.center?.lon ?? hit.lon;
    if (lat == null || lng == null) return null;
    return { name: 'East Rock Park', lat, lng, addr: 'East Rock Park, New Haven, CT', photoRaw: null };
  } catch (err) {
    console.log('overpass skipped:', err instanceof Error ? err.message : err);
    return null;
  }
}

function dedupe(list: Building[]): Building[] {
  const by = new Map<string, Building>();
  for (const b of list) if (!by.has(b.name)) by.set(b.name, b);
  return [...by.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function buildBuildings(): Promise<Building[]> {
  let api: Building[];
  try {
    api = await fetchPlaces();
    fs.mkdirSync(path.dirname(CACHE), { recursive: true });
    fs.writeFileSync(CACHE, JSON.stringify(api));
  } catch (err) {
    if (!fs.existsSync(CACHE)) throw err;
    console.log('places API failed, using cache:', err instanceof Error ? err.message : err);
    api = JSON.parse(fs.readFileSync(CACHE, 'utf8')) as Building[];
  }

  const byName = new Map(api.map((b) => [b.name, { ...b }]));
  const becton = byName.get('Becton Engineering and Applied Science Center');
  const tsai = byName.get('Tsai CITY');

  // The places endpoint pins Tsai CITY on Elm Street. The real room is 17 Prospect.
  byName.set('Tsai CITY', {
    name: 'Tsai CITY',
    lat: 41.3124,
    lng: -72.9249,
    addr: '17 Prospect Street, New Haven, CT 06511',
    photoRaw: tsai?.photoRaw ?? null,
  });

  // CEID is inside Becton. Shift ~8 m so a pin here is not identical to Davies Auditorium.
  byName.set('Center for Engineering Innovation & Design', {
    name: 'Center for Engineering Innovation & Design',
    lat: +((becton?.lat ?? 41.312605) + 8 / 111320).toFixed(6),
    lng: becton?.lng ?? -72.925136,
    addr: becton?.addr || '15 Prospect Street, New Haven, CT 06511',
    photoRaw: becton?.photoRaw ?? null,
  });

  if (!byName.has('East Rock Park')) {
    const fromOverpass = await overpassEastRock();
    byName.set(
      'East Rock Park',
      fromOverpass ?? {
        name: 'East Rock Park',
        lat: 41.3248,
        lng: -72.9112,
        addr: 'East Rock Park, New Haven, CT',
        photoRaw: null,
      },
    );
  }

  const buildings = dedupe([...byName.values()]);
  const names = new Set(buildings.map((b) => b.name));
  const missing = [...new Set(Object.values(ALIASES))].filter((n) => !names.has(n));
  if (missing.length) throw new Error(`alias targets missing from places: ${missing.join(', ')}`);
  const collegesMissing = COLLEGES.filter((n) => !names.has(n));
  if (collegesMissing.length) throw new Error(`colleges missing: ${collegesMissing.join(', ')}`);

  const tsaiOut = buildings.find((b) => b.name === 'Tsai CITY');
  if (!tsaiOut || tsaiOut.lat !== 41.3124 || tsaiOut.lng !== -72.9249) {
    throw new Error('Tsai CITY coordinates were not overridden');
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(buildings, null, 2) + '\n');
  console.log(`buildings ${buildings.length} → ${OUT}`);
  return buildings;
}

export function loadBuildings(): Building[] {
  return JSON.parse(fs.readFileSync(OUT, 'utf8')) as Building[];
}

const isDirect = (process.argv[1] ?? '').includes('buildings.ts');
if (isDirect) {
  buildBuildings().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
