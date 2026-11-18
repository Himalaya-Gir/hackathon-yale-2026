// Merge every source except the official Yale calendar (owned by scripts/yale-calendar.mjs)
// and Yale Connect when those rows are already in events.json (scripts/yale-connect.mjs).
// Appends only. Never removes a source 'yale-calendar' row.
// Run: pnpm exec tsx scripts/ingest.ts
import fs from 'fs';
import type { ActivityKind, Track, YaleEvent } from '../lib/types';
import type { EventSourceAdapter, RawEvent } from './adapters/types';
import { lumaAdapter } from './adapters/luma';
import { handCheckedAdapter } from './adapters/hand-checked';
import { newslettersAdapter } from './adapters/newsletters';

const DAYS = 30;
const EVENTS_PATH = 'public/data/events.json';
const EXTRA_PATH = 'public/data/extra-events.json';
const BUILDINGS_PATH = 'public/data/buildings.json';
const STATS_PATH = 'public/data/stats.json';
const GEO_CACHE = 'scripts/.cache/nominatim.json';
const UA = { 'User-Agent': 'campus-events-hackathon/1.0' };

const ADAPTERS: EventSourceAdapter[] = [lumaAdapter, handCheckedAdapter, newslettersAdapter];

type Building = { name: string; lat: number; lng: number; addr: string };
type Extra = {
  reason: 'no-coordinates' | 'outside-new-haven' | 'too-long' | 'online' | 'no-matching-photo';
  source: string;
  title: string;
  start: string;
  end: string | null;
  locationRaw: string;
  sourceUrl: string;
  host: string | null;
  lat: number | null;
  lng: number | null;
  summary: string;
};

const TRACK_RULES: [Track, RegExp][] = [
  ['space', /\b(space|rocket|astro\w*|planet\w*|satellite|nasa|orbit\w*|aerospace|lunar)\b/],
  ['ai', /\b(ai|a\.i\.|artificial intelligence|machine learning|llm|robot\w*|data science)\b/],
  ['startup', /\b(start-?ups?|entrepreneur\w*|founders?|venture|tsai|innovation|pitch)\b/],
  ['industry', /\b(engineer\w*|industry|hardware|technology|tech)\b/],
  ['climate', /\b(climate|environment\w*|sustainab\w*|energy)\b/],
  ['health', /\b(health|medic\w*|wellness|yoga)\b/],
  ['policy', /\b(policy|law|legal|politic\w*|government)\b/],
  ['finance', /\b(financ\w*|econom\w*|invest\w*|venture capital)\b/],
  ['career', /\b(career\w*|internship|networking|professional)\b/],
  ['arts', /\b(arts?|music\w*|concerts?|films?|theat(er|re)|gallery|exhibit\w*|dance|museum|jazz|screening|tour)\b/],
  ['social', /\b(social|mixer|community|festival|fair|market)\b/],
  ['research', /\b(lectures?|seminars?|research|talks?|panel|scien\w*|reading)\b/],
];
const KIND_RULES: [ActivityKind, RegExp][] = [
  ['music-live', /\b(concerts?|recitals?|choirs?|choristers?|jazz|orchestras?|quartets?|trios?|bands?|choral|evensong|carols?|ballet|nutcracker|piano|organ)\b/],
  ['arts-watch', /\b(films?|screenings?|theat(er|re)|exhibit\w*|gallery|museum|tours?|ballet|nutcracker|performance)\b/],
  ['awe', /\b(planetarium|observatory|stargazing|telescope)\b/],
  ['move', /\b(yoga|run|running|fitness|walk|hike|sport|wrestling|hockey)\b/],
  ['move-together', /\b(dance|dancing|intramural)\b/],
  ['calm', /\b(meditat\w*|mindful\w*|sound bath)\b/],
  ['laugh', /\b(comedy|improv|stand-up|trivia)\b/],
  ['help', /\b(volunteers?|service day)\b/],
  ['create', /\b(craft\w*|workshop|paint|studio|hackathon|make)\b/],
  ['build', /\b(hackathon|build|maker\w*|coding|website|ai)\b/],
  ['nature', /\b(garden|nature|outdoor|park|hike)\b/],
  ['food-together', /\b(lunch|dinner|breakfast|brunch|coffee|food|pizza|happy hour)\b/],
  ['social-small', /\b(discussion|conversation|book club|fireside|coffee)\b/],
  ['social-big', /\b(mixer|festival|party|fair|reception|social)\b/],
  ['learn', /\b(lectures?|talks?|seminars?|workshops?|panel|tour|reading|class)\b/],
];

