// Package A1, step 2: Grok (smart model, structured output) writes 60 fictional Yale events on fixed slots.
// The slots (day, time, duration, primary track and kind) are fixed by code so the coverage rules of PLAN.md §9 hold;
// Grok writes title, host, building, room, summary and the secondary tags. Result cached in scripts/.cache/sample-events.json
// so a re-run never produces different events (ids stay stable for the recorded fallbacks).
// Run: ./node_modules/.bin/tsx scripts/sample-events.ts        (add --force to regenerate)
import fs from 'fs';
import OpenAI from 'openai';
import type { ActivityKind, Track } from '../lib/types';

export const CACHE_FILE = 'scripts/.cache/sample-events.json';
export const TRACKS: Track[] = ['space', 'ai', 'startup', 'industry', 'research', 'finance', 'policy', 'health', 'climate', 'arts', 'social', 'career'];
export const KINDS: ActivityKind[] = ['move', 'move-together', 'nature', 'social-small', 'social-big', 'food-together', 'create', 'music-live', 'arts-watch', 'awe', 'learn', 'help', 'calm', 'laugh', 'build'];

export const GROK_BUILDINGS = ['Tsai CITY', 'Mason Laboratory', 'Becton Engineering and Applied Science Center', 'Center for Engineering Innovation & Design', 'Evans Hall', 'Wright Laboratory', 'Leitner Observatory & Planetarium', 'Watson Hall', 'Sheffield-Sterling-Strathcona Hall', 'Dwight Hall', 'Pierson College', 'Cross Campus', 'Dunham Laboratory', 'Kline Tower', 'Yale Science Building', 'Sloane Physics Laboratory', 'Kroon Hall', 'Payne Whitney Gymnasium', 'Yale Schwarzman Center', 'Woolsey Hall', 'Sprague Hall', 'Yale University Art Gallery', 'Yale Center for British Art', 'Sterling Memorial Library', 'Bass Library', 'Linsly-Chittenden Hall', 'W. L. Harkness Hall', 'Humanities Quadrangle', 'Luce Hall', 'Rosenkranz Hall', 'Loria Center', 'Yale Peabody Museum', 'Marsh Botanical Garden', 'Yale Farm', 'Old Campus', 'Hewitt Quadrangle', 'Davenport College', 'Saybrook College', 'Branford College', 'Silliman College', 'Timothy Dwight College', 'Morse College', 'Ezra Stiles College', 'Benjamin Franklin College', 'Pauli Murray College', 'Trumbull College', 'Berkeley College', 'Jonathan Edwards College', 'Grace Hopper College', 'Off Broadway Theater', 'University Theatre', 'Center for Collaborative Arts and Media', 'Poorvu Center for Teaching and Learning', 'Quantum Institute', 'Malone Center', 'Rudolph Hall', 'Ingalls Rink', 'Farmington Canal', 'New Haven Green', 'Slifka Center', 'Battell Chapel', 'East Rock Park'];

