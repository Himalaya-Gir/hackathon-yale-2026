// Package A1 — 60 fictional Yale events (PLAN.md §9).
// Grok (XAI_MODEL_SMART, else grok-4.7) rewrites titles and summaries in 4 calls
// when XAI_API_KEY is available. Coverage is fixed in code, not left to the model.
// If the key is missing or a rewrite fails validation, the hand-authored line stays.
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';
import type { ActivityKind, Track, YaleEvent } from '../lib/types';
import { redateAll } from '../lib/time';
import { loadBuildings, type Building } from './buildings';
import { COMPANY, DENY_NAMES, GOALS, MOODS, eventMatchesMood, inWindow } from './check-data';

type Draft = {
  id: string;
  dayOffset: number;
  time: string;
  durationMin: number;
  title: string;
  summary: string;
  building: string;
  locationName: string;
  host: string;
  tracks: Track[];
  kinds: ActivityKind[];
  future: boolean;
  food: boolean;
  slug: string;
  anchor: string[];
};

function ev(
  id: string,
  dayOffset: number,
  time: string,
  durationMin: number,
  title: string,
  summary: string,
  building: string,
  locationName: string,
  host: string,
  tracks: Track[],
  kinds: ActivityKind[],
  future: boolean,
  food: boolean,
  slug: string,
  anchor: string[],
): Draft {
  return { id, dayOffset, time, durationMin, title, summary, building, locationName, host, tracks, kinds, future, food, slug, anchor };
}

