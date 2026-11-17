// Package 0 starter data: 12 sample events with real photographs, friends, stats.
// Package A1 replaces events.json, friends.json and stats.json with the full sample world.
// Run from the project root: node scripts/starter.mjs
import fs from 'fs';
import sharp from 'sharp';

const CACHE = 'scripts/.cache';
const OUT_IMG = 'public/img/events';
fs.mkdirSync(OUT_IMG, { recursive: true });
fs.mkdirSync('public/data', { recursive: true });

const B = { // real coordinates from the Yale places endpoint (PLAN.md §4.1 source 2); Tsai CITY from Luma
  tsai: ['Tsai CITY', 41.3124, -72.9249],
  mason: ['Mason Laboratory', 41.312111, -72.923557],
  becton: ['Becton Engineering and Applied Science Center', 41.312605, -72.925136],
  evans: ['Evans Hall', 41.314941, -72.920346],
  wright: ['Wright Laboratory', 41.318985, -72.920782],
  leitner: ['Leitner Observatory & Planetarium', 41.321132, -72.921942],
  watson: ['Watson Hall', 41.313087, -72.92485],
  sss: ['Sheffield-Sterling-Strathcona Hall', 41.311882, -72.925196],
  dwight: ['Dwight Hall', 41.308937, -72.929315],
  pierson: ['Pierson College', 41.309934, -72.932601],
  cross: ['Cross Campus', 41.310756, -72.927275],
};

// [id, dayOffset, time, durationMin, title, buildingKey, room, host, summary, tracks, kinds, future, food, photo source dir, photo file, slug]
const ROWS = [
  ['grokathon-yale-2026', 0, '17:00', 240, 'Grokathon Yale 2026', 'tsai', 'Tsai CITY', 'xAI × Yale', 'Four-hour build sprint with Grok: ship a tool for the Yale community and demo it to the judges.', ['ai', 'space'], ['build'], true, true, 'cand', 'hackathon-0', 'hackathon'],
  ['sample-teststand', 0, '19:30', 120, 'Propulsion test-stand build night', 'mason', 'Mason Laboratory, machine shop', 'Yale Undergraduate Aerospace Association', 'Help wire and leak-check the test stand before the first cold-flow run of the semester.', ['space', 'industry'], ['build', 'social-small'], true, false, 'nasa', 'rocket-3', 'rocket-team'],
  ['sample-launch-careers', 1, '12:00', 60, 'Lunch talk: how to get hired in the launch industry', 'becton', 'Becton Center, Davies Auditorium', 'Yale School of Engineering & Applied Science', 'A propulsion engineer walks through what launch companies look for in interns, with Q&A and lunch.', ['space', 'career', 'industry'], ['learn', 'food-together'], true, true, 'cand', 'lecture-0', 'lecture'],
  ['sample-founder-dinner', 1, '18:00', 90, 'Founder dinner: your first ten customers', 'evans', 'Evans Hall, Beinecke Terrace Room', 'Yale Entrepreneurial Society', 'Twelve seats, three student founders, one honest conversation about getting the first customers.', ['startup', 'career'], ['food-together', 'social-small'], false, true, 'cand', 'dinner-1', 'dinner'],
  ['sample-wright-open', 2, '16:30', 90, 'Wright Lab open house: detectors and dark matter', 'wright', 'Wright Laboratory', 'Wright Lab', 'Walk the experimental halls, see the detectors up close and meet the grad students who build them.', ['research', 'space'], ['learn', 'awe'], true, false, 'nasa', 'lab-1', 'lab'],
  ['sample-stargazing', 2, '20:00', 90, 'Stargazing night at Leitner Observatory', 'leitner', 'Leitner Family Observatory & Planetarium', 'Yale Astronomy', 'Telescopes on the lawn, Saturn and the winter clusters, hot chocolate inside.', ['space', 'social'], ['awe', 'nature'], false, true, 'cand', 'observatory-0', 'observatory'],
  ['sample-ai-mixer', 3, '17:30', 90, 'AI research mixer: undergrads meet the labs', 'watson', 'Arthur K. Watson Hall, atrium', 'Y/CS', 'Ten labs, ten posters, open spots for spring. Come with one question and leave with a name.', ['ai', 'research'], ['social-big', 'learn'], true, true, 'nasa', 'mixer-3', 'poster-session'],
  ['sample-sat-sprint', 4, '15:00', 150, 'Satellite design sprint', 'becton', 'Center for Engineering Innovation & Design', 'Yale Undergraduate Aerospace Association', 'Teams of four size a CubeSat power system in one afternoon. No experience needed.', ['space', 'industry'], ['build', 'learn'], true, false, 'nasa', 'lab-0', 'hardware-bench'],
  ['sample-pitch', 3, '12:30', 60, 'Pitch practice: 90 seconds, real feedback', 'sss', 'Sheffield-Sterling-Strathcona Hall, room 114', 'Tsai CITY', 'Stand up, pitch for 90 seconds, get direct feedback from three founders. Six slots.', ['startup', 'career'], ['build', 'social-small'], false, false, 'nasa', 'pitch-2', 'pitch'],
  ['sample-kitchen', 5, '11:00', 120, 'Community kitchen volunteer shift', 'dwight', 'Dwight Hall', 'Dwight Hall at Yale', 'Sort and pack food for New Haven families. Two hours, good company.', ['social'], ['help', 'social-small'], false, false, 'cand', 'volunteer-0', 'volunteer'],
  ['sample-boardgames', 0, '20:30', 120, 'Board games night', 'pierson', 'Pierson College, common room', 'Pierson College Council', 'Low-key night of board games and snacks. Come alone, leave with a table.', ['social'], ['social-small', 'laugh'], false, true, 'cand', 'boardgames-0', 'board-games'],
  ['sample-yoga', 1, '16:30', 60, 'Sunset yoga on Cross Campus', 'cross', 'Cross Campus lawn', 'Yale Well', 'An easy outdoor flow as the light goes down. Mats provided.', ['health', 'social'], ['calm', 'move-together'], false, false, 'cand', 'yoga-0', 'yoga'],
];