export type Slot = { n: number; day: number; time: string; dur: number; track: Track; kind: ActivityKind; hint: string };
// Day 0 is a Tuesday in the demo week; the app re-dates from dayOffset + time.
const S = (day: number, time: string, dur: number, track: Track, kind: ActivityKind, hint: string) => ({ day, time, dur, track, kind, hint });
export const SLOTS: Slot[] = [
  // day 0 (tonight)
  S(0, '18:00', 90, 'social', 'food-together', 'residential college long-table dinner where you sit with people you do not know'),
  S(0, '18:30', 60, 'health', 'calm', 'guided evening meditation, beginners welcome'),
  S(0, '19:00', 60, 'health', 'move-together', 'easy evening group run or flow, all paces'),
  S(0, '19:30', 120, 'space', 'build', 'undergraduate rocket team: propulsion test-stand build night'),
  S(0, '19:30', 90, 'arts', 'music-live', 'student jazz combo night'),
  S(0, '20:00', 60, 'arts', 'laugh', 'student improv comedy show'),
  S(0, '20:00', 90, 'space', 'awe', 'public stargazing night with telescopes'),
  S(0, '20:30', 120, 'social', 'social-small', 'board games night in a college common room'),
  S(0, '21:00', 60, 'startup', 'social-small', 'late-night idea jam for student founders, small tables'),
  // day 1
  S(1, '07:30', 45, 'health', 'move-together', 'sunrise group run toward East Rock (also nature)'),
  S(1, '12:00', 60, 'space', 'learn', 'lunch talk: how to get hired in the launch industry, by an unnamed propulsion engineer'),
  S(1, '16:00', 60, 'research', 'learn', 'AI lab open house for undergraduates looking for a research position'),
  S(1, '16:00', 75, 'climate', 'nature', 'guided late-afternoon walk among plants or trees, outdoors'),
  S(1, '16:30', 60, 'health', 'calm', 'sunset yoga, mats provided'),
  S(1, '17:00', 90, 'startup', 'build', 'pitch practice: 90 seconds and direct feedback'),
  S(1, '17:30', 90, 'social', 'help', 'volunteer shift: community kitchen or food pantry for New Haven families'),
  S(1, '18:00', 90, 'startup', 'food-together', 'founder dinner, twelve seats, first customers'),
  S(1, '18:30', 90, 'arts', 'create', 'open studio night: ceramics or printmaking, no experience needed'),
  S(1, '19:00', 120, 'ai', 'build', 'machine-learning build night: fine-tune a small model together'),
  S(1, '19:30', 90, 'social', 'move-together', 'swing dance social, no partner needed, lesson first'),
  S(1, '20:00', 90, 'arts', 'music-live', 'a cappella or chamber music concert'),
  S(1, '20:30', 75, 'social', 'laugh', 'trivia night or stand-up open mic'),
  // day 2
  S(2, '12:00', 60, 'finance', 'learn', 'lunch: how venture funds evaluate deep-tech startups'),
  S(2, '16:00', 90, 'research', 'awe', 'physics lab open house: detectors and dark matter'),
  S(2, '16:30', 60, 'policy', 'learn', 'seminar on space policy: orbital debris and who regulates launch'),
  S(2, '17:00', 60, 'social', 'help', 'volunteers tutor local high-school students in math and science'),
  S(2, '17:30', 90, 'ai', 'social-big', 'AI research mixer: undergraduates meet the labs, posters'),
  S(2, '18:00', 120, 'space', 'build', 'CubeSat radio soldering workshop'),
  S(2, '18:30', 60, 'health', 'move', 'intro climbing or strength session at the gym'),
  S(2, '19:00', 100, 'arts', 'arts-watch', 'space documentary screening with discussion'),
  S(2, '19:30', 90, 'social', 'food-together', 'international potluck, bring a dish or just come'),
  S(2, '20:00', 90, 'startup', 'social-small', 'student builders demo night: five projects, five minutes each'),
  // day 3
  S(3, '12:00', 60, 'research', 'learn', 'robotics and autonomy lunch seminar with a lab tour'),
  S(3, '14:30', 90, 'career', 'learn', 'aerospace internship resume clinic with alumni reviewers (space track too)'),
  S(3, '15:00', 120, 'startup', 'build', 'prototype Friday: bring an idea, leave with a clickable prototype'),
  S(3, '16:00', 75, 'arts', 'arts-watch', 'student-led gallery tour'),
  S(3, '17:00', 90, 'industry', 'social-big', 'engineering school social hour across departments'),
  S(3, '18:00', 90, 'social', 'food-together', 'Friday community dinner open to all colleges'),
  S(3, '20:00', 120, 'arts', 'music-live', 'student symphony orchestra concert'),
  // day 4 (Saturday)
  S(4, '09:00', 60, 'health', 'move-together', 'Saturday long run with a running club'),
  S(4, '10:00', 120, 'climate', 'help', 'farm or garden volunteer workday'),
  S(4, '11:00', 180, 'space', 'build', 'high-power rocket integration day before a launch weekend'),
  S(4, '13:00', 240, 'ai', 'build', 'mini-hackathon: build an AI agent for campus life'),
  S(4, '14:00', 120, 'arts', 'create', 'drop-in drawing session'),
  S(4, '20:00', 90, 'arts', 'laugh', 'sketch comedy show'),
  // day 5 (Sunday)
  S(5, '10:00', 150, 'social', 'nature', 'group hike to the East Rock summit'),
  S(5, '11:00', 90, 'social', 'food-together', 'brunch that seats you with students from other majors'),
  S(5, '14:00', 150, 'space', 'build', 'satellite design sprint: size a CubeSat power system in teams'),
  S(5, '15:00', 90, 'research', 'learn', 'undergraduate research poster symposium'),
  S(5, '17:00', 60, 'health', 'calm', 'Sunday reset: breathing and quiet time'),
  S(5, '19:00', 90, 'startup', 'social-small', 'co-founder matching night'),
  // day 6 (Monday)
  S(6, '12:00', 60, 'startup', 'learn', 'lunch workshop: raising a first small round as a student'),
  S(6, '16:30', 60, 'ai', 'learn', 'colloquium: machine learning for astronomy data'),
  S(6, '17:30', 90, 'space', 'social-small', 'aerospace club general meeting and project fair'),
  S(6, '18:00', 90, 'career', 'food-together', 'alumni dinner: careers in aerospace and deep tech (industry)'),
  S(6, '20:00', 60, 'research', 'learn', 'evening talk on quantum computing for non-physicists'),
  // days 7 to 9
  S(7, '12:00', 60, 'climate', 'learn', 'lunch talk: fusion and the future of clean energy'),
  S(7, '19:00', 60, 'space', 'awe', 'planetarium show'),
  S(8, '16:00', 60, 'research', 'learn', 'workshop: how to email a professor and join a lab'),
  S(9, '17:00', 90, 'space', 'learn', 'panel of alumni working in the space industry (career)'),
].map((s, n) => ({ n, ...s }));

