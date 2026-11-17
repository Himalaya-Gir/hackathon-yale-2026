// Package A2 (PLAN.md §9): real events from the official Yale calendar (Localist, open API, no key).
// Fetches the next 8 days, keeps timed in-person events with coordinates and their own photo,
// tags them with deterministic keyword rules (no Grok call, nothing invented), downloads and crops
// each photo locally, and merges them into events.json ahead of the sample events.
// Re-run any time: node scripts/yale-calendar.mjs   (sample events are kept untouched)
import fs from 'fs';
import sharp from 'sharp';

const DAYS = 8;
const MAX_REAL = 120;          // the plan route keeps 150 candidates: leave room for sample events
const MAX_PER_EVENT = 2;       // upcoming instances kept per recurring event
const OUT_IMG = 'public/img/events';
const API = 'https://events.yale.edu/api/2/events';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchAll() {
  const out = [];
  for (let page = 1; page < 20; page++) {
    const res = await fetch(`${API}?pp=100&days=${DAYS}&page=${page}`);
    if (!res.ok) throw new Error(`yale calendar HTTP ${res.status}`);
    const json = await res.json();
    const evs = (json.events ?? []).map((x) => x.event);
    out.push(...evs);
    if (!json.page?.next_page || evs.length === 0) break;
  }
  return out;
}

// ---- closed vocabularies (lib/types.ts), assigned by keyword rules ----
const TRACK_RULES = [
  ['space', /\b(space|rocket|astro\w*|planet\w*|satellite|nasa|orbit\w*|cosmo\w*|telescope|galax\w*|aerospace|lunar|mars)\b/],
  ['ai', /\b(ai|a\.i\.|artificial intelligence|machine learning|neural|llms?|data science|computer science|computing|algorithm\w*|robot\w*)\b/],
  ['startup', /\b(start-?ups?|entrepreneur\w*|founders?|venture|tsai city|innovation|pitch)\b/],
  ['industry', /\b(engineer\w*|industry|manufactur\w*|hardware|technology)\b/],
  ['climate', /\b(climate|environment\w*|sustainab\w*|energy|forest\w*|ecolog\w*|carbon)\b/],
  ['health', /\b(health|medic\w*|clinical|wellness|disease|nursing|public health)\b/],
  ['policy', /\b(policy|law|legal|politic\w*|government|democracy|global affairs|international)\b/],
  ['finance', /\b(financ\w*|econom\w*|markets?|invest\w*|banking)\b/],
  ['career', /\b(career\w*|internships?|jobs?|recruit\w*|networking|professional development)\b/],
  ['arts', /\b(arts?|music\w*|concerts?|films?|theat(er|re)|poetry|poets?|gallery|exhibit\w*|dance|museum|opera|choir|recital|orchestra|jazz|screening)\b/],
  ['social', /\b(social|mixer|reception|community|gathering|celebration|festival)\b/],
  ['research', /\b(lectures?|seminars?|colloqui\w*|research|symposi\w*|talks?|panel|conference|scien\w*)\b/],
];
const KIND_RULES = [
  ['music-live', /\b(concerts?|recital|choir|chorus|orchestra|jazz|band|singers?|quartet|ensemble|organ)\b/],
  ['arts-watch', /\b(films?|screening|theat(er|re)|play|exhibit\w*|gallery|museum|tour|opera|performance)\b/],
  ['awe', /\b(planetarium|observatory|stargazing|telescope)\b/],
  ['move', /\b(yoga|run|running|fitness|exercise|walk|hike|swim)\b/],
  ['move-together', /\b(dance class|dancing|pickup|intramural)\b/],
  ['calm', /\b(meditat\w*|mindful\w*|relax\w*)\b/],
  ['laugh', /\b(comedy|improv|stand-up)\b/],
  ['help', /\b(volunteer\w*|service day|donat\w*|charitable)\b/],
  ['create', /\b(craft\w*|drawing|painting|writing workshop|make your own|studio)\b/],
  ['build', /\b(hackathon|build|maker\w*|prototyp\w*|coding|design sprint)\b/],
  ['nature', /\b(garden|nature|outdoor|forest walk|park)\b/],
  ['food-together', /\b(lunch|dinner|breakfast|brunch|coffee|tea|pizza|refreshments)\b/],
  ['social-small', /\b(discussion|roundtable|conversation|book club|reading group|office hours)\b/],
  ['social-big', /\b(reception|festival|party|celebration|gala|fair)\b/],
  ['learn', /\b(lectures?|talks?|seminars?|colloqui\w*|workshops?|panel|symposi\w*|conference|reading|class|demonstration)\b/],
];
const FUTURE_RE = /\b(space|rocket|satellite|ai|artificial intelligence|machine learning|robot\w*|energy|climate tech|biotech\w*|quantum|hardware|fusion|semiconductor\w*)\b/;
const FOOD_RE = /\b(lunch|dinner|breakfast|brunch|food|refreshments|reception|pizza|snacks)\b/;

