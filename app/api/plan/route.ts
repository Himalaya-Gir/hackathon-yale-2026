// POST /api/plan (PLAN.md §7.3). Code pre-filters, Grok picks, code validates and adds the facts.
// ?demo=1 (read from the request URL) replays the recorded fallback. ?live=1 is the bake script: no replay.
// A recorded file, then a code-only fill, so the client still gets a plan when Grok is down.
import eventsJson from '@/public/data/events.json';
import friendsJson from '@/public/data/friends.json';
import profileJson from '@/public/data/profile.json';
import statsJson from '@/public/data/stats.json';
import { FALLBACKS } from '@/public/data/fallback';
import { fastModel, grokLines, parseGrokLine, type RawPick } from '@/lib/grok';
import { allowedMechanisms, codeInvite, codeOnlyPicks, codeTrajectory, friendLine, friendsGoing, goalSlug, preselect, servesGoal, validPick } from '@/lib/match';
import { systemPrompt, userPrompt } from '@/lib/prompts';
import { candidates, conflict, fit, leaveBy, startPoint, walkMin } from '@/lib/schedule';
import { MECHANISMS } from '@/lib/science';
import { redateAll, parseNow } from '@/lib/time';
import { MOODS } from '@/lib/types';
import type { Contact, Friend, Mode, Mood, Pick as OrbitPick, PlanEvent, Profile, Stats, YaleEvent } from '@/lib/types';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

const FIRST_PICK_MS = 6000;
const TOTAL_MS = 22000;
const REPLAY_MS = 350;

const Body = z.object({
  mode: z.enum(['week', 'tonight']).optional(),
  goal: z.string().optional(),
  mood: z.enum(['sad', 'lonely', 'stressed', 'anxious', 'bored', 'tired', 'unmotivated', 'great']).optional(),
  now: z.string().optional(),
});

