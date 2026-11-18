// Package A1 — friends.json, run after events.json exists.
// 12 friends (2–4 events in the next 7 days) and 6 suggestions tied to Maya's profile.
import fs from 'fs';
import type { Friend, Mood, YaleEvent } from '../lib/types';
import { GOALS, MOODS, eventMatchesMood, inWindow, redateNow } from './check-data';

const COLORS = ['#63AAFF', '#8FB8DE', '#5B7FA6', '#A9B8CC', '#3E6FB0', '#7C8DA6'];

const PEOPLE: { id: string; name: string; classYear: string; college: string }[] = [
  { id: 'f-lena', name: 'Lena Park', classYear: "'28", college: 'Pierson' },
  { id: 'f-theo', name: 'Theo Lindqvist', classYear: "'28", college: 'Saybrook' },
  { id: 'f-amara', name: 'Amara Diallo', classYear: "'27", college: 'Pierson' },
  { id: 'f-jonah', name: 'Jonah Weiss', classYear: "'28", college: 'Davenport' },
  { id: 'f-mei', name: 'Mei Tanaka', classYear: "'29", college: 'Morse' },
  { id: 'f-rafa', name: 'Rafael Ortiz', classYear: "'27", college: 'Trumbull' },
  { id: 'f-ines', name: 'Ines Moreau', classYear: "'28", college: 'Pierson' },
  { id: 'f-kofi', name: 'Kofi Mensah', classYear: "'26", college: 'Silliman' },
  { id: 'f-naomi', name: 'Naomi Berg', classYear: "'28", college: 'Ezra Stiles' },
  { id: 'f-luis', name: 'Luis Ferreira', classYear: "'27", college: 'Timothy Dwight' },
  { id: 'f-aisha', name: 'Aisha Rahman', classYear: "'29", college: 'Berkeley' },
  { id: 'f-owen', name: 'Owen Clarke', classYear: "'28", college: 'Branford' },
];

const SUGGESTED: { id: string; name: string; classYear: string; college: string; reason: string; goingTo: string[] }[] = [
  { id: 's-nora', name: 'Nora Castillo', classYear: "'28", college: 'Branford', reason: 'also in CPSC 3230', goingTo: ['sample-rl-journal', 'sample-poster-tea'] },
  { id: 's-dev', name: 'Dev Malhotra', classYear: "'27", college: 'Pierson', reason: 'Pierson', goingTo: ['sample-boardgames'] },
  { id: 's-hana', name: 'Hana Suzuki', classYear: "'28", college: 'Ezra Stiles', reason: 'YUAA', goingTo: ['sample-teststand', 'sample-cubesat'] },
  { id: 's-eli', name: 'Eli Brandt', classYear: "'29", college: 'Berkeley', reason: 'also in MENG 2511', goingTo: ['sample-launch-lunch'] },
  { id: 's-camille', name: 'Camille Berger', classYear: "'28", college: 'Silliman', reason: 'also in ASTR 3200', goingTo: ['sample-stargazing', 'sample-orbit'] },
  { id: 's-rowan', name: 'Rowan Hale', classYear: "'27", college: 'Davenport', reason: 'Yale Entrepreneurial Society', goingTo: ['sample-founder-dinner', 'sample-pitch'] },
];

function initials(name: string): string {
  return name.split(/\s+/).map((p) => p[0]).join('');
}

