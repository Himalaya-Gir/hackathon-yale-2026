// Package A2 (PLAN.md §4.1 source 3): club events from Yale Connect's public iCal feed (no login).
// Keeps the next 8 days, in person, with a public location; places them by building name, street
// address, or Nominatim; uses the building's photo from the Yale places endpoint (the feed has none).
// No attendee data is read: the public feed carries none, and Orbit never shows real students.
// Run after scripts/yale-calendar.mjs: node scripts/yale-connect.mjs
import fs from 'fs';
import ical from 'node-ical';
import sharp from 'sharp';

const DAYS = 8, MAX_PER_TITLE = 2;
const OUT_IMG = 'public/img/events';
const UA = { 'User-Agent': 'campus-events-hackathon/1.0' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const res = await fetch('https://yaleconnect.yale.edu/ical/yale/ical_yale.ics', { headers: UA, redirect: 'follow' });
if (!res.ok) throw new Error(`yale connect HTTP ${res.status}`);
const feed = ical.sync.parseICS(await res.text());

const buildings = JSON.parse(fs.readFileSync('public/data/buildings.json', 'utf8')).sort((a, b) => b.name.length - a.name.length);
const norm = (s) => String(s ?? '').toLowerCase().replace(/\bstreet\b/g, 'st').replace(/\bavenue\b/g, 'ave').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const text = (v) => String(v?.val ?? v ?? '').replace(/\s+/g, ' ').trim();
const clip = (t, max) => (t.length <= max ? t : `${t.slice(0, max - 1).replace(/\s+\S*$/, '')}…`);
function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

async function place(loc) {
  const n = norm(loc);
  const byName = buildings.find((b) => n.includes(norm(b.name)));
  if (byName) return byName;
  const street = n.match(/^(?:[a-z ]+ )?(\d+ [a-z]+ (?:st|ave|rd|pl|ct|ln|blvd|sq))/)?.[1] ?? n.match(/(\d+ [a-z]+ (?:st|ave|rd|pl))/)?.[1];
  if (street) {
    const byAddr = buildings.find((b) => norm(b.addr).startsWith(street));
    if (byAddr) return byAddr;
    await sleep(1100);
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(`${street}, New Haven, CT`)}`, { headers: UA });
    const j = r.ok ? await r.json() : [];
    if (j[0]) return { name: null, lat: Number(j[0].lat), lng: Number(j[0].lon), photoRaw: null };
  }
  return null;
}

// tags: same closed vocabularies as scripts/yale-calendar.mjs, from the feed's own categories
const TRACKS = [['space', /space|astro|aerospace/], ['ai', /\bai\b|artificial|machine learning|computer|data science|tech/], ['startup', /entrepreneur|startup|venture|innovation/],
  ['climate', /climate|environment|sustainab|energy|carbon/], ['health', /health|medic|nursing|wellness/], ['policy', /policy|law|politic|global affairs|government/],
  ['finance', /financ|econom|business/], ['career', /career|professional|networking|recruit/], ['arts', /art|music|perform|theat|film|dance|poetry|comedy/],
  ['social', /social|community|belonging|conversation|culture|food|dining/], ['research', /lecture|speaker|seminar|research|talk|panel|academic/]];
const KINDS = [['music-live', /music|concert|choir|a cappella/], ['arts-watch', /theat|performance|film|exhibit/], ['laugh', /comedy|improv/], ['move', /fitness|yoga|run|sport|athlet/],
  ['move-together', /dance|intramural/], ['calm', /meditat|mindful|wellness/], ['help', /volunteer|service/], ['create', /craft|art making|workshop/], ['build', /hack|build|maker/],
  ['nature', /outdoor|nature|garden|hike/], ['food-together', /food|dining|culinary|dinner|lunch|breakfast|tea|coffee/], ['social-small', /conversation|discussion|club meeting|table/],
  ['social-big', /social|party|celebration|festival|reception/], ['learn', /lecture|speaker|seminar|talk|panel|class|academic/]];
const tags = (rules, t, fallback) => { const o = rules.filter(([, re]) => re.test(t)).map(([id]) => id); return o.length ? o.slice(0, 3) : [fallback]; };

const now = Date.now(), end = now + DAYS * 864e5;
const perTitle = new Map(), out = [], photos = new Map();
const PHOTOS = Object.entries(JSON.parse(fs.readFileSync('scripts/yale-connect-photos.json', 'utf8'))).filter(([k]) => k !== '_');
const vevents = Object.values(feed).filter((v) => v.type === 'VEVENT' && +v.start >= now && +v.start <= end).sort((a, b) => a.start - b.start);
let hidden = 0, online = 0, noPlace = 0;
for (const v of vevents) {
  const loc = text(v.location);
  if (!loc || /sign in/i.test(loc)) { hidden++; continue; }
  if (/online|virtual|zoom/i.test(loc)) { online++; continue; }
  const title = clip(text(v.summary), 80);
  if ((perTitle.get(title) ?? 0) >= MAX_PER_TITLE) continue;
  const p = await place(loc);
  if (!p) { noPlace++; continue; }
  const key = PHOTOS.find(([re]) => new RegExp(re, 'i').test(title))?.[1];
  if (!key) { noPlace++; continue; } // a real, matching photo is required (PLAN.md §3)
  perTitle.set(title, (perTitle.get(title) ?? 0) + 1);
  const slug = `yc-${key}`;
  if (!photos.has(slug)) {
    try {
      await sharp(`scripts/.cache/a1/${key}.jpg`).resize(1200, 675, { fit: 'cover', position: 'attention' }).jpeg({ quality: 80, mozjpeg: true }).toFile(`${OUT_IMG}/${slug}.jpg`);
      photos.set(slug, true);
    } catch (e) { console.warn(`  skip (photo): ${title}`); continue; }
  }
  const cats = (Array.isArray(v.categories) ? v.categories : [v.categories]).filter(Boolean).join(' ');
  const desc = text(v.description);
  const t = `${title} ${cats} ${desc.slice(0, 400)}`.toLowerCase();
  const startD = new Date(v.start), endD = v.end ? new Date(v.end) : null;
  const dur = endD ? Math.round((endD - startD) / 60000) : null;
  if (dur !== null && dur > 8 * 60) continue;
  const iso = (d) => new Date(d).toLocaleString('sv-SE', { timeZone: 'America/New_York' }).replace(' ', 'T') + (/(EDT|GMT-4)/.test(new Date(d).toLocaleString('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' })) ? '-04:00' : '-05:00');
  const tracks = tags(TRACKS, t, 'social');
  out.push({
    id: `yaleconnect-${hash(v.uid ?? v.url ?? title + v.start)}`,
    title, start: iso(startD), end: endD ? iso(endD) : null, dayOffset: null, time: null,
    locationName: clip(loc.split(',')[0], 80), building: p.name, lat: p.lat, lng: p.lng,
    source: 'yaleconnect', sourceUrl: text(v.url), host: clip(text(v.organizer?.params?.CN ?? '').replace(/^"|"$/g, ''), 60) || null,
    summary: clip(desc.split(/(?<=[.!?])\s/)[0] || title, 140), tracks, kinds: tags(KINDS, t, 'social-big'),
    future: tracks.includes('space') || tracks.includes('ai') || /energy|robot|quantum|biotech/.test(t),
    free: null, food: /food|dining|culinary|dinner|lunch|pizza/.test(t) ? true : null, rsvpUrl: text(v.url) || null,
    photoUrl: `/img/events/${slug}.jpg`, sample: false, online: false, solo: false, durationMin: dur,
  });
}
console.log(`yale-connect: ${vevents.length} events in ${DAYS} days; ${hidden} hidden locations, ${online} online, ${noPlace} unplaced; keeping ${out.length}`);

const prev = JSON.parse(fs.readFileSync('public/data/events.json', 'utf8')).filter((e) => e.source !== 'yaleconnect');
const seen = new Set(prev.map((e) => `${norm(e.title)}|${String(e.start).slice(0, 10)}`));
const fresh = out.filter((e) => !seen.has(`${norm(e.title)}|${e.start.slice(0, 10)}`));
const merged = [...prev.filter((e) => !e.sample), ...fresh, ...prev.filter((e) => e.sample)];
fs.writeFileSync('public/data/events.json', JSON.stringify(merged, null, 1) + '\n');
const used = new Set(merged.map((e) => e.photoUrl));
for (const f of fs.readdirSync(OUT_IMG)) if (f.startsWith('yc-') && !used.has(`/img/events/${f}`)) fs.rmSync(`${OUT_IMG}/${f}`);

const stats = JSON.parse(fs.readFileSync('public/data/stats.json', 'utf8'));
const count = (s) => merged.filter((e) => e.source === s).length;
stats.total = merged.length;
stats.sources = [{ name: 'yale-calendar', count: count('yale-calendar') }, { name: 'yaleconnect', count: count('yaleconnect') }, { name: 'sample', count: count('sample') }];
stats.bakedAt = new Date().toISOString();
fs.writeFileSync('public/data/stats.json', JSON.stringify(stats, null, 1) + '\n');
console.log(`events.json: ${merged.length} (${fresh.length} from Yale Connect after removing duplicates)`);
