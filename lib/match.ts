// Mood and goal matching for /api/plan (PLAN.md §5 and §9 package C, steps 3–4).
// Exports: allowedMechanisms, moodExcluded, validPick, friendsGoing, friendLine,
// goalTracks, goalSlug, goalScore, servesGoal, rank, preselect,
// codeInvite, codeTrajectory, codeOnlyPicks.
import { MECHANISMS } from './science';
import { candidates, conflict, endMs, startMs } from './schedule';
import { TZ, fmtDay, fmtTime, nyParts } from './time';
import type { Contact, Friend, GrokPick, Mode, Mood, Profile, Track, YaleEvent } from './types';

/** "Great": nothing to counter, so only these three mechanisms (PLAN.md §5). */
const GREAT_IDS = ['progress', 'kindness', 'weak-ties'];

/** Length in minutes: `durationMin` when set, otherwise the start–end span. */
function durationMinutes(event: YaleEvent): number {
  if (typeof event.durationMin === 'number' && event.durationMin > 0) return event.durationMin;
  const s = startMs(event);
  const e = endMs(event);
  if (Number.isFinite(s) && Number.isFinite(e) && e > s) return Math.round((e - s) / 60000);
  return 0;
}

/** Hard exclusions per mood. Tired: longer than 2h, or a start after 21:00 New York. Sad/lonely: no online, no solo. */
export function moodExcluded(event: YaleEvent, mood: Mood): boolean {
  if (mood === 'tired') {
    if (durationMinutes(event) > 120) return true;
    const ms = startMs(event);
    if (!Number.isFinite(ms)) return false;
    const p = nyParts(new Date(ms));
    if (p.hh * 60 + p.mm > 21 * 60) return true;
  }
  if (mood === 'sad' || mood === 'lonely') {
    if (event.online || event.solo) return true;
  }
  return false;
}

/** Mechanism ids valid for this event and this mood, in table order. Empty when a mood rule excludes the event. */
export function allowedMechanisms(event: YaleEvent, mood: Mood): string[] {
  if (moodExcluded(event, mood)) return [];
  return MECHANISMS.filter((m) => {
    const kindOk = m.kinds === 'all' || m.kinds.some((k) => event.kinds.includes(k));
    if (!kindOk) return false;
    if (mood === 'great') return GREAT_IDS.includes(m.id);
    return m.moods.includes(mood);
  }).map((m) => m.id);
}

export function validPick(pick: { lane: string; mechanismId: string | null }, event: YaleEvent, mode: Mode, mood?: Mood): boolean {
  if (mode === 'week') return pick.lane === 'build' && pick.mechanismId === null;
  if (!mood || !pick.mechanismId) return false;
  if (pick.lane !== 'feel' && pick.lane !== 'both') return false;
  if (moodExcluded(event, mood)) return false;
  return allowedMechanisms(event, mood).includes(pick.mechanismId);
}

/** eventId → first names of friends going (status 'friend' only). */
export function friendsGoing(friends: Friend[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const f of friends) {
    if (f.status !== 'friend') continue;
    for (const id of f.goingTo ?? []) {
      const list = map.get(id) ?? [];
      list.push(f.name.split(' ')[0]);
      map.set(id, list);
    }
  }
  return map;
}

