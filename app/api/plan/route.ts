// STUB (package 0). Package C replaces the body of this route with the real Grok engine.
// It already honours the contract of PLAN.md §7.3, so the map and the panels can be built against it.
import eventsJson from '@/public/data/events.json';
import friendsJson from '@/public/data/friends.json';
import profileJson from '@/public/data/profile.json';
import statsJson from '@/public/data/stats.json';
import { MECHANISMS } from '@/lib/science';
import { parseNow, redateAll, toNyIso, fmtTime } from '@/lib/time';
import type { Friend, Mood, Pick, PlanEvent, PlanRequest, Profile, Stats, YaleEvent } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const STEP_MS = 400;

function mechanismFor(event: YaleEvent, mood: Mood): string | null {
  const m = MECHANISMS.find((x) => x.moods.includes(mood) && x.kinds !== 'all' && x.kinds.some((k) => event.kinds.includes(k)))
    ?? MECHANISMS.find((x) => x.moods.includes(mood) && x.kinds === 'all');
  return m ? m.id : null;
}

function toPick(event: YaleEvent, i: number, lane: Pick['lane'], mechanismId: string | null, profile: Profile, friends: Friend[]): Pick {
  const going = friends.filter((f) => f.status === 'friend' && f.goingTo.includes(event.id));
  const contact = profile.contacts.filter((c) => c.relation === 'new')[i % 3];
  const start = new Date(event.start);
  const leaveBy = new Date(start.getTime() - 12 * 60000);
  return {
    eventId: event.id,
    score: 96 - i * 7,
    lane,
    mechanismId,
    why: lane === 'build'
      ? `Builds on ${profile.courses[i % profile.courses.length].code} and your work with ${profile.clubs[0].replace('Yale Undergraduate ', '')}.`
      : 'A short, easy way to get out of your room and be around people tonight.',
    friendLine: going.length ? `${going.slice(0, 2).map((f) => f.name.split(' ')[0]).join(' and ')}${going.length > 2 ? ` + ${going.length - 2}` : ''} ${going.length === 1 ? 'is' : 'are'} going` : null,
    withContactId: contact?.id ?? null,
    withWhy: contact ? `${contact.name.split(' ')[0]} is into ${contact.interests[0]}.` : null,
    invite: contact ? `Hey ${contact.name.split(' ')[0]}, "${event.title}" is on ${new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long' }).format(start)} at ${fmtTime(event.start)}. Want to go together?` : null,
    conflict: null,
    walkMin: 7,
    leaveBy: toNyIso(leaveBy),
    fitNote: `No class conflict · leave by ${fmtTime(toNyIso(leaveBy))} · 7 min walk`,
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<PlanRequest>;
  const mode = body.mode === 'tonight' ? 'tonight' : 'week';
  const mood = (body.mood ?? 'stressed') as Mood;
  const ref = parseNow(body.now);
  const profile = profileJson as unknown as Profile;
  const friends = friendsJson as unknown as Friend[];
  const stats = statsJson as unknown as Stats;
  const all = redateAll(eventsJson as unknown as YaleEvent[], ref).filter((e) => new Date(e.start).getTime() > ref.getTime() - 3 * 3600000);

  const out: PlanEvent[] = [{ type: 'status', text: 'Initializing events…' }];
  if (mode === 'week') {
    const horizon = ref.getTime() + 7 * 86400000;
    const pool = all.filter((e) => new Date(e.start).getTime() < horizon && e.id !== 'grokathon-yale-2026');
    const ranked = [...pool].sort((a, b) => Number(b.future) - Number(a.future));
    out.push({ type: 'status', text: `${stats.total} events · this week · ${profile.courses.length} courses · ${friends.filter((f) => f.status === 'friend').length} friends` });
    out.push({ type: 'status', text: `Matching against "${body.goal ?? profile.defaultGoal}"` });
    ranked.slice(0, 6).forEach((e, i) => out.push({ type: 'pick', pick: toPick(e, i, 'build', null, profile, friends) }));
    out.push({ type: 'trajectory', text: 'This week: build something real and meet the people who launch. This semester: a team. After Yale: a seat in mission control.' });
  } else {
    const horizon = ref.getTime() + 48 * 3600000;
    const pool = all.filter((e) => new Date(e.start).getTime() < horizon && e.id !== 'grokathon-yale-2026' && mechanismFor(e, mood));
    out.push({ type: 'status', text: `${pool.length} things you could do in the next 48 hours` });
    pool.slice(0, 3).forEach((e, i) => out.push({ type: 'pick', pick: toPick(e, i, e.future ? 'both' : 'feel', mechanismFor(e, mood), profile, friends) }));
  }
  out.push({ type: 'done', source: 'fallback' });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const e of out) {
        controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'));
        await new Promise((r) => setTimeout(r, STEP_MS));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' } });
}