function tags(rules, text, fallback, max = 3) {
  const out = [];
  for (const [id, re] of rules) if (re.test(text) && !out.includes(id)) out.push(id);
  return out.length ? out.slice(0, max) : [fallback];
}

function clip(text, max) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.–-]+$/, '')}…`;
}

function summaryOf(e) {
  const text = String(e.description_text ?? '').replace(/\s+/g, ' ').trim();
  const first = text.split(/(?<=[.!?])\s/)[0] || text;
  return clip(first || `${e.location_name ?? 'Yale'} event.`, 140);
}

function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

async function photo(url, slug) {
  const file = `${OUT_IMG}/${slug}.jpg`;
  if (fs.existsSync(file)) return `/img/events/${slug}.jpg`;
  const res = await fetch(url, { headers: { 'User-Agent': 'campus-events-hackathon/1.0' } });
  if (!res.ok) throw new Error(`photo HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const meta = await sharp(buf).metadata();
  if (!meta.width || meta.width < 500) throw new Error('photo too small');
  await sharp(buf).resize(1200, 675, { fit: 'cover', position: 'attention' }).jpeg({ quality: 80, mozjpeg: true }).toFile(file);
  return `/img/events/${slug}.jpg`;
}

const nowMs = Date.now();
const raw = await fetchAll();
console.log(`yale-calendar: ${raw.length} events fetched (${DAYS} days)`);

const buildings = JSON.parse(fs.readFileSync('public/data/buildings.json', 'utf8'));
const byName = new Map(buildings.map((b) => [b.name.toLowerCase(), b.name]));

const photoUse = new Map();
// photos checked by eye on a contact sheet: posters full of text, logos and placeholder icons are refused (PLAN.md §3)
const DENY = new Set(JSON.parse(fs.readFileSync('scripts/yale-photo-deny.json', 'utf8')));

const drop = { allDay: 0, long: 0, past: 0, noGeo: 0, online: 0, photo: 0 };
const candidates = [];
for (const e of raw) {
  const b = buildings.find((x) => x.name.toLowerCase() === String(e.location_name ?? '').toLowerCase());
  const lat = Number(e.geo?.latitude) || b?.lat, lng = Number(e.geo?.longitude) || b?.lng;
  if (!lat || !lng || lat < 41.29 || lat > 41.34 || lng < -72.95 || lng > -72.90) { drop.noGeo++; continue; }
  if (/online|virtual|zoom/i.test(e.location_name ?? '') || (!e.location_name && e.stream_url)) { drop.online++; continue; }
  // a photo is used by at most 2 events in the dataset (PLAN.md §3)
  if (!e.photo_url || DENY.has(`yale-${hash(e.photo_id ?? e.id)}`) || (photoUse.get(e.photo_id) ?? 0) >= 2) { drop.photo++; continue; }
  let kept = 0;
  for (const { event_instance: inst } of e.event_instances ?? []) {
    if (kept >= MAX_PER_EVENT) break;
    if (inst.all_day) { drop.allDay++; continue; }
    const start = new Date(inst.start).getTime();
    const end = inst.end ? new Date(inst.end).getTime() : null;
    if (start < nowMs) { drop.past++; continue; }
    const dur = end ? Math.round((end - start) / 60000) : null;
    if (dur !== null && dur > 8 * 60) { drop.long++; continue; }
    candidates.push({ e, inst, lat, lng, dur });
    kept++;
    photoUse.set(e.photo_id, (photoUse.get(e.photo_id) ?? 0) + 1);
  }
}
candidates.sort((a, b) => a.inst.start.localeCompare(b.inst.start));
const chosen = candidates.slice(0, MAX_REAL);
console.log(`yale-calendar: ${candidates.length} usable, keeping ${chosen.length}; dropped`, drop);

