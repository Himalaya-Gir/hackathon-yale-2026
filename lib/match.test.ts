import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allowedMechanisms, codeOnlyPicks, friendLine, friendsGoing, goalSlug, moodExcluded, preselect, rank, servesGoal, validPick } from './match';
import { MECHANISM_BY_ID } from './science';
import { nyDate, toNyIso } from './time';
import { MOODS } from './types';
import type { Friend, Profile, YaleEvent } from './types';

function ev(over: Partial<YaleEvent>): YaleEvent {
  return {
    id: 'e1', title: 'T', start: '', end: null, dayOffset: null, time: null, locationName: 'X', building: null,
    lat: 41.3124, lng: -72.9249, source: 'sample', sourceUrl: '', host: null, summary: 's', tracks: ['space'], kinds: ['build'],
    future: false, free: true, food: false, rsvpUrl: null, photoUrl: '/img/events/a.jpg', sample: true, online: false, solo: false, durationMin: 60,
    ...over,
  };
}

const at = (d: number, hh: number, mm = 0) => toNyIso(nyDate(2026, 11, d, hh, mm));
const now = nyDate(2026, 11, 17, 18, 30);
const profile = {
  name: 'Maya Chen', classYear: "'28", college: 'Pierson', majors: ['CS'], clubs: ['Yale Undergraduate Aerospace Association'], interests: [],
  defaultGoal: 'Break into the space industry', home: { name: 'Pierson College', lat: 41.3099, lng: -72.9326 }, connected: [],
  courses: [{ code: 'CPSC 3230', title: 'Systems', professor: 'P', building: 'Watson Hall', lat: 41.313, lng: -72.9248, meetings: [{ day: 'Wed', start: '13:05', end: '14:20' }] }],
  contacts: [{ id: 'c-sam', name: 'Sam Okafor', handle: null, via: 'x', metWhen: '2 days ago', metWhere: null, relation: 'new', persona: 'p', interests: ['propulsion'] }],
} as Profile;

test('allowedMechanisms follows the table', () => {
  assert.deepEqual(allowedMechanisms(ev({ kinds: ['move'] }), 'stressed'), ['move']);
  assert.deepEqual(allowedMechanisms(ev({ kinds: ['build'] }), 'stressed'), []);
  assert.deepEqual(allowedMechanisms(ev({ kinds: ['build'] }), 'sad'), ['activation']);
  assert.deepEqual(allowedMechanisms(ev({ kinds: ['social-small'] }), 'lonely'), ['weak-ties', 'strangers']);
  assert.deepEqual(allowedMechanisms(ev({ kinds: ['help', 'build'] }), 'great'), ['kindness', 'progress']);
  assert.deepEqual(allowedMechanisms(ev({ kinds: ['calm'] }), 'great'), []);
  for (const mood of MOODS) for (const id of allowedMechanisms(ev({ kinds: ['awe', 'learn', 'social-big'] }), mood)) assert.ok(MECHANISM_BY_ID[id]);
});

test('mood exclusions', () => {
  assert.equal(moodExcluded(ev({ start: at(17, 19), durationMin: 150 }), 'tired'), true);
  assert.equal(moodExcluded(ev({ start: at(17, 19), durationMin: null, end: at(17, 22) }), 'tired'), true);
  assert.equal(moodExcluded(ev({ start: at(17, 19), durationMin: 120 }), 'tired'), false);
  assert.equal(moodExcluded(ev({ start: at(17, 21, 30) }), 'tired'), true);
  assert.equal(moodExcluded(ev({ start: at(17, 21) }), 'tired'), false);
  assert.equal(moodExcluded(ev({ start: at(17, 19), online: true }), 'sad'), true);
  assert.equal(moodExcluded(ev({ start: at(17, 19), solo: true }), 'lonely'), true);
  assert.equal(moodExcluded(ev({ start: at(17, 19), solo: true }), 'stressed'), false);
  assert.deepEqual(allowedMechanisms(ev({ start: at(17, 22), kinds: ['move'] }), 'tired'), []);
  assert.deepEqual(allowedMechanisms(ev({ start: at(17, 19), kinds: ['social-small'], online: true }), 'sad'), []);
  assert.deepEqual(allowedMechanisms(ev({ kinds: ['social-small'] }), 'great'), ['weak-ties']);
});

test('validPick', () => {
  const yoga = ev({ start: at(17, 19), kinds: ['move', 'calm'] });
  assert.equal(validPick({ lane: 'build', mechanismId: null }, yoga, 'week'), true);
  assert.equal(validPick({ lane: 'feel', mechanismId: 'move' }, yoga, 'week'), false);
  assert.equal(validPick({ lane: 'feel', mechanismId: 'calm' }, yoga, 'tonight', 'anxious'), true);
  assert.equal(validPick({ lane: 'both', mechanismId: 'move' }, yoga, 'tonight', 'stressed'), true);
  assert.equal(validPick({ lane: 'feel', mechanismId: 'awe' }, yoga, 'tonight', 'stressed'), false); // wrong kind
  assert.equal(validPick({ lane: 'feel', mechanismId: 'calm' }, yoga, 'tonight', 'sad'), false); // wrong mood
  assert.equal(validPick({ lane: 'feel', mechanismId: 'made-up' }, yoga, 'tonight', 'stressed'), false);
  assert.equal(validPick({ lane: 'feel', mechanismId: null }, yoga, 'tonight', 'stressed'), false);
  assert.equal(validPick({ lane: 'build', mechanismId: 'move' }, yoga, 'tonight', 'stressed'), false);
  assert.equal(validPick({ lane: 'feel', mechanismId: 'move' }, { ...yoga, solo: true }, 'tonight', 'sad'), false);
});

