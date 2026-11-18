// Package A1 check (PLAN.md §9). Asserts the sample world, then prints a short summary.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import type { ActivityKind, Friend, Mood, YaleEvent } from '../lib/types';
import { MECHANISMS } from '../lib/science';
import { redateAll } from '../lib/time';
import { ALIASES } from './buildings';

export const MOODS: Mood[] = ['sad', 'lonely', 'stressed', 'anxious', 'bored', 'tired', 'unmotivated', 'great'];

export const DENY_NAMES = [
  'Elon Musk', 'Sam Altman', 'Jensen Huang', 'Mark Zuckerberg', 'Jeff Bezos', 'Sundar Pichai',
  'Satya Nadella', 'Tim Cook', 'Peter Thiel', 'Demis Hassabis', 'Dario Amodei', 'Bill Gates',
  'Barack Obama', 'Donald Trump', 'Joe Biden', 'Kamala Harris', 'Taylor Swift', 'Beyoncé', 'Beyonce',
  'Kanye West', 'LeBron James', 'Oprah Winfrey', 'Steve Jobs', 'Larry Page', 'Sergey Brin',
  'Reed Hastings', 'Brian Chesky', 'Patrick Collison', 'Richard Branson', 'Gwynne Shotwell',
  'Peter Salovey', 'Maurie McInnis', 'Sheryl Sandberg', 'Larry Ellison', 'Warren Buffett',
  'Sam Bankman-Fried', 'Andrew Ng', 'Yann LeCun', 'Geoffrey Hinton', 'Yoshua Bengio', 'Fei-Fei Li',
  'Andrej Karpathy', 'Ilya Sutskever', 'Greg Brockman', 'Mira Murati', 'Reid Hoffman',
  'Marc Andreessen', 'Ben Horowitz', 'Tory Bruno',
];

export const COMPANY = /\b(SpaceX|Tesla|NASA|Google|Alphabet|OpenAI|Microsoft|Apple|Meta|Facebook|Amazon|Blue Origin|Anduril|Palantir|Jane Street|Goldman|McKinsey|Citadel|NVIDIA|Nvidia|Intel|Anthropic|DeepMind|xAI|Boeing|Lockheed|Northrop|Oracle|Stripe|TikTok|ByteDance)\b/;

export const GOALS: { id: string; label: string; test: (e: YaleEvent) => boolean }[] = [
  { id: 'space', label: 'Break into the space industry', test: (e) => e.tracks.includes('space') },
  { id: 'startup', label: 'Start a company before I graduate', test: (e) => e.tracks.includes('startup') },
  { id: 'research', label: 'Find a research lab in AI', test: (e) => e.tracks.includes('ai') && e.tracks.includes('research') },
  { id: 'people', label: 'Meet people outside my major', test: (e) => e.tracks.includes('social') || e.tracks.includes('arts') },
];

/** Mechanisms whose moods and kinds fit this event, after the §5 exclusions. */
export function matchingMechanisms(e: YaleEvent, mood: Mood): string[] {
  if ((mood === 'sad' || mood === 'lonely') && (e.online || e.solo)) return [];
  if (mood === 'tired') {
    if ((e.durationMin ?? 0) > 120) return [];
    const hour = Number((e.time ?? '12:00').slice(0, 2));
    if (hour >= 21) return [];
  }
  const out: string[] = [];
  for (const m of MECHANISMS) {
    if (!m.moods.includes(mood)) continue;
    if (m.kinds === 'all' || e.kinds.some((k) => (m.kinds as ActivityKind[]).includes(k))) out.push(m.id);
  }
  return out;
}

export function eventMatchesMood(e: YaleEvent, mood: Mood): boolean {
  return matchingMechanisms(e, mood).length > 0;
}

/** Starts inside the window, or is still going and began within the last 6 hours. */
export function inWindow(e: YaleEvent, ref: Date, hours: number): boolean {
  const start = new Date(e.start).getTime();
  const end = e.end ? new Date(e.end).getTime() : start + (e.durationMin ?? 60) * 60000;
  const now = ref.getTime();
  if (Number.isNaN(start)) return false;
  if (start >= now && start <= now + hours * 3600000) return true;
  if (start < now && end >= now && now - start <= 6 * 3600000) return true;
  return false;
}

export function redateNow(events: YaleEvent[], ref = new Date()): YaleEvent[] {
  return redateAll(events, ref);
}

const COLLEGES = [
  'Berkeley College', 'Branford College', 'Davenport College', 'Ezra Stiles College',
  'Jonathan Edwards College', 'Benjamin Franklin College', 'Grace Hopper College',
  'Morse College', 'Pierson College', 'Saybrook College', 'Silliman College',
  'Timothy Dwight College', 'Trumbull College', 'Pauli Murray College',
];