const DRAFTS: Draft[] = [
  ev('grokathon-yale-2026', 0, '17:00', 240, 'Grokathon Yale 2026', 'Four-hour build sprint with Grok: ship a tool for the Yale community and demo it to the judges.', 'Tsai CITY', 'Tsai CITY, 17 Prospect Street', 'xAI × Yale', ['ai', 'space'], ['build'], true, true, 'hackathon', ['grokathon', 'grok']),
  ev('sample-teststand', 0, '19:30', 120, 'Propulsion test-stand build night', 'Wire and leak-check the club test stand before the first cold-flow of the semester.', 'Mason Laboratory', 'Mason Laboratory, machine shop', 'Yale Undergraduate Aerospace Association', ['space', 'industry'], ['build', 'social-small'], true, false, 'teststand', ['propulsion', 'test stand', 'cold-flow']),
  ev('sample-boardgames', 0, '20:00', 90, 'Board games in the Pierson buttery', 'Low-key tables and snacks. Come alone and leave with a group.', 'Pierson College', 'Pierson College, buttery', 'Pierson College Council', ['social'], ['social-small', 'laugh'], false, true, 'boardgames', ['board', 'buttery']),
  ev('sample-improv', 0, '20:30', 75, 'Improv drop-in for first-timers', 'Short-form games. First-timers get a partner and a scene, not a tryout.', 'Yale Schwarzman Center', 'Schwarzman Center, rehearsal room', 'Yale Dramat', ['arts', 'social'], ['laugh', 'social-small'], false, false, 'improv', ['improv']),
  ev('sample-evening-run', 0, '19:15', 50, 'Evening loop from Cross Campus', 'Four miles at conversation pace on lit streets. All levels, no one dropped.', 'Cross Campus', 'Cross Campus lawn', 'Yale Club Running', ['health', 'social'], ['move', 'social-small'], false, false, 'evening-run', ['run', 'miles', 'cross campus']),
  ev('sample-meditation', 0, '18:50', 40, 'Quiet sit at Payne Whitney', 'Forty minutes, guided, mats already out. No experience and no talking.', 'Payne Whitney Gymnasium', 'Payne Whitney, studio 2', 'Yale Well', ['health'], ['calm'], false, false, 'meditation', ['sit', 'guided', 'meditation']),
  ev('sample-acappella', 0, '19:45', 60, 'A cappella open rehearsal', 'Sit in on a full rehearsal and join the last song if you want.', 'Sudler Recital Hall', 'Sudler Recital Hall', 'Yale Glee Club', ['arts', 'social'], ['music-live', 'move-together'], false, false, 'acappella', ['cappella', 'rehearsal', 'sing']),
  ev('sample-packing', 0, '19:00', 90, 'Dwight Hall packing shift', 'Sort and bag groceries for New Haven families. Two hours, good company.', 'Dwight Hall', 'Dwight Hall', 'Dwight Hall at Yale', ['social'], ['help', 'social-small'], false, false, 'packing', ['packing', 'groceries', 'dwight']),
  ev('sample-launch-lunch', 2, '12:00', 50, 'Lunch talk: getting hired in launch', 'A propulsion engineer on what launch teams look for in interns, then questions.', 'Becton Engineering and Applied Science Center', 'Becton Center, Davies Auditorium', 'Yale School of Engineering & Applied Science', ['space', 'career', 'industry'], ['learn', 'food-together'], true, true, 'launch-lunch', ['launch', 'intern', 'propulsion']),
  ev('sample-landing-page', 2, '16:30', 90, 'Build-your-landing-page sprint', 'Leave with a one-page site and one sentence a stranger understands.', 'Center for Engineering Innovation & Design', 'CEID, Becton Center', 'Tsai CITY', ['startup'], ['build', 'learn'], true, false, 'landing-page', ['landing', 'one-page', 'site']),
  ev('sample-yoga', 1, '17:00', 60, 'Easy yoga at Payne Whitney', 'A slow flow, mats provided, all levels. Indoors, lights low.', 'Payne Whitney Gymnasium', 'Payne Whitney, studio 1', 'Yale Well', ['health', 'social'], ['calm', 'move-together'], false, false, 'yoga', ['yoga', 'flow']),
  ev('sample-east-rock', 1, '16:15', 90, 'East Rock loop before dinner', 'Up the park road and back at an easy pace, with a stop at the view.', 'East Rock Park', 'East Rock Park, summit road', 'Yale Outdoors', ['health', 'social'], ['nature', 'move'], false, false, 'east-rock', ['east rock', 'park', 'view']),
  ev('sample-founder-dinner', 1, '18:30', 90, 'Founder dinner: your first ten customers', 'Twelve seats. Three student founders on getting anyone to pay.', 'Evans Hall', 'Evans Hall, seminar room', 'Yale Entrepreneurial Society', ['startup', 'career'], ['food-together', 'social-small'], false, true, 'founder-dinner', ['customers', 'founders', 'dinner']),
  ev('sample-chamber', 1, '20:00', 70, 'Chamber concert at Sprague Hall', 'A student string quartet, short program, doors open to anyone.', 'Sprague Hall', 'Sprague Hall', 'Yale School of Music', ['arts', 'social'], ['music-live', 'arts-watch', 'social-big'], false, false, 'chamber', ['quartet', 'sprague', 'concert']),
  ev('sample-rl-journal', 1, '17:30', 60, 'Reinforcement learning journal club', 'One paper and a whiteboard. This week: reward shaping. Undergrads welcome.', 'Watson Hall', 'Watson Hall, room 105', 'Y/CS', ['ai', 'research'], ['learn', 'social-small'], true, false, 'rl-journal', ['reinforcement', 'journal', 'paper']),
  ev('sample-pottery', 1, '16:00', 90, 'Open studio at the pottery', 'Wheels are free. Someone shows the first cylinder, then you try.', 'Green Hall', 'Green Hall, studio', 'Yale School of Art', ['arts', 'social'], ['create', 'social-small'], false, false, 'pottery', ['pottery', 'wheel', 'clay']),
  ev('sample-jazz', 1, '19:00', 80, 'Jazz night at Saybrook', 'A short combo set, then the floor opens. Plates out at the start.', 'Saybrook College', 'Saybrook College, dining hall', 'Saybrook College Council', ['arts', 'social'], ['music-live', 'food-together'], false, true, 'jazz', ['jazz', 'combo']),
  ev('sample-climbing', 1, '20:30', 60, 'Intro to the climbing wall', 'Harness, belay, and one route. First-timers are paired with a belayer.', 'Payne Whitney Gymnasium', 'Payne Whitney, climbing wall', 'Payne Whitney Gymnasium', ['health', 'social'], ['move', 'social-small'], false, false, 'climbing', ['climbing', 'belay', 'wall']),
  ev('sample-grove-walk', 1, '16:45', 50, 'Slow walk under the Grove Street elms', 'Phones away. Out and back, just looking up.', 'Beinecke Library', 'Beinecke Library plaza', 'Yale Well', ['health', 'social'], ['awe', 'nature', 'social-small'], false, false, 'grove-walk', ['elms', 'grove', 'walk']),
  ev('sample-poster-tea', 1, '18:00', 75, 'AI lab posters and tea', 'Ten labs, ten posters, open spring spots. Bring one question.', 'Watson Hall', 'Watson Hall, atrium', 'Y/CS', ['ai', 'research'], ['learn', 'social-small'], true, true, 'poster-tea', ['posters', 'labs', 'tea']),
  ev('sample-wright', 2, '16:00', 90, 'Wright Lab open house', 'Walk the experimental halls and see the detectors with the students who build them.', 'Wright Laboratory', 'Wright Laboratory', 'Wright Lab', ['research', 'space'], ['learn', 'awe'], true, false, 'wright', ['wright', 'detectors', 'halls']),
  ev('sample-stargazing', 2, '20:00', 90, 'Stargazing at Leitner Observatory', 'Telescopes on the lawn, winter clusters, and hot chocolate inside.', 'Leitner Observatory & Planetarium', 'Leitner Observatory', 'Yale Astronomy', ['space', 'social'], ['awe', 'nature'], false, true, 'stargazing', ['stargazing', 'telescope', 'leitner']),
  ev('sample-ml-reading', 2, '17:15', 60, 'Machine learning reading group', 'One short paper on evaluation. Chalkboard, not a lecture.', 'Watson Hall', 'Watson Hall, seminar room', 'Y/CS', ['ai', 'research'], ['learn', 'social-small'], true, false, 'ml-reading', ['machine learning', 'paper', 'evaluation']),
  ev('sample-pitch', 2, '18:30', 60, 'Pitch practice: 90 seconds, real notes', 'Six slots. Stand up, pitch, get direct notes from three student founders.', 'Sheffield-Sterling-Strathcona Hall', 'SSS, room 114', 'Tsai CITY', ['startup', 'career'], ['build', 'social-small'], false, false, 'pitch', ['pitch', '90 seconds']),
  ev('sample-customers', 2, '10:30', 60, 'Customer-discovery workshop', 'Practice five interview questions and leave with people you will actually ask.', 'Yale Schwarzman Center', 'Schwarzman Center, room 216', 'Yale Entrepreneurial Society', ['startup'], ['learn', 'social-small'], false, false, 'customers', ['customer', 'interview']),
  ev('sample-incorporate', 2, '15:00', 60, 'Incorporation clinic for student teams', 'How a student team becomes a company: forms, founders, and the first paperwork. No firm is pitching.', 'Evans Hall', 'Evans Hall, classroom', 'Yale Entrepreneurial Society', ['startup'], ['learn', 'social-small'], false, false, 'incorporate', ['incorporation', 'paperwork', 'company']),
  ev('sample-cubesat', 3, '15:00', 150, 'CubeSat power-system sprint', 'Teams of four size a small-satellite power budget in one afternoon.', 'Center for Engineering Innovation & Design', 'CEID, project hall', 'Yale Undergraduate Aerospace Association', ['space', 'industry'], ['build', 'learn'], true, false, 'cubesat', ['cubesat', 'power', 'satellite']),
  ev('sample-cv-open', 3, '16:30', 90, 'Computer vision lab open house', 'See the cameras and the rigs, and where an undergrad can actually help.', 'Yale Science Building', 'Yale Science Building, lab wing', 'Yale Computer Science', ['ai', 'research'], ['learn', 'awe'], true, false, 'cv-open', ['vision', 'cameras', 'lab']),
  ev('sample-hardware-oh', 3, '17:30', 75, 'Hardware startup office hours', 'Bring a prototype, a sketch, or a stuck question. Mentors are student founders.', 'Center for Engineering Innovation & Design', 'CEID, project hall', 'Tsai CITY', ['startup', 'industry'], ['build', 'social-small'], true, false, 'hardware-oh', ['hardware', 'prototype', 'office hours']),
  ev('sample-terms', 3, '12:30', 60, 'Term sheets, explained slowly', 'A student founder walks a sample sheet line by line. No firm is in the room.', 'Luce Hall', 'Luce Hall, seminar room', 'Yale Entrepreneurial Society', ['startup', 'finance'], ['learn', 'social-small'], false, false, 'terms', ['term sheet', 'sheet']),
  ev('sample-ballroom', 3, '19:00', 75, 'Beginner ballroom in the college hall', 'A waltz and a basic swing. Partners rotate, and no one sits out.', 'Silliman College', 'Silliman College, dining hall', 'Yale Ballroom Dance Team', ['arts', 'social'], ['move-together', 'social-big'], false, false, 'ballroom', ['ballroom', 'waltz', 'dance']),
  ev('sample-nlp-tea', 3, '16:00', 60, 'Language-model lab tea', 'Meet the group that works on language models. Tea, posters, open questions.', 'Watson Hall', 'Watson Hall, lounge', 'Yale Computer Science', ['ai', 'research'], ['learn', 'food-together'], true, true, 'nlp-tea', ['language', 'tea', 'lab']),
  ev('sample-orbit', 4, '14:00', 80, 'Orbit mechanics problem session', 'Work the transfer problems together. Whiteboards, snacks, no grading.', 'Kline Tower', 'Kline Tower, classroom', 'Yale Astronomy', ['space'], ['learn', 'social-small'], true, true, 'orbit', ['orbit', 'mechanics', 'transfer']),
  ev('sample-robots', 4, '15:30', 90, 'Robot learning demo hour', 'Watch a robot fail, then improve, and ask the team how to join.', 'Yale Science Building', 'Yale Science Building, robotics bay', 'Yale Computer Science', ['ai', 'research'], ['build', 'learn'], true, false, 'robots', ['robot', 'demo']),
  ev('sample-cofounders', 4, '10:00', 80, 'Co-founder breakfast', 'Eight seats. Say what you want to build and who you still need.', 'Tsai CITY', 'Tsai CITY, cafe', 'Yale Entrepreneurial Society', ['startup', 'social'], ['food-together', 'social-small'], false, true, 'cofounders', ['co-founder', 'breakfast']),
  ev('sample-usertest', 4, '18:00', 70, 'Prototype user-test night', 'Bring something clickable. People outside your major try it and talk.', 'Center for Engineering Innovation & Design', 'CEID, studio', 'Tsai CITY', ['startup', 'social'], ['build', 'social-small'], false, false, 'usertest', ['user-test', 'prototype', 'clickable']),
  ev('sample-lab-match', 4, '11:30', 70, 'Lab match: vision and robotics', 'Short talks from groups looking for undergrads, then you walk up and ask.', 'Yale Science Building', 'Yale Science Building, atrium', 'Yale Computer Science', ['ai', 'research'], ['learn', 'social-big'], true, false, 'lab-match', ['lab match', 'robotics', 'undergrads']),
  ev('sample-responsible', 4, '16:30', 60, 'Seminar: responsibility in AI systems', 'One deployed system, and the failure it did not expect. Discussion after.', 'Humanities Quadrangle', 'Humanities Quadrangle, auditorium', 'Yale Computer Science', ['ai', 'research', 'policy'], ['learn'], true, false, 'responsible', ['responsibility', 'deployed', 'failure']),
  ev('sample-medimg', 5, '14:00', 60, 'Medical imaging reading group', 'One paper on how models read scans. Coders and clinicians in one room.', 'Yale Science Building', 'Yale Science Building, seminar room', 'Yale Computer Science', ['ai', 'research', 'health'], ['learn', 'social-small'], true, false, 'medimg', ['imaging', 'scans', 'paper']),
  ev('sample-policy-lunch', 5, '12:00', 60, 'Lunch: who regulates space launches', 'A policy student and an engineering student trade the questions they cannot answer.', 'Luce Hall', 'Luce Hall, seminar room', 'Yale Undergraduate Aerospace Association', ['space', 'policy'], ['learn', 'food-together'], true, true, 'policy-lunch', ['regulates', 'launches', 'policy']),
  ev('sample-research-match', 5, '15:30', 80, 'Undergrad research match for AI', 'Labs post open tasks on the wall. You leave with a name and a next step.', 'Becton Engineering and Applied Science Center', 'Becton Center, Davies Auditorium', 'Y/CS', ['ai', 'research'], ['social-big', 'learn'], true, false, 'research-match', ['research match', 'labs', 'tasks']),
  ev('sample-yes', 5, '17:00', 75, 'YES brainstorm: ideas you would start', 'Sticky notes for an hour, then the three ideas people volunteer to push.', 'Yale Schwarzman Center', 'Schwarzman Center, workshop room', 'Yale Entrepreneurial Society', ['startup', 'social'], ['social-big', 'learn'], false, false, 'yes', ['brainstorm', 'ideas', 'sticky']),
  ev('sample-pricing', 5, '11:00', 60, 'Pricing workshop: the first invoice', 'Practice saying a number out loud and writing the email that asks for it.', 'Evans Hall', 'Evans Hall, classroom', 'Yale Entrepreneurial Society', ['startup'], ['learn', 'social-small'], false, false, 'pricing', ['pricing', 'invoice']),
  ev('sample-trajectory', 5, '19:00', 120, 'Trajectory code night', 'Implement a simple orbit propagator in pairs, one laptop each.', 'Dunham Laboratory', 'Dunham Laboratory, computer room', 'Yale Undergraduate Aerospace Association', ['space', 'ai'], ['build', 'learn'], true, false, 'trajectory', ['trajectory', 'propagator', 'orbit']),
  ev('sample-cleanroom', 6, '16:30', 75, 'Cleanroom gowning, first visit', 'Learn the gowning order and see how flight hardware is handled.', 'Wright Laboratory', 'Wright Laboratory, cleanroom lobby', 'Yale Undergraduate Aerospace Association', ['space'], ['learn', 'awe'], true, false, 'cleanroom', ['cleanroom', 'gowning', 'flight hardware']),
  ev('sample-mirrors', 6, '17:30', 80, 'Telescope mirror lab tour', 'See a mirror in progress and how students test its figure.', 'Leitner Observatory & Planetarium', 'Leitner Observatory, lab', 'Yale Astronomy', ['space'], ['build', 'learn'], true, false, 'mirrors', ['mirror', 'telescope', 'figure']),
  ev('sample-showcase', 6, '18:30', 90, 'Student founder showcase', 'Eight teams, four minutes each, then you talk to the ones you liked.', 'Evans Hall', 'Evans Hall, auditorium', 'Yale Entrepreneurial Society', ['startup'], ['social-big', 'learn'], false, false, 'showcase', ['showcase', 'teams', 'founders']),
  ev('sample-hai', 6, '16:15', 70, 'Human-AI interaction lab visit', 'Watch a study setup and hear which questions the group still cannot answer.', 'Watson Hall', 'Watson Hall, lab', 'Yale Computer Science', ['ai', 'research'], ['learn', 'social-small'], true, false, 'hai', ['human-ai', 'interaction', 'study']),
  ev('sample-gpu', 6, '19:30', 50, 'Tour of the shared GPU cluster', 'Where the machines live, who can get time, and what not to run on a shared box.', 'Yale Science Building', 'Yale Science Building, machine room', 'Yale Computer Science', ['ai', 'research'], ['learn', 'awe'], true, false, 'gpu', ['gpu', 'cluster', 'machines']),
  ev('sample-safety', 6, '20:15', 50, 'High-power rocketry safety briefing', 'Range rules, motor classes, and who is allowed to press the button.', 'Mason Laboratory', 'Mason Laboratory, classroom', 'Yale Undergraduate Aerospace Association', ['space'], ['learn', 'social-small'], true, false, 'safety', ['rocketry', 'safety', 'motor']),
  ev('sample-energy', 7, '17:00', 60, 'Energy storage journal club', 'One paper on batteries: what the figure claims, and what it skips.', 'Kroon Hall', 'Kroon Hall, classroom', 'Yale School of the Environment', ['climate', 'research'], ['learn'], true, false, 'energy', ['battery', 'batteries', 'storage']),
  ev('sample-longrun', 7, '09:00', 80, 'Long run to East Rock and back', 'Easy conversational pace, out and back. Walkers are welcome on the return.', 'East Rock Park', 'East Rock Park gate', 'Yale Club Running', ['health', 'social'], ['move', 'nature'], false, false, 'longrun', ['long run', 'east rock']),
  ev('sample-organ', 7, '19:30', 60, 'Short organ recital at Battell', 'Thirty minutes of music. Doors open, sit anywhere.', 'Battell Chapel', 'Battell Chapel', 'Yale Institute of Sacred Music', ['arts'], ['music-live', 'awe'], false, false, 'organ', ['organ', 'recital', 'battell']),
  ev('sample-sketch', 7, '14:00', 80, 'Sketch hour at the Art Gallery', 'Pencils at the desk. Draw one object, then wander.', 'Yale University Art Gallery', 'Yale University Art Gallery', 'Yale University Art Gallery', ['arts'], ['create', 'calm'], false, false, 'sketch', ['sketch', 'gallery', 'draw']),
  ev('sample-biotech', 8, '16:00', 75, 'Biotech lab shadow hour', 'Stand with a grad student through one protocol and ask what the week is like.', 'Yale Science Building', 'Yale Science Building, wet lab', 'Yale MB&B', ['health', 'research'], ['learn', 'awe'], true, false, 'biotech', ['biotech', 'protocol', 'lab']),
  ev('sample-critique', 8, '18:00', 80, 'Design critique, open chairs', 'Bring a poster, a screen, or a sketch. The room gives you three notes.', 'Green Hall', 'Green Hall, studio', 'Yale School of Art', ['arts', 'startup'], ['create', 'social-small'], false, false, 'critique', ['critique', 'sketch', 'notes']),
  ev('sample-language', 8, '18:30', 90, 'Language-exchange dinner', 'Tables by language, switch seats halfway. Come hungry.', 'Timothy Dwight College', 'Timothy Dwight College, dining hall', 'Timothy Dwight College', ['social'], ['food-together', 'social-big'], false, true, 'language', ['language', 'dinner', 'seats']),
  ev('sample-climate-dinner', 9, '18:00', 90, 'Climate policy dinner', 'Students in science and policy argue one proposal, then write down what they learned.', 'Kroon Hall', 'Kroon Hall, common room', 'Yale Student Environmental Coalition', ['climate', 'policy', 'social'], ['food-together', 'learn'], false, true, 'climate-dinner', ['climate', 'proposal', 'policy']),
  ev('sample-openmic', 9, '20:00', 90, 'Open mic at the college', 'Three songs or one poem. Sign the sheet, or listen from the back.', 'Jonathan Edwards College', 'Jonathan Edwards College, buttery', 'Jonathan Edwards College Council', ['arts', 'social'], ['music-live', 'laugh'], false, false, 'openmic', ['open mic', 'songs', 'poem']),
  ev('sample-library', 9, '19:00', 90, 'Quiet company at Sterling', 'A reserved table for people who want to work beside someone. Company, not a tutor.', 'Sterling Memorial Library', 'Sterling Memorial Library, main reading room', 'Sterling Memorial Library', ['social'], ['learn', 'social-small'], false, false, 'library', ['sterling', 'table', 'reading']),
];