/** "Lena and Theo are going", "Lena, Theo + 2 are going", or null. Always written by code. */
export function friendLine(names: string[] | undefined): string | null {
  if (!names || names.length === 0) return null;
  if (names.length === 1) return `${names[0]} is going`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are going`;
  return `${names[0]}, ${names[1]} + ${names.length - 2} are going`;
}

// ---------- goal reading (code-only) ----------

const STOP = new Set(['the', 'and', 'for', 'into', 'before', 'with', 'from', 'that', 'this', 'find', 'get', 'break', 'want', 'more', 'about', 'graduate', 'become', 'work']);
const GOAL_TRACKS: { words: string[]; tracks: Track[] }[] = [
  { words: ['space', 'rocket', 'rockets', 'aerospace', 'satellite', 'launch', 'nasa', 'astronaut'], tracks: ['space', 'industry'] },
  { words: ['company', 'startup', 'founder', 'start', 'business', 'entrepreneur', 'venture'], tracks: ['startup', 'industry', 'finance'] },
  { words: ['research', 'lab', 'phd', 'paper', 'professor'], tracks: ['research'] },
  { words: ['ai', 'ml', 'machine', 'intelligence', 'models'], tracks: ['ai'] },
  { words: ['people', 'meet', 'friends', 'outside', 'major', 'community', 'social'], tracks: ['social', 'arts', 'policy', 'health', 'climate'] },
  { words: ['finance', 'invest', 'investing', 'banking', 'markets'], tracks: ['finance'] },
  { words: ['policy', 'law', 'government', 'politics'], tracks: ['policy'] },
  { words: ['health', 'medicine', 'doctor', 'biotech', 'med'], tracks: ['health'] },
  { words: ['climate', 'energy', 'environment', 'sustainability'], tracks: ['climate'] },
  { words: ['art', 'arts', 'music', 'film', 'theater', 'design', 'write', 'writing'], tracks: ['arts'] },
  { words: ['job', 'internship', 'career', 'hired', 'industry'], tracks: ['career', 'industry'] },
];

function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

export function goalTracks(goal: string): Track[] {
  const w = new Set(words(goal));
  const out = new Set<Track>();
  for (const g of GOAL_TRACKS) if (g.words.some((x) => w.has(x))) g.tracks.forEach((t) => out.add(t));
  return [...out];
}

const PRESET_WORDS: Record<string, string> = {
  space: 'break into the space industry rocket aerospace satellite launch',
  startup: 'start a company before i graduate startup founder business',
  research: 'find a research lab in ai machine learning phd',
  people: 'meet people outside my major friends community social',
};

/** Preset with the most words in common with a free-text goal, else 'space'. */
export function goalSlug(goal: string): string {
  const w = new Set(words(goal).filter((x) => x.length > 1 && !STOP.has(x)));
  let best = 'space';
  let bestN = 0;
  for (const [slug, text] of Object.entries(PRESET_WORDS)) {
    const n = words(text).filter((x) => w.has(x)).length;
    if (n > bestN) { best = slug; bestN = n; }
  }
  return best;
}

/** How much an event serves a goal, by code only: tracks, keywords, `future`. */
export function goalScore(event: YaleEvent, goal: string): number {
  const tracks = goalTracks(goal);
  const text = new Set(words(`${event.title} ${event.summary} ${event.host ?? ''} ${event.tracks.join(' ')}`));
  const hits = words(goal).filter((x) => x.length > 2 && !STOP.has(x) && text.has(x)).length;
  const trackHits = event.tracks.filter((t) => tracks.includes(t)).length;
  return trackHits * 3 + hits + (event.future ? 1.5 : 0);
}

/** One matching track (3), or the same weight from keywords and `future`. The route sets lane `both` from this. */
export function servesGoal(event: YaleEvent, goal: string): boolean {
  return goalScore(event, goal) >= 3;
}

const dayKey = (e: YaleEvent) => {
  const ms = startMs(e);
  if (!Number.isFinite(ms)) return '';
  const p = nyParts(new Date(ms));
  return `${p.y}-${p.m}-${p.d}`;
};

/**
 * Higher is a better candidate. Week: goal overlap, then friends.
 * Tonight: same, plus tonight-first. Sad and lonely: any event with friends outranks the rest.
 * Anxious: `social-small` above `social-big`.
 */
export function rank(event: YaleEvent, input: { mode: Mode; goal: string; mood?: Mood; friends?: number; ref?: Date }): number {
  const friends = input.friends ?? 0;
  const g = goalScore(event, input.goal);
  const mood = input.mood;
  if (input.mode !== 'tonight') return g + Math.min(friends, 3) * 0.5;
  let s = g * 0.5 + Math.min(friends, 3) * (mood === 'sad' || mood === 'lonely' ? 2 : 0.7);
  if (input.ref && dayKey(event) === dayKeyOf(input.ref)) s += 4;
  if ((mood === 'sad' || mood === 'lonely') && friends > 0) s += 1000;
  if (mood === 'anxious') s += event.kinds.includes('social-small') ? 8 : event.kinds.includes('social-big') ? -8 : 0;
  return s;
}

function dayKeyOf(d: Date): string {
  const p = nyParts(d);
  return `${p.y}-${p.m}-${p.d}`;
}

// ---------- pre-selection before Grok ----------

/** Candidates Grok may choose from: in the window, no class conflict, mood rules applied. Real events first. */
export function preselect(mode: Mode, events: YaleEvent[], ref: Date, profile: Pick<Profile, 'courses'>, mood?: Mood): YaleEvent[] {
  const free = (list: YaleEvent[]) => list.filter((e) => !conflict(e, profile.courses));
  let pool: YaleEvent[];
  if (mode === 'week') {
    pool = free(candidates(events, ref, 168));
    if (pool.length < 6) pool = free(candidates(events, ref, 336));
  } else {
    const m = mood ?? 'stressed';
    const ok = (list: YaleEvent[]) => free(list).filter((e) => !moodExcluded(e, m) && allowedMechanisms(e, m).length > 0);
    pool = ok(candidates(events, ref, 48, { minCount: 30, widenHours: 96 }));
    if (pool.length < 3) pool = ok(candidates(events, ref, 168));
  }
  pool = pool.slice(0, 150);
  return [...pool.filter((e) => !e.sample), ...pool.filter((e) => e.sample)];
}

// ---------- code-only picks (safety net when Grok and the recording are both unavailable) ----------

const shortName = (s: string) => s.replace(/^Yale Undergraduate /, '').replace(/^Yale /, '');

const GOAL_PHRASE: Record<string, string> = {
  space: 'the space industry',
  startup: 'a company of your own',
  research: 'an AI research lab',
  people: 'circles outside your major',
};

const TONIGHT_WHY: Record<string, string> = {
  activation: 'One small plan on the calendar, easy to show up to.',
  move: 'An hour of moving, and the rest of the evening feels lighter.',
  'weak-ties': 'Low-key company and easy conversation, no agenda.',
  strangers: 'A small room where saying hi to someone new is easy.',
  nature: 'Fresh air and open sky, away from your desk.',
  awe: 'Something much bigger than this week’s to-do list.',
  arts: 'Let someone else’s work carry the evening for a while.',
  sync: 'Moving in time with a room full of people.',
  kindness: 'An hour spent on someone else, and it gives back.',
  calm: 'A quiet hour with nothing to prove.',
  laugh: 'A room that laughs together, nothing to prepare.',
  novelty: 'A place and a crowd you have not tried yet.',
  progress: 'A small visible win you can take home.',
};

/** The course or club that best matches an event, by shared words. */
function profileElement(event: YaleEvent, profile: Profile, i: number): string {
  const text = new Set(words(`${event.title} ${event.summary} ${event.host ?? ''} ${event.tracks.join(' ')}`));
  const options = [
    ...profile.clubs.map((c) => ({ label: shortName(c), text: c })),
    ...profile.courses.map((c) => ({ label: c.code, text: `${c.title} ${c.code}` })),
  ];
  let best = options[i % Math.max(1, options.length)]?.label ?? 'your courses';
  let bestN = 0;
  for (const o of options) {
    const n = words(o.text).filter((x) => x.length > 3 && text.has(x)).length;
    if (n > bestN) { best = o.label; bestN = n; }
  }
  return best;
}

/** A short first-person message, built by code from real facts. */
export function codeInvite(contact: Contact, event: YaleEvent, ref: Date): string {
  const d = fmtDay(event.start, ref);
  const instant = new Date(startMs(event));
  const day = d === 'Tonight' ? 'tonight' : d === 'Today' ? 'today' : d === 'Tomorrow' ? 'tomorrow'
    : `on ${new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long' }).format(instant)}`;
  return `Hey ${contact.name.split(' ')[0]}, "${event.title}" is ${day} at ${fmtTime(event.start)}. Want to go together?`;
}

export function codeTrajectory(goal: string): string {
  const slug = goalSlug(goal);
  if (slug === 'startup') return 'This week: meet builders and test one idea. This semester: a co-founder and a first user. After Yale: your own company.';
  if (slug === 'research') return 'This week: meet the labs and read their work. This semester: a research seat. After Yale: your name on a paper.';
  if (slug === 'people') return 'This week: three rooms you have never been in. This semester: friends in every college. After Yale: a wider world.';
  return 'This week: build something real and meet the people who launch. This semester: a team. After Yale: a seat in mission control.';
}

/** Deterministic picks: ranked by goal overlap, `future`, friends going; valid mechanisms in tonight mode. */
export function codeOnlyPicks(args: {
  mode: Mode; pool: YaleEvent[]; goal: string; mood?: Mood; profile: Profile; going: Map<string, string[]>;
  ref: Date; want: number; exclude?: Set<string>; usedMechanisms?: Set<string>;
}): GrokPick[] {
  const { mode, pool, goal, profile, going, ref, want } = args;
  const mood = args.mood ?? 'stressed';
  const exclude = args.exclude ?? new Set<string>();
  const usedMech = new Set(args.usedMechanisms ?? []);
  const slug = goalSlug(goal);
  const scored = pool
    .filter((e) => !exclude.has(e.id))
    .map((e) => ({ e, s: rank(e, { mode, goal, mood, friends: going.get(e.id)?.length ?? 0, ref }) }))
    .sort((a, b) => b.s - a.s || startMs(a.e) - startMs(b.e));

  const contacts = [...profile.contacts.filter((c) => c.relation === 'new'), ...profile.contacts.filter((c) => c.relation !== 'new')];
  const perDay = new Map<string, number>();
  const out: GrokPick[] = [];
  // Two passes: first at most 2 events per day, then (if still short) without that limit.
  for (const relaxed of [false, true]) for (const { e } of scored) {
    if (out.length >= want) break;
    if (out.some((p) => p.eventId === e.id)) continue;
    let mechanismId: string | null = null;
    if (mode === 'tonight') {
      const allowed = allowedMechanisms(e, mood);
      if (allowed.length === 0 || moodExcluded(e, mood)) continue;
      // Prefer a specific mechanism not used yet; 'activation' (matches everything) comes last.
      const order = [...allowed.filter((id) => id !== 'activation'), ...allowed.filter((id) => id === 'activation')];
      mechanismId = order.find((id) => !usedMech.has(id)) ?? order[0];
      usedMech.add(mechanismId);
    } else {
      const k = dayKey(e);
      if ((perDay.get(k) ?? 0) >= 2 && !relaxed) continue;
      perDay.set(k, (perDay.get(k) ?? 0) + 1);
    }
    const i = out.length;
    const contact = contacts.length ? contacts[i % contacts.length] : null;
    const useContact = contact && (mode === 'week' ? i < Math.min(contacts.length * 2, want) : true);
    out.push({
      eventId: e.id,
      score: Math.max(55, 94 - i * 6),
      lane: mode === 'week' ? 'build' : servesGoal(e, goal) ? 'both' : 'feel',
      mechanismId,
      why: mode === 'week'
        ? `Builds on ${profileElement(e, profile, i)}: a concrete step toward ${GOAL_PHRASE[slug] && goalTracks(goal).length ? GOAL_PHRASE[slug] : 'your goal'}.`
        : TONIGHT_WHY[mechanismId ?? ''] ?? 'An easy reason to get out and be around people.',
      friendLine: friendLine(going.get(e.id)),
      withContactId: useContact ? contact.id : null,
      withWhy: useContact ? `${contact.name.split(' ')[0]} is into ${contact.interests[0] ?? 'this'}.` : null,
      invite: useContact ? codeInvite(contact, e, ref) : null,
    });
  }
  return out;
}