export type RawSample = { slot: number; title: string; host: string; building: string; room: string; summary: string; tracks: Track[]; kinds: ActivityKind[]; future: boolean; food: boolean; photoHint: string };

const schema = {
  type: 'object', additionalProperties: false, required: ['events'],
  properties: {
    events: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['slot', 'title', 'host', 'building', 'room', 'summary', 'tracks', 'kinds', 'future', 'food', 'photoHint'],
        properties: {
          slot: { type: 'integer' }, title: { type: 'string' }, host: { type: 'string' },
          building: { type: 'string', enum: GROK_BUILDINGS }, room: { type: 'string' }, summary: { type: 'string' },
          tracks: { type: 'array', items: { type: 'string', enum: TRACKS } },
          kinds: { type: 'array', items: { type: 'string', enum: KINDS } },
          future: { type: 'boolean' }, food: { type: 'boolean' }, photoHint: { type: 'string' },
        },
      },
    },
  },
};

const SYSTEM = `You write the sample event calendar of a campus app for Yale University students. The events are fictional but must be fully believable: a Yale student should recognize the kind of event, the host and the place.

The student: Maya Chen, Yale '28, Pierson College, Computer Science + Economics. Courses: CPSC 3230 systems programming, CPSC 3650 algorithms, ECON 2121 intermediate micro, MENG 2511 thermodynamics, ASTR 3200 physical processes in astronomy. Clubs: Yale Undergraduate Aerospace Association (YUAA), Y/CS, Yale Entrepreneurial Society. Interests: rockets and propulsion, embedded systems, startups, astronomy, trail running.
Her four possible long-term goals: "Break into the space industry", "Start a company before I graduate", "Find a research lab in AI", "Meet people outside my major".

For each slot you receive (slot number, weekday, time, duration, primary track, primary activity kind, hint) write ONE event:
- title: specific and concrete, at most 60 characters, sentence case, no emoji, no date or time in it. "Propulsion test-stand build night", never "Engineering event".
- host: a real kind of Yale organization (Yale Undergraduate Aerospace Association, Tsai CITY, Y/CS, Yale Entrepreneurial Society, Wright Lab, Yale Astronomy, a residential college council, Dwight Hall at Yale, Yale Well, Yale School of Engineering & Applied Science, a student a cappella or improv group with an invented name, a department).
- building: exactly one name from the allowed list, the place where this event would really happen at Yale (rocket work in Mason Laboratory or the Center for Engineering Innovation & Design, startups at Tsai CITY or Evans Hall, stargazing at Leitner Observatory & Planetarium, concerts in Woolsey Hall or Sprague Hall, volunteering at Dwight Hall, runs from Payne Whitney Gymnasium, Cross Campus or East Rock Park, AI in Watson Hall or Dunham Laboratory, physics at Wright Laboratory or Sloane Physics Laboratory). Spread events over many different buildings; do not use the same building more than twice in your batch.
- room: the location line as displayed, "<short building name>, <room or area>", e.g. "Becton Center, Davies Auditorium", "Pierson College, common room", "Watson Hall, atrium".
- summary: one or two factual sentences, at most 125 characters, concrete (what you do there, how many seats, what you leave with). Student tone, no hype, no exclamation mark.
- tracks: 1 to 3 from the closed list, the primary track first. Add "social" when the event is a good way to meet people from other majors. Add "career" when it helps getting a job or internship. Add "space", "ai", "startup" or "research" whenever the event honestly serves that goal.
- kinds: 1 to 3 from the closed list, the primary kind first. Only kinds that are literally true of the event (move = exercise, move-together = exercise or dance in a group, nature = outdoors in green space, social-small = small group you talk in, social-big = big mixer or crowd, food-together = a shared meal, create = you make art, music-live, arts-watch = you watch art or film, awe = vastness: sky, big science, great hall, learn, help = volunteering, calm = meditation or yoga, laugh = comedy or games, build = you make a thing).
- future: true only if the event is about building the future: space, AI, energy, hardware, biotech.
- food: true if food is served.
- photoHint: 6 to 10 words describing the stock photograph that would illustrate it.

Hard rules: never name a real person. Never name a real company or agency as present, sponsoring or recruiting: write "a propulsion engineer from the launch industry", "an early-stage investor". No online event. Every event is in person and done with other people. Follow the slot's hint closely but give each event its own character. Return the events in slot order, one per slot, with the same slot number.`;