function loadEnv() {
  const file = path.resolve('.env.local');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const i = t.indexOf('=');
    const key = t.slice(0, i);
    let value = t.slice(i + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function redact(s: string): string {
  return s.replace(/xai-[A-Za-z0-9_-]{6,}/gi, '[redacted]').replace(/sk-[A-Za-z0-9_-]{6,}/g, '[redacted]').slice(0, 280);
}

function banned(text: string): string | null {
  for (const name of DENY_NAMES) {
    if (text.toLowerCase().includes(name.toLowerCase())) return name;
  }
  if (COMPANY.test(text)) return 'company';
  return null;
}

function acceptRewrite(d: Draft, title: string, summary: string): boolean {
  if (d.id === 'grokathon-yale-2026') return false;
  if (!title || !summary || title.length > 80 || summary.length > 140) return false;
  if (/\p{Extended_Pictographic}/u.test(title + summary)) return false;
  const blob = `${title}\n${summary}`;
  if (banned(blob)) return false;
  const hay = blob.toLowerCase();
  if (!d.anchor.some((a) => hay.includes(a.toLowerCase()))) return false;
  return true;
}

type GrokRow = { id?: string; title?: string; summary?: string; host?: string; locationName?: string };

function parseRows(raw: string): GrokRow[] {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('no json object');
  const data = JSON.parse(raw.slice(start, end + 1)) as { events?: GrokRow[] };
  if (!Array.isArray(data.events)) throw new Error('no events array');
  return data.events;
}

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['events'],
  properties: {
    events: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'summary', 'host', 'locationName'],
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          summary: { type: 'string' },
          host: { type: 'string' },
          locationName: { type: 'string' },
        },
      },
    },
  },
};

