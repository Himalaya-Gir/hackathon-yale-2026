// POST /api/plan (PLAN.md §7.3): code pre-filters → Grok picks and explains (streamed) → code validates and adds the facts.
// Safety nets, in order: recorded fallback (public/data/fallback), then a deterministic code-only answer.
// URL flags: ?demo=1 forces the recorded fallback; ?live=1 (bake script) forbids it. Body `now` freezes time.
import eventsJson from '@/public/data/events.json';
import friendsJson from '@/public/data/friends.json';
import profileJson from '@/public/data/profile.json';
import statsJson from '@/public/data/stats.json';
import { FALLBACKS } from '@/public/data/fallback';
import { fastModel, grokLines, parseGrokLine, type RawPick } from '@/lib/grok';
import { allowedMechanisms, codeInvite, codeOnlyPicks, codeTrajectory, friendLine, friendsGoing, goalSlug, preselect, validPick } from '@/lib/match';
import { systemPrompt, userPrompt } from '@/lib/prompts';
import { fit } from '@/lib/schedule';
import { nyParts, parseNow, redateAll } from '@/lib/time';
import { MOODS } from '@/lib/types';
import type { Contact, Friend, Mode, Mood, Pick as OrbitPick, PlanEvent, PlanRequest, Profile, Stats, YaleEvent } from '@/lib/types';

export const maxDuration = 60;

const FIRST_PICK_MS = 6000;   // no first pick after this → fallback
const TOTAL_MS = 22000;       // hard stop of the live call
const REPLAY_MS = 350;        // rhythm of a replayed answer

type Ctx = {
  mode: Mode; goal: string; mood: Mood; ref: Date; profile: Profile;
  going: Map<string, string[]>; pool: YaleEvent[]; byId: Map<string, YaleEvent>;
  want: number; min: number;
};
type State = { used: Set<string>; mech: Set<string>; contacts: Map<string, number> };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sp = cut.lastIndexOf(' ');
  return `${(sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.–-]+$/, '')}…`;
}

/** An invite that states a clock time must state the event's real start time. */
function inviteTimeOk(invite: string, event: YaleEvent): boolean {
  const p = nyParts(new Date(event.start));
  const found = [...invite.matchAll(/\b(\d{1,2})(?::(\d\d))?\s*(a\.?m\.?|p\.?m\.?)/gi)];
  if (found.length === 0) return true;
  return found.some((m) => {
    let h = Number(m[1]) % 12;
    if (m[3].toLowerCase().startsWith('p')) h += 12;
    return h === p.hh && Number(m[2] ?? 0) === p.mm;
  });
}

