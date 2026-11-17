// Run: ./node_modules/.bin/tsx --test lib/schedule.test.ts lib/match.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { candidates, conflict, fit, HACKATHON_ID, leaveBy, startPoint, walkMin } from './schedule';
import { nyDate, toNyIso } from './time';
import type { Course, YaleEvent } from './types';

export function ev(over: Partial<YaleEvent>): YaleEvent {
  return {
    id: 'e1', title: 'T', start: '', end: null, dayOffset: null, time: null, locationName: 'X', building: null,
    lat: 41.3124, lng: -72.9249, source: 'sample', sourceUrl: '', host: null, summary: 's', tracks: ['space'], kinds: ['build'],
    future: false, free: true, food: false, rsvpUrl: null, photoUrl: '/img/events/a.jpg', sample: true, online: false, solo: false, durationMin: 60,
    ...over,
  };
}
const at = (d: number, hh: number, mm = 0) => toNyIso(nyDate(2026, 11, d, hh, mm)); // 2026-11-17 is a Tuesday
const now = nyDate(2026, 11, 17, 18, 30);
const courses: Course[] = [
  { code: 'CPSC 3230', title: 'Systems', professor: 'P', building: 'Watson Hall', lat: 41.313087, lng: -72.92485, meetings: [{ day: 'Mon', start: '13:05', end: '14:20' }, { day: 'Wed', start: '13:05', end: '14:20' }] },
];
const profile = { courses, home: { name: 'Pierson College', lat: 41.309934, lng: -72.932601 } };

test('candidates: window, order, hackathon excluded, widening, empty list', () => {
  const list = [
    ev({ id: 'late', start: at(19, 20) }), ev({ id: 'soon', start: at(17, 19, 30) }), ev({ id: 'past', start: at(17, 17) }),
    ev({ id: 'far', start: at(21, 12) }), ev({ id: HACKATHON_ID, start: at(17, 19) }), ev({ id: 'bad', start: 'nope' }),
  ];
  assert.deepEqual(candidates(list, now, 48).map((e) => e.id), ['soon']);
  assert.deepEqual(candidates(list, now, 168).map((e) => e.id), ['soon', 'late', 'far']);
  assert.deepEqual(candidates(list, now, 48, { minCount: 30, widenHours: 96 }).map((e) => e.id), ['soon', 'late', 'far']);
  assert.deepEqual(candidates([], now, 48, { minCount: 30, widenHours: 96 }), []);
});

test('conflict: overlap on the right weekday only', () => {
  assert.deepEqual(conflict(ev({ start: at(18, 13, 30) }), courses), { courseCode: 'CPSC 3230' }); // Wed, inside class
  assert.deepEqual(conflict(ev({ start: at(18, 12, 30), durationMin: 60 }), courses), { courseCode: 'CPSC 3230' }); // runs into class
  assert.equal(conflict(ev({ start: at(18, 14, 20) }), courses), null); // starts when class ends
  assert.equal(conflict(ev({ start: at(17, 13, 30) }), courses), null); // Tuesday
  assert.equal(conflict(ev({ start: at(21, 13, 30) }), courses), null); // Saturday
});

test('walkMin: distance × 1.3 ÷ 80, rounded up', () => {
  assert.equal(walkMin({ lat: 41.31, lng: -72.93 }, { lat: 41.31, lng: -72.93 }), 1);
  const w = walkMin(profile.home, { lat: 41.3124, lng: -72.9249 }); // ≈ 700 m straight
  assert.ok(w >= 10 && w <= 13, `got ${w}`);
});

test('offset-less instants are New York wall time', () => {
  const plain = [
    ev({ id: 'tonight', start: '2026-11-17T19:00:00' }),
    ev({ id: 'thu', start: '2026-11-19T20:00:00' }),
  ];
  assert.deepEqual(candidates(plain, now, 48).map((e) => e.id), ['tonight']);
  assert.deepEqual(candidates(plain, now, 48, { minCount: 30, widenHours: 96 }).map((e) => e.id), ['tonight', 'thu']);
  assert.equal(leaveBy(ev({ start: '2026-11-18T19:00:00' }), 10), at(18, 18, 45));
  assert.deepEqual(conflict(ev({ start: '2026-11-18T13:30:00' }), courses), { courseCode: 'CPSC 3230' });
  assert.equal(conflict(ev({ start: '2026-11-17T13:30:00' }), courses), null);
  assert.equal(startPoint(ev({ start: '2026-11-18T15:00:00' }), profile).courseCode, 'CPSC 3230');
});

test('startPoint, leaveBy, fit', () => {
  const afterClass = ev({ start: at(18, 15) }); // Wed 3:00 PM, class ended 2:20 PM
  assert.equal(startPoint(afterClass, profile).courseCode, 'CPSC 3230');
  assert.equal(startPoint(ev({ start: at(18, 19) }), profile).name, 'Pierson College');
  assert.equal(leaveBy(ev({ start: at(18, 19) }), 10), at(18, 18, 45));
  const f = fit(afterClass, profile);
  assert.equal(f.conflict, null);
  assert.match(f.fitNote, /^After CPSC 3230 · leave by 2:5\d PM · \d+ min walk$/);
  assert.match(fit(ev({ start: at(18, 19) }), profile).fitNote, /^No class conflict · leave by 6:\d\d PM · \d+ min walk$/);
});