test('friends: only status friend, line written by code', () => {
  const friends = [
    { name: 'Lena Park', status: 'friend', goingTo: ['a', 'b'] }, { name: 'Theo L', status: 'friend', goingTo: ['a'] },
    { name: 'Zed Q', status: 'suggested', goingTo: ['a'] },
  ] as Friend[];
  const g = friendsGoing(friends);
  assert.deepEqual(g.get('a'), ['Lena', 'Theo']);
  assert.equal(friendLine(g.get('a')), 'Lena and Theo are going');
  assert.equal(friendLine(g.get('b')), 'Lena is going');
  assert.equal(friendLine(g.get('zzz')), null);
  assert.equal(friendLine(['A', 'B', 'C', 'D']), 'A, B + 2 are going');
});

test('goalSlug', () => {
  assert.equal(goalSlug('Break into the space industry'), 'space');
  assert.equal(goalSlug('Start a company before I graduate'), 'startup');
  assert.equal(goalSlug('Find a research lab in AI'), 'research');
  assert.equal(goalSlug('Meet people outside my major'), 'people');
  assert.equal(goalSlug('become a founder'), 'startup');
  assert.equal(goalSlug('zzz'), 'space');
});

test('preselect and codeOnlyPicks: valid, no conflict, never crash on few or no events', () => {
  const events = [
    ev({ id: 'clash', start: at(18, 13, 30) }),
    ev({ id: 'rocket', start: at(18, 19), tracks: ['space'], future: true, title: 'Rocket build night' }),
    ev({ id: 'yoga', start: at(17, 20), tracks: ['health'], kinds: ['move', 'calm'] }),
    ev({ id: 'games', start: at(18, 20), tracks: ['social'], kinds: ['social-small', 'laugh'] }),
    ev({ id: 'solo', start: at(17, 20), tracks: ['arts'], kinds: ['arts-watch'], solo: true }),
  ];
  const week = preselect('week', events, now, profile);
  assert.ok(!week.some((e) => e.id === 'clash'));
  const going = new Map([['games', ['Lena']]]);
  const picks = codeOnlyPicks({ mode: 'week', pool: week, goal: 'Break into the space industry', profile, going, ref: now, want: 6 });
  assert.equal(picks.length, 4); // fewer valid events than required: return what is valid
  assert.equal(picks[0].eventId, 'rocket');
  assert.ok(picks.every((p) => p.lane === 'build' && p.mechanismId === null && p.why.length <= 110));
  assert.equal(new Set(picks.map((p) => p.eventId)).size, picks.length);

  for (const mood of MOODS) {
    const pool = preselect('tonight', events, now, profile, mood);
    const t = codeOnlyPicks({ mode: 'tonight', pool, goal: 'Break into the space industry', mood, profile, going, ref: now, want: 3 });
    for (const p of t) assert.ok(validPick(p, pool.find((e) => e.id === p.eventId)!, 'tonight', mood), `${mood} ${p.eventId} ${p.mechanismId}`);
    if (mood === 'sad' || mood === 'lonely') assert.ok(!t.some((p) => p.eventId === 'solo'));
  }
  assert.deepEqual(preselect('week', [], now, profile), []);
  assert.deepEqual(codeOnlyPicks({ mode: 'tonight', pool: [], goal: '', mood: 'sad', profile, going: new Map(), ref: now, want: 3 }), []);
});

test('friends rank first for sad and lonely; anxious prefers small groups; goal sets lane both', () => {
  const goal = 'Break into the space industry';
  const withFriends = ev({ id: 'friends', start: at(19, 18), kinds: ['social-small'], tracks: ['social'], title: 'College dinner' });
  const rocket = ev({ id: 'rocket', start: at(17, 19), kinds: ['social-small', 'build'], tracks: ['space'], future: true, title: 'Rocket build night' });
  const going = new Map([['friends', ['Lena']]]);
  assert.equal(servesGoal(rocket, goal), true);
  assert.equal(servesGoal(withFriends, goal), false);
  for (const mood of ['sad', 'lonely'] as const) {
    assert.ok(rank(withFriends, { mode: 'tonight', goal, mood, friends: 1, ref: now }) > rank(rocket, { mode: 'tonight', goal, mood, friends: 0, ref: now }));
    const picks = codeOnlyPicks({ mode: 'tonight', pool: [rocket, withFriends], goal, mood, profile, going, ref: now, want: 2 });
    assert.equal(picks[0].eventId, 'friends', mood);
    assert.equal(picks.find((p) => p.eventId === 'rocket')?.lane, 'both');
    assert.equal(picks.find((p) => p.eventId === 'friends')?.lane, 'feel');
  }
  const small = ev({ id: 'small', start: at(18, 19), kinds: ['social-small'], tracks: ['social'] });
  const big = ev({ id: 'big', start: at(17, 19), kinds: ['social-big'], tracks: ['social'] });
  assert.ok(rank(small, { mode: 'tonight', goal: 'zzz', mood: 'anxious', ref: now }) > rank(big, { mode: 'tonight', goal: 'zzz', mood: 'anxious', ref: now }));
  const anxious = codeOnlyPicks({ mode: 'tonight', pool: [big, small], goal: 'zzz', mood: 'anxious', profile, going: new Map(), ref: now, want: 2 });
  assert.equal(anxious[0].eventId, 'small');
  assert.ok(anxious.every((p) => validPick(p, [big, small].find((e) => e.id === p.eventId)!, 'tonight', 'anxious')));
});
