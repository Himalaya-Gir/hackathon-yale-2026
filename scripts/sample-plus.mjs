// Package A1 (PLAN.md §9): 19 more hand-written sample events, each with a real photograph chosen
// by eye on a contact sheet of scripts/.cache/a1 (NASA Image Library, public domain; Wikimedia Commons).
// Merges into events.json (replacing earlier versions of the same ids), adds friends going, credits.
// Run from the project root after scripts/photo-fetch.mjs: node scripts/sample-plus.mjs
import fs from 'fs';
import sharp from 'sharp';

const CACHE = 'scripts/.cache/a1';
const OUT_IMG = 'public/img/events';
const buildings = JSON.parse(fs.readFileSync('public/data/buildings.json', 'utf8'));
const FIXED = { // buildings missing from the places endpoint (coordinates from scripts/starter.mjs)
  'Tsai CITY': [41.3124, -72.9249], 'Mason Laboratory': [41.312111, -72.923557],
  'Becton Engineering and Applied Science Center': [41.312605, -72.925136], 'Pierson College': [41.309934, -72.932601],
};
function where(name) {
  if (FIXED[name]) return FIXED[name];
  const b = buildings.find((x) => x.name === name);
  if (!b) throw new Error(`unknown building: ${name}`);
  return [b.lat, b.lng];
}