fs.mkdirSync(OUT_IMG, { recursive: true });
const real = [];
const spot = new Map(); // same coordinates → offset 8 m around a circle
for (const { e, inst, lat, lng, dur } of chosen) {
  const topics = [...(e.filters?.event_types ?? []), ...(e.filters?.event_topics ?? [])].map((t) => t.name).join(' ');
  const title = clip(String(e.title ?? '').replace(/[“”]/g, '"').replace(/^"(.*)"$/, '$1'), 80);
  const text = `${title} ${topics} ${String(e.description_text ?? '').slice(0, 600)}`.toLowerCase();
  const slug = `yale-${hash(e.photo_id ?? e.id)}`;
  let photoUrl;
  try { photoUrl = await photo(e.photo_url, slug); await sleep(150); }
  catch (err) { console.warn(`  skip (photo): ${title}: ${err.message}`); continue; }

  const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
  const n = spot.get(key) ?? 0; spot.set(key, n + 1);
  const ang = n * 2.4, r = n ? 8 : 0;
  const dLat = (r * Math.cos(ang)) / 111320, dLng = (r * Math.sin(ang)) / (111320 * Math.cos((lat * Math.PI) / 180));

  const locName = [e.location_name, e.room_number].filter(Boolean).join(', ') || 'Yale University';
  const tracks = tags(TRACK_RULES, text, 'research');
  const kinds = tags(KIND_RULES, text, 'learn');
  real.push({
    id: `yale-calendar-${hash(inst.id)}`,
    title,
    start: inst.start,
    end: inst.end ?? null,
    dayOffset: null,
    time: null,
    locationName: clip(locName, 80),
    building: byName.get(String(e.location_name ?? '').toLowerCase()) ?? null,
    lat: Number((lat + dLat).toFixed(6)),
    lng: Number((lng + dLng).toFixed(6)),
    source: 'yale-calendar',
    sourceUrl: e.localist_url ?? '',
    host: e.departments?.[0]?.name ?? e.groups?.[0]?.name ?? null,
    summary: summaryOf(e),
    tracks,
    kinds,
    future: FUTURE_RE.test(text) || tracks.includes('space') || tracks.includes('ai'),
    free: typeof e.free === 'boolean' ? e.free : null,
    food: FOOD_RE.test(text) ? true : null,
    rsvpUrl: e.ticket_url || null,
    photoUrl,
    sample: false,
    online: false,
    solo: false,
    durationMin: dur,
  });
}

const prev = JSON.parse(fs.readFileSync('public/data/events.json', 'utf8'));
const sample = prev.filter((x) => x.sample || x.source === 'sample' || x.id === 'grokathon-yale-2026');
const merged = [...real, ...sample];
fs.writeFileSync('public/data/events.json', JSON.stringify(merged, null, 1) + '\n');

// photos of real events that are no longer in the dataset
const usedPhotos = new Set(merged.map((x) => x.photoUrl));
for (const f of fs.readdirSync(OUT_IMG)) if (f.startsWith('yale-') && !usedPhotos.has(`/img/events/${f}`)) fs.rmSync(`${OUT_IMG}/${f}`);

const stats = {
  total: merged.length,
  sources: [{ name: 'yale-calendar', count: real.length }, { name: 'sample', count: sample.length }],
  bakedAt: new Date().toISOString(),
};
fs.writeFileSync('public/data/stats.json', JSON.stringify(stats, null, 1) + '\n');
console.log(`events.json: ${real.length} real + ${sample.length} sample = ${merged.length}`);