async function main() {
  const fail: string[] = [];
  const bad = (cond: boolean, msg: string) => { if (!cond) fail.push(msg); };

  const events = JSON.parse(fs.readFileSync('public/data/events.json', 'utf8')) as YaleEvent[];
  const friends = JSON.parse(fs.readFileSync('public/data/friends.json', 'utf8')) as Friend[];
  const stats = JSON.parse(fs.readFileSync('public/data/stats.json', 'utf8')) as {
    total: number; sources: { name: string; count: number }[]; bakedAt: string;
  };
  const buildings = JSON.parse(fs.readFileSync('public/data/buildings.json', 'utf8')) as { name: string; lat: number; lng: number }[];
  const buildingNames = new Set(buildings.map((b) => b.name));

  bad(buildings.length >= 300, `buildings ${buildings.length} < 300`);
  for (const [alias, target] of Object.entries(ALIASES)) {
    bad(buildingNames.has(target), `alias ${alias} → missing ${target}`);
  }
  for (const college of COLLEGES) bad(buildingNames.has(college), `missing college ${college}`);
  const tsai = buildings.find((b) => b.name === 'Tsai CITY');
  bad(!!tsai && tsai.lat === 41.3124 && tsai.lng === -72.9249, 'Tsai CITY coords');
  bad(buildingNames.has('East Rock Park'), 'East Rock Park missing');
  bad(buildingNames.has('Center for Engineering Innovation & Design'), 'CEID missing');

  bad(events.length >= 60, `events ${events.length} < 60`);
  const ids = new Set<string>();
  const offsets = new Set<number>();
  let future = 0;
  for (const e of events) {
    bad(!ids.has(e.id), `duplicate id ${e.id}`);
    ids.add(e.id);
    bad(e.lat >= 41.29 && e.lat <= 41.34, `lat ${e.id} ${e.lat}`);
    bad(e.lng >= -72.95 && e.lng <= -72.9, `lng ${e.id} ${e.lng}`);
    bad(!!e.building && buildingNames.has(e.building), `building ${e.id} ${e.building}`);
    bad(e.title.length > 0 && e.title.length <= 80, `title length ${e.id} ${e.title.length}`);
    bad(e.summary.length > 0 && e.summary.length <= 140, `summary length ${e.id} ${e.summary.length}`);
    bad(e.tracks.length >= 1 && e.tracks.length <= 3, `tracks ${e.id}`);
    bad(e.kinds.length >= 1 && e.kinds.length <= 3, `kinds ${e.id}`);
    bad(e.sample === true && e.source === 'sample', `sample flag ${e.id}`);
    bad(!/^https?:/i.test(e.photoUrl), `remote photo ${e.id}`);
    if (e.dayOffset != null) offsets.add(e.dayOffset);
    if (e.future) future++;
    const blob = `${e.title}\n${e.summary}`;
    for (const name of DENY_NAMES) {
      bad(!blob.toLowerCase().includes(name.toLowerCase()), `deny name ${name} in ${e.id}`);
    }
    if (e.id !== 'grokathon-yale-2026') {
      bad(!COMPANY.test(`${e.title}\n${e.summary}\n${e.host ?? ''}`), `company claim in ${e.id}`);
    }
  }
  bad(ids.has('grokathon-yale-2026'), 'missing grokathon-yale-2026');
  const g = events.find((e) => e.id === 'grokathon-yale-2026');
  if (g) {
    bad(g.title === 'Grokathon Yale 2026', 'grokathon title');
    bad(g.lat === 41.3124 && g.lng === -72.9249, 'grokathon coords');
    bad(g.dayOffset === 0, 'grokathon dayOffset');
    bad(g.building === 'Tsai CITY', 'grokathon building');
    bad(g.tracks.includes('ai') && g.tracks.includes('space'), 'grokathon tracks');
    bad(g.kinds.includes('build') && g.kinds.length === 1, 'grokathon kinds');
    bad(g.future === true, 'grokathon future');
  }
  for (let d = 0; d <= 9; d++) bad(offsets.has(d), `dayOffset ${d} unused`);
  bad(future >= 15, `future ${future} < 15`);

  const photoUse = new Map<string, number>();
  const hashes = new Set<string>();
  for (const e of events) {
    bad(e.photoUrl.startsWith('/img/events/') && e.photoUrl.endsWith('.jpg'), `photo path ${e.id} ${e.photoUrl}`);
    const file = path.join('public', e.photoUrl);
    bad(fs.existsSync(file), `missing file ${e.photoUrl}`);
    if (!fs.existsSync(file)) continue;
    const buf = fs.readFileSync(file);
    hashes.add(crypto.createHash('sha256').update(buf).digest('hex'));
    bad(buf.length < 250 * 1024, `size ${e.photoUrl} ${buf.length}`);
    try {
      const meta = await sharp(buf).metadata();
      bad((meta.width ?? 0) >= 1200 && (meta.height ?? 0) >= 675, `dims ${e.photoUrl} ${meta.width}x${meta.height}`);
      bad(meta.format === 'jpeg', `format ${e.photoUrl} ${meta.format}`);
    } catch {
      bad(false, `decode ${e.photoUrl}`);
    }
    photoUse.set(e.photoUrl, (photoUse.get(e.photoUrl) ?? 0) + 1);
  }
  bad(photoUse.size >= 60, `distinct photo paths ${photoUse.size} < 60`);
  bad(hashes.size >= 60, `distinct photo files ${hashes.size} < 60`);
  for (const [p, n] of photoUse) bad(n <= 2, `photo used ${n} times: ${p}`);
  bad(fs.existsSync('public/img/CREDITS.md') && fs.readFileSync('public/img/CREDITS.md', 'utf8').length > 200, 'CREDITS.md');

  const ref = new Date();
  const dated = redateAll(events, ref);
  const week = dated.filter((e) => inWindow(e, ref, 168));
  const soon = dated.filter((e) => inWindow(e, ref, 48));
  const goalCounts: Record<string, number> = {};
  for (const goal of GOALS) {
    const n = week.filter((e) => goal.test(e)).length;
    goalCounts[goal.id] = n;
    bad(n >= 12, `goal ${goal.id} has ${n} events in the next 7 days`);
  }
  const moodCounts: Record<string, number> = {};
  for (const mood of MOODS) {
    const n = soon.filter((e) => eventMatchesMood(e, mood)).length;
    moodCounts[mood] = n;
    bad(n >= 6, `mood ${mood} has ${n} events in the next 48h`);
  }

  const realFriends = friends.filter((f) => f.status === 'friend');
  const suggested = friends.filter((f) => f.status === 'suggested');
  bad(realFriends.length === 12, `friends ${realFriends.length} != 12`);
  bad(suggested.length === 6, `suggested ${suggested.length} != 6`);
  const weekIds = new Set(week.map((e) => e.id));
  const soonIds = new Set(soon.map((e) => e.id));
  for (const f of friends) {
    const face = (f as Friend & { photoUrl?: string }).photoUrl;
    bad(f.initials.length >= 2 && f.initials.length <= 3, `initials ${f.id}`);
    bad(!face, `face photo on ${f.id}`);
    for (const name of DENY_NAMES) bad(!f.name.toLowerCase().includes(name.toLowerCase()), `deny friend ${f.name}`);
    for (const id of f.goingTo) bad(ids.has(id), `goingTo missing ${f.id} → ${id}`);
    if (f.status === 'friend') {
      bad(f.goingTo.length >= 2 && f.goingTo.length <= 4, `${f.id} goingTo ${f.goingTo.length}`);
      bad(f.reason == null, `${f.id} friend reason should be null`);
      bad(f.goingTo.every((id) => weekIds.has(id)), `${f.id} going outside 7 days`);
    } else {
      bad(f.goingTo.length >= 1 && f.goingTo.length <= 2, `${f.id} suggested goingTo ${f.goingTo.length}`);
      bad(!!f.reason && f.reason.length > 0, `${f.id} missing reason`);
    }
  }
  // Friend is structural; the type has no photoUrl. The check above uses a loose field.
  const goingFriends = (eventId: string) => realFriends.filter((f) => f.goingTo.includes(eventId)).length;
  for (const goal of GOALS) {
    const n = week.filter((e) => goal.test(e) && goingFriends(e.id) > 0).length;
    bad(n >= 3, `goal ${goal.id} friend-events ${n} < 3`);
  }
  for (const mood of MOODS) {
    const n = soon.filter((e) => soonIds.has(e.id) && eventMatchesMood(e, mood) && goingFriends(e.id) > 0).length;
    bad(n >= 2, `mood ${mood} friend-events in 48h ${n} < 2`);
  }

  bad(stats.total === events.length, `stats.total ${stats.total} != ${events.length}`);
  bad(Array.isArray(stats.sources) && stats.sources.some((s) => s.name === 'sample' && s.count === events.length), 'stats.sources');
  bad(typeof stats.bakedAt === 'string' && !Number.isNaN(Date.parse(stats.bakedAt)), 'stats.bakedAt');

  if (fail.length) {
    console.error(`FAIL ${fail.length}`);
    for (const line of fail) console.error(' -', line);
    process.exit(1);
  }

  console.log('OK check-data');
  console.log(`events ${events.length}  future ${future}  photos ${photoUse.size}  buildings ${buildings.length}`);
  console.log(`week ${week.length}  next48h ${soon.length}  friends ${realFriends.length}  suggested ${suggested.length}`);
  console.log('goals', goalCounts);
  console.log('moods', moodCounts);
  console.log(`ref ${ref.toISOString()}`);
}

const isDirect = (process.argv[1] ?? '').includes('check-data.ts');
if (isDirect) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.stack : err);
    process.exit(1);
  });
}