// [id, dayOffset, time, durationMin, title, building, room, host, summary, tracks, kinds, future, food, photo (cache key), friends going]
const ROWS = [
  ['sample-launch-watch', 0, '21:30', 75, 'Night launch watch party on the observatory lawn', 'Leitner Observatory & Planetarium', 'Leitner Observatory, the lawn', 'Yale Undergraduate Aerospace Association', 'A live stream of tonight\'s orbital launch on the big screen, telescopes pointed at the sky, hot cider for everyone.', ['space'], ['awe', 'social-big', 'food-together'], true, true, 'nlaunch-2', ['f-theo', 'f-lena', 'f-rafa']],
  ['sample-hotfire', 1, '19:00', 90, 'Hot-fire night: YUAA\'s hybrid engine test, frame by frame', 'Mason Laboratory', 'Mason Laboratory, room 211', 'Yale Undergraduate Aerospace Association', 'The propulsion team replays last weekend\'s test-stand footage and explains what failed, what held, and what they fire next.', ['space', 'industry'], ['learn', 'build', 'social-small'], true, true, 'nengine-1', ['f-theo', 'f-amara']],
  ['sample-mission-sim', 3, '19:00', 120, 'Mission control simulation: land on the Moon in teams of five', 'Becton Engineering and Applied Science Center', 'Becton Center, CEID studio', 'Yale Undergraduate Aerospace Association', 'Flight director, guidance, comms: each team runs a lunar landing on real consoles while the sim throws failures at you.', ['space', 'ai'], ['build', 'social-small', 'laugh'], true, true, 'ncontrol-0', ['f-theo', 'f-rafa', 'f-kofi']],
  ['sample-cubesat-review', 2, '18:00', 90, 'CubeSat design review: pitch a payload for next year\'s launch', 'Center for Engineering Innovation & Design', 'CEID, main floor', 'Yale Undergraduate Aerospace Association', 'Bring one idea for what our 10-cm satellite should carry. Five minutes each, then the team votes. Pizza after.', ['space', 'research'], ['build', 'learn', 'food-together'], true, true, 'ncubesat-2', ['f-amara', 'f-theo']],
  ['sample-balloon', 5, '09:00', 180, 'High-altitude balloon launch from East Rock', 'East Rock Park', 'East Rock Park, summit lot', 'Yale Undergraduate Aerospace Association', 'Help release a weather balloon carrying our camera to 30 km, then track it live as it crosses Connecticut.', ['space', 'research', 'climate'], ['build', 'nature', 'awe'], true, false, 'nbalance-0', ['f-rafa', 'f-lena']],
  ['sample-orbit-econ', 2, '12:00', 60, 'The economics of orbit: who pays for space, and who profits', 'Evans Hall', 'Evans Hall, Zhang Auditorium', 'Yale School of Management', 'A launch-industry analyst breaks down the cost per kilo to orbit and where the next space businesses will come from. Lunch served.', ['space', 'finance', 'startup'], ['learn', 'food-together'], true, true, 'npanel-0', ['f-jonah']],
  ['sample-space-global', 3, '18:00', 90, 'Satellite teams from six countries, one evening', 'Luce Hall', 'Luce Hall, common room', 'Yale Undergraduate Aerospace Association', 'Student satellite builders visiting from Kenya, Japan, Brazil and more share what they launched and how they got there.', ['space', 'social'], ['social-big', 'learn', 'food-together'], true, true, 'ncubesat-0', ['f-amara', 'f-mei']],
  ['sample-hardware-hack', 4, '18:00', 240, 'Hardware hackathon kickoff: 48 hours, real parts', 'Center for Engineering Innovation & Design', 'CEID, maker floor', 'Center for Engineering Innovation & Design', 'Form a team, grab a kit of motors, sensors and boards, and build something that moves by Sunday night.', ['startup', 'industry', 'ai'], ['build', 'social-small', 'food-together'], true, true, 'nrobot-4', ['f-kofi', 'f-rafa']],
  ['sample-demo-night', 2, '18:30', 120, 'Demo night: eight student startups, three minutes each', 'Tsai CITY', 'Tsai CITY, main space', 'Tsai CITY', 'Founders from across Yale demo what they shipped this semester, then the floor opens for questions and coffee.', ['startup'], ['learn', 'social-big'], false, true, 'nrobot-1', ['f-jonah', 'f-kofi']],
  ['sample-cofounder-match', 4, '20:00', 90, 'Co-founder speed matching', 'Tsai CITY', 'Tsai CITY, lounge', 'Yale Entrepreneurial Society', 'Seven-minute rounds with builders, designers and future CEOs. Leave with three people to grab coffee with.', ['startup', 'social'], ['social-small', 'food-together'], false, true, 'trivia-1', ['f-jonah', 'f-ines']],
  ['sample-robot-lab', 1, '16:00', 90, 'Robot learning lab: open bench afternoon', 'Dunham Laboratory', 'Dunham Laboratory, robotics lab', 'Yale School of Engineering & Applied Science', 'Watch robot arms learn to grasp new objects, ask the grad students anything, and see how undergrads join the lab.', ['ai', 'research'], ['learn', 'build'], true, false, 'robotarm-1', ['f-mei', 'f-kofi']],
  ['sample-paper-club', 3, '20:00', 75, 'AI paper club: agents that plan', 'Kline Tower', 'Kline Tower, 14th floor', 'Y/CS', 'One recent paper on planning agents, read in advance, argued over pizza. Newcomers welcome, skimming is fine.', ['ai', 'research'], ['learn', 'social-small', 'food-together'], true, true, 'robotarm-0', ['f-mei']],
  ['sample-gpu-tour', 4, '14:00', 60, 'Inside the campus GPU cluster: a tour of the machines', '25 Science Park', '25 Science Park, data center', 'Yale Center for Research Computing', 'See the racks that train Yale\'s models, learn how students get compute time, and hear what research runs on them.', ['ai', 'research'], ['learn', 'awe'], true, false, 'server-0', ['f-kofi']],
  ['sample-scifi-film', 5, '19:30', 150, 'Sci-fi night: a Mars survival film, then an astronomer\'s Q&A', 'Loria Center', 'Loria Center, screening room', 'Yale Film Society', 'Popcorn, a classic Mars survival film, and a Yale astronomer on what the movie got right about living off-world.', ['arts', 'space'], ['arts-watch', 'awe', 'social-big'], true, true, 'film-1', ['f-lena', 'f-theo', 'f-amara']],
  ['sample-greenhouse', 1, '13:00', 60, 'Marsh Botanical Garden: greenhouse open hour', 'Marsh Hall', 'Marsh Botanical Garden, greenhouses', 'Marsh Botanical Garden', 'An hour among the tropical and desert collections, with a curator showing the plants that survive the harshest climates.', ['climate', 'research'], ['nature', 'calm', 'learn'], false, false, 'marsh-0', ['f-ines']],
  ['sample-meditation', 1, '17:30', 30, 'Twenty quiet minutes: guided meditation before finals', 'Dwight Hall & Memorial Chapel', 'Dwight Memorial Chapel', 'Yale Chaplain\'s Office', 'A short guided session for anyone who needs to slow down. No experience needed, cushions provided.', ['health'], ['calm'], false, false, 'meditation-0', ['f-ines', 'f-lena']],
  ['sample-trivia', 2, '21:00', 90, 'Science trivia night: Pierson vs. everyone', 'Pierson College', 'Pierson College, the Buttery', 'Pierson College', 'Teams of four, eight rounds from black holes to biochemistry, and the college with the most points takes the trophy home.', ['social', 'research'], ['laugh', 'social-big', 'food-together'], false, true, 'trivia-2', ['f-lena', 'f-rafa', 'f-jonah']],
  ['sample-open-table', 1, '18:00', 75, 'Open table: grad and undergrad dinner, sit with someone new', 'Pierson College', 'Pierson College, dining hall', 'Pierson College', 'One long table, no assigned seats, conversation cards if you want them. Come alone: that is the point.', ['social'], ['food-together', 'social-small'], false, true, 'potluck-2', ['f-lena', 'f-mei']],
  ['sample-chess-tea', 0, '20:00', 90, 'Chess and tea at the Slifka Center', 'Slifka Center', 'Slifka Center, lounge', 'Yale Chess Club', 'Boards set up, tea poured, players of every level. Sit down at any open board and ask for a game.', ['social'], ['social-small', 'calm'], false, true, 'chess-1', ['f-kofi']],
  ['sample-list-dumplings', 0, '21:00', 60, 'Late-night dumpling folding in the Pierson kitchen', 'Pierson College', 'Pierson College, the college kitchen', 'Pierson College mailing list', 'Flour, fillings and forty people. Fold, steam, eat together. Announced on the Pierson list this morning.', ['social'], ['food-together', 'social-big', 'create'], false, true, 'potluck-1', ['f-lena', 'f-rafa', 'f-ines']],
  ['sample-list-launch-trip', 1, '18:30', 45, 'Road trip to a launch site: info session and sign-ups', 'Mason Laboratory', 'Mason Laboratory, room 107', 'YUAA mailing list', 'Twelve seats in two vans to watch a launch up close this winter. Costs, dates and how the seats are picked.', ['space', 'career'], ['learn', 'social-small', 'awe'], true, true, 'nlaunch-4', ['f-theo', 'f-amara']],
  ['sample-list-mission-ops', 2, '17:00', 60, 'Alumni in mission operations: open Q&A', 'Kline Tower', 'Kline Tower, 9th floor lounge', 'CS majors mailing list', 'Three alumni who run spacecraft operations answer anything: the job, the hours, how they got in from a CS degree.', ['space', 'career', 'ai'], ['learn', 'social-small'], true, false, 'ncontrol-1', ['f-mei', 'f-kofi']],
  ['sample-tree-planting', 6, '10:00', 180, 'Plant 50 trees in Fair Haven', 'Dwight Hall', 'Meet at Dwight Hall, bus provided', 'Dwight Hall', 'Join New Haven neighbors to plant street trees for a greener, cooler city. Gloves, tools and lunch provided.', ['climate', 'social'], ['help', 'nature', 'move-together'], false, true, 'treeplant-0', ['f-ines', 'f-amara']],
];