const DAYS = ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu'];

export async function generate(force = false): Promise<RawSample[]> {
  if (!force && fs.existsSync(CACHE_FILE)) return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
  process.loadEnvFile('.env.local');
  const client = new OpenAI({ apiKey: process.env.XAI_API_KEY, baseURL: 'https://api.x.ai/v1' });
  const model = process.env.XAI_MODEL_SMART || 'grok-4.7';
  const batches: Slot[][] = [0, 1, 2, 3].map((b) => SLOTS.filter((_, i) => i % 4 === b)); // interleaved so each call sees varied themes
  const call = async (slots: Slot[], attempt = 0): Promise<RawSample[]> => {
    const user = 'Slots:\n' + slots.map((s) => `slot ${s.n} | ${DAYS[s.day]} | ${s.time} | ${s.dur} min | track ${s.track} | kind ${s.kind} | ${s.hint}`).join('\n');
    try {
      const r = await client.chat.completions.create({
        model, temperature: 0.7,
        messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: user }],
        response_format: { type: 'json_schema', json_schema: { name: 'sample_events', strict: true, schema } },
      });
      const txt = r.choices[0].message.content ?? '';
      const parsed = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1)).events as RawSample[];
      const got = new Set(parsed.map((e) => e.slot));
      const missing = slots.filter((s) => !got.has(s.n));
      if (missing.length && attempt < 2) return [...parsed.filter((e) => slots.some((s) => s.n === e.slot)), ...(await call(missing, attempt + 1))];
      return parsed.filter((e) => slots.some((s) => s.n === e.slot));
    } catch (e) {
      if (attempt < 3) { await new Promise((res) => setTimeout(res, 1000 * 2 ** attempt)); return call(slots, attempt + 1); }
      throw e;
    }
  };
  const all = (await Promise.all(batches.map((b) => call(b)))).flat().sort((a, b) => a.slot - b.slot);
  fs.writeFileSync(CACHE_FILE, JSON.stringify(all, null, 1));
  return all;
}

async function main() {
  const t = Date.now();
  const ev = await generate(process.argv.includes('--force'));
  console.log('generated', ev.length, 'of', SLOTS.length, 'in', Math.round((Date.now() - t) / 1000), 's');
  for (const e of ev) console.log(String(e.slot).padStart(2), '|', e.title, '|', e.building, '|', e.tracks.join(','), '|', e.kinds.join(','), '|', e.photoHint);
}
if (process.argv[1]?.endsWith('sample-events.ts')) main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