function assign(events: YaleEvent[], ref: Date): Record<string, string[]> {
  const dated = redateNow(events, ref);
  const byId = new Map(dated.map((e) => [e.id, e]));
  const week = dated.filter((e) => inWindow(e, ref, 168));
  const soon = dated.filter((e) => inWindow(e, ref, 48));
  const going: Record<string, string[]> = Object.fromEntries(PEOPLE.map((p) => [p.id, [] as string[]]));
  const ids = PEOPLE.map((p) => p.id);

  const add = (fid: string, eid: string) => {
    const list = going[fid];
    if (!list || list.includes(eid) || list.length >= 4) return false;
    list.push(eid);
    return true;
  };
  const covered = (eid: string) => ids.some((fid) => going[fid].includes(eid));

  type Quota = { key: string; need: number; pool: YaleEvent[] };
  const quotas: Quota[] = [
    ...GOALS.map((g) => ({ key: g.id, need: 3, pool: week.filter((e) => g.test(e)) })),
    ...MOODS.map((m) => ({ key: m, need: 2, pool: soon.filter((e) => eventMatchesMood(e, m)) })),
  ];

  let cursor = 0;
  for (const q of quotas) {
    const pool = [...q.pool].sort((a, b) => a.id.localeCompare(b.id));
    let got = pool.filter((e) => covered(e.id)).length;
    for (const e of pool) {
      if (got >= q.need) break;
      if (covered(e.id)) continue;
      let placed = false;
      for (let k = 0; k < ids.length; k++) {
        const fid = ids[(cursor + k) % ids.length];
        if (add(fid, e.id)) {
          cursor = (cursor + k + 1) % ids.length;
          placed = true;
          break;
        }
      }
      if (!placed) throw new Error(`no free friend slot for ${q.key} / ${e.id}`);
      got++;
    }
    if (got < q.need) throw new Error(`coverage ${q.key}: ${got}/${q.need} (pool ${pool.length})`);
  }

  const weekIds = week.map((e) => e.id).sort();
  let fill = 0;
  for (const fid of ids) {
    let guard = 0;
    while (going[fid].length < 2) {
      const eid = weekIds[fill % weekIds.length];
      fill++;
      add(fid, eid);
      if (++guard > weekIds.length + 5) throw new Error(`could not fill ${fid}`);
    }
  }

  for (const fid of ids) {
    const list = going[fid];
    if (list.length < 2 || list.length > 4) throw new Error(`${fid} has ${list.length} events`);
    for (const eid of list) {
      const ev = byId.get(eid);
      if (!ev || !inWindow(ev, ref, 168)) throw new Error(`${fid} → ${eid} is outside 7 days`);
    }
  }

  for (const [fid, list] of Object.entries(going)) {
    list.sort((a, b) => (byId.get(a)?.start ?? '').localeCompare(byId.get(b)?.start ?? ''));
    void fid;
  }
  return going;
}

function main() {
  const events = JSON.parse(fs.readFileSync('public/data/events.json', 'utf8')) as YaleEvent[];
  const ids = new Set(events.map((e) => e.id));
  const ref = new Date();
  const going = assign(events, ref);

  const friends: Friend[] = PEOPLE.map((p, i) => ({
    id: p.id,
    name: p.name,
    initials: initials(p.name),
    color: COLORS[i % COLORS.length],
    classYear: p.classYear,
    college: p.college,
    status: 'friend' as const,
    reason: null,
    goingTo: going[p.id],
  }));

  for (const s of SUGGESTED) {
    for (const id of s.goingTo) {
      if (!ids.has(id)) throw new Error(`suggested ${s.id} points at missing ${id}`);
    }
    friends.push({
      id: s.id,
      name: s.name,
      initials: initials(s.name),
      color: COLORS[friends.length % COLORS.length],
      classYear: s.classYear,
      college: s.college,
      status: 'suggested',
      reason: s.reason,
      goingTo: s.goingTo,
    });
  }

  fs.writeFileSync('public/data/friends.json', JSON.stringify(friends, null, 2) + '\n');
  const dated = redateNow(events, ref);
  const week = dated.filter((e) => inWindow(e, ref, 168));
  const soon = dated.filter((e) => inWindow(e, ref, 48));
  const withFriends = (e: YaleEvent) => PEOPLE.some((p) => going[p.id].includes(e.id));
  console.log('friends', PEOPLE.length, 'suggested', SUGGESTED.length);
  for (const g of GOALS) {
    console.log(`  goal ${g.id} with friends`, week.filter((e) => g.test(e) && withFriends(e)).length);
  }
  for (const m of MOODS as Mood[]) {
    console.log(`  mood ${m} with friends`, soon.filter((e) => eventMatchesMood(e, m) && withFriends(e)).length);
  }
}

main();