fs.mkdirSync(OUT_IMG, { recursive: true });
const meta = { ...JSON.parse(fs.readFileSync(`${CACHE}/meta-nasa.json`, 'utf8')), ...JSON.parse(fs.readFileSync(`${CACHE}/meta-commons.json`, 'utf8')) };
function credit(key) {
  const [k, i] = [key.replace(/-\d+$/, ''), Number(key.split('-').pop())];
  const m = (meta[k] ?? []).find((x) => x.i === i) ?? {};
  return `- \`${key}\` → ${m.title ?? key}. ${m.credit ?? m.artist ?? ''} ${m.license ?? (k.startsWith('n') ? 'NASA, public domain' : '')}. ${m.url ?? m.page ?? ''}`.replace(/\s+/g, ' ').trim();
}

const spot = new Map();
const events = [];
const credits = [];
for (const [id, dayOffset, time, durationMin, title, building, room, host, summary, tracks, kinds, future, food, key] of ROWS) {
  const [lat0, lng0] = where(building);
  const k = `${lat0},${lng0}`; const n = spot.get(k) ?? 1; spot.set(k, n + 1); // starter events already sit on the exact point
  const ang = n * 2.4, r = 9 * n;
  const lat = lat0 + (r * Math.cos(ang)) / 111320, lng = lng0 + (r * Math.sin(ang)) / (111320 * Math.cos((lat0 * Math.PI) / 180));
  const slug = id.replace(/^sample-/, 's-');
  await sharp(`${CACHE}/${key}.jpg`).resize(1200, 675, { fit: 'cover', position: 'attention' }).jpeg({ quality: 80, mozjpeg: true }).toFile(`${OUT_IMG}/${slug}.jpg`);
  credits.push(credit(key).replace(`\`${key}\``, `\`${slug}.jpg\``));
  events.push({
    id, title, start: '', end: null, dayOffset, time, locationName: room, building, lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)),
    source: 'sample', sourceUrl: '', host, summary, tracks, kinds, future, free: true, food, rsvpUrl: null,
    photoUrl: `/img/events/${slug}.jpg`, sample: true, online: false, solo: false, durationMin,
  });
}