async function polishBatch(client: OpenAI, model: string, batch: Draft[]): Promise<GrokRow[]> {
  const brief = batch
    .map((d) => `${d.id} | ${d.building} | day ${d.dayOffset} ${d.time} | activity: ${d.title} | must include one of: ${d.anchor.join(', ')} | host hint: ${d.host}`)
    .join('\n');
  const messages = [
    {
      role: 'system' as const,
      content: 'You write fictional but believable events for Yale students. Return JSON only. No real person names. No real company as host, sponsor, or guest, and no claim a company is officially present. Keep each event the same activity as the activity line. Title at most 80 characters. Summary at most 140 characters. Host is a Yale club, college, or department. locationName names a room inside the given building.',
    },
    {
      role: 'user' as const,
      content: `Rewrite title, summary, host, and locationName for each line. Keep the id exactly. The title or summary must contain one anchor phrase, spelled as given.\n\n${brief}`,
    },
  ];
  const common = { model, messages, temperature: 0.4, max_tokens: 7000 };
  try {
    const res = await client.chat.completions.create({
      ...common,
      response_format: { type: 'json_schema', json_schema: { name: 'sample_events', strict: true, schema: SCHEMA } },
    });
    return parseRows(res.choices[0]?.message?.content ?? '');
  } catch (err) {
    console.log('grok schema retry:', redact(err instanceof Error ? err.message : String(err)));
    const res = await client.chat.completions.create(common);
    return parseRows(res.choices[0]?.message?.content ?? '');
  }
}