const ALIASES: [RegExp, string][] = [
  [/tsai (city|center)|17 prospect/, 'Tsai CITY'],
  [/schwarzman/, 'Yale Schwarzman Center'],
  [/beinecke/, 'Beinecke Library'],
  [/university art gallery|\byuag\b/, 'Yale University Art Gallery'],
  [/british art|\bycba\b/, 'Yale Center for British Art'],
  [/peabody/, 'Yale Peabody Museum'],
  [/battell/, 'Battell Chapel'],
  [/christ church|84 broadway/, 'Christ Church'],
  [/woolsey/, 'Woolsey Hall'],
  [/sprague/, 'Sprague Hall'],
  [/benjamin franklin|90 prospect/, 'Benjamin Franklin College'],
  [/ingalls/, 'Ingalls Rink'],
  [/shubert/, 'Shubert Theatre'],
  [/long wharf theat/, 'Long Wharf Theater'],
];

const VENUE_QUERY: [RegExp, string][] = [
  [/cafe nine/, 'Cafe Nine, New Haven, CT'],
  [/firehouse\s*12/, 'Firehouse 12, New Haven, CT'],
  [/institute library/, 'Institute Library, New Haven, CT'],
  [/il gabbiano|501 long wharf/, '501 Long Wharf Drive, New Haven, CT'],
  [/climatehaven|770 chapel/, '770 Chapel Street, New Haven, CT'],
  [/iseman/, 'Iseman Theater, New Haven, CT'],
  [/toad'?s place/, "Toad's Place, New Haven, CT"],
  [/college street music hall/, 'College Street Music Hall, New Haven, CT'],
  [/new haven free public library|\bnhfpl\b|ives (main|library)/, 'New Haven Free Public Library, New Haven, CT'],
  [/140 bradley/, '140 Bradley Street, New Haven, CT'],
  [/17 hillhouse/, '17 Hillhouse Avenue, New Haven, CT'],
  [/101 college/, '101 College Street, New Haven, CT'],
  [/hotel marcel/, 'Hotel Marcel, New Haven, CT'],
  [/trinity on the green|trinity church/, 'Trinity Church on the Green, New Haven, CT'],
  [/fair haven library/, 'Fair Haven Library, New Haven, CT'],
  [/wilson library/, 'Wilson Library, New Haven, CT'],
  [/ingalls/, 'Ingalls Rink, New Haven, CT'],
];

function clip(text: string, max: number) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.–-]+$/, '')}…`;
}

function hash(s: string) {
  let h = 2166136261;
  for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

function normTitle(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

function dayKey(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function tags<T extends string>(rules: [T, RegExp][], text: string, fallback: T): T[] {
  const out: T[] = [];
  for (const [id, re] of rules) if (re.test(text) && !out.includes(id)) out.push(id);
  return out.length ? out.slice(0, 3) : [fallback];
}

const normAddr = (s: string) => s.toLowerCase()
  .replace(/\bstreet\b/g, 'st').replace(/\bavenue\b/g, 'ave').replace(/\bdrive\b/g, 'dr')
  .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

function inNewHaven(lat: number, lng: number) {
  return lat >= 41.28 && lat <= 41.345 && lng >= -72.97 && lng <= -72.885;
}

function loadGeoCache(): Record<string, { lat: number; lng: number } | null> {
  try { return JSON.parse(fs.readFileSync(GEO_CACHE, 'utf8')); }
  catch { return {}; }
}

async function nominatim(query: string, cache: Record<string, { lat: number; lng: number } | null>) {
  const key = query.toLowerCase();
  if (key in cache) return cache[key];
  await new Promise((r) => setTimeout(r, 1100));
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: UA });
  const rows = res.ok ? await res.json() as { lat: string; lon: string }[] : [];
  const hit = rows[0] ? { lat: Number(rows[0].lat), lng: Number(rows[0].lon) } : null;
  cache[key] = hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lng) ? hit : null;
  fs.mkdirSync('scripts/.cache', { recursive: true });
  fs.writeFileSync(GEO_CACHE, JSON.stringify(cache));
  return cache[key];
}

async function locate(raw: RawEvent, buildings: Building[], cache: Record<string, { lat: number; lng: number } | null>) {
  if (raw.lat != null && raw.lng != null && Number.isFinite(raw.lat) && Number.isFinite(raw.lng)) {
    const blob = `${raw.locationRaw} ${raw.title}`;
    const alias = ALIASES.find(([re]) => re.test(blob.toLowerCase()));
    const named = alias ? buildings.find((b) => b.name === alias[1]) : undefined;
    return { lat: raw.lat, lng: raw.lng, building: named?.name ?? null, locationName: raw.locationRaw.split(',')[0] || raw.locationRaw };
  }
  const blob = `${raw.locationRaw} ${raw.title}`.toLowerCase();
  if (/online|virtual|zoom|google meet/.test(blob) && !/\d+\s+\w+/.test(blob)) {
    return { online: true as const };
  }
  const alias = ALIASES.find(([re]) => re.test(blob));
  if (alias) {
    const b = buildings.find((x) => x.name === alias[1]);
    if (b) return { lat: b.lat, lng: b.lng, building: b.name, locationName: b.name };
  }
  const n = normAddr(blob);
  const byName = buildings.find((b) => n.includes(normAddr(b.name)) && normAddr(b.name).length > 6);
  if (byName) return { lat: byName.lat, lng: byName.lng, building: byName.name, locationName: byName.name };
  const street = n.match(/(\d+\s+[a-z0-9]+(?:\s+[a-z0-9]+){0,2}\s(?:st|ave|rd|dr|pl|ct))/)?.[1];
  if (street) {
    const byAddr = buildings.find((b) => normAddr(b.addr).includes(street));
    if (byAddr) return { lat: byAddr.lat, lng: byAddr.lng, building: byAddr.name, locationName: byAddr.name };
  }
  const venue = VENUE_QUERY.find(([re]) => re.test(blob));
  const query = venue?.[1] ?? (street ? `${street}, New Haven, CT` : null);
  if (!query) return null;
  const hit = await nominatim(query, cache);
  if (!hit) return null;
  return { lat: hit.lat, lng: hit.lng, building: null, locationName: query.split(',')[0] };
}

// A photo is reused only when its own event title and the new event share an activity.
// The first group is the photo's identity. An event may fall back to a later group
// (a book discussion may use a lecture photo) and never to an unrelated one.
const ACTIVITY_GROUPS: [string, RegExp][] = [
  ['music', /\b(jazz|concerts?|choirs?|choristers?|choral|orchestras?|quartets?|trios?|recitals?|carols?|evensong|organ|ballets?|nutcracker|music|songs?|piano)\b/i],
  ['film', /\b(films?|screenings?|cinema)\b/i],
  ['yoga', /\b(yoga)\b/i],
  ['calm', /\b(mindfulness|meditation)\b/i],
  ['trivia', /\b(trivia|comedy|improv)\b/i],
  ['games', /\b(board games?|play go\b|chess)\b/i],
  ['food', /\b(dinner|brunch|happy hour|pizza|pasta|coffee)\b/i],
  ['gallery', /\b(galler(y|ies)|museums?|exhibits?|docent|sculpture|paintings?)\b/i],
  ['code', /\b(hackathons?|grokathon)\b/i],
  ['rocket', /\b(rockets?|propulsion|test-stand|hot-fire|satellites?)\b/i],
  ['book', /\b(book group|book club|readers|short stories|poetry|writing group)\b/i],
  ['talk', /\b(lectures?|talks?|seminars?|colloqui\w*|panels?|firesides?|forums?|symposiums?|archiv\w*)\b/i],
  ['social', /\b(mixers?|networking|receptions?)\b/i],
];

function activityGroups(text: string) {
  return ACTIVITY_GROUPS.filter(([, re]) => re.test(text)).map(([id]) => id);
}

function photoPicker(existing: YaleEvent[]) {
  const use = new Map<string, number>();
  const primary = new Map<string, string>();
  for (const e of existing) {
    if (!e.photoUrl) continue;
    use.set(e.photoUrl, (use.get(e.photoUrl) ?? 0) + 1);
    if (!primary.has(e.photoUrl)) primary.set(e.photoUrl, activityGroups(e.title)[0] ?? '');
  }
  return (eventText: string): string | null => {
    const wanted = activityGroups(eventText);
    for (const group of wanted) {
      for (const [url, kind] of primary) {
        if (kind !== group || (use.get(url) ?? 0) >= 2) continue;
        use.set(url, (use.get(url) ?? 0) + 1);
        return url;
      }
    }
    return null;
  };
}

function toEvent(raw: RawEvent, place: { lat: number; lng: number; building: string | null; locationName: string }, photoUrl: string): YaleEvent {
  const text = `${raw.title} ${raw.locationRaw} ${raw.descriptionRaw}`.toLowerCase();
  const startMs = new Date(raw.start).getTime();
  const endMs = raw.end ? new Date(raw.end).getTime() : null;
  const dur = endMs != null && endMs > startMs ? Math.round((endMs - startMs) / 60000) : null;
  const tracks = tags(TRACK_RULES, text, 'social');
  const free = /\b(free|gratuit|no fee|sans réservation|entrée libre)\b/i.test(raw.descriptionRaw)
    ? true
    : /\$\s?\d/.test(raw.descriptionRaw) ? false : null;
  return {
    id: `${raw.source}-${hash(raw.sourceUrl || raw.title + raw.start)}`,
    title: clip(raw.title, 80),
    start: raw.start,
    end: raw.end,
    dayOffset: null,
    time: null,
    locationName: clip(place.locationName || raw.locationRaw || 'New Haven', 80),
    building: place.building,
    lat: Number(place.lat.toFixed(6)),
    lng: Number(place.lng.toFixed(6)),
    source: raw.source,
    sourceUrl: raw.sourceUrl,
    host: raw.host,
    summary: clip(raw.descriptionRaw || place.locationName || raw.title, 140),
    tracks,
    kinds: tags(KIND_RULES, text, 'learn'),
    future: tracks.includes('space') || tracks.includes('ai') || /\b(robot|quantum|biotech|hardware|energy)\b/.test(text),
    free,
    food: /\b(lunch|dinner|breakfast|brunch|food|pizza|coffee|refreshments)\b/i.test(text) ? true : null,
    rsvpUrl: raw.sourceUrl || null,
    photoUrl,
    sample: false,
    online: false,
    solo: false,
    durationMin: dur,
  };
}

function dedupeKey(title: string, start: string) {
  return `${normTitle(title)}|${dayKey(start)}`;
}

async function main() {
  const fetched: { adapter: EventSourceAdapter; events: RawEvent[] }[] = [];
  for (const adapter of ADAPTERS) {
    try {
      const events = await adapter.fetch(DAYS);
      console.log(`${adapter.id}: ${events.length} bruts`);
      fetched.push({ adapter, events });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`${adapter.id}: source inaccessible (${message})`);
      fetched.push({ adapter, events: [] });
    }
  }

  const buildings = JSON.parse(fs.readFileSync(BUILDINGS_PATH, 'utf8')) as Building[];
  buildings.sort((a, b) => b.name.length - a.name.length);
  const cache = loadGeoCache();
  const raws = fetched.flatMap((f) => f.events);

  const placed: { raw: RawEvent; place: { lat: number; lng: number; building: string | null; locationName: string } }[] = [];
  const extra: Extra[] = [];
  for (const raw of raws) {
    let place: Awaited<ReturnType<typeof locate>>;
    try { place = await locate(raw, buildings, cache); }
    catch (err) {
      console.warn(`  geocode skip: ${raw.title}: ${err instanceof Error ? err.message : err}`);
      place = null;
    }
    const startMs = new Date(raw.start).getTime();
    const endMs = raw.end ? new Date(raw.end).getTime() : null;
    const dur = endMs != null ? Math.round((endMs - startMs) / 60000) : null;
    const base = {
      source: raw.source, title: raw.title, start: raw.start, end: raw.end,
      locationRaw: raw.locationRaw, sourceUrl: raw.sourceUrl, host: raw.host,
      summary: clip(raw.descriptionRaw || raw.title, 140),
    };
    if (place && 'online' in place) {
      extra.push({ ...base, reason: 'online', lat: null, lng: null });
      continue;
    }
    if (!place) {
      extra.push({ ...base, reason: 'no-coordinates', lat: raw.lat ?? null, lng: raw.lng ?? null });
      continue;
    }
    if (dur != null && dur > 8 * 60) {
      extra.push({ ...base, reason: 'too-long', lat: place.lat, lng: place.lng });
      continue;
    }
    if (!inNewHaven(place.lat, place.lng)) {
      extra.push({ ...base, reason: 'outside-new-haven', lat: place.lat, lng: place.lng });
      continue;
    }
    placed.push({ raw, place });
  }

  const OWNED = new Set(ADAPTERS.map((a) => a.id));
  const loaded = JSON.parse(fs.readFileSync(EVENTS_PATH, 'utf8')) as YaleEvent[];
  const calBefore = loaded.filter((e) => e.source === 'yale-calendar').length;
  const prev = loaded.filter((e) => !OWNED.has(e.source));
  const seen = new Set(prev.map((e) => dedupeKey(e.title, e.start)));
  const titlesByDay = new Map<string, string[]>();
  for (const e of prev) {
    const day = dayKey(e.start);
    const list = titlesByDay.get(day) ?? [];
    list.push(normTitle(e.title));
    titlesByDay.set(day, list);
  }
  const ids = new Set(prev.map((e) => e.id));
  const pickPhoto = photoPicker(prev);
  const fresh: YaleEvent[] = [];
  const contributed = new Map<string, number>();

  const ordered = [...placed].sort((a, b) => a.raw.start.localeCompare(b.raw.start));
  for (const { raw, place } of ordered) {
    const key = dedupeKey(raw.title, raw.start);
    const n = normTitle(raw.title);
    const dayTitles = titlesByDay.get(dayKey(raw.start)) ?? [];
    const contained = dayTitles.some((t) => t === n || (t.length > 14 && n.length > 14 && (t.includes(n) || n.includes(t))));
    if (seen.has(key) || contained) continue;
    const blob = `${raw.title} ${raw.locationRaw} ${raw.descriptionRaw}`;
    const photoUrl = pickPhoto(blob);
    if (!photoUrl) {
      extra.push({
        reason: 'no-matching-photo', source: raw.source, title: raw.title, start: raw.start, end: raw.end,
        locationRaw: raw.locationRaw, sourceUrl: raw.sourceUrl, host: raw.host,
        lat: place.lat, lng: place.lng, summary: clip(raw.descriptionRaw || raw.title, 140),
      });
      console.warn(`  photo: aucune photo locale du même type encore libre pour « ${raw.title} »`);
      continue;
    }
    const event = toEvent(raw, place, photoUrl);
    if (ids.has(event.id)) event.id = `${event.id}-${hash(event.start)}`;
    seen.add(key);
    const dayList = titlesByDay.get(dayKey(raw.start)) ?? [];
    dayList.push(n);
    titlesByDay.set(dayKey(raw.start), dayList);
    ids.add(event.id);
    fresh.push(event);
    contributed.set(raw.source, (contributed.get(raw.source) ?? 0) + 1);
  }

  const merged = [...prev, ...fresh];
  const calAfter = merged.filter((e) => e.source === 'yale-calendar').length;
  if (calAfter < calBefore) throw new Error(`refusing to write: yale-calendar ${calBefore} -> ${calAfter}`);

  if (fresh.length || loaded.length !== prev.length) {
    fs.writeFileSync(EVENTS_PATH, JSON.stringify(merged, null, 1) + '\n');
  }
  fs.writeFileSync(EXTRA_PATH, JSON.stringify(extra, null, 1) + '\n');

  const counts = new Map<string, number>();
  for (const e of merged) counts.set(e.source, (counts.get(e.source) ?? 0) + 1);
  const order = ['yale-calendar', 'yaleconnect', 'luma', 'hand-checked', 'newsletter', 'sample'];
  const names = [...new Set([...order, ...counts.keys()])];
  const stats = {
    total: merged.length,
    sources: names.filter((n) => counts.has(n)).map((name) => ({ name, count: counts.get(name) })),
    bakedAt: new Date().toISOString(),
  };
  fs.writeFileSync(STATS_PATH, JSON.stringify(stats, null, 1) + '\n');

  console.log('ajoutés à events.json:', Object.fromEntries(contributed));
  const extraBy = new Map<string, number>();
  for (const e of extra) extraBy.set(`${e.source}/${e.reason}`, (extraBy.get(`${e.source}/${e.reason}`) ?? 0) + 1);
  console.log('extra-events.json:', extra.length, Object.fromEntries(extraBy));
  console.log(`events.json: ${merged.length} (yale-calendar inchangé: ${calAfter})`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