type Ctx = {
  mode: Mode; goal: string; mood: Mood; ref: Date; profile: Profile;
  going: Map<string, string[]>; pool: YaleEvent[]; byId: Map<string, YaleEvent>;
  want: number; min: number;
};
type State = { used: Set<string>; mech: Set<string>; contacts: Map<string, number>; days: Map<string, number> };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const BANNED = /great opportunity|aligns with your interests|since you are|since you're|to cheer you up/i;
const NOT_A_NAME = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'tonight', 'today', 'tomorrow', 'yale', 'orbit', 'after', 'before', 'with', 'from', 'your', 'this', 'that', 'free', 'leave', 'walk', 'going', 'are', 'and', 'the', 'for', 'you', 'new', 'haven', 'pierson', 'center', 'hall', 'want', 'come', 'join', 'hey']);

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.–-]+$/, '')}…`;
}

function stripEmoji(text: string): string {
  return text.replace(/\p{Extended_Pictographic}+/gu, '').replace(/\s{2,}/g, ' ').trim();
}

/** An invite that states a clock time must state the event's real start time. */
function inviteTimeOk(invite: string, event: YaleEvent): boolean {
  const p = event.start.match(/T(\d{2}):(\d{2})/);
  if (!p) return true;
  const hh = Number(p[1]);
  const mm = Number(p[2]);
  const found = [...invite.matchAll(/\b(\d{1,2})(?::(\d\d))?\s*(a\.?m\.?|p\.?m\.?)/gi)];
  if (found.length === 0) return true;
  return found.some((m) => {
    let h = Number(m[1]) % 12;
    if (m[3].toLowerCase().startsWith('p')) h += 12;
    return h === hh && Number(m[2] ?? 0) === mm;
  });
}

/** True when every capitalized name in the line is a friend who is actually going. */
function friendLineOk(line: string, going: string[]): boolean {
  const allowed = new Set(going.map((n) => n.toLowerCase()));
  const tokens = line.match(/\b[A-Z][a-z]+\b/g) ?? [];
  return tokens.every((t) => NOT_A_NAME.has(t.toLowerCase()) || allowed.has(t.toLowerCase()));
}

/** Facts code adds. fitNote comes from schedule.fit; the numbers come from the schedule functions. */
function addedFacts(event: YaleEvent, profile: Profile) {
  const from = startPoint(event, profile);
  const walk = walkMin(from, event);
  const leave = leaveBy(event, walk);
  const clash = conflict(event, profile.courses);
  return { conflict: clash, walkMin: walk, leaveBy: leave, fitNote: fit(event, profile).fitNote };
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/** Grok chooses, code asserts. Unknown ids, invalid picks, and class conflicts are dropped. */
function finalize(raw: RawPick, ctx: Ctx, st: State): OrbitPick | null {
  const event = ctx.byId.get(raw.eventId);
  if (!event || st.used.has(event.id)) return null;
  if (conflict(event, ctx.profile.courses)) return null;

  let lane: OrbitPick['lane'] = 'build';
  let mechanismId: string | null = null;
  if (ctx.mode === 'week') {
    if ((st.days.get(dayKey(event.start)) ?? 0) >= 2) return null;
  } else {
    lane = raw.lane === 'both' || raw.lane === 'feel' ? raw.lane : (servesGoal(event, ctx.goal) ? 'both' : 'feel');
    mechanismId = raw.mechanismId ?? null;
    if (!mechanismId || !MECHANISMS.some((m) => m.id === mechanismId)) return null;
    if (!allowedMechanisms(event, ctx.mood).includes(mechanismId)) return null;
    if (st.mech.has(mechanismId)) return null;
  }
  if (!validPick({ lane, mechanismId }, event, ctx.mode, ctx.mood)) return null;

  const why = stripEmoji(raw.why);
  const inviteRaw = raw.invite ? stripEmoji(raw.invite) : null;
  if (BANNED.test(why) || (inviteRaw && BANNED.test(inviteRaw))) return null;
  if (why.length < 3) return null;

  let contact: Contact | null = ctx.profile.contacts.find((c) => c.id === raw.withContactId) ?? null;
  let own = Boolean(contact);
  if (contact && (st.contacts.get(contact.id) ?? 0) >= 2) { contact = null; own = false; }
  if (!contact && ctx.mode === 'tonight' && (ctx.mood === 'sad' || ctx.mood === 'lonely')) {
    const ordered = [...ctx.profile.contacts.filter((c) => c.relation === 'new'), ...ctx.profile.contacts.filter((c) => c.relation !== 'new')];
    contact = ordered.sort((a, b) => (st.contacts.get(a.id) ?? 0) - (st.contacts.get(b.id) ?? 0))[0] ?? null;
    own = false;
  }
  const first = contact?.name.split(' ')[0];
  const going = ctx.going.get(event.id);
  const line = raw.friendLine && friendLineOk(raw.friendLine, going ?? []) ? clip(raw.friendLine, 60) : friendLine(going);

  st.used.add(event.id);
  if (mechanismId) st.mech.add(mechanismId);
  if (ctx.mode === 'week') st.days.set(dayKey(event.start), (st.days.get(dayKey(event.start)) ?? 0) + 1);
  if (contact) st.contacts.set(contact.id, (st.contacts.get(contact.id) ?? 0) + 1);

  return {
    eventId: event.id,
    score: Number.isFinite(raw.score) ? Math.max(0, Math.min(100, Math.round(raw.score))) : 80,
    lane,
    mechanismId,
    why: clip(why, 110),
    friendLine: line,
    withContactId: contact?.id ?? null,
    withWhy: contact ? (own && raw.withWhy ? clip(raw.withWhy, 80) : `${first} is into ${contact.interests[0] ?? 'this'}.`) : null,
    invite: contact ? (own && inviteRaw && inviteTimeOk(inviteRaw, event) ? clip(inviteRaw, 220) : codeInvite(contact, event, ctx.ref)) : null,
    ...addedFacts(event, ctx.profile),
  };
}

function sourceLine(events: YaleEvent[], stats: Stats): string {
  const counts = new Map<string, number>();
  for (const e of events) counts.set(e.source, (counts.get(e.source) ?? 0) + 1);
  const fromFile = stats.total === events.length
    ? stats.sources.map((s) => `${s.count} ${s.name}`)
    : [...counts.entries()].map(([name, count]) => `${count} ${name}`);
  return `${Math.max(stats.total, events.length)} events · ${fromFile.join(', ')}`;
}

const HEADERS = { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' };

export async function POST(request: Request) {
  const url = new URL(request.url);
  const demo = url.searchParams.get('demo') === '1';
  const forceLive = url.searchParams.get('live') === '1' && !demo;
  const raw = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(raw);
  const body = parsed.success ? parsed.data : {};

  const profile = profileJson as unknown as Profile;
  const friends = (friendsJson as unknown as Friend[]) ?? [];
  const stats = statsJson as unknown as Stats;
  const mode: Mode = body.mode === 'tonight' ? 'tonight' : 'week';
  const goal = (body.goal?.trim() || profile.defaultGoal).slice(0, 200);
  const ref = parseNow(body.now);

  if (mode === 'tonight' && !body.mood) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const send = (e: PlanEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'));
        send({ type: 'status', text: 'Initializing events…' });
        send({ type: 'error', message: 'A mood is required for tonight.' });
        send({ type: 'done', source: 'fallback' });
        controller.close();
      },
    });
    return new Response(stream, { headers: HEADERS });
  }

  const mood: Mood = body.mood && MOODS.includes(body.mood) ? body.mood : 'stressed';
  const events = redateAll((eventsJson as unknown as YaleEvent[]) ?? [], ref);
  const going = friendsGoing(friends);
  const inWindow = candidates(events, ref, mode === 'week' ? 168 : 48, mode === 'tonight' ? { minCount: 30, widenHours: 96 } : {});
  const pool = preselect(mode, events, ref, profile, mode === 'tonight' ? mood : undefined);
  const ctx: Ctx = {
    mode, goal, mood, ref, profile, going, pool, byId: new Map(pool.map((e) => [e.id, e])),
    want: mode === 'week' ? 6 : 3, min: mode === 'week' ? 4 : 2,
  };
  const st: State = { used: new Set(), mech: new Set(), contacts: new Map(), days: new Map() };
  const model = fastModel();
  const useLive = !demo && Boolean(process.env.XAI_API_KEY) && Boolean(model) && pool.length > 0;
  const recorded = FALLBACKS[mode === 'week' ? `week-${goalSlug(goal)}` : `tonight-${mood}`];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: PlanEvent) => { try { controller.enqueue(encoder.encode(JSON.stringify(e) + '\n')); } catch { /* client left */ } };
      let count = 0;
      let live = 0;
      let trajectory: string | null = null;
      let finished = false;
      const sendPick = (pick: OrbitPick | null) => { if (pick && count < ctx.want) { send({ type: 'pick', pick }); count++; return true; } return false; };
      const t0 = Date.now();

      const replay = async () => {
        if (forceLive || !recorded?.picks?.length) return;
        for (const p of recorded.picks) {
          if (count >= ctx.want) break;
          if (sendPick(finalize(p, ctx, st))) await sleep(REPLAY_MS);
        }
      };
      const topUp = async () => {
        if (forceLive || count >= ctx.want) return;
        const extra = codeOnlyPicks({ mode, pool, goal, mood, profile, going, ref, want: ctx.want - count, exclude: st.used, usedMechanisms: st.mech });
        for (const p of extra) {
          if (sendPick(finalize(p, ctx, st))) await sleep(REPLAY_MS);
        }
      };
      const finish = (source: 'live' | 'fallback') => {
        if (finished) return;
        finished = true;
        if (mode === 'week') {
          const text = trajectory ?? (forceLive ? null : (source === 'fallback' && recorded?.trajectory) || codeTrajectory(goal));
          if (text) send({ type: 'trajectory', text: clip(stripEmoji(text), 160) });
        }
        if (count === 0) send({ type: 'error', message: 'Orbit could not build a plan. Try again.' });
        console.log(`[plan] ${mode} ${source} · ${count} picks (${live} live) · window ${inWindow.length} · pool ${pool.length} · ${Date.now() - t0} ms`);
        send({ type: 'done', source });
      };

      try {
        send({ type: 'status', text: 'Initializing events…' });
        if (!useLive) await sleep(REPLAY_MS);
        const friendCount = friends.filter((f) => f.status === 'friend').length;
        send({ type: 'status', text: `${sourceLine(events, stats)} · ${profile.courses.length} courses · ${profile.clubs.length} clubs · ${friendCount} friends` });
        if (!useLive) await sleep(REPLAY_MS);
        send({ type: 'status', text: mode === 'week' ? `Matching against "${goal}"` : `${pool.length} options in the next 48 hours` });
        if (!useLive) await sleep(REPLAY_MS);

        if (useLive && model) {
          const ac = new AbortController();
          const firstTimer = setTimeout(() => { if (live === 0) ac.abort(); }, forceLive ? 20000 : FIRST_PICK_MS);
          const totalTimer = setTimeout(() => ac.abort(), forceLive ? 45000 : TOTAL_MS);
          let stopped = false;
          try {
            const lines = grokLines({ model, system: systemPrompt(mode, profile), user: userPrompt({ mode, goal, mood, ref, pool, going }), signal: ac.signal });
            for await (const line of lines) {
              const got = parseGrokLine(line);
              if (got?.kind === 'trajectory' && mode === 'week') trajectory = clip(stripEmoji(got.text), 160);
              if (got?.kind === 'pick' && sendPick(finalize(got.pick, ctx, st))) {
                live++;
                if (live === 1) console.log(`[plan] ${mode} first pick ${Date.now() - t0} ms`);
              }
              if (live >= ctx.want && (mode === 'tonight' || trajectory)) { stopped = true; ac.abort(); break; }
            }
          } catch (e) {
            if (!stopped) console.error(`[plan] live call failed: ${(e as Error).name}`);
          } finally {
            clearTimeout(firstTimer);
            clearTimeout(totalTimer);
          }
        }

        const source: 'live' | 'fallback' = live >= ctx.min ? 'live' : 'fallback';
        if (source === 'fallback') await replay();
        await topUp();
        finish(source);
      } catch (e) {
        console.error(`[plan] failed: ${(e as Error).name}`);
        if (!finished) {
          await replay();
          await topUp();
          finish('fallback');
        }
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
  return new Response(stream, { headers: HEADERS });
}