async function polish(drafts: Draft[]): Promise<{ used: boolean; accepted: number; model: string }> {
  loadEnv();
  const key = process.env.XAI_API_KEY;
  if (!key) {
    console.log('GENERATION grok=no hand-authored');
    return { used: false, accepted: 0, model: '' };
  }
  const model = process.env.XAI_MODEL_SMART || 'grok-4.7';
  const client = new OpenAI({ apiKey: key, baseURL: 'https://api.x.ai/v1' });
  const cachePath = 'scripts/.cache/grok-rewrites.json';
  if (process.env.GROK_REUSE === '1' && fs.existsSync(cachePath)) {
    const saved = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as { id: string; title: string; summary: string; host: string; locationName: string }[];
    let accepted = 0;
    for (const row of saved) {
      const d = drafts.find((x) => x.id === row.id);
      if (!d) continue;
      d.title = row.title;
      d.summary = row.summary;
      d.host = row.host;
      d.locationName = row.locationName;
      accepted++;
    }
    console.log(`GENERATION grok=yes reused=${accepted} model=${model}`);
    return { used: true, accepted, model };
  }
  const batches: Draft[][] = [];
  for (let i = 0; i < drafts.length; i += 15) batches.push(drafts.slice(i, i + 15));
  let accepted = 0;
  let calls = 0;
  for (let i = 0; i < batches.length; i += 2) {
    const slice = batches.slice(i, i + 2);
    const results = await Promise.all(
      slice.map(async (batch) => {
        try {
          const rows = await polishBatch(client, model, batch);
          calls++;
          return rows;
        } catch (err) {
          console.log('grok batch failed:', redact(err instanceof Error ? err.message : String(err)));
          return [] as GrokRow[];
        }
      }),
    );
    for (const rows of results) {
      for (const row of rows) {
        const d = drafts.find((x) => x.id === row.id);
        if (!d || !row.title || !row.summary) continue;
        if (!acceptRewrite(d, row.title.trim(), row.summary.trim())) continue;
        d.title = row.title.trim();
        d.summary = row.summary.trim();
        if (row.host && !banned(row.host) && row.host.length <= 80) d.host = row.host.trim();
        if (row.locationName && row.locationName.length <= 80 && !banned(row.locationName)) d.locationName = row.locationName.trim();
        accepted++;
      }
    }
  }
  console.log(`GENERATION grok=${calls ? 'yes' : 'no'} accepted=${accepted}/${drafts.length} model=${model}`);
  fs.mkdirSync('scripts/.cache', { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(drafts.map((d) => ({ id: d.id, title: d.title, summary: d.summary, host: d.host, locationName: d.locationName })), null, 2));
  return { used: calls > 0 && accepted > 0, accepted, model };
}

function coordsFor(buildings: Map<string, Building>, used: Map<string, number>, building: string, id: string) {
  const b = buildings.get(building);
  if (!b) throw new Error(`unknown building: ${building}`);
  const n = used.get(building) ?? 0;
  used.set(building, n + 1);
  if (id === 'grokathon-yale-2026') return { lat: 41.3124, lng: -72.9249 };
  if (n === 0) return { lat: +b.lat.toFixed(6), lng: +b.lng.toFixed(6) };
  const angle = (n * 2 * Math.PI) / 6;
  const dLat = (8 * Math.cos(angle)) / 111320;
  const dLng = (8 * Math.sin(angle)) / (111320 * Math.cos((b.lat * Math.PI) / 180));
  return { lat: +(b.lat + dLat).toFixed(6), lng: +(b.lng + dLng).toFixed(6) };
}

function toEvents(drafts: Draft[]): YaleEvent[] {
  const buildings = new Map(loadBuildings().map((b) => [b.name, b]));
  const used = new Map<string, number>();
  const ids = new Set<string>();
  return drafts.map((d) => {
    if (ids.has(d.id)) throw new Error(`dup ${d.id}`);
    ids.add(d.id);
    if (d.title.length > 80) throw new Error(`title ${d.id} ${d.title.length}`);
    if (d.summary.length > 140) throw new Error(`summary ${d.id} ${d.summary.length}: ${d.summary}`);
    if (d.id !== 'grokathon-yale-2026') {
      const hit = banned(`${d.title}\n${d.summary}\n${d.host}`);
      if (hit) throw new Error(`banned ${hit} in ${d.id}`);
    }
    const { lat, lng } = coordsFor(buildings, used, d.building, d.id);
    return {
      id: d.id,
      title: d.title,
      start: '',
      end: null,
      dayOffset: d.dayOffset,
      time: d.time,
      locationName: d.locationName,
      building: d.building,
      lat,
      lng,
      source: 'sample',
      sourceUrl: '',
      host: d.host,
      summary: d.summary,
      tracks: d.tracks,
      kinds: d.kinds,
      future: d.future,
      free: true,
      food: d.food,
      rsvpUrl: null,
      photoUrl: `/img/events/${d.slug}.jpg`,
      sample: true,
      online: false,
      solo: false,
      durationMin: d.durationMin,
    };
  });
}

function preflight(events: YaleEvent[]) {
  const ref = new Date();
  const dated = redateAll(events, ref);
  const week = dated.filter((e) => inWindow(e, ref, 168));
  const soon = dated.filter((e) => inWindow(e, ref, 48));
  const offsets = new Set(events.map((e) => e.dayOffset));
  for (let d = 0; d <= 9; d++) if (!offsets.has(d)) throw new Error(`missing dayOffset ${d}`);
  const future = events.filter((e) => e.future).length;
  if (events.length < 60) throw new Error(`only ${events.length} events`);
  if (future < 15) throw new Error(`future ${future}`);
  for (const g of GOALS) {
    const n = week.filter((e) => g.test(e)).length;
    console.log(`preflight ${g.id} ${n}`);
    if (n < 12) throw new Error(`goal ${g.id} ${n}`);
  }
  for (const m of MOODS) {
    const n = soon.filter((e) => eventMatchesMood(e, m)).length;
    console.log(`preflight ${m} ${n}`);
    if (n < 6) throw new Error(`mood ${m} ${n}`);
  }
}

async function main() {
  if (DRAFTS.length !== 60) throw new Error(`drafts ${DRAFTS.length}`);
  await polish(DRAFTS);
  const events = toEvents(DRAFTS);
  preflight(events);
  fs.mkdirSync('public/data', { recursive: true });
  fs.writeFileSync('public/data/events.json', JSON.stringify(events, null, 2) + '\n');
  const stats = {
    total: events.length,
    sources: [{ name: 'sample', count: events.length }],
    bakedAt: new Date().toISOString(),
  };
  fs.writeFileSync('public/data/stats.json', JSON.stringify(stats, null, 2) + '\n');
  console.log(`events ${events.length}`);
}

main().catch((err) => {
  console.error(redact(err instanceof Error ? err.stack || err.message : String(err)));
  process.exit(1);
});