const ids = new Set(events.map((e) => e.id));
const prev = JSON.parse(fs.readFileSync('public/data/events.json', 'utf8')).filter((e) => !ids.has(e.id));
const merged = [...prev, ...events];
fs.writeFileSync('public/data/events.json', JSON.stringify(merged, null, 1) + '\n');

const friends = JSON.parse(fs.readFileSync('public/data/friends.json', 'utf8'));
for (const f of friends) f.goingTo = f.goingTo.filter((x) => !ids.has(x));
for (const row of ROWS) for (const fid of row[14]) {
  const f = friends.find((x) => x.id === fid);
  if (!f) throw new Error(`unknown friend ${fid}`);
  if (!f.goingTo.includes(row[0])) f.goingTo.push(row[0]);
}
fs.writeFileSync('public/data/friends.json', JSON.stringify(friends, null, 1) + '\n');

const stats = JSON.parse(fs.readFileSync('public/data/stats.json', 'utf8'));
stats.total = merged.length;
stats.sources = ['yale-calendar', 'yaleconnect', 'sample'].map((name) => ({ name, count: merged.filter((e) => e.source === name).length }));
stats.bakedAt = new Date().toISOString();
fs.writeFileSync('public/data/stats.json', JSON.stringify(stats, null, 1) + '\n');

const CRED = 'public/img/CREDITS.md';
const head = '\n## More sample events (s-*.jpg, scripts/sample-plus.mjs)\n\n';
const txt = fs.readFileSync(CRED, 'utf8').split(head)[0];
fs.writeFileSync(CRED, txt.replace(/\s*$/, '\n') + head + credits.join('\n') + '\n');
console.log(`events.json: ${merged.length} events (${events.length} from sample-plus)`);