const credits = ['# Photo credits', '', 'Every image in `public/img/events/` is a real photograph. Origins:', ''];
const candInfo = JSON.parse(fs.readFileSync(`${CACHE}/cand/cand.json`, 'utf8'));
const nasaInfo = JSON.parse(fs.readFileSync(`${CACHE}/nasa/cand.json`, 'utf8'));

const sameBuilding = {};
const events = [];
for (const r of ROWS) {
  const [id, dayOffset, time, durationMin, title, bKey, room, host, summary, tracks, kinds, future, food, dir, file, slug] = r;
  const [building, lat0, lng0] = B[bKey];
  const n = (sameBuilding[bKey] = (sameBuilding[bKey] ?? 0) + 1) - 1;
  const lat = lat0 + (n ? 0.00008 * Math.cos(n * 2.1) : 0); // ~8 m offset so beams do not overlap
  const lng = lng0 + (n ? 0.00010 * Math.sin(n * 2.1) : 0);
  await sharp(`${CACHE}/${dir}/${file}.jpg`).resize(1200, 675, { fit: 'cover', position: 'attention' }).jpeg({ quality: 80, mozjpeg: true }).toFile(`${OUT_IMG}/${slug}.jpg`);
  const [key, idx] = [file.replace(/-\d+$/, ''), +file.match(/-(\d+)$/)[1]];
  if (dir === 'nasa') {
    const c = nasaInfo[key][idx];
    credits.push(`- \`${slug}.jpg\` — NASA, "${c.title}" (${c.nasa_id}), public domain. ${c.url}`);
  } else {
    const c = candInfo[key][idx];
    credits.push(`- \`${slug}.jpg\` — Wikimedia Commons, ${c.title}, ${c.license || 'see page'}, by ${String(c.artist).replace(/<[^>]+>/g, '').trim() || 'see page'}. ${c.page}`);
  }
  events.push({
    id, title, start: '', end: null, dayOffset, time, locationName: room, building, lat: +lat.toFixed(6), lng: +lng.toFixed(6),
    source: 'sample', sourceUrl: '', host, summary, tracks, kinds, future, free: true, food, rsvpUrl: null,
    photoUrl: `/img/events/${slug}.jpg`, sample: true, online: false, solo: false, durationMin,
  });
}

const COLORS = ['#63AAFF', '#8FB8DE', '#5B7FA6', '#A9B8CC', '#3E6FB0', '#7C8DA6'];
const F = (id, name, classYear, college, status, reason, goingTo, i) => ({
  id, name, initials: name.split(' ').map((x) => x[0]).join(''), color: COLORS[i % COLORS.length], classYear, college, status, reason, goingTo,
});
const friends = [
  F('f-lena', 'Lena Park', "'28", 'Pierson', 'friend', null, ['sample-boardgames', 'sample-yoga', 'sample-stargazing'], 0),
  F('f-theo', 'Theo Lindqvist', "'28", 'Saybrook', 'friend', null, ['sample-teststand', 'sample-sat-sprint', 'sample-stargazing'], 1),
  F('f-amara', 'Amara Diallo', "'27", 'Pierson', 'friend', null, ['sample-launch-careers', 'sample-teststand'], 2),
  F('f-jonah', 'Jonah Weiss', "'28", 'Davenport', 'friend', null, ['sample-founder-dinner', 'sample-pitch'], 3),
  F('f-mei', 'Mei Tanaka', "'29", 'Morse', 'friend', null, ['sample-ai-mixer', 'sample-wright-open'], 4),
  F('f-rafa', 'Rafael Ortiz', "'27", 'Trumbull', 'friend', null, ['sample-launch-careers', 'sample-sat-sprint', 'sample-boardgames'], 5),
  F('f-ines', 'Ines Moreau', "'28", 'Pierson', 'friend', null, ['sample-kitchen', 'sample-yoga'], 0),
  F('f-kofi', 'Kofi Mensah', "'26", 'Silliman', 'friend', null, ['sample-ai-mixer', 'sample-founder-dinner', 'sample-stargazing'], 1),
  F('s-nora', 'Nora Castillo', "'28", 'Branford', 'suggested', 'also in CPSC 3230', ['sample-ai-mixer'], 2),
  F('s-dev', 'Dev Malhotra', "'27", 'Pierson', 'suggested', 'Pierson', ['sample-boardgames'], 3),
  F('s-hana', 'Hana Suzuki', "'28", 'Ezra Stiles', 'suggested', 'YUAA', ['sample-teststand', 'sample-sat-sprint'], 4),
  F('s-eli', 'Eli Brandt', "'29", 'Berkeley', 'suggested', 'also in MENG 2511', ['sample-launch-careers'], 5),
];

fs.writeFileSync('public/data/events.json', JSON.stringify(events, null, 1));
fs.writeFileSync('public/data/friends.json', JSON.stringify(friends, null, 1));
fs.writeFileSync('public/data/stats.json', JSON.stringify({ total: events.length, sources: [{ name: 'sample', count: events.length }], bakedAt: new Date().toISOString() }, null, 1));
fs.writeFileSync('public/img/CREDITS.md', credits.join('\n') + '\n');
console.log('events', events.length, 'friends', friends.length);