/** Grok chooses, code asserts: returns a full pick, or null if the line must be dropped. */
function finalize(raw: RawPick, ctx: Ctx, st: State): OrbitPick | null {
  const event = ctx.byId.get(raw.eventId);
  if (!event || st.used.has(event.id)) return null;

  let lane: OrbitPick['lane'] = 'build';
  let mechanismId: string | null = null;
  if (ctx.mode === 'tonight') {
    lane = raw.lane === 'both' ? 'both' : 'feel';
    mechanismId = raw.mechanismId;
    const allowed = allowedMechanisms(event, ctx.mood);
    if (!mechanismId || !allowed.includes(mechanismId)) return null;
    if (st.mech.has(mechanismId)) {
      const other = allowed.find((id) => !st.mech.has(id) && id !== 'activation') ?? allowed.find((id) => !st.mech.has(id));
      if (other) mechanismId = other;
    }
  }
  if (!validPick({ lane, mechanismId }, event, ctx.mode, ctx.mood)) return null;

  let contact: Contact | null = ctx.profile.contacts.find((c) => c.id === raw.withContactId) ?? null;
  let own = Boolean(contact);
  if (contact && (st.contacts.get(contact.id) ?? 0) >= 2) { contact = null; own = false; }
  if (!contact && ctx.mode === 'tonight' && (ctx.mood === 'sad' || ctx.mood === 'lonely')) {
    const ordered = [...ctx.profile.contacts.filter((c) => c.relation === 'new'), ...ctx.profile.contacts.filter((c) => c.relation !== 'new')];
    contact = ordered.sort((a, b) => (st.contacts.get(a.id) ?? 0) - (st.contacts.get(b.id) ?? 0))[0] ?? null;
    own = false;
  }
  const first = contact?.name.split(' ')[0];

  st.used.add(event.id);
  if (mechanismId) st.mech.add(mechanismId);
  if (contact) st.contacts.set(contact.id, (st.contacts.get(contact.id) ?? 0) + 1);

  return {
    eventId: event.id,
    score: Math.max(0, Math.min(100, Math.round(raw.score))),
    lane,
    mechanismId,
    why: clip(raw.why, 120),
    friendLine: friendLine(ctx.going.get(event.id)),
    withContactId: contact?.id ?? null,
    withWhy: contact ? (own && raw.withWhy ? clip(raw.withWhy, 90) : `${first} is into ${contact.interests[0] ?? 'this'}.`) : null,
    invite: contact ? (own && raw.invite && inviteTimeOk(raw.invite, event) ? clip(raw.invite, 230) : codeInvite(contact, event, ctx.ref)) : null,
    ...fit(event, ctx.profile),
  };
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const demo = url.searchParams.get('demo') === '1';
  const forceLive = url.searchParams.get('live') === '1';
  const body = (await request.json().catch(() => ({}))) as Partial<PlanRequest>;

  const profile = profileJson as unknown as Profile;
  const friends = (friendsJson as unknown as Friend[]) ?? [];
  const stats = statsJson as unknown as Stats;
  const mode: Mode = body.mode === 'tonight' ? 'tonight' : 'week';
  const mood: Mood = MOODS.includes(body.mood as Mood) ? (body.mood as Mood) : 'stressed';
  const goal = (typeof body.goal === 'string' && body.goal.trim() ? body.goal.trim() : profile.defaultGoal).slice(0, 200);
  const ref = parseNow(typeof body.now === 'string' ? body.now : undefined);

  const events = redateAll((eventsJson as unknown as YaleEvent[]) ?? [], ref);
  const going = friendsGoing(friends);
  const pool = preselect(mode, events, ref, profile, mood);
  const ctx: Ctx = {
    mode, goal, mood, ref, profile, going, pool, byId: new Map(pool.map((e) => [e.id, e])),
    want: mode === 'week' ? 6 : 3, min: mode === 'week' ? 4 : 2,
  };
  const st: State = { used: new Set(), mech: new Set(), contacts: new Map() };
  const useLive = !demo && Boolean(process.env.XAI_API_KEY) && pool.length > 0;
  const recorded = FALLBACKS[mode === 'week' ? `week-${goalSlug(goal)}` : `tonight-${mood}`];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: PlanEvent) => { try { controller.enqueue(encoder.encode(JSON.stringify(e) + '\n')); } catch { /* client left */ } };
      let count = 0;
      const sendPick = (pick: OrbitPick | null) => { if (pick && count < ctx.want) { send({ type: 'pick', pick }); count++; return true; } return false; };
      const t0 = Date.now();

      try {
        send({ type: 'status', text: 'Initializing events…' });
        if (!useLive) await sleep(REPLAY_MS);
        const friendCount = friends.filter((f) => f.status === 'friend').length;
        if (mode === 'week') {
          send({ type: 'status', text: `${Math.max(stats.total, events.length)} events · this week · ${profile.courses.length} courses · ${friendCount} friends` });
          if (!useLive) await sleep(REPLAY_MS);
          send({ type: 'status', text: `Matching against "${goal}"` });
        } else {
          send({ type: 'status', text: `${pool.length} things you could do in the next 48 hours` });
        }
        if (!useLive) await sleep(REPLAY_MS);

        // 1. Live Grok, streamed pick by pick.
        let live = 0;
        let trajectory: string | null = null;
        if (useLive) {
          const ac = new AbortController();
          const firstTimer = setTimeout(() => { if (live === 0) ac.abort(); }, forceLive ? 15000 : FIRST_PICK_MS);
          const totalTimer = setTimeout(() => ac.abort(), forceLive ? 40000 : TOTAL_MS);
          try {
            const lines = grokLines({ model: fastModel(), system: systemPrompt(mode, profile), user: userPrompt({ mode, goal, mood, ref, pool, going }), signal: ac.signal });
            for await (const line of lines) {
              const parsed = parseGrokLine(line);
              if (parsed?.kind === 'trajectory') trajectory = clip(parsed.text, 170);
              if (parsed?.kind === 'pick' && sendPick(finalize(parsed.pick, ctx, st))) {
                live++;
                if (live === 1) console.log(`[plan] ${mode} first pick ${Date.now() - t0} ms`);
              }
              if (live >= ctx.want && (mode === 'tonight' || trajectory)) break;
            }
          } catch (e) {
            console.error(`[plan] live call failed: ${(e as Error).name}`);
          } finally {
            clearTimeout(firstTimer);
            clearTimeout(totalTimer);
          }
        }
        const source: 'live' | 'fallback' = live >= ctx.min ? 'live' : 'fallback';

        if (!forceLive) {
          // 2. Recorded answer (ids that no longer exist or are no longer valid are dropped by finalize).
          if (source === 'fallback' && recorded?.picks?.length) {
            for (const p of recorded.picks) {
              if (count >= ctx.want) break;
              if (sendPick(finalize({ ...p, lane: p.lane, score: p.score ?? 80 }, ctx, st))) await sleep(REPLAY_MS);
            }
          }
          // 3. Code-only top-up so the user always gets the full set when enough valid events exist.
          if (count < ctx.want) {
            const extra = codeOnlyPicks({ mode, pool, goal, mood, profile, going, ref, want: ctx.want - count, exclude: st.used, usedMechanisms: st.mech });
            for (const p of extra) {
              if (sendPick(finalize(p, ctx, st))) await sleep(source === 'fallback' ? REPLAY_MS : 120);
            }
          }
        }

        if (mode === 'week') {
          const text = trajectory ?? (forceLive ? null : (source === 'fallback' && recorded?.trajectory) || codeTrajectory(goal));
          if (text) send({ type: 'trajectory', text });
        }
        console.log(`[plan] ${mode} ${source} · ${count} picks (${live} live) · ${Date.now() - t0} ms`);
        send({ type: 'done', source });
      } catch (e) {
        console.error(`[plan] failed: ${(e as Error).message}`);
        send({ type: 'error', message: 'Orbit could not build a plan. Try again.' });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' } });
}
